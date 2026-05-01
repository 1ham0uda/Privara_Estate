'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { paginationService, userService, consultantService, consultationService } from '@/src/lib/db';
import { UserProfile, UserRole, ConsultationCase } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import Navbar from '@/src/components/Navbar';
import { Users, Search, Filter, ChevronLeft, User, Download, Loader2, Plus, X, Phone, Briefcase, Mail } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/src/context/LanguageContext';
import { toast } from 'react-hot-toast';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { useFocusTrap } from '@/src/hooks/useFocusTrap';

const PAGE_SIZE = 50;

export default function AdminStaffPage() {
  useRoleGuard(['admin']);
  const { t, isRTL } = useLanguage();

  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [cases, setCases] = useState<ConsultationCase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<UserRole | 'all'>('all');
  const [selectedStaff, setSelectedStaff] = useState<UserProfile | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const staffModalRef = useFocusTrap(!!selectedStaff, () => setSelectedStaff(null));

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const result = await paginationService.getStaff(PAGE_SIZE);
      setStaff(result.items);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadInitial();
    const unsubscribe = consultationService.subscribeToConsultations('admin', 'admin', setCases, 200);
    return unsubscribe;
  }, [loadInitial]);

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await paginationService.getStaff(PAGE_SIZE, lastDoc);
      setStaff((prev) => [...prev, ...result.items]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleStatus = async (uid: string, currentStatus: string) => {
    const activeCases = cases.filter(
      (c) => (c.consultantId === uid || c.qualitySpecialistId === uid) && c.status !== 'completed'
    );
    if (currentStatus === 'active' && activeCases.length > 0) {
      toast.error(t('admin.dashboard.staff.error_active_cases'));
      return;
    }
    setUpdatingStatus(true);
    try {
      const newStatus = currentStatus === 'active' ? 'deactivated' : 'active';
      await userService.updateUserProfile(uid, { status: newStatus });
      const target = staff.find((s) => s.uid === uid);
      if (target?.role === 'consultant') {
        await consultantService.updateConsultantProfile(uid, { status: newStatus });
      }
      toast.success(t('common.success'));
      setStaff((prev) => prev.map((s) => s.uid === uid ? { ...s, status: newStatus } : s));
      if (selectedStaff?.uid === uid) setSelectedStaff({ ...selectedStaff, status: newStatus });
    } catch {
      toast.error(t('common.error'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredStaff = staff.filter((s) => {
    const lq = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      (s.displayName?.toLowerCase().includes(lq) ?? false) ||
      (s.email?.toLowerCase().includes(lq) ?? false);
    return matchesSearch && (filter === 'all' || s.role === filter);
  });

  const exportToCSV = () => {
    const headers = [t('admin.staff.table.name'), t('admin.staff.table.email'), t('admin.staff.table.role'), t('admin.staff.table.joined'), t('admin.staff.table.status')];
    const rows = filteredStaff.map((s) => [
      s.displayName, s.email, s.role,
      s.createdAt ? new Date(s.createdAt.seconds * 1000).toLocaleDateString() : t('common.na'),
      s.status || 'active',
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'staff.csv'; a.click();
  };

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="p-2" as={Link} href="/admin/dashboard">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-ink">{t('admin.staff.title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportToCSV} className="flex items-center gap-2">
              <Download className="w-4 h-4" /> {t('common.export')}
            </Button>
            <Button variant="primary" className="flex items-center gap-2" as={Link} href="/admin/staff/add">
              <Plus className="w-4 h-4" /> {t('admin.staff.add') || 'Add Staff'}
            </Button>
          </div>
        </div>

        <Card className="bg-white border-none shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-6 border-b border-soft-blue flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-96">
              <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-5 h-5 text-brand-slate" />
              <input
                type="text"
                placeholder={t('admin.staff.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-2 pl-10 pr-4 bg-cloud border border-soft-blue rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-brand-slate" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="py-2 px-3 bg-cloud border border-soft-blue rounded-lg focus:outline-none focus:border-blue-600 text-sm"
              >
                <option value="all">{t('admin.staff.filter.all')}</option>
                <option value="admin">{t('admin.staff.role.admin')}</option>
                <option value="consultant">{t('admin.staff.role.consultant')}</option>
                <option value="quality">{t('admin.staff.role.quality')}</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-brand-slate flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> {t('common.loading')}
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-12 text-center text-brand-slate">{t('admin.staff.no_results')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-cloud text-brand-slate uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 font-medium">{t('admin.staff.table.staff')}</th>
                    <th className="px-6 py-4 font-medium">{t('admin.staff.table.role')}</th>
                    <th className="px-6 py-4 font-medium">{t('admin.staff.table.joined')}</th>
                    <th className="px-6 py-4 font-medium text-center">{t('admin.staff.table.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-soft-blue">
                  {filteredStaff.map((s) => (
                    <tr key={s.uid} className="hover:bg-cloud transition-colors cursor-pointer" onClick={() => setSelectedStaff(s)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-soft-blue rounded-full flex items-center justify-center overflow-hidden relative shrink-0">
                            {s.avatarUrl ? <Image src={s.avatarUrl} alt="" fill className="object-cover" /> : <User className="w-5 h-5 text-brand-slate" />}
                          </div>
                          <div>
                            <p className="font-medium text-ink">{s.displayName}</p>
                            <p className="text-xs text-brand-slate">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 capitalize">{t(`admin.staff.role.${s.role}`)}</td>
                      <td className="px-6 py-4 text-brand-slate">
                        {s.createdAt ? new Date(s.createdAt.seconds * 1000).toLocaleDateString() : t('common.na')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={s.status === 'active' ? 'success' : 'error'}>
                          {s.status === 'active' ? t('admin.staff.status.active') : t('admin.staff.status.deactivated')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {hasMore && !searchQuery && (
                <div className="px-6 py-4 border-t border-soft-blue flex items-center justify-between text-sm text-brand-slate">
                  <span>{staff.length} loaded</span>
                  <Button variant="outline" size="sm" onClick={loadMore} loading={loadingMore}>
                    {t('consultants.dir.load_more') || 'Load More'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </main>

      {/* Staff Details Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setSelectedStaff(null); }}>
          <div ref={staffModalRef} role="dialog" aria-modal="true" aria-labelledby="staff-modal-title" className="w-full max-w-md">
          <Card className="bg-white shadow-xl overflow-hidden">
            <div className={`flex items-center justify-between p-6 border-b border-soft-blue ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 id="staff-modal-title" className="text-xl font-bold text-ink">{t('admin.dashboard.staff.view_profile') || 'Staff Profile'}</h3>
              <Button variant="ghost" className="p-2 -mr-2" aria-label={t('common.close') || 'Close'} onClick={() => setSelectedStaff(null)}>
                <X className="w-5 h-5" aria-hidden="true" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-soft-blue rounded-full flex items-center justify-center overflow-hidden relative shrink-0">
                  {selectedStaff.avatarUrl ? <Image src={selectedStaff.avatarUrl} alt="" fill className="object-cover" /> : <User className="w-8 h-8 text-brand-slate" />}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-ink">{selectedStaff.displayName}</h4>
                  <Badge variant="info" className="capitalize mt-1">{t(`admin.staff.role.${selectedStaff.role}`)}</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-brand-slate">
                  <Mail className="w-4 h-4" /><span>{selectedStaff.email}</span>
                </div>
                {selectedStaff.phoneNumber && (
                  <div className="flex items-center gap-3 text-sm text-brand-slate">
                    <Phone className="w-4 h-4" /><span dir="ltr">{selectedStaff.phoneNumber}</span>
                  </div>
                )}
                {selectedStaff.experienceYears !== undefined && (
                  <div className="flex items-center gap-3 text-sm text-brand-slate">
                    <Briefcase className="w-4 h-4" />
                    <span>{selectedStaff.experienceYears} {t('admin.dashboard.modal.addUser.experience_years') || 'Years Experience'}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-soft-blue">
                <div className="bg-cloud p-3 rounded-lg text-center">
                  <p className="text-xs text-brand-slate mb-1">{t('admin.clients.table.total_consultations') || 'Total'}</p>
                  <p className="text-xl font-bold text-ink">{selectedStaff.totalConsultations || 0}</p>
                </div>
                <div className="bg-cloud p-3 rounded-lg text-center">
                  <p className="text-xs text-brand-slate mb-1">{t('admin.clients.table.active') || 'Active'}</p>
                  <p className="text-xl font-bold text-blue-600">{selectedStaff.activeConsultations || 0}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-soft-blue">
                <Button
                  variant={selectedStaff.status === 'active' ? 'outline' : 'primary'}
                  className={`w-full ${selectedStaff.status === 'active' ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}`}
                  onClick={() => handleToggleStatus(selectedStaff.uid, selectedStaff.status || 'active')}
                  loading={updatingStatus}
                >
                  {selectedStaff.status === 'active' ? t('admin.dashboard.staff.deactivate') : t('admin.dashboard.staff.activate')}
                </Button>
              </div>
            </div>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}
