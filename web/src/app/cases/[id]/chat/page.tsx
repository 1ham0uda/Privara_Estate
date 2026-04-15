'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { chatService, consultationService, userService, consultantService } from '@/src/lib/db';
import { callService } from '@/src/lib/callService';
import { CallIceCandidate, CallSession, ConsultationCase, Message, UserProfile } from '@/src/types';
import { Button } from '@/src/components/UI';
import {
  Send,
  ArrowLeft,
  Shield,
  MoreVertical,
  Info,
  MessageSquare,
  Image as ImageIcon,
  X,
  Phone,
  Calendar,
  Link as LinkIcon,
  Mic,
  MicOff,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
} from 'lucide-react';
import { formatDate } from '@/src/lib/utils';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';
import Image from 'next/image';
import { useLanguage } from '@/src/context/LanguageContext';

const CALL_TIMEOUT_MS = 45_000;
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

const parseIceServersFromEnv = (): RTCIceServer[] => {
  const fromJson = process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS_JSON;
  if (fromJson) {
    try {
      const parsed = JSON.parse(fromJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as RTCIceServer[];
      }
    } catch (error) {
      console.error('[call] Invalid NEXT_PUBLIC_WEBRTC_ICE_SERVERS_JSON', error);
    }
  }

  const turnUrls = (process.env.NEXT_PUBLIC_WEBRTC_TURN_URLS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const turnUsername = process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL;

  if (turnUrls.length > 0 && turnUsername && turnCredential) {
    return [
      ...DEFAULT_ICE_SERVERS,
      {
        urls: turnUrls,
        username: turnUsername,
        credential: turnCredential,
      },
    ];
  }

  return DEFAULT_ICE_SERVERS;
};

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: parseIceServersFromEnv(),
  iceCandidatePoolSize: 10,
};

const TERMINAL_CALL_STATUSES = new Set(['declined', 'ended', 'missed']);

const formatMediaDuration = (seconds?: number | null) => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

type PendingVoiceNote = {
  blob: Blob;
  mimeType: string;
  previewUrl: string;
  durationSec: number;
};

function VoiceNoteBubble({ src, isMe, label }: { src: string; isMe: boolean; label: string }) {
  const [durationSec, setDurationSec] = useState<number | null>(null);

  return (
    <div className={`rounded-2xl border ${isMe ? 'border-white/15 bg-white/10' : 'border-gray-200 bg-white'} p-2.5 min-w-[220px] max-w-[260px]`}>
      <audio
        controls
        preload="metadata"
        src={src}
        className="w-full h-10"
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          if (Number.isFinite(nextDuration)) {
            setDurationSec(nextDuration);
          }
        }}
      />
      <div className={`mt-2 flex items-center justify-between text-[11px] ${isMe ? 'text-white/80' : 'text-gray-500'}`}>
        <span className="font-medium">{label}</span>
        <span>{formatMediaDuration(durationSec)}</span>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { profile, loading: authLoading } = useRoleGuard(['client', 'consultant', 'admin', 'quality']);
  const { id: caseId } = useParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [consultation, setConsultation] = useState<ConsultationCase | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingCancelledRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingVoiceNote, setPendingVoiceNote] = useState<PendingVoiceNote | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [showCallPanel, setShowCallPanel] = useState(false);
  const [callElapsed, setCallElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [callBusy, setCallBusy] = useState(false);
  const [callRecordingProcessing, setCallRecordingProcessing] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteCandidateIdsRef = useRef<Set<string>>(new Set());
  const pendingCandidatesRef = useRef<CallIceCandidate[]>([]);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaMixRef = useRef<{ audioContext: AudioContext; destination: MediaStreamAudioDestinationNode } | null>(null);
  const callRecorderRef = useRef<MediaRecorder | null>(null);
  const callRecordingChunksRef = useRef<Blob[]>([]);
  const recordingMetaRef = useRef<{ callId: string; consultationId: string; startedAtMs: number } | null>(null);
  const recorderStoppingRef = useRef(false);
  const finalizedCallStatusesRef = useRef<Map<string, string>>(new Map());
  // Track which call ID's candidate state has been initialised (avoid clearing on every re-render)
  const lastResetCallIdRef = useRef<string | null>(null);
  // Track which offer/answer SDP has been applied so ICE-restart renegotiations are detected
  const lastAppliedOfferSdpRef = useRef<string | null>(null);
  const lastAppliedAnswerSdpRef = useRef<string | null>(null);
  const remotePlaybackContextRef = useRef<AudioContext | null>(null);
  const remotePlaybackSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const { t, isRTL, language } = useLanguage();
  const isQuality = profile?.role === 'quality';
  const canOpenCall = profile?.role === 'client' || profile?.role === 'consultant';
  const isClientOrConsultant = profile?.role === 'client' || profile?.role === 'consultant';
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);

  const isConsultantRecorder = Boolean(profile && consultation?.consultantId && profile.uid === consultation.consultantId);
  const isCallInitiator = Boolean(activeCall && profile && activeCall.initiatedBy === profile.uid);
  const isIncomingCall = Boolean(activeCall && profile && activeCall.status === 'ringing' && activeCall.initiatedBy !== profile.uid);
  const isLiveCall = activeCall?.status === 'active';

  useEffect(() => {
    if (!consultation || !profile) return;
    const otherId = profile.role === 'client' ? consultation.consultantId : consultation.clientId;
    if (otherId) {
      if (profile.role === 'admin' || profile.role === 'quality') {
        userService.getUserProfile(otherId).then(setOtherUser);
      } else if (profile.role === 'client') {
        consultantService.getConsultantProfile(otherId).then(cp => {
          if (cp) {
            setOtherUser({
              uid: cp.uid,
              displayName: cp.name,
              avatarUrl: cp.avatarUrl,
              role: 'consultant',
              email: '',
              createdAt: null,
              totalConsultations: 0,
              activeConsultations: 0,
              completedConsultations: 0,
            } as UserProfile);
          }
        });
      } else {
        setOtherUser({
          uid: otherId,
          displayName: consultation.clientName || '',
          avatarUrl: consultation.clientAvatarUrl,
          role: 'client',
          email: '',
          createdAt: null,
          totalConsultations: 0,
          activeConsultations: 0,
          completedConsultations: 0,
        } as UserProfile);
      }
    }
  }, [consultation, profile]);

  const getOtherUserName = () => {
    if (otherUser?.displayName) return otherUser.displayName;
    if (otherUser?.email) return otherUser.email;
    if (profile?.role === 'client') return consultation?.consultantName || t('chat.consultant');
    return consultation?.clientName || t('chat.client');
  };

  const formatDuration = (seconds: number) => formatMediaDuration(seconds);

  useEffect(() => {
    if (caseId && profile) {
      consultationService.getConsultation(caseId as string).then(setConsultation);
      const unsubscribeMessages = chatService.subscribeToMessages(caseId as string, setMessages);
      return () => unsubscribeMessages();
    }
  }, [caseId, profile]);

  useEffect(() => {
    if (!caseId || !profile || !canOpenCall) return;
    const unsubscribeCall = callService.subscribeToLatestCall(caseId as string, (call) => {
      setActiveCall(call);
      setCallBusy(Boolean(call && !TERMINAL_CALL_STATUSES.has(call.status)));
      if (call && !TERMINAL_CALL_STATUSES.has(call.status)) {
        setShowCallPanel(true);
      }
      if (!call) {
        setCallBusy(false);
      }
    });

    return () => unsubscribeCall();
  }, [caseId, profile, canOpenCall]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const resetRemoteCandidates = () => {
    remoteCandidateIdsRef.current = new Set();
    pendingCandidatesRef.current = [];
  };

  const clearCallTimeout = () => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  };

  const clearCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  const stopVoiceNoteRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };


  const discardPendingVoiceNote = useCallback(() => {
    setPendingVoiceNote((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return null;
    });
  }, []);

  const ensureRemotePlaybackContext = useCallback(async () => {
    try {
      if (!remotePlaybackContextRef.current) {
        remotePlaybackContextRef.current = new AudioContext();
      }
      if (remotePlaybackContextRef.current.state === 'suspended') {
        await remotePlaybackContextRef.current.resume();
      }
      return remotePlaybackContextRef.current;
    } catch (error) {
      console.error('[call] Failed to initialize remote playback context', error);
      return null;
    }
  }, []);

  const stopRemotePlayback = useCallback(() => {
    if (remotePlaybackSourceRef.current) {
      try {
        remotePlaybackSourceRef.current.disconnect();
      } catch {
        // ignore disconnect failures
      }
      remotePlaybackSourceRef.current = null;
    }

    if (remotePlaybackContextRef.current) {
      remotePlaybackContextRef.current.close().catch(() => undefined);
      remotePlaybackContextRef.current = null;
    }
  }, []);

  const cleanupCallMedia = useCallback(({ preservePanel = false }: { preservePanel?: boolean } = {}) => {
    clearCallTimeout();
    clearCallTimer();

    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (callRecorderRef.current && callRecorderRef.current.state !== 'inactive' && !recorderStoppingRef.current) {
      recorderStoppingRef.current = true;
      callRecorderRef.current.stop();
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => track.stop());
      remoteStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.onloadedmetadata = null;
    }

    if (localAudioRef.current) {
      localAudioRef.current.pause();
      localAudioRef.current.srcObject = null;
    }

    if (mediaMixRef.current) {
      mediaMixRef.current.audioContext.close().catch(() => undefined);
      mediaMixRef.current = null;
    }

    stopRemotePlayback();

    if (!preservePanel) {
      setShowCallPanel(false);
    }

    setIsMuted(false);
    setCallElapsed(0);
    resetRemoteCandidates();
  }, [stopRemotePlayback]);

  useEffect(() => {
    return () => {
      cleanupCallMedia();
      stopVoiceNoteRecordingTimer();
      discardPendingVoiceNote();
    };
  }, [cleanupCallMedia, discardPendingVoiceNote]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('chat.image_size_error'));
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    if (pendingVoiceNote) {
      discardPendingVoiceNote();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = chooseRecordingMimeType();
      const mediaRecorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingCancelledRef.current = false;
      recordingStartedAtRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const currentStream = stream;
        currentStream.getTracks().forEach(track => track.stop());

        const startedAt = recordingStartedAtRef.current;
        recordingStartedAtRef.current = null;
        const durationSec = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : Math.max(recordingTime, 1);
        const mimeType = mediaRecorder.mimeType || preferredMimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;

        if (recordingCancelledRef.current || audioBlob.size === 0) {
          recordingCancelledRef.current = false;
          return;
        }

        discardPendingVoiceNote();
        const previewUrl = URL.createObjectURL(audioBlob);
        setPendingVoiceNote({
          blob: audioBlob,
          mimeType,
          previewUrl,
          durationSec,
        });
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch {
      toast.error(t('chat.audio_access_failed'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopVoiceNoteRecordingTimer();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      recordingCancelledRef.current = true;
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
    stopVoiceNoteRecordingTimer();
  };

  const handleSendAudio = async (blob: Blob, mimeType: string = 'audio/webm') => {
    if (!profile || !caseId || !consultation) return;
    setUploadingAudio(true);
    try {
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `voice_note_${Date.now()}.${ext}`, { type: mimeType });
      const audioUrl = await chatService.uploadChatAudio(caseId as string, file);

      await chatService.sendMessage(
        caseId as string,
        profile.uid,
        profile.displayName,
        profile.role,
        '',
        consultation.clientId,
        consultation.consultantId,
        '',
        audioUrl,
        'audio'
      );
    } catch {
      toast.error(t('chat.audio_send_failed'));
    } finally {
      setUploadingAudio(false);
    }
  };

  const sendPendingVoiceNote = async () => {
    if (!pendingVoiceNote) return;
    await handleSendAudio(pendingVoiceNote.blob, pendingVoiceNote.mimeType);
    discardPendingVoiceNote();
    setRecordingTime(0);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || !profile || !caseId || !consultation) return;

    setSending(true);
    try {
      let imageUrl = '';
      if (selectedImage) {
        setUploadingImage(true);
        imageUrl = await chatService.uploadChatImage(caseId as string, selectedImage);
        setUploadingImage(false);
      }

      await chatService.sendMessage(
        caseId as string,
        profile.uid,
        profile.displayName || profile.email || t(`common.${profile.role}`),
        profile.role,
        newMessage,
        consultation.clientId,
        consultation.consultantId,
        imageUrl
      );
      setNewMessage('');
      setSelectedImage(null);
      setImagePreview(null);
    } catch {
      toast.error(t('chat.send_failed'));
    } finally {
      setSending(false);
    }
  };

  const handleRequestMeeting = async () => {
    if (!profile || !caseId || !consultation) return;
    try {
      await chatService.sendMessage(
        caseId as string,
        profile.uid,
        profile.displayName || profile.email || t(`common.${profile.role}`),
        profile.role,
        `📅 ${t('chat.meeting_requested')}: I would like to schedule an online meeting to discuss my case.`,
        consultation.clientId,
        consultation.consultantId,
        '',
        undefined,
        'meeting_request'
      );
      toast.success(t('chat.meeting_requested_success'));
      setShowActions(false);
    } catch {
      toast.error(t('chat.meeting_failed'));
    }
  };

  const handleProvideMeetingLink = async () => {
    const link = prompt(t('chat.meeting_link_prompt') || 'Please provide the meeting link (Zoom, Google Meet, etc.):');
    if (!link || !profile || !caseId || !consultation) return;
    try {
      await chatService.sendMessage(
        caseId as string,
        profile.uid,
        profile.displayName || profile.email || t(`common.${profile.role}`),
        profile.role,
        `🔗 ${t('chat.meeting_link')}: ${link}`,
        consultation.clientId,
        consultation.consultantId,
        '',
        undefined,
        'meeting_link'
      );
      toast.success(t('chat.link_sent_success'));
      setShowActions(false);
    } catch {
      toast.error(t('chat.link_failed'));
    }
  };

  const flushPendingCandidates = async () => {
    if (!peerConnectionRef.current || pendingCandidatesRef.current.length === 0) return;
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        }));
      } catch {
        // Ignore malformed or duplicate candidates.
      }
    }
    pendingCandidatesRef.current = [];
  };

  const maybeStartCallRecording = useCallback(() => {
    if (!activeCall || activeCall.status !== 'active' || !isConsultantRecorder) return;
    if (!localStreamRef.current || !remoteStreamRef.current) return;
    if (!localStreamRef.current.getAudioTracks().length || !remoteStreamRef.current.getAudioTracks().length) return;
    if (callRecorderRef.current && callRecorderRef.current.state !== 'inactive') return;

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    const localSource = audioContext.createMediaStreamSource(localStreamRef.current);
    const remoteSource = audioContext.createMediaStreamSource(remoteStreamRef.current);
    localSource.connect(destination);
    remoteSource.connect(destination);
    mediaMixRef.current = { audioContext, destination };

    const mimeType = chooseRecordingMimeType();
    const recorder = mimeType
      ? new MediaRecorder(destination.stream, { mimeType })
      : new MediaRecorder(destination.stream);

    callRecorderRef.current = recorder;
    callRecordingChunksRef.current = [];
    recordingMetaRef.current = {
      callId: activeCall.id,
      consultationId: activeCall.consultationId,
      startedAtMs: Date.now(),
    };
    recorderStoppingRef.current = false;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        callRecordingChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const meta = recordingMetaRef.current;
      const currentMimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(callRecordingChunksRef.current, { type: currentMimeType });
      callRecorderRef.current = null;
      recordingMetaRef.current = null;
      callRecordingChunksRef.current = [];
      recorderStoppingRef.current = false;

      if (!meta || blob.size === 0) return;

      const durationSec = Math.max(1, Math.round((Date.now() - meta.startedAtMs) / 1000));
      const ext = currentMimeType.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `call_recording_${Date.now()}.${ext}`, { type: currentMimeType });

      setCallRecordingProcessing(true);
      try {
        await callService.uploadRecording(meta.consultationId, meta.callId, file, durationSec);
        if (profile && consultation) {
          await chatService.sendMessage(
            consultation.id,
            profile.uid,
            profile.displayName || profile.email || t(`common.${profile.role}`),
            profile.role,
            `📞 ${t('call.recording_ready')}`,
            consultation.clientId,
            consultation.consultantId,
            '',
            undefined,
            'call_log'
          );
        }
        toast.success(t('call.recording_ready'));
      } catch {
        toast.error(t('call.recording_failed'));
      } finally {
        setCallRecordingProcessing(false);
      }
    };

    recorder.start(1000);
    callService.updateCall(activeCall.id, { recordingStatus: 'recording' }).catch(() => undefined);
  }, [activeCall, consultation, isConsultantRecorder, profile, t]);

  const attachRemoteStream = async (event: RTCTrackEvent) => {
    const incomingStream = event.streams?.[0] || null;

    if (incomingStream) {
      remoteStreamRef.current = incomingStream;
    } else {
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      if (!remoteStreamRef.current.getTracks().some((existing) => existing.id === event.track.id)) {
        remoteStreamRef.current.addTrack(event.track);
      }
    }

    const remoteAudioEl = remoteAudioRef.current;
    const remoteStream = remoteStreamRef.current;

    if (!remoteStream) {
      return;
    }

    try {
      const playbackContext = await ensureRemotePlaybackContext();
      if (playbackContext) {
        if (remotePlaybackSourceRef.current) {
          try {
            remotePlaybackSourceRef.current.disconnect();
          } catch {
            // ignore disconnect failures
          }
          remotePlaybackSourceRef.current = null;
        }

        const source = playbackContext.createMediaStreamSource(remoteStream);
        source.connect(playbackContext.destination);
        remotePlaybackSourceRef.current = source;
      }
    } catch (error) {
      console.error('[call] Remote playback setup failed', error);
    }

    if (remoteAudioEl) {
      remoteAudioEl.autoplay = true;
      remoteAudioEl.muted = false;
      remoteAudioEl.volume = 1;
      remoteAudioEl.srcObject = remoteStream;

      const playRemoteAudio = async () => {
        try {
          await remoteAudioEl.play();
        } catch (error) {
          console.error('[call] Remote audio playback failed', error);
          toast.error(t('call.playback_failed'));
        }
      };

      if (remoteAudioEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        await playRemoteAudio();
      } else {
        remoteAudioEl.onloadedmetadata = () => {
          void playRemoteAudio();
        };
      }
    }

    maybeStartCallRecording();
  };

  const buildPeerConnection = async (callId: string, side: 'caller' | 'callee', localStream: MediaStream) => {
    const peerConnection = new RTCPeerConnection(RTC_CONFIGURATION);
    peerConnectionRef.current = peerConnection;

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = true;
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
      void attachRemoteStream(event);
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        callService.addIceCandidate(callId, side, event.candidate);
      }
    };

    // Buffer ICE gather errors for deferred classification.
    // onicecandidateerror fires for every (candidate, ICE-server) pair that doesn't work —
    // IPv6 host addresses, the fallback STUN URL, mDNS candidates, etc.  All of these are
    // normal and harmless when the connection ultimately succeeds via another transport.
    // We log them immediately at debug level and only escalate to warn if ICE finally fails.
    type IceErrorEntry = { errorCode: number; errorText: string; url: string; address: string };
    const iceErrorLog: IceErrorEntry[] = [];

    peerConnection.onicecandidateerror = (event) => {
      const e = event as RTCPeerConnectionIceErrorEvent;
      const entry: IceErrorEntry = {
        errorCode: e.errorCode ?? 0,
        errorText: e.errorText ?? '',
        url: e.url ?? '',
        address: (e as any).address ?? '',
      };
      iceErrorLog.push(entry);
      // Debug-level: visible in DevTools but not in the browser error console.
      console.debug('[call] ICE gather error (non-fatal while connecting)', entry);
    };

    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState;
      console.log('[call] ICE state', iceState);

      if (iceState === 'connected' || iceState === 'completed') {
        // Every buffered error was harmless — the connection succeeded via another transport.
        iceErrorLog.length = 0;
      }

      // Attempt ICE restart on disconnect or failure.  For 'disconnected' this often
      // recovers without full renegotiation; for 'failed' it triggers onnegotiationneeded
      // on the caller side which sends a fresh offer.
      if (iceState === 'disconnected' || iceState === 'failed') {
        peerConnection.restartIce();
      }

      if (iceState === 'failed') {
        // Only now are the buffered gather errors actionable — escalate so they're visible.
        if (iceErrorLog.length > 0) {
          console.warn('[call] ICE gather errors that contributed to failure:', iceErrorLog);
          iceErrorLog.length = 0;
        }
        toast.error(t('call.connection_failed'));
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log('[call] Peer connection state', state);
      if (state === 'connected') {
        // Belt-and-suspenders: clear any lingering gather errors once the transport is up.
        iceErrorLog.length = 0;
      }
      if (state === 'failed') {
        toast.error(t('call.connection_failed'));
      }
    };

    // Caller re-negotiates when ICE restart is needed (triggered by restartIce()).
    // Skip the initial negotiation (no remote description yet) — that is handled by handleStartCall.
    if (side === 'caller') {
      peerConnection.onnegotiationneeded = async () => {
        if (!peerConnection.currentRemoteDescription) return;
        try {
          const offer = await peerConnection.createOffer({ iceRestart: true });
          await peerConnection.setLocalDescription(offer);
          callService.saveOffer(callId, offer).catch(() => undefined);
        } catch {
          // ignore — if renegotiation fails the call will remain in the failed state
        }
      };
    }

    return peerConnection;
  };

  const prepareLocalStream = async () => {
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
      return stream;
    } catch {
      toast.error(t('call.microphone_failed'));
      throw new Error('microphone_failed');
    }
  };

  const chooseRecordingMimeType = () => {
    const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    return options.find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';
  };

  const handleStartCall = async () => {
    if (!profile || !consultation || !caseId) return;
    if (!consultation.consultantId) {
      toast.error(t('call.no_consultant'));
      return;
    }
    if (callBusy && activeCall && !TERMINAL_CALL_STATUSES.has(activeCall.status)) {
      toast.error(t('call.busy'));
      return;
    }

    try {
      const localStream = await prepareLocalStream();
      const createdCallId = await callService.createCall(consultation, {
        uid: profile.uid,
        displayName: profile.displayName || profile.email || 'User',
        role: profile.role as 'client' | 'consultant',
      });
      resetRemoteCandidates();
      setShowActions(false);
      setShowCallPanel(true);

      const peerConnection = await buildPeerConnection(createdCallId, 'caller', localStream);
      const offer = await peerConnection.createOffer({ offerToReceiveAudio: true });
      await peerConnection.setLocalDescription(offer);
      await callService.saveOffer(createdCallId, offer);
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
    } catch {
      cleanupCallMedia();
    }
  };

  const handleAcceptCall = async () => {
    if (!profile || !consultation || !activeCall?.offer) return;
    try {
      const localStream = await prepareLocalStream();
      setShowCallPanel(true);

      const peerConnection = await buildPeerConnection(activeCall.id, 'callee', localStream);
      lastAppliedOfferSdpRef.current = activeCall.offer.sdp ?? null;
      await peerConnection.setRemoteDescription(new RTCSessionDescription(activeCall.offer));
      await flushPendingCandidates();
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await callService.saveAnswer(activeCall.id, answer);
      clearCallTimeout();
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
    } catch {
      cleanupCallMedia();
    }
  };

  const handleDeclineCall = async () => {
    if (!profile || !activeCall) return;
    await callService.updateCall(activeCall.id, {
      status: 'declined',
      endedAt: new Date() as any,
      endedBy: profile.uid,
    });
    cleanupCallMedia();
  };

  const handleEndCall = async () => {
    if (!profile || !activeCall) return;
    await callService.updateCall(activeCall.id, {
      status: 'ended',
      endedAt: new Date() as any,
      endedBy: profile.uid,
    });
    cleanupCallMedia({ preservePanel: true });
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const shouldMute = !isMuted;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !shouldMute;
    });
    setIsMuted(shouldMute);
  };

  useEffect(() => {
    if (!activeCall || !profile || !canOpenCall) return;

    // Caller: apply remote answer (initial connect + ICE-restart renegotiation)
    if (
      activeCall.answer?.sdp &&
      isCallInitiator &&
      peerConnectionRef.current &&
      peerConnectionRef.current.signalingState !== 'closed' &&
      activeCall.answer.sdp !== lastAppliedAnswerSdpRef.current
    ) {
      lastAppliedAnswerSdpRef.current = activeCall.answer.sdp;
      peerConnectionRef.current
        .setRemoteDescription(new RTCSessionDescription(activeCall.answer as RTCSessionDescriptionInit))
        .then(() => flushPendingCandidates())
        .catch(() => undefined);
    }

    // Callee: re-apply offer when caller triggers an ICE restart (offer SDP changes)
    if (
      activeCall.offer?.sdp &&
      !isCallInitiator &&
      peerConnectionRef.current &&
      peerConnectionRef.current.signalingState !== 'closed' &&
      activeCall.offer.sdp !== lastAppliedOfferSdpRef.current
    ) {
      const pc = peerConnectionRef.current;
      lastAppliedOfferSdpRef.current = activeCall.offer.sdp;
      pc.setRemoteDescription(new RTCSessionDescription(activeCall.offer as RTCSessionDescriptionInit))
        .then(() => pc.createAnswer())
        .then((answer) => pc.setLocalDescription(answer).then(() => callService.saveAnswer(activeCall.id, answer)))
        .catch(() => undefined);
    }

    if (activeCall.status === 'active') {
      clearCallTimeout();
      setShowCallPanel(true);
      if (!callTimerRef.current) {
        const callStartedAt = activeCall.acceptedAt?.toMillis?.() || activeCall.createdAt?.toMillis?.() || Date.now();
        setCallElapsed(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)));
        callTimerRef.current = setInterval(() => {
          setCallElapsed(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)));
        }, 1000);
      }
      maybeStartCallRecording();
    }

    const previousStatus = finalizedCallStatusesRef.current.get(activeCall.id);
    if (TERMINAL_CALL_STATUSES.has(activeCall.status) && previousStatus !== activeCall.status) {
      finalizedCallStatusesRef.current.set(activeCall.id, activeCall.status);
      clearCallTimeout();
      clearCallTimer();
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
  }, [activeCall, canOpenCall, cleanupCallMedia, isCallInitiator, maybeStartCallRecording, profile, t]);

  useEffect(() => {
    if (!activeCall?.id || !canOpenCall) return;

    // Reset candidate tracking exactly once per unique call ID so that candidates
    // queued while the call was ringing are not discarded when the callee accepts.
    if (lastResetCallIdRef.current !== activeCall.id) {
      lastResetCallIdRef.current = activeCall.id;
      remoteCandidateIdsRef.current = new Set();
      pendingCandidatesRef.current = [];
      lastAppliedOfferSdpRef.current = null;
      lastAppliedAnswerSdpRef.current = null;
    }

    const sourceRole: 'caller' | 'callee' = isCallInitiator ? 'callee' : 'caller';

    const unsubscribeCandidates = callService.subscribeToIceCandidates(activeCall.id, sourceRole, async (candidates) => {
      for (const candidate of candidates) {
        if (remoteCandidateIdsRef.current.has(candidate.id)) continue;
        remoteCandidateIdsRef.current.add(candidate.id);
        if (peerConnectionRef.current?.remoteDescription) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate({
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex,
            }));
          } catch {
            pendingCandidatesRef.current.push(candidate);
          }
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      }
    });

    return () => unsubscribeCandidates();
  }, [activeCall?.id, isCallInitiator, canOpenCall]);

  const currentCallTitle = useMemo(() => {
    if (!activeCall) return t('call.start');
    if (activeCall.status === 'active') return t('call.status_active');
    if (activeCall.status === 'ringing') return isIncomingCall ? t('call.incoming_title') : t('call.outgoing_title');
    if (activeCall.status === 'declined') return t('call.declined_remote');
    if (activeCall.status === 'missed') return t('call.missed');
    return t('call.end');
  }, [activeCall, isIncomingCall, t]);

  if (authLoading || !consultation) return null;

  const hasAssignedConsultant = Boolean(consultation.consultantId);
  const chatLockedUntilAssignment = Boolean(isClientOrConsultant && !hasAssignedConsultant);
  const otherUserInitial = getOtherUserName().charAt(0).toUpperCase() || '?';
  const isCallLive = Boolean(activeCall && !TERMINAL_CALL_STATUSES.has(activeCall.status));

  return (
    <div className={`h-screen flex flex-col bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`}>
      <Navbar />
      <Toaster position="top-center" toastOptions={{ style: { fontSize: '13px' } }} />

      {/* ── Chat shell ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col w-full max-w-3xl mx-auto">

        {/* ── Header ── */}
        <div className="bg-white border-b border-gray-100 px-3 sm:px-4 h-14 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-full text-gray-400 hover:bg-gray-100 transition-colors shrink-0"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0 select-none">
            <span className="text-xs font-bold text-white">{otherUserInitial}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
              {getOtherUserName()}
            </p>
            <p className="text-[11px] text-gray-400 leading-tight truncate">
              <span className="capitalize">{consultation.status.replace(/_/g, ' ')}</span>
              <span className="mx-1 text-gray-200">·</span>
              <span className="capitalize">{consultation.stage.replace(/_/g, ' ')}</span>
            </p>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {canOpenCall && !chatLockedUntilAssignment && (
              <button
                type="button"
                onClick={handleStartCall}
                title={t('call.start')}
                className="relative p-2.5 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <Phone className="w-[18px] h-[18px]" />
                {/* Live indicator dot — visible when a call is in progress but overlay is minimised */}
                {isCallLive && !showCallPanel && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                )}
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowActions(!showActions)}
                className="p-2.5 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <MoreVertical className="w-[18px] h-[18px]" />
              </button>

              {showActions && (
                <div className="absolute top-full mt-1 right-0 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 overflow-hidden">
                  {profile?.role === 'client' && (
                    <button
                      type="button"
                      onClick={handleRequestMeeting}
                      className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                    >
                      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                      {t('chat.request_meeting')}
                    </button>
                  )}
                  {profile?.role === 'consultant' && (
                    <button
                      type="button"
                      onClick={handleProvideMeetingLink}
                      className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                    >
                      <LinkIcon className="w-4 h-4 text-gray-400 shrink-0" />
                      {t('meeting.provide_link')}
                    </button>
                  )}
                  <Link
                    href={`/${profile?.role}/cases/${caseId}`}
                    className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <Info className="w-4 h-4 text-gray-400 shrink-0" />
                    {t('chat.case_info')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Return-to-call banner (shown when call is live but overlay is minimised) ── */}
        {canOpenCall && isCallLive && !showCallPanel && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-gray-950 border-b border-white/5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${activeCall!.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400 animate-pulse'}`} />
            <div className="flex-1 min-w-0 flex items-center gap-2.5">
              <span className="text-sm font-medium text-white truncate">{getOtherUserName()}</span>
              {activeCall!.status === 'active' && (
                <span className="text-xs text-white/50 tabular-nums shrink-0">{formatDuration(callElapsed)}</span>
              )}
              {activeCall!.status === 'ringing' && (
                <span className="text-xs text-white/50 shrink-0">{t('call.ringing')}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowCallPanel(true)}
                className="text-xs font-semibold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full transition-colors"
              >
                {t('call.return_to_call')}
              </button>
              {activeCall!.status === 'active' && (
                <button
                  type="button"
                  onClick={handleEndCall}
                  className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors"
                  title={t('call.end')}
                >
                  <PhoneOff className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Messages ── */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50"
          style={{ overscrollBehavior: 'contain' }}
        >
          {chatLockedUntilAssignment ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-amber-400" />
              </div>
              <p className="font-semibold text-gray-800 text-sm">{t('chat.locked_until_assignment_title')}</p>
              <p className="text-xs text-gray-400 mt-1.5 max-w-xs leading-relaxed">{t('chat.locked_until_assignment_desc')}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-gray-300" />
              </div>
              <p className="font-semibold text-gray-800 text-sm">{t('chat.no_messages')}</p>
              <p className="text-xs text-gray-400 mt-1.5 max-w-xs leading-relaxed">{t('chat.start_convo')}</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === profile?.uid;
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {/* Remote avatar */}
                  {!isMe && (
                    <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center shrink-0 mb-1 select-none">
                      <span className="text-[10px] font-bold text-white">
                        {msg.senderName?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                  )}

                  <div className={`max-w-[78%] sm:max-w-[65%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`rounded-2xl text-sm px-3.5 py-2.5 space-y-2
                      ${isMe
                        ? 'bg-gray-900 text-white rounded-br-sm shadow-sm'
                        : 'bg-white text-gray-900 rounded-bl-sm border border-gray-100 shadow-sm'}`}>
                      {msg.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setLightboxImage(msg.imageUrl!)}
                          className="block rounded-xl overflow-hidden"
                        >
                          <div className="relative aspect-[4/3] w-[200px] sm:w-[260px]">
                            <Image
                              src={msg.imageUrl}
                              alt="Shared image"
                              fill
                              className="object-cover"
                              referrerPolicy="no-referrer"
                              unoptimized
                              sizes="(max-width: 640px) 200px, 260px"
                            />
                          </div>
                        </button>
                      )}
                      {msg.type === 'audio' && msg.audioUrl ? (
                        <VoiceNoteBubble src={msg.audioUrl} isMe={isMe} label={t('chat.voice_note')} />
                      ) : null}
                      {msg.text ? (
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                      ) : null}
                    </div>
                    <span className="text-[10px] text-gray-400 px-0.5">
                      {msg.createdAt ? formatDate(msg.createdAt, language) : t('chat.sending')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Input ── */}
        {!isQuality && !chatLockedUntilAssignment && (
          <div className="shrink-0 bg-white border-t border-gray-100 px-3 pt-2 pb-3">
            {imagePreview && (
              <div className="mb-2 inline-block relative">
                <div className="h-16 w-16 relative rounded-xl overflow-hidden border border-gray-200">
                  <Image src={imagePreview} alt="Preview" fill className="object-cover" unoptimized />
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-900 text-white rounded-full flex items-center justify-center shadow"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-end gap-2">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />

              {!isRecording && !pendingVoiceNote && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-9 h-9 shrink-0 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center text-gray-500"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              )}

              {isRecording ? (
                <div className="flex-1 flex items-center justify-between gap-3 px-4 py-2.5 bg-rose-50 border border-rose-100 rounded-2xl">
                  <div className="flex items-center gap-2 text-rose-600 text-sm font-semibold">
                    <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                    {formatDuration(recordingTime)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={cancelRecording} className="text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors">
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                    >
                      <MicOff className="w-3.5 h-3.5" />
                      {t('chat.stop')}
                    </button>
                  </div>
                </div>
              ) : pendingVoiceNote ? (
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <audio controls preload="metadata" src={pendingVoiceNote.previewUrl} className="w-full h-9" />
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1.5 px-0.5">
                        <span>{t('chat.voice_note')}</span>
                        <span>{formatDuration(pendingVoiceNote.durationSec)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto sm:ml-2 shrink-0">
                      <button type="button" onClick={discardPendingVoiceNote} className="text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors">
                        {t('common.cancel')}
                      </button>
                      <Button type="button" className="h-8 rounded-xl text-xs px-3" onClick={sendPendingVoiceNote} loading={uploadingAudio}>
                        <Send className={`w-3.5 h-3.5 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />
                        {t('common.send')}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center bg-gray-100 rounded-2xl px-3.5 py-2.5 gap-2">
                  <input
                    type="text"
                    placeholder={t('chat.placeholder')}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                  />
                </div>
              )}

              {!isRecording && !pendingVoiceNote && (
                newMessage.trim() || selectedImage ? (
                  <button
                    type="submit"
                    disabled={sending || uploadingImage}
                    className="w-9 h-9 shrink-0 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center text-white transition-colors"
                  >
                    {(sending || uploadingImage)
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Send className="w-4 h-4" />}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={uploadingAudio}
                    className="w-9 h-9 shrink-0 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center text-gray-500 transition-colors"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )
              )}
            </form>

            <p className="text-[10px] text-center text-gray-300 mt-1.5 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              {t('chat.secure_msg')}
            </p>
          </div>
        )}

        {isQuality && (
          <div className="shrink-0 bg-white border-t border-gray-100 px-4 py-3 text-center">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              {t('quality.read_only_msg') || 'Read-only mode for quality assurance'}
            </p>
          </div>
        )}
      </div>

      {/* Hidden audio elements — must live outside the scrollable container */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
      <audio ref={localAudioRef} autoPlay muted className="hidden" />

      {/* ── Lightbox ── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[95] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label={t('call.close')}
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="relative w-full max-w-4xl aspect-[4/3]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image src={lightboxImage} alt="Chat image preview" fill className="object-contain" unoptimized sizes="100vw" />
          </div>
        </div>
      )}

      {/* ── Call overlay ──────────────────────────────────────────────────
           Mobile  : slides up from bottom, near full-screen
           Desktop : centred modal with dark-gradient card               */}
      {showCallPanel && activeCall && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCallPanel(false)}
          />

          {/* Card */}
          <div className="relative w-full sm:max-w-xs bg-gradient-to-b from-gray-900 to-gray-950
                          rounded-t-3xl sm:rounded-3xl overflow-hidden
                          border-t border-white/10 sm:border sm:border-white/10
                          shadow-2xl shadow-black/70">

            {/* Top bar */}
            <div className="flex items-center justify-between px-5 pt-5 pb-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 select-none">
                {activeCall.status === 'active'
                  ? t('call.status_active')
                  : activeCall.status === 'ringing' && isIncomingCall
                    ? t('call.incoming_title')
                    : activeCall.status === 'ringing'
                      ? t('call.outgoing_title')
                      : currentCallTitle}
              </span>
              <button
                type="button"
                onClick={() => setShowCallPanel(false)}
                className="p-1.5 rounded-full text-white/35 hover:text-white/70 hover:bg-white/10 transition-colors"
                aria-label="Minimise call"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar + identity area */}
            <div className="flex flex-col items-center px-8 pt-6 pb-5">
              {/* Pulsing rings for incoming ringing */}
              <div className="relative flex items-center justify-center">
                {isIncomingCall && activeCall.status === 'ringing' && (
                  <>
                    <span className="absolute w-28 h-28 rounded-full bg-blue-500/10 animate-ping" />
                    <span className="absolute w-24 h-24 rounded-full bg-blue-500/15" />
                  </>
                )}
                <div className={`relative w-20 h-20 rounded-full flex items-center justify-center select-none z-10
                                ${activeCall.status === 'active'
                                  ? 'bg-gradient-to-br from-emerald-700 to-emerald-900 ring-4 ring-emerald-500/25'
                                  : 'bg-gradient-to-br from-gray-600 to-gray-800'}`}>
                  <span className="text-3xl font-bold text-white">{otherUserInitial}</span>
                </div>
                {activeCall.status === 'active' && (
                  <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-gray-950 z-20" />
                )}
              </div>

              <h2 className="mt-4 text-[19px] font-semibold text-white tracking-tight leading-tight text-center">
                {getOtherUserName()}
              </h2>

              <p className="mt-1.5 text-sm text-white/45 tabular-nums font-medium">
                {activeCall.status === 'active'
                  ? formatDuration(callElapsed)
                  : TERMINAL_CALL_STATUSES.has(activeCall.status)
                    ? currentCallTitle
                    : t('call.ringing')}
              </p>

              {/* Recording badges */}
              <div className="mt-3.5 flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1.5 bg-white/8 rounded-full px-3 py-1.5">
                  <Shield className="w-3 h-3 text-amber-400/80" />
                  <span className="text-[11px] text-white/40">{t('call.recording')}</span>
                </div>
                {isConsultantRecorder && (isLiveCall || callRecordingProcessing) && (
                  <div className="flex items-center gap-1.5 bg-white/8 rounded-full px-3 py-1.5">
                    {callRecordingProcessing
                      ? <span className="w-3 h-3 rounded-full border border-white/30 border-t-transparent animate-spin" />
                      : <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />}
                    <span className="text-[11px] text-white/40">
                      {callRecordingProcessing ? t('call.recording_processing') : t('call.recording_owner')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Call controls ── */}
            <div className="px-8 pb-10 flex items-center justify-center gap-8">

              {/* Incoming ringing: Decline + Accept */}
              {isIncomingCall && activeCall.status === 'ringing' && (
                <>
                  <div className="flex flex-col items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleDeclineCall}
                      className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95
                                 flex items-center justify-center shadow-lg shadow-rose-500/25 transition-all"
                    >
                      <PhoneOff className="w-6 h-6 text-white" />
                    </button>
                    <span className="text-[11px] font-medium text-white/40">{t('call.decline')}</span>
                  </div>
                  <div className="flex flex-col items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleAcceptCall}
                      className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95
                                 flex items-center justify-center shadow-lg shadow-emerald-500/25 transition-all"
                    >
                      <Phone className="w-6 h-6 text-white" />
                    </button>
                    <span className="text-[11px] font-medium text-white/40">{t('call.accept')}</span>
                  </div>
                </>
              )}

              {/* Outgoing ringing: Cancel */}
              {!isIncomingCall && activeCall.status === 'ringing' && (
                <div className="flex flex-col items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleEndCall}
                    className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95
                               flex items-center justify-center shadow-lg shadow-rose-500/25 transition-all"
                  >
                    <PhoneOff className="w-6 h-6 text-white" />
                  </button>
                  <span className="text-[11px] font-medium text-white/40">{t('call.end')}</span>
                </div>
              )}

              {/* Active call: Mute + End */}
              {activeCall.status === 'active' && (
                <>
                  <div className="flex flex-col items-center gap-2.5">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className={`w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all
                        ${isMuted
                          ? 'bg-white text-gray-900 shadow-lg shadow-white/15'
                          : 'bg-white/12 hover:bg-white/20 text-white'}`}
                    >
                      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <span className="text-[11px] font-medium text-white/40">
                      {isMuted ? t('call.unmute') : t('call.mute')}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleEndCall}
                      className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95
                                 flex items-center justify-center shadow-lg shadow-rose-500/25 transition-all"
                    >
                      <PhoneOff className="w-6 h-6 text-white" />
                    </button>
                    <span className="text-[11px] font-medium text-white/40">{t('call.end')}</span>
                  </div>
                </>
              )}

              {/* Terminal state: Dismiss */}
              {TERMINAL_CALL_STATUSES.has(activeCall.status) && (
                <button
                  type="button"
                  onClick={() => setShowCallPanel(false)}
                  className="px-8 py-3 rounded-xl bg-white/10 hover:bg-white/18 text-white text-sm font-medium transition-colors"
                >
                  {t('call.close')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
