'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { paginationService, userService } from '@/src/lib/db';
import { UserProfile } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import Navbar from '@/src/components/Navbar';
import { Users, Search, Filter, ChevronLeft, ChevronRight, User, Download, X, Phone, Mail } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/src/context/LanguageContext';
import { formatDate } from '@/src/lib/utils';
import { toast } from 'react-hot-toast';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { useFocusTrap } from '@/src/hooks/useFocusTrap';

const PAGE_SIZE = 25;

export default function AdminClientsPage() {
  const { t, language, isRTL } = useLanguage();
  const { profile, loading: authLoading } = useRoleGuard(['admin']);

  const [clients, setClients] = useState<UserProfile[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [fetchingClients, setFetchingClients] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'with_consultations' | 'without_consultations'>('all');
  const [selectedClient, setSelectedClient] = useState<UserProfile | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const clientModalRef = useFocusTrap(!!selectedClient, () => setSelectedClient(null));

  const loadInitial = useCallback(async () => {
    setFetchingClients(true);
    try {
      const result = await paginationService.getClients(PAGE_SIZE);
      setClients(result.items);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setFetchingClients(false);
    }
  }, [t]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await paginationService.getClients(PAGE_SIZE, lastDoc);
      setClients((prev) => [...prev, ...result.items]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleStatus = async (uid: string, currentStatus: string) => {
    setUpdatingStatus(true);
    try {
      const newStatus = currentStatus === 'active' ? 'deactivated' : 'active';
      await userService.updateUserProfile(uid, { status: newStatus });
      toast.success(t('common.success'));
      setClients((prev) => prev.map((c) => c.uid === uid ? { ...c, status: newStatus } : c));
      if (selectedClient?.uid === uid) setSelectedClient({ ...selectedClient, status: newStatus });
    } catch {
      toast.error(t('common.error'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredClients = clients.filter((c) => {
    const lq = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      (c.displayName?.toLowerCase().includes(lq) ?? false) ||
      (c.email?.toLowerCase().includes(lq) ?? false);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'with_consultations' ? c.totalConsultations > 0 : c.totalConsultations === 0);
    return matchesSearch && matchesFilter;
  });

  const totalClients = clients.length;
  const clientsWithConsultations = clients.filter((c) => c.totalConsultations > 0).length;
  const clientsWithoutConsultations = clients.filter((c) => c.totalConsultations === 0).length;

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Joined', 'Total Consultations', 'Status'];
    const rows = filteredClients.map((c) => [
      c.displayName, c.email, formatDate(c.createdAt, language),
      c.totalConsultations, c.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clients.csv'; a.click();
  };

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar forceLanguage={language} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className={`flex items-center justify-between mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Button variant="ghost" className="p-2" as={Link} href="/admin/dashboard">
              {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-ink">{t('admin.clients.title') || 'Client Management'}</h1>
          </div>
          <Button variant="outline" onClick={exportToCSV} className="flex items-center gap-2">
            <Download className="w-4 h-4" /> {t('common.export') || 'Export'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: t('admin.clients.total') || 'Total Clients', value: totalClients, color: 'blue' },
            { label: t('admin.clients.with_consultations') || 'With Consultations', value: clientsWithConsultations, color: 'emerald' },
            { label: t('admin.clients.without_consultations') || 'Without Consultations', value: clientsWithoutConsultations, color: 'slate' },
          ].map(({ label, value, color }) => (
            <Card key={label} className="p-6 bg-white border-none shadow-sm">
              <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className={`w-12 h-12 bg-${color}-50 rounded-xl flex items-center justify-center`}>
                  <Users className={`w-6 h-6 text-${color}-500`} />
                </div>
                <div>
                  <p className="text-sm text-brand-slate">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="bg-white border-none shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className={`p-6 border-b border-soft-blue flex flex-col sm:flex-row gap-4 justify-between items-center ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <div className={`relative w-full sm:w-96 ${isRTL ? 'text-right' : ''}`}>
              <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-brand-slate ${isRTL ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                placeholder={t('admin.clients.search') || 'Search clients…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full py-2 bg-cloud border border-soft-blue rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
              />
            </div>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Filter className="w-5 h-5 text-brand-slate" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="py-2 px-3 bg-cloud border border-soft-blue rounded-lg focus:outline-none focus:border-blue-600 text-sm"
              >
                <option value="all">{t('admin.clients.filter.all') || 'All Clients'}</option>
                <option value="with_consultations">{t('admin.clients.filter.with') || 'With Consultations'}</option>
                <option value="without_consultations">{t('admin.clients.filter.without') || 'Without Consultations'}</option>
              </select>
            </div>
          </div>

          {fetchingClients ? (
            <div className="p-12 text-center text-brand-slate flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-soft-blue border-t-blue-600 rounded-full animate-spin" />
              {t('common.loading') || 'Loading…'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                <thead className="bg-cloud text-brand-slate uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 font-medium">{t('admin.clients.table.client') || 'Client'}</th>
                    <th className="px-6 py-4 font-medium">{t('admin.clients.table.joined') || 'Joined'}</th>
                    <th className="px-6 py-4 font-medium text-center">{t('admin.clients.table.total_consultations') || 'Total'}</th>
                    <th className="px-6 py-4 font-medium text-center">{t('admin.clients.table.active') || 'Active'}</th>
                    <th className="px-6 py-4 font-medium text-center">{t('admin.clients.table.completed') || 'Done'}</th>
                    <th className="px-6 py-4 font-medium text-center">{t('admin.clients.table.status') || 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-soft-blue">
                  {filteredClients.length > 0 ? (
                    filteredClients.map((client) => (
                      <tr key={client.uid} className="hover:bg-cloud transition-colors cursor-pointer" onClick={() => setSelectedClient(client)}>
                        <td className="px-6 py-4">
                          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <div className="w-10 h-10 bg-soft-blue rounded-full flex items-center justify-center overflow-hidden relative shrink-0">
                              {client.avatarUrl ? <Image src={client.avatarUrl} alt="" fill className="object-cover" /> : <User className="w-5 h-5 text-brand-slate" />}
                            </div>
                            <div>
                              <p className="font-medium text-ink">{client.displayName || t('common.unknown')}</p>
                              <p className="text-xs text-brand-slate">{client.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-brand-slate">{formatDate(client.createdAt, language)}</td>
                        <td className="px-6 py-4 text-center font-medium">{client.totalConsultations}</td>
                        <td className="px-6 py-4 text-center">
                          {client.activeConsultations > 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{client.activeConsultations}</span>
                          ) : <span className="text-brand-slate/40">-</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {client.completedConsultations > 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{client.completedConsultations}</span>
                          ) : <span className="text-brand-slate/40">-</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant={client.status === 'active' ? 'success' : 'error'}>
                            {client.status === 'active' ? t('admin.dashboard.staff.active') : t('admin.dashboard.staff.deactivated')}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-brand-slate">
                        {t('admin.clients.no_results') || 'No clients found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Pagination footer */}
              {hasMore && !searchQuery && (
                <div className="px-6 py-4 border-t border-soft-blue flex items-center justify-between text-sm text-brand-slate">
                  <span>{clients.length} loaded</span>
                  <Button variant="outline" size="sm" onClick={loadMore} loading={loadingMore}>
                    {t('consultants.dir.load_more') || 'Load More'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </main>

      {/* Client Details Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setSelectedClient(null); }}>
          <div ref={clientModalRef} role="dialog" aria-modal="true" aria-labelledby="client-modal-title" className="w-full max-w-md">
          <Card className="bg-white shadow-xl overflow-hidden">
            <div className={`flex items-center justify-between p-6 border-b border-soft-blue ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 id="client-modal-title" className="text-xl font-bold text-ink">{t('admin.dashboard.clients.view_profile') || 'Client Profile'}</h3>
              <Button variant="ghost" className="p-2" aria-label={t('common.close') || 'Close'} onClick={() => setSelectedClient(null)}>
                <X className="w-5 h-5" aria-hidden="true" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className="w-16 h-16 bg-soft-blue rounded-full flex items-center justify-center overflow-hidden relative shrink-0">
                  {selectedClient.avatarUrl ? <Image src={selectedClient.avatarUrl} alt="" fill className="object-cover" /> : <User className="w-8 h-8 text-brand-slate" />}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-ink">{selectedClient.displayName || t('common.unknown')}</h4>
                  <Badge variant="info" className="capitalize mt-1">{t('admin.clients.table.client') || 'Client'}</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className={`flex items-center gap-3 text-sm text-brand-slate ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Mail className="w-4 h-4" /><span>{selectedClient.email}</span>
                </div>
                {selectedClient.phoneNumber && (
                  <div className={`flex items-center gap-3 text-sm text-brand-slate ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Phone className="w-4 h-4" /><span dir="ltr">{selectedClient.phoneNumber}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-soft-blue">
                {[
                  { label: t('admin.clients.table.total_consultations') || 'Total', value: selectedClient.totalConsultations || 0, color: 'text-ink' },
                  { label: t('admin.clients.table.active') || 'Active', value: selectedClient.activeConsultations || 0, color: 'text-blue-600' },
                  { label: t('admin.clients.table.completed') || 'Done', value: selectedClient.completedConsultations || 0, color: 'text-emerald-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-cloud p-3 rounded-lg text-center">
                    <p className="text-xs text-brand-slate mb-1">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-soft-blue">
                <Button
                  variant={selectedClient.status === 'active' ? 'outline' : 'primary'}
                  className={`w-full ${selectedClient.status === 'active' ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}`}
                  onClick={() => handleToggleStatus(selectedClient.uid, selectedClient.status || 'active')}
                  loading={updatingStatus}
                >
                  {selectedClient.status === 'active' ? t('admin.dashboard.staff.deactivate') : t('admin.dashboard.staff.activate')}
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
