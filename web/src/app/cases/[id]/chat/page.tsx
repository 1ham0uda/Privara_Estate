'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { chatService, consultationService, userService, consultantService } from '@/src/lib/db';
import { callService } from '@/src/lib/callService';
import { CallSession, ConsultationCase, Message, UserProfile } from '@/src/types';
import { useWebRTCCall } from '@/src/hooks/useWebRTCCall';
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
  Mic,
  MicOff,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Paperclip,
  FileText,
  Download,
  Monitor,
  MonitorOff,
  Maximize,
  Minimize,
} from 'lucide-react';
import { formatDate } from '@/src/lib/utils';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';
import Image from 'next/image';
import { useLanguage } from '@/src/context/LanguageContext';
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
    <div className={`rounded-2xl border ${isMe ? 'border-white/15 bg-white/10' : 'border-soft-blue bg-white'} p-2.5 min-w-[220px] max-w-[260px]`}>
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
      <div className={`mt-2 flex items-center justify-between text-[11px] ${isMe ? 'text-white/80' : 'text-brand-slate'}`}>
        <span className="font-medium">{label}</span>
        <span>{formatMediaDuration(durationSec)}</span>
      </div>
    </div>
  );
}

function renderClickableText(text: string, isMe: boolean) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (/^https?:\/\/[^\s]+$/i.test(part)) {
      return (
        <a
          key={`link-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline break-all ${isMe ? 'text-white' : 'text-blue-700'}`}
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
  });
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileAttachRef = useRef<HTMLInputElement>(null);

  // ── Recording state (managed here; streams/mix owned by WebRTC hook) ──────
  const [callRecordingProcessing, setCallRecordingProcessing] = useState(false);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingAnimationRef = useRef<number | null>(null);
  const recordingVideoStreamRef = useRef<MediaStream | null>(null);
  const callRecorderRef = useRef<MediaRecorder | null>(null);
  const callRecordingChunksRef = useRef<Blob[]>([]);
  const recordingMetaRef = useRef<{ callId: string; consultationId: string; startedAtMs: number } | null>(null);
  const recorderStoppingRef = useRef(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { t, isRTL, language } = useLanguage();
  const isQuality = profile?.role === 'quality';
  const canOpenCall = profile?.role === 'client' || profile?.role === 'consultant';
  const isClientOrConsultant = profile?.role === 'client' || profile?.role === 'consultant';
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const isConsultantRecorder = Boolean(profile && consultation?.consultantId && profile.uid === consultation.consultantId);

  // ── WebRTC hook (depends on derived values above) ──────────────────────────
  const {
    activeCall, showCallPanel, setShowCallPanel, callElapsed,
    isMuted, videoEnabled, screenSharing, callBusy, remoteHasVideo,
    isIncomingCall, isLiveCall, isCallInitiator,
    canScreenShare, isRemoteVideoFullscreen,
    remoteAudioRef, localAudioRef,
    remoteVideoRef, localVideoRef,
    remoteVideoFallbackRef, localVideoFallbackRef,
    remoteVideoContainerRef,
    localStreamRef, remoteStreamRef, mediaMixRef,
    onRemoteTrackAttachedRef,
    handleStartCall, handleAcceptCall, handleDeclineCall, handleEndCall,
    toggleMute, toggleVideo, toggleScreenShare, toggleRemoteVideoFullscreen,
  } = useWebRTCCall({ profile, consultation, caseId: caseId as string, canOpenCall, isConsultantRecorder, t });

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const stopCallVisualCapture = () => {
    if (recordingAnimationRef.current) {
      cancelAnimationFrame(recordingAnimationRef.current);
      recordingAnimationRef.current = null;
    }
    if (recordingVideoStreamRef.current) {
      recordingVideoStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingVideoStreamRef.current = null;
    }
    recordingCanvasRef.current = null;
  };

  const startCallVisualCapture = (): MediaStream | null => {
    const primaryVideo = remoteVideoRef.current;
    if (!primaryVideo) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    recordingCanvasRef.current = canvas;

    const drawFrame = () => {
      const { width, height } = canvas;
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, width, height);

      if (primaryVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        ctx.drawImage(primaryVideo, 0, 0, width, height);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for video...', width / 2, height / 2);
      }

      const localVideo = localVideoRef.current;
      if (localVideo && localVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const pipWidth = Math.round(width * 0.24);
        const pipHeight = Math.round(height * 0.24);
        const margin = Math.round(width * 0.02);
        const pipX = width - pipWidth - margin;
        const pipY = height - pipHeight - margin;

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(pipX - 6, pipY - 6, pipWidth + 12, pipHeight + 12);
        ctx.drawImage(localVideo, pipX, pipY, pipWidth, pipHeight);
        ctx.restore();
      }

      recordingAnimationRef.current = requestAnimationFrame(drawFrame);
    };

    drawFrame();
    const stream = canvas.captureStream(24);
    recordingVideoStreamRef.current = stream;
    return stream;
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

  // Stop recording canvas capture on unmount
  useEffect(() => {
    return () => {
      stopCallVisualCapture();
      stopVoiceNoteRecordingTimer();
      discardPendingVoiceNote();
      if (callRecorderRef.current && callRecorderRef.current.state !== 'inactive' && !recorderStoppingRef.current) {
        recorderStoppingRef.current = true;
        callRecorderRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  const handleFileAttachSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error(t('chat.file_type_error'));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t('chat.file_size_error'));
      return;
    }
    setSelectedFile(file);
    e.target.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSendFile = async () => {
    if (!selectedFile || !profile || !caseId || !consultation) return;
    setUploadingFile(true);
    try {
      const fileUrl = await chatService.uploadChatFile(caseId as string, selectedFile);
      await chatService.sendMessage(
        caseId as string,
        profile.uid,
        profile.displayName || profile.email || t(`common.${profile.role}`),
        profile.role,
        '',
        consultation.clientId,
        consultation.consultantId,
        '',
        undefined,
        'file',
        { fileUrl, fileName: selectedFile.name, fileType: selectedFile.type, fileSize: selectedFile.size }
      );
      setSelectedFile(null);
    } catch {
      toast.error(t('chat.file_send_failed'));
    } finally {
      setUploadingFile(false);
    }
  };

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
      const preferredMimeType = chooseVoiceRecordingMimeType();
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
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      setSelectedImage(null);
      setImagePreview(null);
    } catch {
      toast.error(t('chat.send_failed'));
    } finally {
      setSending(false);
    }
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
    mediaMixRef.current = { audioContext, destination, remoteSource };

    const visualStream = startCallVisualCapture();
    const composedStream = visualStream
      ? new MediaStream([
          ...visualStream.getVideoTracks(),
          ...destination.stream.getAudioTracks(),
        ])
      : destination.stream;

    const mimeType = chooseCallRecordingMimeType();
    const recorder = mimeType
      ? new MediaRecorder(composedStream, { mimeType })
      : new MediaRecorder(composedStream);

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
      const currentMimeType = recorder.mimeType || 'video/webm';
      const blob = new Blob(callRecordingChunksRef.current, { type: currentMimeType });
      callRecorderRef.current = null;
      recordingMetaRef.current = null;
      callRecordingChunksRef.current = [];
      recorderStoppingRef.current = false;
      stopCallVisualCapture();

      if (!meta || blob.size === 0) return;

      const durationSec = Math.max(1, Math.round((Date.now() - meta.startedAtMs) / 1000));
      const ext = currentMimeType.includes('mp4') ? 'mp4' : 'webm';
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

  // Keep a ref so ontrack handlers (captured at peer-connection build time) always
  // call the latest version of maybeStartCallRecording, avoiding stale-closure races
  // where the captured version still has activeCall.status === 'ringing'.
  const maybeStartCallRecordingRef = useRef(maybeStartCallRecording);
  useEffect(() => {
    maybeStartCallRecordingRef.current = maybeStartCallRecording;
  }, [maybeStartCallRecording]);


  const chooseVoiceRecordingMimeType = () => {
    const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    return options.find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';
  };

  const chooseCallRecordingMimeType = () => {
    const options = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return options.find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';
  };

  // Wire recording callback into WebRTC hook so it fires when a remote track arrives
  onRemoteTrackAttachedRef.current = () => maybeStartCallRecordingRef.current?.();

  // Trigger recording when call transitions to active (e.g. both sides connected)
  useEffect(() => {
    if (activeCall?.status === 'active') maybeStartCallRecording();
  }, [activeCall?.status, maybeStartCallRecording]);


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
    <div className={`h-screen h-[100dvh] min-h-0 overflow-hidden flex flex-col bg-cloud ${isRTL ? 'rtl' : 'ltr'}`}>
      <Navbar />
      <Toaster position="top-center" toastOptions={{ style: { fontSize: '13px' } }} />

      {/* ── Chat shell ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col w-full max-w-3xl mx-auto">

        {/* ── Header ── */}
        <div className="bg-white border-b border-soft-blue px-3 sm:px-4 h-14 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-full text-brand-slate hover:bg-soft-blue transition-colors shrink-0"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center shrink-0 select-none">
            <span className="text-xs font-bold text-white">{otherUserInitial}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink text-sm leading-tight truncate">
              {getOtherUserName()}
            </p>
            <p className="text-[11px] text-brand-slate leading-tight truncate">
              <span className="capitalize">{consultation.status.replace(/_/g, ' ')}</span>
              <span className="mx-1 text-brand-slate/30">·</span>
              <span className="capitalize">{consultation.stage.replace(/_/g, ' ')}</span>
            </p>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {canOpenCall && !chatLockedUntilAssignment && (
              <button
                type="button"
                onClick={handleStartCall}
                title={t('call.start')}
                className="relative p-2.5 rounded-full text-brand-slate hover:text-ink hover:bg-soft-blue transition-colors"
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
                className="p-2.5 rounded-full text-brand-slate hover:bg-soft-blue transition-colors"
              >
                <MoreVertical className="w-[18px] h-[18px]" />
              </button>

              {showActions && (
                <div className="absolute top-full mt-1 right-0 w-52 bg-white rounded-2xl shadow-xl border border-soft-blue py-1.5 z-50 overflow-hidden">
                  <Link
                    href={`/${profile?.role}/cases/${caseId}`}
                    className="w-full px-4 py-2.5 text-sm text-left text-brand-slate hover:bg-cloud flex items-center gap-3 transition-colors"
                  >
                    <Info className="w-4 h-4 text-brand-slate shrink-0" />
                    {t('chat.case_info')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Return-to-call banner (shown when call is live but overlay is minimised) ── */}
        {canOpenCall && isCallLive && !showCallPanel && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-ink border-b border-white/5">
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
          className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-cloud"
          style={{ overscrollBehavior: 'contain' }}
        >
          {chatLockedUntilAssignment ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-amber-400" />
              </div>
              <p className="font-semibold text-ink text-sm">{t('chat.locked_until_assignment_title')}</p>
              <p className="text-xs text-brand-slate mt-1.5 max-w-xs leading-relaxed">{t('chat.locked_until_assignment_desc')}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-soft-blue flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-brand-slate/40" />
              </div>
              <p className="font-semibold text-ink text-sm">{t('chat.no_messages')}</p>
              <p className="text-xs text-brand-slate mt-1.5 max-w-xs leading-relaxed">{t('chat.start_convo')}</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === profile?.uid;
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {/* Remote avatar */}
                  {!isMe && (
                    <div className="w-6 h-6 rounded-full bg-ink flex items-center justify-center shrink-0 mb-1 select-none">
                      <span className="text-[10px] font-bold text-white">
                        {msg.senderName?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                  )}

                  <div className={`max-w-[78%] sm:max-w-[65%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`rounded-2xl text-sm px-3.5 py-2.5 space-y-2
                      ${isMe
                        ? 'bg-ink text-white rounded-br-sm shadow-sm'
                        : 'bg-white text-ink rounded-bl-sm border border-soft-blue shadow-sm'}`}>
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
                      {msg.type === 'file' && msg.fileUrl ? (
                        <a
                          href={msg.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 min-w-[200px] max-w-[260px] no-underline
                            ${isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-soft-blue hover:bg-soft-blue/80'} transition-colors`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                            ${isMe ? 'bg-white/15' : 'bg-blue-100'}`}>
                            <FileText className={`w-4 h-4 ${isMe ? 'text-white/80' : 'text-blue-600'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${isMe ? 'text-white' : 'text-ink'}`}>
                              {msg.fileName || t('chat.file_label')}
                            </p>
                            {msg.fileSize ? (
                              <p className={`text-[10px] mt-0.5 ${isMe ? 'text-white/50' : 'text-brand-slate'}`}>
                                {formatFileSize(msg.fileSize)}
                              </p>
                            ) : null}
                          </div>
                          <Download className={`w-3.5 h-3.5 shrink-0 ${isMe ? 'text-white/60' : 'text-brand-slate'}`} />
                        </a>
                      ) : null}
                      {msg.text ? (
                        <p className="whitespace-pre-wrap break-words leading-relaxed">
                          {renderClickableText(msg.text, isMe)}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-[10px] text-brand-slate px-0.5">
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
          <div
            className="shrink-0 bg-white border-t border-soft-blue px-3 pt-2 pb-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {imagePreview && (
              <div className="mb-2 inline-block relative">
                <div className="h-16 w-16 relative rounded-xl overflow-hidden border border-soft-blue">
                  <Image src={imagePreview} alt="Preview" fill className="object-cover" unoptimized />
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-ink text-white rounded-full flex items-center justify-center shadow"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {selectedFile && (
              <div className="mb-2 flex items-center gap-2 bg-soft-blue rounded-xl px-3 py-2 w-fit max-w-[260px]">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-medium text-ink truncate flex-1">{selectedFile.name}</span>
                <span className="text-[10px] text-brand-slate shrink-0">{formatFileSize(selectedFile.size)}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="w-4 h-4 rounded-full bg-ink/10 flex items-center justify-center hover:bg-ink/20 transition-colors shrink-0"
                >
                  <X className="w-2.5 h-2.5 text-ink" />
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-end gap-2">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                ref={fileAttachRef}
                onChange={handleFileAttachSelect}
              />

              {!isRecording && !pendingVoiceNote && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title={t('chat.upload_image')}
                    className="w-9 h-9 rounded-xl bg-soft-blue hover:bg-soft-blue transition-colors flex items-center justify-center text-brand-slate"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileAttachRef.current?.click()}
                    title={t('chat.attach_file')}
                    className="w-9 h-9 rounded-xl bg-soft-blue hover:bg-soft-blue transition-colors flex items-center justify-center text-brand-slate"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                </div>
              )}

              {isRecording ? (
                <div className="flex-1 flex items-center justify-between gap-3 px-4 py-2.5 bg-rose-50 border border-rose-100 rounded-2xl">
                  <div className="flex items-center gap-2 text-rose-600 text-sm font-semibold">
                    <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                    {formatDuration(recordingTime)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={cancelRecording} className="text-xs font-medium text-brand-slate hover:text-ink transition-colors">
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
                <div className="flex-1 bg-cloud border border-soft-blue rounded-2xl px-3 py-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <audio controls preload="metadata" src={pendingVoiceNote.previewUrl} className="w-full h-9" />
                      <div className="flex items-center justify-between text-[10px] text-brand-slate mt-1.5 px-0.5">
                        <span>{t('chat.voice_note')}</span>
                        <span>{formatDuration(pendingVoiceNote.durationSec)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto sm:ml-2 shrink-0">
                      <button type="button" onClick={discardPendingVoiceNote} className="text-xs font-medium text-brand-slate hover:text-ink transition-colors">
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
                <div className="flex-1 flex items-center bg-soft-blue rounded-2xl px-3.5 py-2.5 gap-2">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    placeholder={t('chat.placeholder')}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      const el = e.target;
                      el.style.height = 'auto';
                      el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e as unknown as React.FormEvent);
                      }
                    }}
                    className="flex-1 min-w-0 bg-transparent text-sm text-ink placeholder:text-brand-slate outline-none resize-none leading-5 max-h-32 overflow-y-auto"
                  />
                </div>
              )}

              {!isRecording && !pendingVoiceNote && (
                newMessage.trim() || selectedImage || selectedFile ? (
                  selectedFile && !newMessage.trim() && !selectedImage ? (
                    <button
                      type="button"
                      onClick={handleSendFile}
                      disabled={uploadingFile}
                      className="w-9 h-9 shrink-0 rounded-xl bg-ink hover:bg-ink disabled:opacity-50 flex items-center justify-center text-white transition-colors"
                    >
                      {uploadingFile
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <Send className="w-4 h-4" />}
                    </button>
                  ) : (
                  <button
                    type="submit"
                    disabled={sending || uploadingImage}
                    className="w-9 h-9 shrink-0 rounded-xl bg-ink hover:bg-ink disabled:opacity-50 flex items-center justify-center text-white transition-colors"
                  >
                    {(sending || uploadingImage)
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Send className="w-4 h-4" />}
                  </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={uploadingAudio}
                    className="w-9 h-9 shrink-0 rounded-xl bg-soft-blue hover:bg-soft-blue disabled:opacity-50 flex items-center justify-center text-brand-slate transition-colors"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )
              )}
            </form>

            <p className="text-[10px] text-center text-brand-slate/40 mt-1.5 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              {t('chat.secure_msg')}
            </p>
          </div>
        )}

        {isQuality && (
          <div
            className="shrink-0 bg-white border-t border-soft-blue px-4 py-3 text-center"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <p className="text-xs text-brand-slate flex items-center justify-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              {t('quality.read_only_msg') || 'Read-only mode for quality assurance'}
            </p>
          </div>
        )}
      </div>

      {/* Hidden audio elements — must live outside the scrollable container */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
      <audio ref={localAudioRef} autoPlay muted className="hidden" />
      {/* Fallback video elements (used when call panel is closed) */}
      <video ref={remoteVideoFallbackRef} autoPlay playsInline className="hidden" />
      <video ref={localVideoFallbackRef} autoPlay playsInline muted className="hidden" />

      {/* ── Lightbox ── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[95] bg-ink/90 flex items-center justify-center p-4"
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
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={() => setShowCallPanel(false)}
          />

          {/* Card */}
          <div className="relative w-full sm:max-w-xs bg-gradient-to-b from-ink to-ink/95
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
                                  : 'bg-gradient-to-br from-brand-slate to-ink'}`}>
                  <span className="text-3xl font-bold text-white">{otherUserInitial}</span>
                </div>
                {activeCall.status === 'active' && (
                  <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-ink z-20" />
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

              {/* Remote video */}
              {(videoEnabled || screenSharing || remoteHasVideo) && activeCall.status === 'active' && (
                <div
                  ref={remoteVideoContainerRef}
                  className="mt-4 w-full relative rounded-xl overflow-hidden bg-black/40"
                  style={{ aspectRatio: '16/9' }}
                >
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted={false}
                    className="w-full h-full object-cover"
                  />
                  {/* Local video PiP */}
                  <div className="absolute bottom-2 right-2 w-20 h-14 rounded-lg overflow-hidden border border-white/20 bg-black/60">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {screenSharing && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-blue-500/80 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                      <Monitor className="w-2.5 h-2.5" />
                      Screen
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={toggleRemoteVideoFullscreen}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/55 text-white hover:bg-black/75 transition-colors flex items-center justify-center"
                    aria-label={isRemoteVideoFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    title={isRemoteVideoFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  >
                    {isRemoteVideoFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </div>
              )}

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

              {/* Active call: Mute + ScreenShare + End */}
              {activeCall.status === 'active' && (
                <>
                  <div className="flex flex-col items-center gap-2.5">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all
                        ${isMuted
                          ? 'bg-white text-ink shadow-lg shadow-white/15'
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
                      onClick={toggleScreenShare}
                      disabled={!canScreenShare}
                      className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all
                        ${screenSharing
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                          : 'bg-white/12 hover:bg-white/20 text-white'}
                        ${!canScreenShare ? 'opacity-40 cursor-not-allowed hover:bg-white/12' : ''}`}
                    >
                      {screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                    </button>
                    <span className="text-[11px] font-medium text-white/40">
                      {screenSharing ? t('call.screen_stop') : t('call.screen_share')}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleEndCall}
                      className="w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95
                                 flex items-center justify-center shadow-lg shadow-rose-500/25 transition-all"
                    >
                      <PhoneOff className="w-5 h-5 text-white" />
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
