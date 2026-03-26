'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Play,
  Pause,
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
const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
};

const TERMINAL_CALL_STATUSES = new Set(['declined', 'ended', 'missed']);

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  const cleanupCallMedia = ({ preservePanel = false }: { preservePanel?: boolean } = {}) => {
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
      remoteAudioRef.current.srcObject = null;
    }

    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
    }

    if (mediaMixRef.current) {
      mediaMixRef.current.audioContext.close().catch(() => undefined);
      mediaMixRef.current = null;
    }

    if (!preservePanel) {
      setShowCallPanel(false);
    }

    setIsMuted(false);
    setCallElapsed(0);
    resetRemoteCandidates();
  };

  useEffect(() => {
    return () => {
      cleanupCallMedia();
      stopVoiceNoteRecordingTimer();
    };
  }, []);

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 0) {
          await handleSendAudio(audioBlob, mimeType);
        }
        stream.getTracks().forEach(track => track.stop());
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

  const toggleAudio = (url: string) => {
    if (playingAudio === url) {
      audioPlayerRef.current?.pause();
      setPlayingAudio(null);
    } else if (audioPlayerRef.current) {
      audioPlayerRef.current.src = url;
      audioPlayerRef.current.play();
      setPlayingAudio(url);
    }
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

  const attachRemoteStream = (event: RTCTrackEvent) => {
    if (!remoteStreamRef.current) {
      remoteStreamRef.current = new MediaStream();
    }

    event.streams[0]?.getTracks().forEach(track => {
      if (!remoteStreamRef.current?.getTracks().some(existing => existing.id === track.id)) {
        remoteStreamRef.current?.addTrack(track);
      }
    });

    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
      remoteAudioRef.current.play().catch(() => undefined);
    }

    maybeStartCallRecording();
  };

  const buildPeerConnection = async (callId: string, side: 'caller' | 'callee', localStream: MediaStream) => {
    const peerConnection = new RTCPeerConnection(RTC_CONFIGURATION);
    peerConnectionRef.current = peerConnection;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
      attachRemoteStream(event);
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        callService.addIceCandidate(callId, side, event.candidate);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'failed' || state === 'disconnected') {
        toast.error(t('call.ended_remote'));
      }
    };

    await flushPendingCandidates();
    return peerConnection;
  };

  const prepareLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
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

  const maybeStartCallRecording = () => {
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
  }, [activeCall, profile, canOpenCall, isCallInitiator, t]);

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
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {isMe ? t('chat.you') : msg.senderName}
                      </span>
                      <span className="text-[10px] text-gray-300">
                        {msg.createdAt ? formatDate(msg.createdAt, language) : t('chat.sending')}
                      </span>
                    </div>
                    <div className={`px-4 py-3 rounded-2xl text-sm ${
                      isMe ? 'bg-black text-white rounded-tr-none' : 'bg-gray-100 text-gray-900 rounded-tl-none'
                    }`}>
                      {msg.imageUrl && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-white/10 relative w-full aspect-video">
                          <Image src={msg.imageUrl} alt="Shared image" fill className="object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      {msg.type === 'audio' && msg.audioUrl ? (
                        <div className="flex items-center gap-3 min-w-[150px]">
                          <button
                            onClick={() => toggleAudio(msg.audioUrl!)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${isMe ? 'bg-white text-black' : 'bg-black text-white'}`}
                          >
                            {playingAudio === msg.audioUrl ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <div className="flex-1 h-1 bg-gray-300 rounded-full overflow-hidden">
                            <div className={`h-full bg-current ${isMe ? 'text-white' : 'text-black'}`} style={{ width: playingAudio === msg.audioUrl ? '100%' : '0%', transition: 'width 0.1s linear' }} />
                          </div>
                          <span className="text-[10px] font-medium opacity-70">{t('chat.voice_note')}</span>
                        </div>
                      ) : (
                        msg.text
                      )}
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
              <Button
                type="button"
                variant="ghost"
                className="w-12 h-12 p-0 rounded-xl bg-gray-50 hover:bg-gray-100"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-5 h-5 text-gray-500" />
              </Button>

              {isRecording ? (
                <div className="flex-1 flex items-center justify-between px-4 py-2 bg-red-50 border-2 border-red-100 rounded-xl animate-pulse">
                  <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                    {formatDuration(recordingTime)}
                  </div>
                  <button type="button" onClick={stopRecording} className="text-red-600 font-bold text-sm hover:underline">
                    {t('chat.stop')}
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder={t('chat.placeholder')}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all"
                />
              )}

              {newMessage.trim() || selectedImage ? (
                <Button type="submit" className="w-12 h-12 p-0 rounded-xl" loading={sending || uploadingImage}>
                  <Send className="w-5 h-5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={isRecording ? 'danger' : 'ghost'}
                  className={`w-12 h-12 p-0 rounded-xl ${!isRecording ? 'bg-gray-50 hover:bg-gray-100' : ''}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  loading={uploadingAudio}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-gray-500" />}
                </Button>
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

        <audio ref={audioPlayerRef} onEnded={() => setPlayingAudio(null)} className="hidden" />
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        <audio ref={localAudioRef} autoPlay playsInline muted className="hidden" />

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
