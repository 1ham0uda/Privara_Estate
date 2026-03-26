'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { chatService, consultationService, userService, consultantService } from '@/src/lib/db';
import { Message, ConsultationCase, UserProfile } from '@/src/types';
import { Button } from '@/src/components/UI';
import { 
  Send, 
  ArrowLeft, 
  User, 
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
  Pause
} from 'lucide-react';
import { formatDate } from '@/src/lib/utils';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';
import Image from 'next/image';
import { useLanguage } from '@/src/context/LanguageContext';

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
  const [showCallInfo, setShowCallInfo] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const { t, isRTL, language } = useLanguage();
  const isQuality = profile?.role === 'quality';
  const canOpenCallFallback = profile?.role === 'client' || profile?.role === 'consultant';
  const isClientOrConsultant = profile?.role === 'client' || profile?.role === 'consultant';

  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!consultation || !profile) return;
    const otherId = profile.role === 'client' ? consultation.consultantId : consultation.clientId;
    if (otherId) {
      if (profile.role === 'admin' || profile.role === 'quality') {
        userService.getUserProfile(otherId).then(setOtherUser);
      } else if (profile.role === 'client') {
        // Fetch consultant profile (public)
        consultantService.getConsultantProfile(otherId).then(cp => {
          if (cp) {
            setOtherUser({
              uid: cp.uid,
              displayName: cp.name,
              avatarUrl: cp.avatarUrl,
              role: 'consultant',
              email: '',
              createdAt: null
            } as UserProfile);
          }
        });
      } else {
        // Consultant reading client profile - use data from consultation object
        setOtherUser({
          uid: otherId,
          displayName: consultation.clientName || '',
          avatarUrl: consultation.clientAvatarUrl,
          role: 'client',
          email: '',
          createdAt: null
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
      const unsubscribe = chatService.subscribeToMessages(caseId as string, setMessages);
      return () => unsubscribe();
    }
  }, [caseId, profile]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
    } catch (error) {
      toast.error(t('chat.audio_access_failed'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
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
    } catch (error) {
      toast.error(t('chat.audio_send_failed'));
    } finally {
      setUploadingAudio(false);
    }
  };

  const toggleAudio = (url: string) => {
    if (playingAudio === url) {
      audioPlayerRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.play();
        setPlayingAudio(url);
      }
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      toast.error(t('chat.link_failed'));
    }
  };

  const handleCallAction = () => {
    if (!consultation) return;

    const hasOtherParty = profile?.role === 'client'
      ? Boolean(consultation.consultantId)
      : Boolean(consultation.clientId);

    if (!hasOtherParty) {
      toast.error(t('call.party_unavailable'));
      return;
    }

    setShowActions(false);
    setShowCallInfo(true);
  };

  if (authLoading || !consultation) return null;

  const hasAssignedConsultant = Boolean(consultation.consultantId);
  const chatLockedUntilAssignment = Boolean(isClientOrConsultant && !hasAssignedConsultant);

  return (
    <div className={`h-screen flex flex-col bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`}>
      <Navbar />
      <Toaster />
      
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="bg-white rounded-t-2xl border-b border-gray-100 p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-bold text-gray-900">
                {getOtherUserName()}
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="capitalize">{consultation.status.replace('_', ' ')}</span>
                <span>•</span>
                <span className="capitalize">{consultation.stage.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canOpenCallFallback && (
              <Button 
                type="button"
                variant="ghost" 
                className="p-2 rounded-full text-gray-500 hover:text-black"
                onClick={handleCallAction}
                title={t('call.unavailable_title')}
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

        {/* Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 bg-white"
        >
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
                      isMe 
                      ? 'bg-black text-white rounded-tr-none' 
                      : 'bg-gray-100 text-gray-900 rounded-tl-none'
                    }`}>
                      {msg.imageUrl && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-white/10 relative w-full aspect-video">
                          <Image 
                            src={msg.imageUrl} 
                            alt="Shared image" 
                            fill
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
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

        {/* Chat Input */}
        {!isQuality && !chatLockedUntilAssignment && (
          <div className="bg-white rounded-b-2xl border-t border-gray-100 p-4 shadow-sm">
            {imagePreview && (
              <div className="mb-4 relative inline-block">
                <div className="h-20 w-20 relative rounded-lg overflow-hidden border-2 border-indigo-500">
                  <Image 
                    src={imagePreview} 
                    alt="Preview" 
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <button 
                  onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageSelect}
              />
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
                  <button 
                    type="button"
                    onClick={stopRecording}
                    className="text-red-600 font-bold text-sm hover:underline"
                  >
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

        {/* Hidden Audio Player */}
        <audio ref={audioPlayerRef} onEnded={() => setPlayingAudio(null)} className="hidden" />

        {showCallInfo && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-gray-100 p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-2">{t('chat.call')}</p>
                  <h3 className="text-xl font-bold text-gray-900">{t('call.unavailable_title')}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCallInfo(false)}
                  className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label={t('call.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm leading-6 text-gray-600">{t('call.unavailable_body')}</p>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {profile?.role === 'client' ? t('call.unavailable_next_client') : t('call.unavailable_next_consultant')}
                </div>
              </div>

              <div className={`mt-6 flex flex-col sm:flex-row gap-3 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
                {profile?.role === 'client' && (
                  <Button
                    type="button"
                    className="flex-1 h-11 rounded-xl"
                    onClick={async () => {
                      await handleRequestMeeting();
                      setShowCallInfo(false);
                    }}
                  >
                    <Calendar className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('call.send_meeting_request')}
                  </Button>
                )}

                {profile?.role === 'consultant' && (
                  <Button
                    type="button"
                    className="flex-1 h-11 rounded-xl"
                    onClick={async () => {
                      await handleProvideMeetingLink();
                      setShowCallInfo(false);
                    }}
                  >
                    <LinkIcon className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('call.share_meeting_link')}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11 rounded-xl"
                  onClick={() => setShowCallInfo(false)}
                >
                  {t('call.close')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
