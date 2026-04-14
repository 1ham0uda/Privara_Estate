'use client';

import React, { useEffect, useState } from 'react';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { consultationService, consultantService, userService, qualityService } from '@/src/lib/db';
import { ConsultationCase, ConsultantProfile, UserProfile, QualityAuditReport } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  UserPlus, 
  LayoutDashboard,
  TrendingUp,
  ChevronRight,
  User,
  Shield,
  BarChart3,
  MessageSquare,
  Phone,
  Briefcase,
  UserCheck,
  UserX,
  Star
} from 'lucide-react';
import { formatDate } from '@/src/lib/utils';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useLanguage } from '@/src/context/LanguageContext';
import { settingsService } from '@/src/lib/db';
import AdminSupportWorkspace from '@/src/components/support/AdminSupportWorkspace';

export default function AdminDashboard() {
  const { profile, loading } = useRoleGuard(['admin']);
  const { t, isRTL, language } = useLanguage();
  const [cases, setCases] = useState<ConsultationCase[]>([]);
  const [consultants, setConsultants] = useState<ConsultantProfile[]>([]);
  const [qualitySpecialists, setQualitySpecialists] = useState<UserProfile[]>([]);
  const [qualityReports, setQualityReports] = useState<QualityAuditReport[]>([]);
  const [assigningCaseId, setAssigningCaseId] = useState<string | null>(null);
  const [assigningQualityCaseId, setAssigningQualityCaseId] = useState<string | null>(null);
  const [selectedConsultantId, setSelectedConsultantId] = useState('');
  const [selectedQualityId, setSelectedQualityId] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'conversations' | 'staff' | 'quality_reports' | 'support'>('overview');
  const [showStaffDetailsModal, setShowStaffDetailsModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [reassigningCaseId, setReassigningCaseId] = useState<string | null>(null);
  const [reassignToId, setReassignToId] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [consultationFee, setConsultationFee] = useState(500);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (profile) {
      const unsubscribe = consultationService.subscribeToConsultations('admin', profile.uid, (data) => {
        setCases(data);
      });
      
      const unsubscribeReports = qualityService.subscribeToAuditReports((data) => {
        setQualityReports(data);
      });

      
      consultantService.getAllConsultants().then(setConsultants);

      const fetchQuality = async () => {
        const specialists = await qualityService.getAllQualitySpecialists();
        setQualitySpecialists(specialists);
      };

      const fetchSettings = async () => {
        const settings = await settingsService.getSettings();
        if (settings && settings.consultationFee) {
          setConsultationFee(settings.consultationFee);
        }
      };

      fetchQuality();
      fetchSettings();
      
      return () => {
        unsubscribe();
        unsubscribeReports();
      };
    }
  }, [profile]);

  const handleToggleUserStatus = async (uid: string, currentStatus: string) => {
    const activeStaffCases = cases.filter(c => (c.consultantId === uid || c.qualitySpecialistId === uid) && c.status !== 'completed');
    
    if (currentStatus === 'active' && activeStaffCases.length > 0) {
      toast.error(t('admin.dashboard.staff.error_active_cases') || 'Cannot deactivate staff with active cases. Please reassign them first.');
      return;
    }

    setUpdatingStatus(true);
    try {
      const newStatus = currentStatus === 'active' ? 'deactivated' : 'active';

      // Update the user record via the service layer
      await userService.updateUserProfile(uid, { status: newStatus });

      // Keep consultantProfiles in sync so the intake form reflects the change
      const isConsultant = consultants.some(c => c.uid === uid);
      if (isConsultant) {
        await consultantService.updateConsultantProfile(uid, { status: newStatus });
      }

      toast.success(t('common.success'));

      // Refresh lists via service layer (no raw Firestore SDK)
      const [updatedConsultants, updatedSpecialists] = await Promise.all([
        consultantService.getAllConsultants(),
        qualityService.getAllQualitySpecialists(),
      ]);
      setConsultants(updatedConsultants);
      setQualitySpecialists(updatedSpecialists);

      if (selectedStaff && selectedStaff.uid === uid) {
        setSelectedStaff({ ...selectedStaff, status: newStatus });
      }
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReassignCase = async (caseId: string, newStaffId: string, role: 'consultant' | 'quality') => {
    if (!newStaffId) return;
    setIsReassigning(true);
    try {
      if (role === 'consultant') {
        const consultant = consultants.find(c => c.uid === newStaffId);
        await consultationService.assignConsultant(caseId, newStaffId, consultant?.name || 'Consultant');
      } else {
        const quality = qualitySpecialists.find(q => q.uid === newStaffId);
        await consultationService.assignQualitySpecialist(caseId, newStaffId, quality?.displayName || 'Quality Specialist');
      }
      toast.success(t('admin.dashboard.case.reassigned_success') || 'Case reassigned successfully');
      setReassigningCaseId(null);
      setReassignToId('');
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsReassigning(false);
    }
  };



  const startConsultantAssignment = (consultation: ConsultationCase) => {
    setAssigningCaseId(consultation.id);
    setSelectedConsultantId(consultation.intake.selectedConsultantUid || '');
  };

  const handleAssign = async (caseId: string) => {
    if (!selectedConsultantId) return;
    const consultant = consultants.find(c => c.uid === selectedConsultantId);
    try {
      await consultationService.assignConsultant(caseId, selectedConsultantId, consultant?.name || 'Consultant');
      toast.success(t('admin.dashboard.consultant_assigned'));
      setAssigningCaseId(null);
      setSelectedConsultantId('');
    } catch (error) {
      toast.error(t('admin.dashboard.failed_to_assign'));
    }
  };

  const handleAssignQuality = async (caseId: string) => {
    if (!selectedQualityId) return;
    const quality = qualitySpecialists.find(q => q.uid === selectedQualityId);
    try {
      await consultationService.assignQualitySpecialist(caseId, selectedQualityId, quality?.displayName || 'Quality Specialist');
      toast.success(t('admin.dashboard.quality_assigned'));
      setAssigningQualityCaseId(null);
      setSelectedQualityId('');
    } catch (error) {
      toast.error(t('admin.dashboard.failed_to_assign_quality'));
    }
  };

  const sanitizeCsvCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Neutralise formula-injection: prefix any cell that starts with a formula
    // trigger character so spreadsheet apps treat it as plain text.
    const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
    // Wrap in double-quotes and escape internal double-quotes per RFC 4180
    return `"${sanitized.replace(/"/g, '""')}"`;
  };

  const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) {
      toast.error(t('admin.dashboard.export_no_data'));
      return;
    }

    const headers = Object.keys(data[0]).map(sanitizeCsvCell).join(',');
    const rows = data.map(obj =>
      Object.values(obj).map(sanitizeCsvCell).join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await settingsService.updateSettings({ consultationFee });
      toast.success(t('admin.dashboard.settings_success') || 'Settings saved successfully');
      setShowSettingsModal(false);
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (loading) return null;

  const unassignedCases = cases.filter(c => !c.consultantId);
  const activeCases = cases.filter(c => c.consultantId && c.status !== 'completed');
  const completedCases = cases.filter(c => c.status === 'completed');

  const chartData = [
    { name: 'Unassigned', value: unassignedCases.length, color: '#f59e0b' },
    { name: 'Active', value: activeCases.length, color: '#3b82f6' },
    { name: 'Completed', value: completedCases.length, color: '#10b981' },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <Toaster />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('admin.dashboard.title')}</h1>
            <p className="text-gray-500 mt-1">{t('admin.dashboard.subtitle')}</p>
          </div>
          <div className="flex overflow-x-auto bg-white p-1 rounded-xl shadow-sm border border-gray-100 hide-scrollbar">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'overview' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'}`}
            >
              {t('admin.dashboard.tab.overview')}
            </button>
            <button 
              onClick={() => setActiveTab('conversations')}
              className={`px-6 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'conversations' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'}`}
            >
              {t('admin.dashboard.tab.conversations')}
            </button>
            <button 
              onClick={() => setActiveTab('quality_reports')}
              className={`px-6 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'quality_reports' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'}`}
            >
              {t('admin.dashboard.tab.qualityReports') || 'Quality Reports'}
            </button>
            <button 
              onClick={() => setActiveTab('support')}
              className={`px-6 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'support' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'}`}
            >
              {t('admin.dashboard.tab.support')}
            </button>
          </div>
        </div>

        {activeTab === 'overview' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="bg-white border-none shadow-sm p-6" hover={false}>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.dashboard.stat.unassigned')}</p>
                <p className="text-2xl font-bold">{unassignedCases.length}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-white border-none shadow-sm p-6" hover={false}>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.dashboard.stat.active')}</p>
                <p className="text-2xl font-bold">{activeCases.length}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-white border-none shadow-sm p-6" hover={false}>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.dashboard.stat.completed')}</p>
                <p className="text-2xl font-bold">{completedCases.length}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-white border-none shadow-sm p-6" hover={false}>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-gray-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.dashboard.stat.totalStaff')}</p>
                <p className="text-2xl font-bold">{consultants.length + qualitySpecialists.length}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="p-8 border-none shadow-sm bg-white" hover={false}>
              <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <BarChart3 className="w-5 h-5 text-gray-400" /> {t('admin.dashboard.chart.title')}
              </h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <Tooltip 
                      cursor={{ fill: '#f9fafb' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <section>
              <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <UserPlus className="w-5 h-5 text-amber-500" /> {t('admin.dashboard.section.newConsultations')}
              </h2>
              <div className="space-y-4">
                {unassignedCases.length > 0 ? (
                  unassignedCases.map(c => (
                    <Card key={c.id} className="p-6 border-none shadow-sm bg-white" hover={false}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                            <User className="w-6 h-6 text-gray-300" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">{c.clientName || t('common.client')}</h3>
                            <p className="text-xs text-gray-500">{t('client.goal')}: <span className="capitalize">{t(`intake.goal_${c.intake.goal}`)}</span> • {t('client.started_on')} {formatDate(c.createdAt, language)}</p>
                            {c.intake.selectedConsultantName ? (
                              <div className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
                                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 border border-blue-100">
                                  {t('intake.requested_consultant_label')}: {c.intake.selectedConsultantName}
                                </span>
                                {c.intake.selectedConsultantUid ? (
                                  <Link href={`/consultants/${c.intake.selectedConsultantUid}`} className="text-blue-600 hover:text-blue-700 underline underline-offset-2">
                                    {t('intake.view_consultant_profile')}
                                  </Link>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        
                        <div className={`flex flex-col gap-2 ${isRTL ? 'items-end' : ''}`}>
                          {assigningCaseId === c.id ? (
                            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <select 
                                value={selectedConsultantId}
                                onChange={(e) => setSelectedConsultantId(e.target.value)}
                                className={`px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black ${isRTL ? 'text-right' : ''}`}
                              >
                                <option value="">{t('admin.dashboard.case.assignConsultant')}</option>
                                {consultants.map(con => (
                                  <option key={con.uid} value={con.uid}>
                                    {con.name}{c.intake.selectedConsultantUid === con.uid ? ` • ${t('intake.requested_consultant_short')}` : ''}
                                  </option>
                                ))}
                              </select>
                              <Button onClick={() => handleAssign(c.id)} className="h-10 px-4 rounded-lg text-sm">{t('admin.dashboard.case.assignConsultant')}</Button>
                              <Button variant="ghost" onClick={() => setAssigningCaseId(null)} className="h-10 px-4 rounded-lg text-sm">{t('common.cancel')}</Button>
                            </div>
                          ) : (
                            <Button onClick={() => startConsultantAssignment(c)} className="h-10 px-6 rounded-lg">{t('admin.dashboard.case.assignConsultant')}</Button>
                          )}

                          {assigningQualityCaseId === c.id ? (
                            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <select 
                                value={selectedQualityId}
                                onChange={(e) => setSelectedQualityId(e.target.value)}
                                className={`px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black ${isRTL ? 'text-right' : ''}`}
                              >
                                <option value="">{t('admin.dashboard.case.assignQuality')}</option>
                                {qualitySpecialists.map(q => (
                                  <option key={q.uid} value={q.uid}>{q.displayName}</option>
                                ))}
                              </select>
                              <Button onClick={() => handleAssignQuality(c.id)} className="h-10 px-4 rounded-lg text-sm">{t('admin.dashboard.case.assignQuality')}</Button>
                              <Button variant="ghost" onClick={() => setAssigningQualityCaseId(null)} className="h-10 px-4 rounded-lg text-sm">{t('common.cancel')}</Button>
                            </div>
                          ) : (
                            <Button variant="outline" onClick={() => setAssigningQualityCaseId(c.id)} className="h-10 px-6 rounded-lg">{t('admin.dashboard.case.assignQuality')}</Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="py-12 text-center bg-white border-dashed border-2 border-gray-200" hover={false}>
                    <p className="text-gray-500">{t('admin.dashboard.no_unassigned')}</p>
                  </Card>
                )}
              </div>
            </section>

            <section>
              <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Clock className="w-5 h-5 text-blue-500" /> {t('admin.dashboard.section.activeProgress')}
              </h2>
              <div className="space-y-4">
                {activeCases.map(c => (
                  <Card key={c.id} className="p-4 bg-white border-none shadow-sm">
                    <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-300" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{c.clientName}</p>
                          <p className="text-[10px] text-gray-400">{t('client.assigned_consultant')}: {c.consultantName || consultants.find(con => con.uid === c.consultantId)?.name || t('common.unknown')}</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Badge variant="info" className="text-[10px] uppercase">{t(`case.stage.${c.stage}`)}</Badge>
                        <Link href={`/admin/cases/${c.id}`}>
                          <ChevronRight className={`w-5 h-5 text-gray-300 ${isRTL ? 'rotate-180' : ''}`} />
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <Card className="bg-black text-white border-none p-8" hover={false}>
              <h3 className={`text-lg font-bold mb-6 ${isRTL ? 'text-right' : ''}`}>{t('admin.dashboard.section.staffLoad')}</h3>
              
              <div className="space-y-8">
                <div>
                  <p className={`text-xs font-bold text-gray-500 uppercase mb-4 tracking-wider ${isRTL ? 'text-right' : ''}`}>{t('admin.dashboard.section.consultantsLoad')}</p>
                  <div className="space-y-4">
                    {consultants.map(con => {
                      const load = cases.filter(c => c.consultantId === con.uid && c.status !== 'completed').length;
                      return (
                        <div key={con.uid} className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden relative">
                              {con.avatarUrl ? (
                                <Image 
                                  src={con.avatarUrl} 
                                  alt="" 
                                  fill 
                                  className="object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <User className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                            <span className="text-sm font-medium">{con.name}</span>
                          </div>
                          <Badge variant={load > 3 ? 'warning' : 'success'} className="text-[10px]">{load} {t('admin.dashboard.stat.active')}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className={`text-xs font-bold text-gray-500 uppercase mb-4 tracking-wider ${isRTL ? 'text-right' : ''}`}>{t('admin.dashboard.section.qualityLoad')}</p>
                  <div className="space-y-4">
                    {qualitySpecialists.map(q => {
                      const load = cases.filter(c => c.qualitySpecialistId === q.uid && c.status !== 'completed').length;
                      return (
                        <div key={q.uid} className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                              <Shield className="w-4 h-4 text-emerald-500" />
                            </div>
                            <span className="text-sm font-medium">{q.displayName}</span>
                          </div>
                          <Badge variant={load > 5 ? 'warning' : 'success'} className="text-[10px]">{load} {t('admin.dashboard.stat.active')}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-white border-none shadow-sm p-8" hover={false}>
              <h3 className={`text-lg font-bold mb-4 ${isRTL ? 'text-right' : ''}`}>{t('admin.dashboard.section.actions')}</h3>
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className={`w-full justify-start text-sm h-11 rounded-xl ${isRTL ? 'flex-row-reverse' : ''}`}
                  as={Link}
                  href="/admin/clients"
                >
                  <div className="flex items-center w-full">
                    <Users className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('admin.clients.title') || 'Client Management'}
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  className={`w-full justify-start text-sm h-11 rounded-xl ${isRTL ? 'flex-row-reverse' : ''}`}
                  as={Link}
                  href="/admin/staff"
                >
                  <div className="flex items-center w-full">
                    <Users className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('admin.staff.title') || 'Staff Management'}
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  className={`w-full justify-start text-sm h-11 rounded-xl ${isRTL ? 'flex-row-reverse' : ''}`}
                  as={Link}
                  href="/admin/staff/add"
                >
                  <div className="flex items-center w-full">
                    <Shield className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('admin.dashboard.action.addQuality')}
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  className={`w-full justify-start text-sm h-11 rounded-xl ${isRTL ? 'flex-row-reverse' : ''}`}
                  onClick={() => setShowSettingsModal(true)}
                >
                  <Shield className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('admin.dashboard.action.settings')}
                </Button>
                <Button 
                  variant="outline" 
                  className={`w-full justify-start text-sm h-11 rounded-xl ${isRTL ? 'flex-row-reverse' : ''}`}
                  onClick={() => setShowExportModal(true)}
                >
                  <TrendingUp className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('admin.dashboard.action.export')}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </>
      ) : activeTab === 'conversations' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cases.map(c => (
                <Card key={c.id} className="p-6 bg-white border-none shadow-sm flex flex-col justify-between">
                  <div className={isRTL ? 'text-right' : ''}>
                    <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Badge variant={c.status === 'completed' ? 'success' : 'info'} className="text-[10px] uppercase">
                        {t(`case.status.${c.status}`)}
                      </Badge>
                      <span className="text-[10px] text-gray-400">{formatDate(c.createdAt, language)}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">{c.clientName || t('common.client')}</h3>
                    <p className="text-xs text-gray-500 mb-4">{t('client.assigned_consultant')}: {c.consultantName || t('admin.dashboard.stat.unassigned')}</p>
                    <div className="bg-gray-50 p-3 rounded-lg mb-6">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('client.goal')}</p>
                      <p className="text-xs text-gray-700 line-clamp-2">{t(`intake.goal_${c.intake.goal}`)}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full text-xs h-10 rounded-lg" as={Link} href={`/cases/${c.id}/chat`}>
                    {t('admin.dashboard.case.monitor')}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        ) : activeTab === 'staff' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="p-8 bg-white border-none shadow-sm" hover={false}>
              <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h2 className={`text-xl font-bold flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Users className="w-5 h-5 text-blue-500" /> {t('admin.dashboard.tab.staff')}
                </h2>
                <Badge variant="info">{consultants.length}</Badge>
              </div>
                      <div className="space-y-4">
                        {consultants.map(con => {
                          const consultantCases = cases.filter(c => c.consultantId === con.uid && c.status !== 'completed');
                          const load = consultantCases.length;
                          return (
                            <div 
                              key={con.uid} 
                              className="p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => {
                                setSelectedStaff({ ...con, role: 'consultant' });
                                setShowStaffDetailsModal(true);
                              }}
                            >
                              <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                    {con.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold">{con.name}</p>
                                    <p className="text-[10px] text-gray-500">{con.specialties.join(', ')}</p>
                                  </div>
                                </div>
                                <div className={isRTL ? 'text-left' : 'text-right'}>
                                  <p className="text-xs font-bold">{load} {t('admin.dashboard.stat.active')}</p>
                                  <p className="text-[10px] text-gray-400">{t('common.rating')}: {con.rating}/5</p>
                                </div>
                              </div>
                              {consultantCases.length > 0 && (
                                <div className={`mt-2 pt-2 border-t border-gray-200/50 ${isRTL ? 'text-right' : ''}`}>
                                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">{t('admin.dashboard.section.activeProgress')}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {consultantCases.map(c => (
                                      <Badge key={c.id} variant="default" className="text-[9px] py-0 px-1.5 bg-white text-gray-600 border border-gray-200">
                                        {c.clientName}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
            </Card>

            {/* Quality Specialists List */}
            <Card className="p-8 bg-white border-none shadow-sm" hover={false}>
              <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h2 className={`text-xl font-bold flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Shield className="w-5 h-5 text-emerald-500" /> {t('admin.dashboard.section.qualityLoad')}
                </h2>
                <Badge variant="success">{qualitySpecialists.length}</Badge>
              </div>
              <div className="space-y-4">
                {qualitySpecialists.map(q => {
                  const specialistCases = cases.filter(c => c.qualitySpecialistId === q.uid && c.status !== 'completed');
                  const load = specialistCases.length;
                  return (
                    <div 
                      key={q.uid} 
                      className="p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => {
                        setSelectedStaff({ ...q, role: 'quality' });
                        setShowStaffDetailsModal(true);
                      }}
                    >
                      <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold">
                            {q.displayName?.charAt(0) || 'Q'}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{q.displayName}</p>
                            <p className="text-[10px] text-gray-500">{q.specialties?.join(', ') || t('quality.specialist')}</p>
                          </div>
                        </div>
                        <div className={isRTL ? 'text-left' : 'text-right'}>
                          <p className="text-xs font-bold">{load} {t('admin.dashboard.stat.active')}</p>
                        </div>
                      </div>
                      {specialistCases.length > 0 && (
                        <div className={`mt-2 pt-2 border-t border-gray-200/50 ${isRTL ? 'text-right' : ''}`}>
                          <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">{t('admin.dashboard.section.activeProgress')}</p>
                          <div className="flex flex-wrap gap-1">
                            {specialistCases.map(c => (
                              <Badge key={c.id} variant="default" className="text-[9px] py-0 px-1.5 bg-white text-gray-600 border border-gray-200">
                                {c.clientName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </>
      ) : activeTab === 'quality_reports' ? (
          <div className="space-y-6">
            <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Shield className="w-5 h-5 text-emerald-500" /> {t('admin.dashboard.tab.qualityReports') || 'Quality Reports'}
            </h2>
            <div className="grid grid-cols-1 gap-6">
              {qualityReports.length > 0 ? (
                qualityReports.map(report => {
                  const caseInfo = cases.find(c => c.id === report.caseId);
                  const qualitySpecialist = qualitySpecialists.find(q => q.uid === report.specialistId);
                  return (
                    <Card key={report.id} className="p-6 bg-white border-none shadow-sm">
                      <div className={`flex flex-col md:flex-row justify-between gap-4 ${isRTL ? 'md:flex-row-reverse text-right' : ''}`}>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg mb-2">
                            {t('quality.report_for_case')} #{report.caseId.slice(-6)} 
                            {caseInfo?.clientName && <span className="text-gray-400 font-normal text-sm block md:inline md:mx-2">({caseInfo.clientName})</span>}
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-4">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">{t('common.client')}:</span> {caseInfo?.clientName || t('common.na')}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">{t('quality.specialist')}:</span> {qualitySpecialist?.displayName || report.specialistId}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">{t('common.date')}:</span> {formatDate(report.createdAt, language)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-3 mb-4">
                            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <span className="text-xs font-medium text-gray-500">{t('quality.status')}:</span>
                              <Badge variant={report.status === 'completed' ? 'success' : 'warning'} className="text-[10px]">
                                {t(`quality.status.${report.status}`)}
                              </Badge>
                            </div>
                            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <span className="text-xs font-medium text-gray-500">{t('quality.classification')}:</span>
                              <Badge variant={report.classification === 'critical' ? 'error' : 'default'} className="text-[10px]">
                                {t(`quality.classification.${report.classification}`)}
                              </Badge>
                            </div>
                            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <span className="text-xs font-medium text-gray-500">{t('quality.meetingStatus')}:</span>
                              <Badge variant={report.meetingStatus === 'recorded' ? 'success' : report.meetingStatus === 'failed' ? 'error' : 'warning'} className="text-[10px]">
                                {t(`quality.meetingStatus.${report.meetingStatus}`)}
                              </Badge>
                            </div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-sm break-words"><span className="font-medium">{t('quality.notes')}:</span> {report.notes}</p>
                          </div>
                        </div>
                        <div className={`flex flex-col gap-2 ${isRTL ? 'items-start' : 'items-end'} w-full md:w-auto mt-4 md:mt-0 justify-center`}>
                          <Button variant="outline" className="w-full md:w-auto whitespace-nowrap" as={Link} href={`/admin/cases/${report.caseId}`}>
                            {t('admin.dashboard.view_case')}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <Card className="py-12 text-center bg-white border-dashed border-2 border-gray-200" hover={false}>
                  <p className="text-gray-500">{t('admin.dashboard.no_reports') || 'No quality reports found.'}</p>
                </Card>
              )}
            </div>
          </div>
        ) : activeTab === 'support' ? (
          <AdminSupportWorkspace />
        ) : null}
      </main>
      
      {/* Staff Details Modal */}
      {showStaffDetailsModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`max-w-lg w-full p-8 bg-white border-none shadow-2xl ${isRTL ? 'text-right' : ''}`} hover={false}>
            <div className={`flex items-start justify-between mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${selectedStaff.role === 'consultant' ? 'bg-blue-100 text-blue-600' : selectedStaff.role === 'quality' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {(selectedStaff.name || selectedStaff.displayName)?.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{selectedStaff.name || selectedStaff.displayName}</h2>
                  <p className="text-gray-500">{t(`auth.demo_${selectedStaff.role}`)}</p>
                </div>
              </div>
              <Badge variant={selectedStaff.status === 'deactivated' ? 'error' : 'success'}>
                {t(`admin.dashboard.staff.${selectedStaff.status || 'active'}`)}
              </Badge>
            </div>

            <div className="space-y-6 mb-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{t('admin.dashboard.modal.addUser.email')}</p>
                  <p className="text-sm font-medium">{selectedStaff.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{t('admin.dashboard.modal.addUser.phone')}</p>
                  <p className="text-sm font-medium">{selectedStaff.phoneNumber || t('common.na')}</p>
                </div>
              </div>

              {selectedStaff.role === 'consultant' && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{t('admin.dashboard.modal.addUser.experience')}</p>
                    <p className="text-sm font-medium">{selectedStaff.experienceYears} {t('dashboard.years_experience')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{t('common.rating')}</p>
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      {selectedStaff.rating}/5
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase">{t('admin.dashboard.modal.addUser.specialties')}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedStaff.specialties?.map((s: string, i: number) => (
                    <Badge key={i} variant="default" className="bg-gray-100 text-gray-600 border-none">{s}</Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase">{t('admin.dashboard.modal.addUser.bio')}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{selectedStaff.bio || selectedStaff.professionalSummary || t('common.na')}</p>
              </div>

              {/* Active Cases for Reassignment */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase">{t('admin.dashboard.section.activeProgress')}</p>
                {(() => {
                  const staffCases = cases.filter(c => (c.consultantId === selectedStaff.uid || c.qualitySpecialistId === selectedStaff.uid || c.clientId === selectedStaff.uid) && c.status !== 'completed');
                  if (staffCases.length === 0) return <p className="text-xs text-gray-400 italic">{t('admin.dashboard.no_active_cases') || 'No active cases'}</p>;
                  return (
                    <div className="space-y-3">
                      {staffCases.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className={isRTL ? 'text-right' : ''}>
                            <p className="text-xs font-bold">{c.clientName}</p>
                            <p className="text-[10px] text-gray-500">#{c.id.slice(-6)} • {t(`case.stage.${c.stage}`)}</p>
                          </div>
                          {reassigningCaseId === c.id ? (
                            <div className="flex items-center gap-2">
                              <select 
                                value={reassignToId}
                                onChange={(e) => setReassignToId(e.target.value)}
                                className="text-[10px] p-1 border border-gray-200 rounded bg-white"
                              >
                                <option value="">{t('common.select')}</option>
                                {selectedStaff.role === 'consultant' 
                                  ? consultants.filter(con => con.uid !== selectedStaff.uid && con.status !== 'deactivated').map(con => <option key={con.uid} value={con.uid}>{con.name}</option>)
                                  : qualitySpecialists.filter(q => q.uid !== selectedStaff.uid && q.status !== 'deactivated').map(q => <option key={q.uid} value={q.uid}>{q.displayName}</option>)
                                }
                              </select>
                              <Button 
                                size="sm" 
                                className="h-7 px-2 text-[10px]" 
                                onClick={() => handleReassignCase(c.id, reassignToId, selectedStaff.role)}
                                loading={isReassigning}
                              >
                                {t('common.save')}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 text-[10px]" 
                                onClick={() => setReassigningCaseId(null)}
                              >
                                {t('common.cancel')}
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 px-2 text-[10px]" 
                              onClick={() => setReassigningCaseId(c.id)}
                            >
                              {t('admin.dashboard.case.reassign') || 'Reassign'}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button variant="ghost" className="flex-1" onClick={() => setShowStaffDetailsModal(false)}>{t('common.back')}</Button>
              <Button 
                variant={selectedStaff.status === 'deactivated' ? 'default' : 'outline'} 
                className={`flex-1 ${selectedStaff.status !== 'deactivated' ? 'text-red-600 hover:bg-red-50 border-red-200' : ''}`}
                onClick={() => handleToggleUserStatus(selectedStaff.uid, selectedStaff.status || 'active')}
                loading={updatingStatus}
              >
                {selectedStaff.status === 'deactivated' ? (
                  <><UserCheck className="w-4 h-4 mr-2" /> {t('admin.dashboard.staff.activate')}</>
                ) : (
                  <><UserX className="w-4 h-4 mr-2" /> {t('admin.dashboard.staff.deactivate')}</>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
      
      {/* System Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`max-w-md w-full p-8 bg-white border-none shadow-2xl ${isRTL ? 'text-right' : ''}`} hover={false}>
            <h2 className="text-2xl font-bold mb-6">{t('admin.dashboard.modal.settings.title')}</h2>
            <div className="space-y-6">
              <div className={`flex items-center justify-between p-4 bg-gray-50 rounded-xl ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div>
                  <p className="text-sm font-bold">{t('admin.dashboard.modal.settings.registrations')}</p>
                  <p className="text-[10px] text-gray-500">{t('admin.dashboard.modal.settings.registrations_desc')}</p>
                </div>
                <div className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-pointer">
                  <div className={`absolute ${isRTL ? 'left-1' : 'right-1'} top-1 w-4 h-4 bg-white rounded-full shadow-sm`} />
                </div>
              </div>
              <div className={`flex items-center justify-between p-4 bg-gray-50 rounded-xl ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div>
                  <p className="text-sm font-bold">{t('admin.dashboard.modal.settings.maintenance')}</p>
                  <p className="text-[10px] text-gray-500">{t('admin.dashboard.modal.settings.maintenance_desc')}</p>
                </div>
                <div className="w-12 h-6 bg-gray-300 rounded-full relative cursor-pointer">
                  <div className={`absolute ${isRTL ? 'right-1' : 'left-1'} top-1 w-4 h-4 bg-white rounded-full shadow-sm`} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('admin.dashboard.modal.settings.fee')} (EGP)</label>
                <input 
                  type="number" 
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(Number(e.target.value))}
                  className={`w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-black focus:outline-none ${isRTL ? 'text-right' : ''}`}
                />
              </div>
              <div className={`flex gap-3 pt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Button variant="ghost" className="flex-1" onClick={() => setShowSettingsModal(false)}>{t('common.cancel')}</Button>
                <Button className="flex-1" onClick={handleSaveSettings} disabled={isSavingSettings}>
                  {isSavingSettings ? t('common.saving') || 'Saving...' : t('common.save')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Export Reports Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`max-w-md w-full p-8 bg-white border-none shadow-2xl ${isRTL ? 'text-right' : ''}`} hover={false}>
            <h2 className="text-2xl font-bold mb-6">{t('admin.dashboard.modal.export.title')}</h2>
            <p className="text-sm text-gray-500 mb-6">{t('admin.dashboard.modal.export.subtitle')}</p>
            <div className="space-y-3">
              <button 
                onClick={() => {
                  const exportData = cases.map(c => ({
                    ID: c.id,
                    Client: c.clientName,
                    Consultant: c.consultantName || 'Unassigned',
                    Quality: qualitySpecialists.find(q => q.uid === c.qualitySpecialistId)?.displayName || 'Unassigned',
                    Status: c.status,
                    Stage: c.stage,
                    CreatedAt: new Date(c.createdAt).toLocaleDateString()
                  }));
                  exportToCSV(exportData, 'consultations.csv');
                  toast.success(t('admin.dashboard.export_consultations_success'));
                  setShowExportModal(false);
                }}
                className={`w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold">{t('admin.dashboard.modal.export.consultations')}</span>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 group-hover:text-black transition-colors ${isRTL ? 'rotate-180' : ''}`} />
              </button>
              <button 
                onClick={() => {
                  const exportData = [
                    ...consultants.map(c => ({ Role: 'Consultant', Name: c.name, ID: c.uid })),
                    ...qualitySpecialists.map(q => ({ Role: 'Quality Specialist', Name: q.displayName, ID: q.uid }))
                  ];
                  exportToCSV(exportData, 'staff.csv');
                  toast.success(t('admin.dashboard.export_staff_success'));
                  setShowExportModal(false);
                }}
                className={`w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold">{t('admin.dashboard.modal.export.staff')}</span>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 group-hover:text-black transition-colors ${isRTL ? 'rotate-180' : ''}`} />
              </button>
              <button 
                onClick={() => {
                  const exportData = qualityReports.map(r => ({
                    ID: r.id,
                    CaseID: r.caseId,
                    QualitySpecialist: qualitySpecialists.find(q => q.uid === r.specialistId)?.displayName || r.specialistId,
                    Status: r.status,
                    Classification: r.classification,
                    MeetingStatus: r.meetingStatus,
                    Notes: r.notes,
                    CreatedAt: new Date(r.createdAt).toLocaleDateString()
                  }));
                  exportToCSV(exportData, 'quality_reports.csv');
                  toast.success(t('admin.dashboard.export_financial_success') || 'Exported Quality Reports');
                  setShowExportModal(false);
                }}
                className={`w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500">
                    <Shield className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold">{t('admin.dashboard.tab.qualityReports') || 'Quality Reports'}</span>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 group-hover:text-black transition-colors ${isRTL ? 'rotate-180' : ''}`} />
              </button>
              <div className="pt-4">
                <Button variant="ghost" className="w-full" onClick={() => setShowExportModal(false)}>{t('common.cancel')}</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
