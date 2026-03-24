'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { chatService, consultationService, userService, consultantService } from '@/src/lib/db';
import { Message, ConsultationCase, UserProfile } from '@/src/types';
import { Button, Card } from '@/src/components/UI';
import { 
  Send, 
  ArrowLeft, 
  User, 
  Shield, 
  Clock,
  MoreVertical,
  Info,
  MessageSquare,
  Image as ImageIcon,
  Loader2,
  X,
  Phone,
  Video,
  Calendar,
  Link as LinkIcon,
  Mic,
  MicOff,
  PhoneOff,
  Monitor,
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
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const callRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const callChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const { t, isRTL, language } = useLanguage();
  const isQuality = profile?.role === 'quality';

  useEffect(() => {
    if (isCalling) {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [isCalling]);

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
        toast.error('Image size must be less than 5MB');
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
      toast.error('Failed to access microphone');
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
      toast.error('Failed to send voice note');
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
      toast.error('Failed to send message');
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
      toast.success('Meeting request sent');
      setShowActions(false);
    } catch (error) {
      toast.error('Failed to request meeting');
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
      setShowActions(false);
    } catch (error) {
      toast.error('Failed to send meeting link');
    }
  };

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      callRecorderRef.current = mediaRecorder;
      callChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          callChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      setIsRecordingCall(true);
      setIsCalling(true);
      toast.success('Connecting...');
    } catch (error) {
      toast.error('Failed to access microphone for call recording');
      // Still start call for simulation if user wants, but warn
      setIsCalling(true);
    }
  };

  const endCall = async () => {
    if (!profile || !caseId || !consultation) return;
    const duration = formatDuration(callDuration);
    setIsCalling(false);

    // Stop call recording
    if (callRecorderRef.current && isRecordingCall) {
      callRecorderRef.current.stop();
      setIsRecordingCall(false);
      
      callRecorderRef.current.onstop = async () => {
        const mimeType = callRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(callChunksRef.current, { type: mimeType });
        if (audioBlob.size > 0) {
          try {
            const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
            const file = new File([audioBlob], `call_recording_${Date.now()}.${ext}`, { type: mimeType });
            const audioUrl = await chatService.uploadChatAudio(caseId as string, file);
            
            // Add to consultation callRecordings
            const currentRecordings = consultation.callRecordings || [];
            await consultationService.updateConsultation(caseId as string, {
              callRecordings: [...currentRecordings, audioUrl]
            });
            
            toast.success(t('call.recorded_success') || 'Call recorded and saved for quality review');
          } catch (error) {
            console.error('Failed to save call recording', error);
          }
        }
        // Stop all tracks
        callRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
    }

    try {
      await chatService.sendMessage(
        caseId as string,
        profile.uid,
        profile.displayName || profile.email || t(`common.${profile.role}`),
        profile.role,
        `📞 ${t('chat.call_ended')} - ${t('chat.call_duration')}: ${duration}`,
        consultation.clientId,
        consultation.consultantId,
        '',
        undefined,
        'call_log'
      );
    } catch (error) {
      console.error('Failed to log call');
    }
  };

  if (authLoading || !consultation) return null;

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
            <Button 
              variant="ghost" 
              className="p-2 rounded-full text-gray-500 hover:text-black"
              onClick={startCall}
            >
              <Phone className="w-5 h-5" />
            </Button>
            
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
          {messages.length === 0 ? (
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
        {!isQuality && (
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

        {/* Call Overlay */}
        {isCalling && (
          <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center text-white p-6">
            <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mb-8 relative">
              <User className="w-16 h-16 text-gray-400" />
              <div className="absolute inset-0 border-4 border-emerald-500 rounded-full animate-ping opacity-20" />
            </div>
            
            <h2 className="text-2xl font-bold mb-2">
              {getOtherUserName()}
            </h2>
            <p className="text-emerald-400 font-mono mb-12 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              {formatDuration(callDuration)}
            </p>

            <div className="flex items-center gap-8">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-gray-700 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              
              <button 
                onClick={endCall}
                className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-110"
              >
                <PhoneOff className="w-8 h-8" />
              </button>

              <button className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                <Monitor className="w-6 h-6" />
              </button>
            </div>

            <div className="mt-12 text-center text-gray-500 text-sm">
              <p className="flex items-center justify-center gap-2">
                <Shield className="w-4 h-4" /> {t('call.recording')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
