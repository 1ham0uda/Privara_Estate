'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { callService } from '@/src/lib/callService';
import { chatService } from '@/src/lib/db';
import { auth } from '@/src/lib/firebase';
import { CallIceCandidate, CallSession, ConsultationCase, UserProfile } from '@/src/types';
import { toast } from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────

const CALL_TIMEOUT_MS = 45_000;
const ICE_CONNECT_TIMEOUT_MS = 12_000; // escalate to restart after this
const ICE_RESTART_MAX_ATTEMPTS = 3;
const TERMINAL_STATUSES = new Set(['declined', 'ended', 'missed']);

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: DEFAULT_ICE_SERVERS,
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

// ─── Structured logger ────────────────────────────────────────────────────────

const rtcLog = {
  debug: (scope: string, msg: string, data?: unknown) =>
    data !== undefined
      ? console.debug(`[RTC:${scope}]`, msg, data)
      : console.debug(`[RTC:${scope}]`, msg),
  info: (scope: string, msg: string, data?: unknown) =>
    data !== undefined
      ? console.info(`[RTC:${scope}]`, msg, data)
      : console.info(`[RTC:${scope}]`, msg),
  warn: (scope: string, msg: string, data?: unknown) =>
    data !== undefined
      ? console.warn(`[RTC:${scope}]`, msg, data)
      : console.warn(`[RTC:${scope}]`, msg),
  error: (scope: string, msg: string, data?: unknown) =>
    data !== undefined
      ? console.error(`[RTC:${scope}]`, msg, data)
      : console.error(`[RTC:${scope}]`, msg),
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseWebRTCCallOptions {
  profile: UserProfile | null;
  consultation: ConsultationCase | null;
  caseId: string | string[] | undefined;
  canOpenCall: boolean;
  isConsultantRecorder: boolean;
  t: (key: string) => string;
}

export interface UseWebRTCCallReturn {
  // ── State ──
  activeCall: CallSession | null;
  showCallPanel: boolean;
  setShowCallPanel: (v: boolean) => void;
  callElapsed: number;
  isMuted: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  callBusy: boolean;
  remoteHasVideo: boolean;
  isIncomingCall: boolean;
  isLiveCall: boolean;
  isCallInitiator: boolean;
  canScreenShare: boolean;
  isRemoteVideoFullscreen: boolean;
  // ── Media element refs (owned here, passed to DOM) ──
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  localAudioRef: React.RefObject<HTMLAudioElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoFallbackRef: React.RefObject<HTMLVideoElement | null>;
  localVideoFallbackRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoContainerRef: React.RefObject<HTMLDivElement | null>;
  // ── Stream refs (for recording) ──
  localStreamRef: React.RefObject<MediaStream | null>;
  remoteStreamRef: React.RefObject<MediaStream | null>;
  // ── Actions ──
  handleStartCall: () => Promise<void>;
  handleAcceptCall: () => Promise<void>;
  handleDeclineCall: () => Promise<void>;
  handleEndCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  toggleRemoteVideoFullscreen: () => Promise<void>;
  // ── Recording integration ──
  /** Set this ref to a function that page.tsx will call when a remote track arrives (to start recording). */
  onRemoteTrackAttachedRef: React.MutableRefObject<() => void>;
  mediaMixRef: React.RefObject<{
    audioContext: AudioContext;
    destination: MediaStreamAudioDestinationNode;
    remoteSource: MediaStreamAudioSourceNode | null;
  } | null>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebRTCCall({
  profile,
  consultation,
  caseId,
  canOpenCall,
  isConsultantRecorder,
  t,
}: UseWebRTCCallOptions): UseWebRTCCallReturn {

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [showCallPanel, setShowCallPanel] = useState(false);
  const [callElapsed, setCallElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [callBusy, setCallBusy] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [isRemoteVideoFullscreen, setIsRemoteVideoFullscreen] = useState(false);

  // ── Media element refs ────────────────────────────────────────────────────
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoFallbackRef = useRef<HTMLVideoElement | null>(null);
  const localVideoFallbackRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoContainerRef = useRef<HTMLDivElement | null>(null);

  // ── WebRTC core refs ──────────────────────────────────────────────────────
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // ── Signaling state (Perfect Negotiation) ────────────────────────────────
  /**
   * True when the caller (impolite peer) is mid-offer creation.
   * Guards against re-entrant onnegotiationneeded and duplicate offers.
   */
  const makingOfferRef = useRef(false);
  /**
   * Set to true when an ICE restart is specifically needed (failure/disconnect).
   * Prevents iceRestart: true on normal track renegotiations.
   */
  const iceRestartNeededRef = useRef(false);
  /** SDP of the last offer we've applied as remote description (callee) or sent (caller). */
  const lastAppliedOfferSdpRef = useRef<string | null>(null);
  /** SDP of the last answer we've applied (caller) or sent (callee). */
  const lastAppliedAnswerSdpRef = useRef<string | null>(null);
  /** Whether we're the call initiator — determined once per call session. */
  const isInitiatorRef = useRef<boolean | null>(null);
  /** Tracks the active call ID to detect session boundaries and reset state. */
  const activeCallIdRef = useRef<string | null>(null);

  // ── ICE candidate pipeline ────────────────────────────────────────────────
  const pendingCandidatesRef = useRef<CallIceCandidate[]>([]);
  const remoteCandidateIdsRef = useRef<Set<string>>(new Set());

  // ── ICE health monitoring ─────────────────────────────────────────────────
  const iceConnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iceRestartAttemptsRef = useRef(0);

  // ── Timers ────────────────────────────────────────────────────────────────
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Audio playback ────────────────────────────────────────────────────────
  const remotePlaybackContextRef = useRef<AudioContext | null>(null);
  const remotePlaybackSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // ── Recording support (managed externally, needs mix ref) ─────────────────
  const mediaMixRef = useRef<{
    audioContext: AudioContext;
    destination: MediaStreamAudioDestinationNode;
    remoteSource: MediaStreamAudioSourceNode | null;
  } | null>(null);
  const onRemoteTrackAttachedRef = useRef<() => void>(() => {});

  // ── Configuration ─────────────────────────────────────────────────────────
  const rtcConfigRef = useRef<RTCConfiguration>(DEFAULT_RTC_CONFIG);

  // ── Tracking ──────────────────────────────────────────────────────────────
  const finalizedCallStatusesRef = useRef<Map<string, string>>(new Map());

  // ── Derived state (stable derivations) ───────────────────────────────────
  const canScreenShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof (navigator.mediaDevices as MediaDevices & { getDisplayMedia?: unknown }).getDisplayMedia === 'function';

  const isCallInitiator = Boolean(
    activeCall && profile && activeCall.initiatedBy === profile.uid
  );
  const isIncomingCall = Boolean(
    activeCall && profile &&
    activeCall.status === 'ringing' &&
    activeCall.initiatedBy !== profile.uid
  );
  const isLiveCall = activeCall?.status === 'active';

  // ─── ICE server loading ───────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    auth.currentUser?.getIdToken().then((token) =>
      fetch('/api/ice-servers', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.iceServers) {
            rtcConfigRef.current = {
              ...DEFAULT_RTC_CONFIG,
              iceServers: data.iceServers,
            };
            rtcLog.info('config', 'ICE servers loaded', {
              count: (data.iceServers as RTCIceServer[]).length,
            });
          }
        })
        .catch((e) => rtcLog.warn('config', 'Failed to load ICE servers', e))
    );
  }, [profile]);

  // ─── Call subscription ────────────────────────────────────────────────────
  useEffect(() => {
    if (!caseId || !profile || !canOpenCall) return;
    const id = typeof caseId === 'string' ? caseId : caseId[0];
    const unsub = callService.subscribeToLatestCall(id, (call) => {
      setActiveCall(call);
      setCallBusy(Boolean(call && !TERMINAL_STATUSES.has(call.status)));
      if (call && !TERMINAL_STATUSES.has(call.status)) setShowCallPanel(true);
      if (!call) setCallBusy(false);
    });
    return unsub;
  }, [caseId, profile, canOpenCall]);

  // ─── Fullscreen change tracking ───────────────────────────────────────────
  useEffect(() => {
    const handler = () =>
      setIsRemoteVideoFullscreen(
        document.fullscreenElement === remoteVideoContainerRef.current
      );
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  const clearCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const clearIceConnectTimeout = useCallback(() => {
    if (iceConnectTimeoutRef.current) {
      clearTimeout(iceConnectTimeoutRef.current);
      iceConnectTimeoutRef.current = null;
    }
  }, []);

  const stopRemotePlayback = useCallback(() => {
    if (remotePlaybackSourceRef.current) {
      try { remotePlaybackSourceRef.current.disconnect(); } catch { /* ignore */ }
      remotePlaybackSourceRef.current = null;
    }
    if (remotePlaybackContextRef.current) {
      remotePlaybackContextRef.current.close().catch(() => undefined);
      remotePlaybackContextRef.current = null;
    }
  }, []);

  const resetSignalingState = useCallback(() => {
    makingOfferRef.current = false;
    iceRestartNeededRef.current = false;
    lastAppliedOfferSdpRef.current = null;
    lastAppliedAnswerSdpRef.current = null;
    pendingCandidatesRef.current = [];
    remoteCandidateIdsRef.current = new Set();
    iceConnectTimeoutRef.current && clearTimeout(iceConnectTimeoutRef.current);
    iceConnectTimeoutRef.current = null;
    iceRestartAttemptsRef.current = 0;
  }, []);

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  const cleanupCallMedia = useCallback(
    ({ preservePanel = false }: { preservePanel?: boolean } = {}) => {
      rtcLog.info('lifecycle', 'Cleaning up call media', { preservePanel });

      clearCallTimeout();
      clearCallTimer();
      clearIceConnectTimeout();

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.onnegotiationneeded = null;
        peerConnectionRef.current.oniceconnectionstatechange = null;
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.onicecandidateerror = null;
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Stop local streams
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      // Remote stream tracks are owned by the remote peer — just null the ref
      remoteStreamRef.current = null;

      // Detach media elements
      [remoteAudioRef, localAudioRef].forEach((ref) => {
        if (ref.current) {
          ref.current.pause();
          ref.current.srcObject = null;
          ref.current.onloadedmetadata = null;
        }
      });
      [remoteVideoRef, remoteVideoFallbackRef, localVideoRef, localVideoFallbackRef].forEach((ref) => {
        if (ref.current) {
          ref.current.pause();
          ref.current.srcObject = null;
        }
      });

      // Audio mix (recording)
      if (mediaMixRef.current) {
        mediaMixRef.current.audioContext.close().catch(() => undefined);
        mediaMixRef.current = null;
      }

      stopRemotePlayback();
      resetSignalingState();
      isInitiatorRef.current = null;
      activeCallIdRef.current = null;

      if (!preservePanel) setShowCallPanel(false);
      setIsMuted(false);
      setVideoEnabled(false);
      setScreenSharing(false);
      setRemoteHasVideo(false);
      setCallElapsed(0);
    },
    [clearCallTimeout, clearCallTimer, clearIceConnectTimeout, stopRemotePlayback, resetSignalingState]
  );

  // ─── Unmount cleanup ──────────────────────────────────────────────────────
  useEffect(() => () => { cleanupCallMedia(); }, [cleanupCallMedia]);

  // ─── ICE candidate pipeline ───────────────────────────────────────────────

  const flushPendingCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || pendingCandidatesRef.current.length === 0) return;
    rtcLog.debug('ice', `Flushing ${pendingCandidatesRef.current.length} queued candidates`);
    const queue = pendingCandidatesRef.current.splice(0);
    for (const c of queue) {
      try {
        await pc.addIceCandidate(
          new RTCIceCandidate({ candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex })
        );
      } catch (e) {
        rtcLog.debug('ice', 'Queued candidate rejected (harmless)', e);
      }
    }
  }, []);

  const addOrQueueCandidate = useCallback(
    async (c: CallIceCandidate) => {
      if (remoteCandidateIdsRef.current.has(c.id)) return;
      remoteCandidateIdsRef.current.add(c.id);

      const pc = peerConnectionRef.current;
      if (!pc || pc.signalingState === 'closed') return;

      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(
            new RTCIceCandidate({ candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex })
          );
          rtcLog.debug('ice', 'addIceCandidate OK', c.candidate.slice(0, 60));
        } catch (e) {
          // Candidate may be stale after ICE restart — queue it as fallback
          rtcLog.debug('ice', 'addIceCandidate failed, queuing', e);
          pendingCandidatesRef.current.push(c);
        }
      } else {
        rtcLog.debug('ice', 'No remote description yet — queuing candidate');
        pendingCandidatesRef.current.push(c);
      }
    },
    []
  );

  // ─── Remote audio/video attachment ────────────────────────────────────────

  const ensureRemotePlaybackContext = useCallback(async () => {
    try {
      if (!remotePlaybackContextRef.current) {
        remotePlaybackContextRef.current = new AudioContext();
      }
      if (remotePlaybackContextRef.current.state === 'suspended') {
        await remotePlaybackContextRef.current.resume();
      }
      return remotePlaybackContextRef.current;
    } catch (e) {
      rtcLog.error('audio', 'Failed to init playback context', e);
      return null;
    }
  }, []);

  const attachRemoteStream = useCallback(async (event: RTCTrackEvent) => {
    const incomingStream = event.streams?.[0] ?? null;
    const prevStream = remoteStreamRef.current;

    if (incomingStream) {
      remoteStreamRef.current = incomingStream;
    } else {
      if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
      if (!remoteStreamRef.current.getTracks().some((t) => t.id === event.track.id)) {
        remoteStreamRef.current.addTrack(event.track);
      }
    }

    const remoteStream = remoteStreamRef.current;
    rtcLog.info('media', 'Remote track attached', {
      kind: event.track.kind,
      streamId: remoteStream.id,
    });

    // Reconnect recording mix if stream object changed
    const mix = mediaMixRef.current;
    if (mix && remoteStream !== prevStream) {
      try { mix.remoteSource?.disconnect(); } catch { /* ignore */ }
      const newSrc = mix.audioContext.createMediaStreamSource(remoteStream);
      newSrc.connect(mix.destination);
      mediaMixRef.current = { ...mix, remoteSource: newSrc };
    }

    // Video tracks
    if (remoteStream.getVideoTracks().length > 0) {
      remoteStream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (!remoteStreamRef.current?.getVideoTracks().some((t) => t.readyState === 'live')) {
            setRemoteHasVideo(false);
          }
        };
      });
      // setRemoteHasVideo triggers a React re-render that mounts the <video> element.
      // The video refs are null until after that render, so attachment is deferred
      // to a useEffect that fires once the element is in the DOM.
      setRemoteHasVideo(true);
    }

    // Audio playback via Web Audio (avoids autoplay policy issues)
    const ctx = await ensureRemotePlaybackContext();
    if (ctx) {
      try { remotePlaybackSourceRef.current?.disconnect(); } catch { /* ignore */ }
      remotePlaybackSourceRef.current = null;
      const src = ctx.createMediaStreamSource(remoteStream);
      src.connect(ctx.destination);
      remotePlaybackSourceRef.current = src;
    }

    // Fallback: HTMLAudioElement
    const audioEl = remoteAudioRef.current;
    if (audioEl) {
      audioEl.autoplay = true;
      audioEl.muted = false;
      audioEl.volume = 1;
      audioEl.srcObject = remoteStream;
      const play = async () => {
        try { await audioEl.play(); }
        catch (e) {
          rtcLog.error('audio', 'Remote audio play() failed', e);
          toast.error(t('call.playback_failed'));
        }
      };
      audioEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        ? await play()
        : (audioEl.onloadedmetadata = () => void play());
    }

    // Notify recording hook
    onRemoteTrackAttachedRef.current();
  }, [ensureRemotePlaybackContext, t]);

  // ─── Attach remote video stream once the <video> element is mounted ───────
  // The <video> element is conditionally rendered only after remoteHasVideo
  // flips to true. At the time ontrack fires, the element doesn't exist yet,
  // so we re-attach here after React commits the render.
  useEffect(() => {
    if (!remoteHasVideo) return;
    const stream = remoteStreamRef.current;
    if (!stream) return;
    [remoteVideoRef.current, remoteVideoFallbackRef.current].forEach((el) => {
      if (!el || el.srcObject === stream) return;
      el.srcObject = stream;
      el.play().catch(() => {});
    });
  }, [remoteHasVideo]);

  // ─── ICE health monitoring & restart ─────────────────────────────────────

  const triggerIceRestart = useCallback((callId: string) => {
    const pc = peerConnectionRef.current;
    if (!pc || pc.signalingState === 'closed') return;
    if (iceRestartAttemptsRef.current >= ICE_RESTART_MAX_ATTEMPTS) {
      rtcLog.warn('ice', 'Max ICE restart attempts reached');
      return;
    }

    const attempt = ++iceRestartAttemptsRef.current;
    const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
    rtcLog.info('ice', `ICE restart attempt ${attempt} in ${delay}ms`);

    setTimeout(() => {
      if (!peerConnectionRef.current || peerConnectionRef.current.signalingState === 'closed') return;
      iceRestartNeededRef.current = true;
      peerConnectionRef.current.restartIce();
      // restartIce() triggers onnegotiationneeded on the caller side which reads iceRestartNeededRef
    }, delay);
  }, []);

  // ─── Build peer connection ────────────────────────────────────────────────

  const buildPeerConnection = useCallback(
    async (callId: string, isInitiator: boolean, localStream: MediaStream) => {
      // Safety: close any existing connection first
      if (peerConnectionRef.current) {
        rtcLog.warn('lifecycle', 'Closing existing PC before creating new one');
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      rtcLog.info('lifecycle', 'Creating RTCPeerConnection', {
        callId,
        role: isInitiator ? 'caller' : 'callee',
        iceServers: rtcConfigRef.current.iceServers,
      });

      const pc = new RTCPeerConnection(rtcConfigRef.current);
      peerConnectionRef.current = pc;

      // Add local audio tracks
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
        pc.addTrack(track, localStream);
        rtcLog.debug('media', 'Added local audio track', track.id);
      });

      // ── Remote track handler ──
      pc.ontrack = (event) => {
        rtcLog.debug('media', 'ontrack fired', { kind: event.track.kind });
        void attachRemoteStream(event);
      };

      // ── ICE candidate collection ──
      const candidateRole: 'caller' | 'callee' = isInitiator ? 'caller' : 'callee';
      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          rtcLog.debug('ice', 'ICE gathering complete');
          return;
        }
        rtcLog.debug('ice', 'Generated local candidate', event.candidate.type);
        callService.addIceCandidate(callId, candidateRole, event.candidate).catch(
          (e) => rtcLog.warn('ice', 'Failed to save ICE candidate', e)
        );
      };

      // ── ICE error logging ──
      const iceErrorLog: Array<{ code: number; text: string; url: string }> = [];
      pc.onicecandidateerror = (event) => {
        const e = event as RTCPeerConnectionIceErrorEvent;
        const entry = { code: e.errorCode ?? 0, text: e.errorText ?? '', url: e.url ?? '' };
        iceErrorLog.push(entry);
        rtcLog.debug('ice', 'Gather error (non-fatal)', entry);
      };

      // ── ICE connection state ──
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        rtcLog.info('ice', `iceConnectionState → ${state}`);

        switch (state) {
          case 'checking':
            // Start a watchdog: if we don't reach connected within ICE_CONNECT_TIMEOUT_MS, restart
            clearIceConnectTimeout();
            iceConnectTimeoutRef.current = setTimeout(() => {
              if (peerConnectionRef.current?.iceConnectionState === 'checking') {
                rtcLog.warn('ice', 'ICE checking timeout — triggering restart');
                triggerIceRestart(callId);
              }
            }, ICE_CONNECT_TIMEOUT_MS);
            break;

          case 'connected':
          case 'completed':
            clearIceConnectTimeout();
            iceRestartAttemptsRef.current = 0; // reset backoff on success
            iceErrorLog.length = 0;
            rtcLog.info('ice', 'ICE connected — call is live');
            break;

          case 'disconnected':
            rtcLog.warn('ice', 'ICE disconnected — scheduling restart');
            triggerIceRestart(callId);
            break;

          case 'failed':
            clearIceConnectTimeout();
            if (iceErrorLog.length > 0) {
              rtcLog.warn('ice', 'ICE gather errors that contributed to failure', iceErrorLog);
              iceErrorLog.length = 0;
            }
            rtcLog.error('ice', 'ICE failed');
            toast.error(t('call.connection_failed'));
            triggerIceRestart(callId);
            break;
        }
      };

      // ── Connection state ──
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        rtcLog.info('conn', `connectionState → ${state}`);
        if (state === 'failed') {
          rtcLog.error('conn', 'Peer connection failed');
          toast.error(t('call.connection_failed'));
        }
      };

      // ── Signaling state (diagnostic only) ──
      pc.onsignalingstatechange = () => {
        rtcLog.debug('signaling', `signalingState → ${pc.signalingState}`);
      };

      // ── onnegotiationneeded — CALLER (impolite peer) ONLY ──────────────────
      // Rule: only the caller ever creates offers. Callee uses requestRenegotiation()
      // to ask the caller to create one. This eliminates glare entirely.
      if (isInitiator) {
        pc.onnegotiationneeded = async () => {
          if (makingOfferRef.current) {
            rtcLog.debug('signaling', 'onnegotiationneeded skipped — already making offer');
            return;
          }
          // Skip the very first negotiation (no remote description yet) —
          // handleStartCall drives that explicitly.
          if (!pc.currentRemoteDescription) {
            rtcLog.debug('signaling', 'onnegotiationneeded skipped — no remote description yet');
            return;
          }
          if (pc.signalingState !== 'stable') {
            rtcLog.debug('signaling', `onnegotiationneeded skipped — state is ${pc.signalingState}`);
            return;
          }

          const iceRestart = iceRestartNeededRef.current;
          iceRestartNeededRef.current = false;
          makingOfferRef.current = true;
          rtcLog.info('signaling', `onnegotiationneeded fired${iceRestart ? ' (ICE restart)' : ''}`);

          try {
            const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
            if (pc.signalingState !== 'stable') {
              rtcLog.warn('signaling', 'State changed while creating offer — aborting');
              return;
            }
            await pc.setLocalDescription(offer);
            rtcLog.info('signaling', 'Offer created and set as local description');
            await callService.saveOffer(callId, offer);
            lastAppliedOfferSdpRef.current = offer.sdp ?? null;
          } catch (e) {
            rtcLog.error('signaling', 'Failed to create/send offer in onnegotiationneeded', e);
          } finally {
            makingOfferRef.current = false;
          }
        };
      }

      return pc;
    },
    [attachRemoteStream, clearIceConnectTimeout, t, triggerIceRestart]
  );

  // ─── ICE candidate subscription ───────────────────────────────────────────
  // Subscribe once per call ID. Re-runs only when the call ID changes (not on
  // every render like the old effect which also depended on isCallInitiator).
  useEffect(() => {
    if (!activeCall?.id || !canOpenCall) return;
    if (!profile) return;

    const callId = activeCall.id;
    const initiator = activeCall.initiatedBy === profile.uid;
    // Each peer listens to the OTHER peer's candidates
    const sourceRole: 'caller' | 'callee' = initiator ? 'callee' : 'caller';

    rtcLog.info('ice', `Subscribing to ${sourceRole} candidates for call ${callId}`);

    const unsub = callService.subscribeToIceCandidates(callId, sourceRole, async (candidates) => {
      for (const c of candidates) {
        await addOrQueueCandidate(c);
      }
    });

    return () => {
      rtcLog.debug('ice', `Unsubscribing from ${sourceRole} candidates`);
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.id, canOpenCall, profile?.uid]);

  // ─── Main signaling loop ──────────────────────────────────────────────────
  // Processes Firestore signal updates (offer/answer/renegotiation/status).
  // Perfect Negotiation rules:
  //   - Caller (impolite): only applies answers; handles renegotiation requests; never rolls back.
  //   - Callee (polite): only applies offers and creates answers; requests renegotiation via Firestore.
  useEffect(() => {
    if (!activeCall || !profile || !canOpenCall) return;

    const callId = activeCall.id;
    const pc = peerConnectionRef.current;

    // Determine and cache initiator role for this call session
    if (activeCallIdRef.current !== callId) {
      activeCallIdRef.current = callId;
      isInitiatorRef.current = activeCall.initiatedBy === profile.uid;
      resetSignalingState();
      rtcLog.info('lifecycle', `New call session ${callId}`, {
        role: isInitiatorRef.current ? 'caller' : 'callee',
      });
    }

    const isInitiator = isInitiatorRef.current;

    // ── CALLER: apply remote answer (initial connect + ICE restart renegotiation) ──
    if (
      isInitiator &&
      pc &&
      pc.signalingState !== 'closed' &&
      activeCall.answer?.sdp &&
      activeCall.answer.sdp !== lastAppliedAnswerSdpRef.current &&
      // Guard: don't apply an answer we generated ourselves
      activeCall.answer.sdp !== pc.localDescription?.sdp
    ) {
      const answerSdp = activeCall.answer.sdp;
      lastAppliedAnswerSdpRef.current = answerSdp;
      rtcLog.info('signaling', 'Caller applying remote answer');

      pc.setRemoteDescription(new RTCSessionDescription(activeCall.answer as RTCSessionDescriptionInit))
        .then(() => {
          rtcLog.info('signaling', 'Remote answer applied — flushing candidates');
          return flushPendingCandidates();
        })
        .catch((e) => rtcLog.error('signaling', 'setRemoteDescription(answer) failed', e));
    }

    // ── CALLER: handle callee's renegotiation request ──
    // Callee set renegotiationRequest — caller creates a new offer atomically,
    // clearing the request in the same Firestore write.
    if (
      isInitiator &&
      pc &&
      activeCall.renegotiationRequest &&
      !makingOfferRef.current &&
      pc.signalingState === 'stable'
    ) {
      const reason = activeCall.renegotiationRequest.reason;
      rtcLog.info('signaling', `Caller handling renegotiation request: ${reason}`);
      makingOfferRef.current = true;

      (async () => {
        try {
          const offer = await pc.createOffer();
          if (pc.signalingState !== 'stable') {
            rtcLog.warn('signaling', 'State changed while creating renegotiation offer — aborting');
            return;
          }
          await pc.setLocalDescription(offer);
          await callService.saveOfferAndClearRenegotiation(callId, offer);
          lastAppliedOfferSdpRef.current = offer.sdp ?? null;
          rtcLog.info('signaling', 'Renegotiation offer sent and request cleared');
        } catch (e) {
          rtcLog.error('signaling', 'Renegotiation offer failed', e);
        } finally {
          makingOfferRef.current = false;
        }
      })();
    }

    // ── CALLEE: apply remote offer and create answer ──
    if (
      !isInitiator &&
      pc &&
      pc.signalingState !== 'closed' &&
      activeCall.offer?.sdp &&
      activeCall.offer.sdp !== lastAppliedOfferSdpRef.current &&
      // Guard: this is not an offer we created (should never happen with new arch, but safety check)
      activeCall.offer.sdp !== pc.localDescription?.sdp &&
      // Only apply in stable state; callee never makes offers so it should always be stable here
      pc.signalingState === 'stable'
    ) {
      const offerSdp = activeCall.offer.sdp;
      lastAppliedOfferSdpRef.current = offerSdp;
      const isRenegotiation = activeCall.status === 'active';
      rtcLog.info('signaling', `Callee applying remote offer${isRenegotiation ? ' (renegotiation)' : ' (initial)'}`);

      (async () => {
        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription(activeCall.offer as RTCSessionDescriptionInit)
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          lastAppliedAnswerSdpRef.current = answer.sdp ?? null;
          rtcLog.info('signaling', 'Callee answer created — saving');

          if (isRenegotiation) {
            // Mid-call renegotiation: preserve status/acceptedAt, only update answer field
            await callService.updateCall(callId, {
              answer: { type: 'answer', sdp: answer.sdp ?? '' },
            });
          } else {
            // Initial call accept: saveAnswer also sets status=active and acceptedAt
            await callService.saveAnswer(callId, answer);
          }

          await flushPendingCandidates();
          rtcLog.info('signaling', 'Callee answer exchange complete');
        } catch (e) {
          rtcLog.error('signaling', 'Callee offer-answer exchange failed', e);
        }
      })();
    }

    // ── Call status transitions ──
    if (activeCall.status === 'active') {
      clearCallTimeout();
      setShowCallPanel(true);
      if (!callTimerRef.current) {
        const startedAt =
          activeCall.acceptedAt?.toMillis?.() ??
          activeCall.createdAt?.toMillis?.() ??
          Date.now();
        setCallElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
        callTimerRef.current = setInterval(() => {
          setCallElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
        }, 1000);
      }
    }

    // ── Terminal status handling ──
    const prevStatus = finalizedCallStatusesRef.current.get(callId);
    if (TERMINAL_STATUSES.has(activeCall.status) && prevStatus !== activeCall.status) {
      finalizedCallStatusesRef.current.set(callId, activeCall.status);
      clearCallTimeout();
      clearCallTimer();
      rtcLog.info('lifecycle', `Call reached terminal status: ${activeCall.status}`);

      if (activeCall.status === 'declined' && activeCall.endedBy !== profile.uid) {
        toast.error(t('call.declined_remote'));
      }
      if (activeCall.status === 'ended' && activeCall.endedBy !== profile.uid) {
        toast.error(t('call.ended_remote'));
      }
      if (activeCall.status === 'missed') {
        toast.error(t('call.missed'));
      }

      cleanupCallMedia({ preservePanel: true });
    }
  }, [
    activeCall,
    canOpenCall,
    cleanupCallMedia,
    clearCallTimeout,
    clearCallTimer,
    flushPendingCandidates,
    profile,
    resetSignalingState,
    t,
  ]);

  // ─── Prepare local stream ─────────────────────────────────────────────────

  const prepareLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      await ensureRemotePlaybackContext();
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
        localAudioRef.current.muted = true;
        localAudioRef.current.volume = 0;
        localAudioRef.current.play().catch(() => undefined);
      }
      rtcLog.info('media', 'Local stream ready', {
        audioTracks: stream.getAudioTracks().length,
      });
      return stream;
    } catch (e) {
      rtcLog.error('media', 'getUserMedia failed', e);
      toast.error(t('call.microphone_failed'));
      throw new Error('microphone_failed');
    }
  }, [ensureRemotePlaybackContext, t]);

  // ─── Call actions ─────────────────────────────────────────────────────────

  const handleStartCall = useCallback(async () => {
    if (!profile || !consultation || !caseId) return;
    if (!consultation.consultantId) {
      toast.error(t('call.no_consultant'));
      return;
    }
    if (callBusy && activeCall && !TERMINAL_STATUSES.has(activeCall.status)) {
      toast.error(t('call.busy'));
      return;
    }

    rtcLog.info('lifecycle', 'Starting call');

    try {
      const localStream = await prepareLocalStream();
      const id = typeof caseId === 'string' ? caseId : caseId[0];

      const createdCallId = await callService.createCall(consultation, {
        uid: profile.uid,
        displayName: profile.displayName || profile.email || 'User',
        role: profile.role as 'client' | 'consultant',
      });

      setShowCallPanel(true);

      const pc = await buildPeerConnection(createdCallId, true, localStream);
      isInitiatorRef.current = true;
      activeCallIdRef.current = createdCallId;

      // Explicit initial offer — not driven by onnegotiationneeded
      rtcLog.info('signaling', 'Creating initial offer');
      makingOfferRef.current = true;
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        await callService.saveOffer(createdCallId, offer);
        lastAppliedOfferSdpRef.current = offer.sdp ?? null;
        rtcLog.info('signaling', 'Initial offer sent');
      } finally {
        makingOfferRef.current = false;
      }

      await chatService.sendMessage(
        consultation.id,
        profile.uid,
        profile.displayName || profile.email || t(`common.${profile.role}`),
        profile.role,
        `📞 ${t('call.outgoing_title')}`,
        consultation.clientId,
        consultation.consultantId,
        '',
        undefined,
        'call_log'
      );

      // Timeout: mark missed if callee doesn't answer
      clearCallTimeout();
      callTimeoutRef.current = setTimeout(async () => {
        const latest = await callService.getCall(createdCallId);
        if (latest?.status === 'ringing') {
          await callService.updateCall(createdCallId, {
            status: 'missed',
            endedAt: new Date() as any,
            endedBy: profile.uid,
          });
        }
      }, CALL_TIMEOUT_MS);
    } catch (e) {
      rtcLog.error('lifecycle', 'handleStartCall failed', e);
      cleanupCallMedia();
    }
  }, [
    profile, consultation, caseId, callBusy, activeCall,
    prepareLocalStream, buildPeerConnection, cleanupCallMedia, clearCallTimeout, t,
  ]);

  const handleAcceptCall = useCallback(async () => {
    if (!profile || !consultation || !activeCall?.offer) return;

    rtcLog.info('lifecycle', 'Accepting call');

    try {
      const localStream = await prepareLocalStream();
      setShowCallPanel(true);

      const pc = await buildPeerConnection(activeCall.id, false, localStream);
      isInitiatorRef.current = false;
      activeCallIdRef.current = activeCall.id;

      // Callee path: apply existing offer immediately
      rtcLog.info('signaling', 'Callee setting remote offer from accepted call');
      lastAppliedOfferSdpRef.current = activeCall.offer.sdp;

      await pc.setRemoteDescription(
        new RTCSessionDescription(activeCall.offer as RTCSessionDescriptionInit)
      );
      await flushPendingCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      lastAppliedAnswerSdpRef.current = answer.sdp ?? null;

      await callService.saveAnswer(activeCall.id, answer);
      clearCallTimeout();
      rtcLog.info('signaling', 'Callee answer sent');

      await chatService.sendMessage(
        consultation.id,
        profile.uid,
        profile.displayName || profile.email || t(`common.${profile.role}`),
        profile.role,
        `📞 ${t('call.status_active')}`,
        consultation.clientId,
        consultation.consultantId,
        '',
        undefined,
        'call_log'
      );
    } catch (e) {
      rtcLog.error('lifecycle', 'handleAcceptCall failed', e);
      cleanupCallMedia();
    }
  }, [
    profile, consultation, activeCall,
    prepareLocalStream, buildPeerConnection, flushPendingCandidates, cleanupCallMedia, clearCallTimeout, t,
  ]);

  const handleDeclineCall = useCallback(async () => {
    if (!profile || !activeCall) return;
    rtcLog.info('lifecycle', 'Declining call');
    await callService.updateCall(activeCall.id, {
      status: 'declined',
      endedAt: new Date() as any,
      endedBy: profile.uid,
    });
    cleanupCallMedia();
  }, [profile, activeCall, cleanupCallMedia]);

  const handleEndCall = useCallback(async () => {
    if (!profile || !activeCall) return;
    rtcLog.info('lifecycle', 'Ending call');
    await callService.updateCall(activeCall.id, {
      status: 'ended',
      endedAt: new Date() as any,
      endedBy: profile.uid,
    });
    cleanupCallMedia({ preservePanel: true });
  }, [profile, activeCall, cleanupCallMedia]);

  // ─── Media actions ────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !next));
    setIsMuted(next);
    rtcLog.debug('media', `Mute → ${next}`);
  }, [isMuted]);

  /**
   * Request a renegotiation from the callee side.
   * Caller handles it by creating a new offer; callee just writes to Firestore.
   */
  const requestRenegotiationAsCallee = useCallback(async (reason: string) => {
    const callId = activeCallIdRef.current;
    if (!callId) return;

    if (isInitiatorRef.current) {
      // We are the caller — trigger onnegotiationneeded locally (it guards itself)
      rtcLog.debug('signaling', 'Caller triggering local renegotiation');
      // addTrack/removeTrack already triggers onnegotiationneeded automatically
      // If we need a manual trigger (e.g. after replaceTrack), call restartIce()
    } else {
      // We are the callee — ask caller via Firestore
      rtcLog.info('signaling', `Callee requesting renegotiation: ${reason}`);
      await callService.requestRenegotiation(callId, reason);
    }
  }, []);

  const toggleVideo = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    if (videoEnabled) {
      // Remove video track
      const screenShareTrack = screenStreamRef.current?.getVideoTracks()[0];
      const senders = pc.getSenders().filter(
        (s) => s.track?.kind === 'video' && s.track !== screenShareTrack
      );
      senders.forEach((s) => pc.removeTrack(s));
      localStreamRef.current?.getVideoTracks().forEach((t) => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });
      [localVideoRef.current, localVideoFallbackRef.current].forEach((el) => {
        if (el) el.srcObject = null;
      });
      setVideoEnabled(false);
      rtcLog.info('media', 'Video disabled');
      // removeTrack triggers onnegotiationneeded on caller; callee uses requestRenegotiation
      if (!isInitiatorRef.current) {
        await requestRenegotiationAsCallee('video_disabled');
      }
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        const videoTrack = videoStream.getVideoTracks()[0];
        localStreamRef.current?.addTrack(videoTrack);
        pc.addTrack(videoTrack, localStreamRef.current!);
        [localVideoRef.current, localVideoFallbackRef.current].forEach((el) => {
          if (!el) return;
          el.srcObject = localStreamRef.current;
          el.play().catch(() => {});
        });
        setVideoEnabled(true);
        rtcLog.info('media', 'Video enabled');
        // addTrack triggers onnegotiationneeded on caller; callee uses requestRenegotiation
        if (!isInitiatorRef.current) {
          await requestRenegotiationAsCallee('video_enabled');
        }
      } catch {
        toast.error(t('call.camera_failed') || 'Failed to access camera');
      }
    }
  }, [videoEnabled, requestRenegotiationAsCallee, t]);

  const toggleScreenShare = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    if (!canScreenShare) {
      toast.error(t('chat.screenshare_mobile_unsupported'));
      return;
    }

    if (screenSharing) {
      // ── Stop screen share ──
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;

      const videoSenders = pc.getSenders().filter((s) => s.track?.kind === 'video');
      const camTrack = videoEnabled ? localStreamRef.current?.getVideoTracks()[0] : undefined;

      if (camTrack && videoSenders[0]) {
        // replaceTrack: no renegotiation needed
        await videoSenders[0].replaceTrack(camTrack).catch(
          (e) => rtcLog.warn('media', 'replaceTrack failed on screen share stop', e)
        );
        [localVideoRef.current, localVideoFallbackRef.current].forEach((el) => {
          if (!el) return;
          el.srcObject = localStreamRef.current;
          el.play().catch(() => {});
        });
      } else {
        // No camera to restore — remove sender and renegotiate
        videoSenders.forEach((s) => pc.removeTrack(s));
        if (!isInitiatorRef.current) await requestRenegotiationAsCallee('screenshare_stopped');
      }

      setScreenSharing(false);
      rtcLog.info('media', 'Screen share stopped');
    } else {
      // ── Start screen share ──
      try {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { cursor: 'always' },
          audio: false,
        });
        screenStreamRef.current = screenStream;
        const screenTrack: MediaStreamTrack = screenStream.getVideoTracks()[0];

        const videoSenders = pc.getSenders().filter((s) => s.track?.kind === 'video');
        if (videoSenders.length > 0) {
          // Existing video sender: replaceTrack — zero renegotiation
          await videoSenders[0].replaceTrack(screenTrack).catch(
            (e) => rtcLog.warn('media', 'replaceTrack failed on screen share start', e)
          );
        } else {
          // No existing video sender: addTrack requires renegotiation
          pc.addTrack(screenTrack, screenStream);
          if (!isInitiatorRef.current) await requestRenegotiationAsCallee('screenshare_started');
          // Caller's onnegotiationneeded fires automatically from addTrack
        }

        [localVideoRef.current, localVideoFallbackRef.current].forEach((el) => {
          if (!el) return;
          el.srcObject = screenStream;
          el.play().catch(() => {});
        });

        // Handle OS-level screen share stop (user clicks "Stop sharing" in browser chrome)
        screenTrack.onended = () => {
          rtcLog.info('media', 'Screen share ended by user (OS control)');
          screenStreamRef.current = null;
          const activePc = peerConnectionRef.current;
          if (!activePc) { setScreenSharing(false); return; }

          const senders = activePc.getSenders().filter((s) => s.track?.kind === 'video');
          const cam = videoEnabled ? localStreamRef.current?.getVideoTracks()[0] : undefined;

          if (cam && senders[0]) {
            senders[0].replaceTrack(cam).catch(() => {});
            [localVideoRef.current, localVideoFallbackRef.current].forEach((el) => {
              if (el) { el.srcObject = localStreamRef.current; el.play().catch(() => {}); }
            });
          } else {
            senders.forEach((s) => activePc.removeTrack(s));
            if (!isInitiatorRef.current) {
              callService.requestRenegotiation(activeCallIdRef.current!, 'screenshare_ended_by_os')
                .catch(() => {});
            }
          }
          setScreenSharing(false);
        };

        setScreenSharing(true);
        rtcLog.info('media', 'Screen share started');
      } catch {
        // User cancelled getDisplayMedia — not an error
        setScreenSharing(false);
      }
    }
  }, [screenSharing, videoEnabled, canScreenShare, requestRenegotiationAsCallee, t]);

  const toggleRemoteVideoFullscreen = useCallback(async () => {
    const container = remoteVideoContainerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
      } else {
        if (document.fullscreenElement) await document.exitFullscreen();
        await container.requestFullscreen();
      }
    } catch {
      toast.error(t('chat.fullscreen_error'));
    }
  }, [t]);

  // ─── Return value ─────────────────────────────────────────────────────────

  return {
    activeCall,
    showCallPanel,
    setShowCallPanel,
    callElapsed,
    isMuted,
    videoEnabled,
    screenSharing,
    callBusy,
    remoteHasVideo,
    isIncomingCall,
    isLiveCall: Boolean(isLiveCall),
    isCallInitiator,
    canScreenShare,
    isRemoteVideoFullscreen,
    remoteAudioRef,
    localAudioRef,
    remoteVideoRef,
    localVideoRef,
    remoteVideoFallbackRef,
    localVideoFallbackRef,
    remoteVideoContainerRef,
    localStreamRef,
    remoteStreamRef,
    mediaMixRef,
    onRemoteTrackAttachedRef,
    handleStartCall,
    handleAcceptCall,
    handleDeclineCall,
    handleEndCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleRemoteVideoFullscreen,
  } as any;
}
