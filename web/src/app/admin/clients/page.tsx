'use client';

import React, { useEffect, useState } from 'react';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { userService, consultationService } from '@/src/lib/db';
import { UserProfile, ConsultationCase } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import Navbar from '@/src/components/Navbar';
import { Users, Search, Filter, ChevronLeft, ChevronRight, User, Download, X, Phone, Mail } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/src/context/LanguageContext';
import { formatDate } from '@/src/lib/utils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { toast } from 'react-hot-toast';

export default function AdminClientsPage() {
  const { t, language, isRTL } = useLanguage();
  const { profile, loading } = useRoleGuard(['admin']);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'with_consultations' | 'without_consultations'>('all');
  const [selectedClient, setSelectedClient] = useState<UserProfile | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [fetchingClients, setFetchingClients] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setFetchingClients(true);
      try {
        const users = await userService.getAllUsers();
        const clients = users.filter(u => u.role === 'client');
        setClients(clients);
      } catch (error) {
        console.error('Error fetching clients:', error);
        toast.error(t('common.error') || 'Failed to load clients');
      } finally {
        setFetchingClients(false);
      }
    };
    fetchData();
  }, [t]);

  const handleToggleStatus = async (uid: string, currentStatus: string) => {
    setUpdatingStatus(true);
    try {
      const newStatus = currentStatus === 'active' ? 'deactivated' : 'active';
      await updateDoc(doc(db, 'users', uid), { status: newStatus });
      toast.success(t('common.success') || 'Status updated successfully');
      
      // Update local state
      setClients(clients.map(c => c.uid === uid ? { ...c, status: newStatus } : c));
      if (selectedClient?.uid === uid) {
        setSelectedClient({ ...selectedClient, status: newStatus });
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error(t('common.error') || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredClients = clients.filter(c => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
                          (c.displayName?.toLowerCase().includes(searchLower) ?? false) || 
                          (c.email?.toLowerCase().includes(searchLower) ?? false);
    const matchesFilter = filter === 'all' || (filter === 'with_consultations' ? c.totalConsultations > 0 : c.totalConsultations === 0);
    return matchesSearch && matchesFilter;
  });

  const totalClients = clients.length;
  const clientsWithConsultations = clients.filter(c => c.totalConsultations > 0).length;
  const clientsWithoutConsultations = clients.filter(c => c.totalConsultations === 0).length;

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Joined', 'Total Consultations', 'Status'];
    const rows = filteredClients.map(c => [
      c.displayName,
      c.email,
      formatDate(c.createdAt, language),
      c.totalConsultations,
      c.status
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "clients.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar forceLanguage={language} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className={`flex items-center justify-between mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Button variant="ghost" className="p-2" as={Link} href="/admin/dashboard">
              {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('admin.clients.title') || 'Client Management'}</h1>
          </div>
          <Button variant="outline" onClick={exportToCSV} className="flex items-center gap-2">
            <Download className="w-4 h-4" /> {t('common.export') || 'Export'}
          </Button>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-white border-none shadow-sm">
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.clients.total') || 'Total Clients'}</p>
                <p className="text-2xl font-bold">{totalClients}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6 bg-white border-none shadow-sm">
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.clients.with_consultations') || 'With Consultations'}</p>
                <p className="text-2xl font-bold">{clientsWithConsultations}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6 bg-white border-none shadow-sm">
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-gray-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.clients.without_consultations') || 'Without Consultations'}</p>
                <p className="text-2xl font-bold">{clientsWithoutConsultations}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="bg-white border-none shadow-sm overflow-hidden">
          <div className={`p-6 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <div className={`relative w-full sm:w-96 ${isRTL ? 'text-right' : ''}`}>
              <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
              <input 
                type="text" 
                placeholder={t('admin.clients.search') || 'Search clients by name or email...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
              />
            </div>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Filter className="w-5 h-5 text-gray-400" />
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className={`py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black text-sm ${isRTL ? 'text-right' : ''}`}
              >
                <option value="all">{t('admin.clients.filter.all') || 'All Clients'}</option>
                <option value="with_consultations">{t('admin.clients.filter.with') || 'With Consultations'}</option>
                <option value="without_consultations">{t('admin.clients.filter.without') || 'Without Consultations'}</option>
              </select>
            </div>
          </div>

          {fetchingClients ? (
            <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
              {t('common.loading') || 'Loading...'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">{t('admin.clients.table.client') || 'Client'}</th>
                  <th className="px-6 py-4 font-medium">{t('admin.clients.table.joined') || 'Joined'}</th>
                  <th className="px-6 py-4 font-medium text-center">{t('admin.clients.table.total_consultations') || 'Total Consultations'}</th>
                  <th className="px-6 py-4 font-medium text-center">{t('admin.clients.table.active') || 'Active'}</th>
                  <th className="px-6 py-4 font-medium text-center">{t('admin.clients.table.completed') || 'Completed'}</th>
                  <th className="px-6 py-4 font-medium text-center">{t('admin.clients.table.status') || 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClients.length > 0 ? (
                  filteredClients.map(client => (
                    <tr 
                      key={client.uid} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedClient(client)}
                    >
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden relative shrink-0">
                            {client.avatarUrl ? (
                              <Image src={client.avatarUrl} alt="" fill className="object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{client.displayName || t('common.unknown')}</p>
                            <p className="text-xs text-gray-500">{client.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {formatDate(client.createdAt, language)}
                      </td>
                      <td className="px-6 py-4 text-center font-medium">
                        {client.totalConsultations}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {client.activeConsultations > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                            {client.activeConsultations}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {client.completedConsultations > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                            {client.completedConsultations}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={client.status === 'active' ? 'success' : 'error'}>
                          {client.status === 'active' ? (t('admin.dashboard.staff.active') || 'Active') : (t('admin.dashboard.staff.deactivated') || 'Deactivated')}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      {t('admin.clients.no_results') || 'No clients found matching your criteria.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </Card>
      </main>

      {/* Client Details Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className={`flex items-center justify-between p-6 border-b border-gray-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-xl font-bold text-gray-900">{t('admin.dashboard.clients.view_profile') || 'Client Profile'}</h3>
              <Button variant="ghost" className={`p-2 ${isRTL ? '-ml-2' : '-mr-2'}`} onClick={() => setSelectedClient(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden relative shrink-0">
                  {selectedClient.avatarUrl ? (
                    <Image src={selectedClient.avatarUrl} alt="" fill className="object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{selectedClient.displayName || t('common.unknown')}</h4>
                  <Badge variant="info" className="capitalize mt-1">{t('admin.clients.table.client') || 'Client'}</Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className={`flex items-center gap-3 text-sm text-gray-600 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{selectedClient.email}</span>
                </div>
                {selectedClient.phoneNumber && (
                  <div className={`flex items-center gap-3 text-sm text-gray-600 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span dir="ltr">{selectedClient.phoneNumber}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-500 mb-1">{t('admin.clients.table.total_consultations') || 'Total'}</p>
                  <p className="text-xl font-bold text-gray-900">{selectedClient.totalConsultations || 0}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-500 mb-1">{t('admin.clients.table.active') || 'Active'}</p>
                  <p className="text-xl font-bold text-blue-600">{selectedClient.activeConsultations || 0}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-500 mb-1">{t('admin.clients.table.completed') || 'Completed'}</p>
                  <p className="text-xl font-bold text-emerald-600">{selectedClient.completedConsultations || 0}</p>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <Button 
                  variant={selectedClient.status === 'active' ? 'outline' : 'primary'}
                  className={`w-full ${selectedClient.status === 'active' ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}`}
                  onClick={() => handleToggleStatus(selectedClient.uid, selectedClient.status || 'active')}
                  loading={updatingStatus}
                >
                  {selectedClient.status === 'active' ? (t('admin.dashboard.staff.deactivate') || 'Deactivate User') : (t('admin.dashboard.staff.activate') || 'Activate User')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
