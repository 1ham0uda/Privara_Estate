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

    peerConnection.onicecandidateerror = (event) => {
      console.error('[call] ICE candidate error', event);
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('[call] ICE state', peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'failed') {
        toast.error(t('call.connection_failed'));
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log('[call] Peer connection state', state);
      if (state === 'failed') {
        toast.error(t('call.connection_failed'));
      }
    };

    await flushPendingCandidates();
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
      resetRemoteCandidates();
      setShowCallPanel(true);

      const peerConnection = await buildPeerConnection(activeCall.id, 'callee', localStream);
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

    if (activeCall.answer && isCallInitiator && peerConnectionRef.current && !peerConnectionRef.current.currentRemoteDescription) {
      peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(activeCall.answer)).then(() => {
        flushPendingCandidates();
      }).catch(() => undefined);
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

  return (
    <div className={`h-screen flex flex-col bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`}>
      <Navbar />
      <Toaster />

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col overflow-hidden">
        <div className="bg-white rounded-t-2xl border-b border-gray-100 p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-bold text-gray-900">{getOtherUserName()}</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="capitalize">{consultation.status.replace('_', ' ')}</span>
                <span>•</span>
                <span className="capitalize">{consultation.stage.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canOpenCall && (
              <Button
                type="button"
                variant="ghost"
                className="p-2 rounded-full text-gray-500 hover:text-black"
                onClick={handleStartCall}
                title={t('call.start')}
              >
                <Phone className="w-5 h-5" />
              </Button>
            )}

            <div className="relative">
              <Button
                variant="ghost"
                className="p-2 rounded-full text-gray-500 hover:text-black"
                onClick={() => setShowActions(!showActions)}
              >
                <MoreVertical className="w-5 h-5" />
              </Button>

              {showActions && (
                <div className="absolute top-full mt-2 right-0 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                  {profile?.role === 'client' && (
                    <button
                      onClick={handleRequestMeeting}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Calendar className="w-4 h-4" /> {t('chat.request_meeting')}
                    </button>
                  )}
                  {profile?.role === 'consultant' && (
                    <button
                      onClick={handleProvideMeetingLink}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                    >
                      <LinkIcon className="w-4 h-4" /> {t('meeting.provide_link')}
                    </button>
                  )}
                  <Link href={`/${profile?.role}/cases/${caseId}`} className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2">
                    <Info className="w-4 h-4" /> {t('chat.case_info')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
          {chatLockedUntilAssignment ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t('chat.locked_until_assignment_title')}</h3>
              <p className="text-gray-500 max-w-sm">{t('chat.locked_until_assignment_desc')}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t('chat.no_messages')}</h3>
              <p className="text-gray-500 max-w-xs">{t('chat.start_convo')}</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === profile?.uid;
              const bubbleBaseClass = isMe
                ? 'bg-black text-white rounded-tr-none'
                : 'bg-gray-100 text-gray-900 rounded-tl-none';

              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[86%] sm:max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex flex-wrap items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {isMe ? t('chat.you') : msg.senderName}
                      </span>
                      <span className="text-[10px] text-gray-300">
                        {msg.createdAt ? formatDate(msg.createdAt, language) : t('chat.sending')}
                      </span>
                    </div>

                    <div className={`rounded-2xl text-sm ${bubbleBaseClass} px-3 py-2.5 sm:px-4 sm:py-3 space-y-2`}>
                      {msg.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setLightboxImage(msg.imageUrl!)}
                          className="block rounded-2xl overflow-hidden border border-white/10 bg-black/5 w-[220px] sm:w-[300px]"
                        >
                          <div className="relative aspect-[4/3] w-full">
                            <Image
                              src={msg.imageUrl}
                              alt="Shared image"
                              fill
                              className="object-cover"
                              referrerPolicy="no-referrer"
                              unoptimized
                              sizes="(max-width: 640px) 220px, 300px"
                            />
                          </div>
                        </button>
                      )}

                      {msg.type === 'audio' && msg.audioUrl ? (
                        <VoiceNoteBubble src={msg.audioUrl} isMe={isMe} label={t('chat.voice_note')} />
                      ) : null}

                      {msg.text ? (
                        <p className="whitespace-pre-wrap break-words leading-6">{msg.text}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!isQuality && !chatLockedUntilAssignment && (
          <div className="bg-white rounded-b-2xl border-t border-gray-100 p-4 shadow-sm">
            {imagePreview && (
              <div className="mb-4 relative inline-block">
                <div className="h-20 w-20 relative rounded-lg overflow-hidden border-2 border-indigo-500">
                  <Image src={imagePreview} alt="Preview" fill className="object-cover" unoptimized />
                </div>
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />

              {!isRecording && !pendingVoiceNote && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-11 h-11 sm:w-12 sm:h-12 p-0 rounded-xl bg-gray-50 hover:bg-gray-100 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="w-5 h-5 text-gray-500" />
                </Button>
              )}

              {isRecording ? (
                <div className="flex-1 flex items-center justify-between gap-3 px-3 py-2.5 bg-red-50 border border-red-100 rounded-2xl">
                  <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                    {formatDuration(recordingTime)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={cancelRecording} className="text-xs font-semibold text-gray-500 hover:text-black">
                      {t('common.cancel')}
                    </button>
                    <Button type="button" variant="danger" className="h-9 rounded-xl px-3" onClick={stopRecording}>
                      <MicOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('chat.stop')}
                    </Button>
                  </div>
                </div>
              ) : pendingVoiceNote ? (
                <div className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <audio controls preload="metadata" src={pendingVoiceNote.previewUrl} className="w-full h-10" />
                      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                        <span className="font-medium">{t('chat.voice_note')}</span>
                        <span>{formatDuration(pendingVoiceNote.durationSec)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button type="button" onClick={discardPendingVoiceNote} className="text-xs font-semibold text-gray-500 hover:text-black">
                        {t('common.cancel')}
                      </button>
                      <Button type="button" className="h-9 rounded-xl px-3" onClick={sendPendingVoiceNote} loading={uploadingAudio}>
                        <Send className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {t('common.send')}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder={t('chat.placeholder')}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 min-w-0 px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all text-sm"
                  />

                  {newMessage.trim() || selectedImage ? (
                    <Button type="submit" className="w-11 h-11 sm:w-12 sm:h-12 p-0 rounded-xl shrink-0" loading={sending || uploadingImage}>
                      <Send className="w-5 h-5" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-11 h-11 sm:w-12 sm:h-12 p-0 rounded-xl bg-gray-50 hover:bg-gray-100 shrink-0"
                      onClick={startRecording}
                      loading={uploadingAudio}
                    >
                      <Mic className="w-5 h-5 text-gray-500" />
                    </Button>
                  )}
                </>
              )}
            </form>
            <p className="text-[10px] text-center text-gray-400 mt-2 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" /> {t('chat.secure_msg')}
            </p>
          </div>
        )}

        {isQuality && (
          <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" /> {t('quality.read_only_msg') || 'Read-only mode for quality assurance'}
            </p>
          </div>
        )}

        <audio ref={remoteAudioRef} autoPlay controls className="w-full mt-2 hidden" />
        <audio ref={localAudioRef} autoPlay muted className="hidden" />

        {lightboxImage && (
          <div className="fixed inset-0 z-[95] bg-black/80 p-4 flex items-center justify-center" onClick={() => setLightboxImage(null)}>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"
              aria-label={t('call.close')}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="relative w-full max-w-4xl aspect-[4/3]" onClick={(event) => event.stopPropagation()}>
              <Image src={lightboxImage} alt="Chat image preview" fill className="object-contain" unoptimized sizes="100vw" />
            </div>
          </div>
        )}

        {showCallPanel && activeCall && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-gray-100 p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-2">{t('chat.call')}</p>
                  <h3 className="text-xl font-bold text-gray-900">{currentCallTitle}</h3>
                  <p className="mt-2 text-sm text-gray-500">{getOtherUserName()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCallPanel(false)}
                  className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label={t('call.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 space-y-3">
                  <div className="flex items-center gap-3 text-gray-700">
                    {activeCall.status === 'active' ? (
                      <PhoneCall className="w-5 h-5 text-emerald-500" />
                    ) : activeCall.status === 'ringing' && isIncomingCall ? (
                      <PhoneIncoming className="w-5 h-5 text-blue-500" />
                    ) : (
                      <Phone className="w-5 h-5 text-gray-500" />
                    )}
                    <span className="text-sm font-medium">
                      {activeCall.status === 'active' ? formatDuration(callElapsed) : t('call.ringing')}
                    </span>
                  </div>

                  <div className="rounded-xl bg-amber-50 text-amber-900 px-3 py-2 text-xs font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4" /> {t('call.recording')}
                  </div>

                  {isConsultantRecorder && (isLiveCall || callRecordingProcessing) && (
                    <div className="rounded-xl bg-indigo-50 text-indigo-900 px-3 py-2 text-xs font-medium">
                      {callRecordingProcessing ? t('call.recording_processing') : t('call.recording_owner')}
                    </div>
                  )}
                </div>
              </div>

              <div className={`mt-6 flex flex-col sm:flex-row gap-3 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
                {isIncomingCall && activeCall.status === 'ringing' && (
                  <>
                    <Button type="button" className="flex-1 h-11 rounded-xl" onClick={handleAcceptCall}>
                      <PhoneCall className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('call.accept')}
                    </Button>
                    <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={handleDeclineCall}>
                      <PhoneOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('call.decline')}
                    </Button>
                  </>
                )}

                {!isIncomingCall && activeCall.status === 'ringing' && (
                  <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={handleEndCall}>
                    <PhoneOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('call.end')}
                  </Button>
                )}

                {activeCall.status === 'active' && (
                  <>
                    <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={toggleMute}>
                      {isMuted ? <Mic className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> : <MicOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                      {isMuted ? t('call.unmute') : t('call.mute')}
                    </Button>
                    <Button type="button" className="flex-1 h-11 rounded-xl" onClick={handleEndCall}>
                      <PhoneOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('call.end')}
                    </Button>
                  </>
                )}

                {TERMINAL_CALL_STATUSES.has(activeCall.status) && (
                  <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setShowCallPanel(false)}>
                    {t('call.close')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
