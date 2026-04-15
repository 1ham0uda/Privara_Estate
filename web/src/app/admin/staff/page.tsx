'use client';

import React, { useEffect, useState } from 'react';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { userService, consultationService, consultantService } from '@/src/lib/db';
import { UserProfile, UserRole, ConsultationCase } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import Navbar from '@/src/components/Navbar';
import { Users, Search, Filter, ChevronLeft, User, Download, Loader2, Plus, X, Phone, Briefcase, Mail } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/src/context/LanguageContext';
import { toast } from 'react-hot-toast';

export default function AdminStaffPage() {
  useRoleGuard(['admin']);
  const { t, isRTL } = useLanguage();
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [cases, setCases] = useState<ConsultationCase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<UserRole | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void;
    const fetchStaff = async () => {
      setLoading(true);
      setError(null);
      try {
        const allUsers = await userService.getAllUsers();
        const staffUsers = allUsers.filter(u => u.role === 'consultant' || u.role === 'quality' || u.role === 'admin');
        setStaff(staffUsers);
        
        // Fetch cases to check for active assignments
        unsubscribe = consultationService.subscribeToConsultations('admin', 'admin', (data) => {
          setCases(data);
        });
      } catch (err) {
        setError(t('common.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [t]);

  const handleToggleStatus = async (uid: string, currentStatus: string) => {
    const activeStaffCases = cases.filter(c => (c.consultantId === uid || c.qualitySpecialistId === uid) && c.status !== 'completed');
    
    if (currentStatus === 'active' && activeStaffCases.length > 0) {
      toast.error(t('admin.dashboard.staff.error_active_cases'));
      return;
    }

    setUpdatingStatus(true);
    try {
      const newStatus = currentStatus === 'active' ? 'deactivated' : 'active';
      await userService.updateUserProfile(uid, { status: newStatus });

      const target = staff.find(s => s.uid === uid);
      if (target?.role === 'consultant') {
        await consultantService.updateConsultantProfile(uid, { status: newStatus });
      }

      toast.success(t('common.success'));
      
      // Update local state
      setStaff(staff.map(s => s.uid === uid ? { ...s, status: newStatus } : s));
      if (selectedStaff?.uid === uid) {
        setSelectedStaff({ ...selectedStaff, status: newStatus });
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error(t('common.error'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredStaff = staff.filter(s => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
                          (s.displayName?.toLowerCase().includes(searchLower) ?? false) || 
                          (s.email?.toLowerCase().includes(searchLower) ?? false);
    const matchesFilter = filter === 'all' || s.role === filter;
    return matchesSearch && matchesFilter;
  });

  const exportToCSV = () => {
    const headers = [t('admin.staff.table.name'), t('admin.staff.table.email'), t('admin.staff.table.role'), t('admin.staff.table.joined'), t('admin.staff.table.status')];
    const rows = filteredStaff.map(s => [
      s.displayName,
      s.email,
      s.role,
      s.createdAt ? new Date(s.createdAt.seconds * 1000).toLocaleDateString() : t('common.na'),
      s.status || 'active'
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "staff.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="p-2" as={Link} href="/admin/dashboard">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('admin.staff.title')}</h1>
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
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-96">
              <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder={t('admin.staff.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-2 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black text-sm"
              >
                <option value="all">{t('admin.staff.filter.all')}</option>
                <option value="admin">{t('admin.staff.role.admin')}</option>
                <option value="consultant">{t('admin.staff.role.consultant')}</option>
                <option value="quality">{t('admin.staff.role.quality')}</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> {t('common.loading')}
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-500">{error}</div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-12 text-center text-gray-500">{t('admin.staff.no_results')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 font-medium">{t('admin.staff.table.staff')}</th>
                    <th className="px-6 py-4 font-medium">{t('admin.staff.table.role')}</th>
                    <th className="px-6 py-4 font-medium">{t('admin.staff.table.joined')}</th>
                    <th className="px-6 py-4 font-medium text-center">{t('admin.staff.table.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStaff.map(staff => (
                    <tr 
                      key={staff.uid} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedStaff(staff)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden relative shrink-0">
                            {staff.avatarUrl ? (
                              <Image src={staff.avatarUrl} alt="" fill className="object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{staff.displayName}</p>
                            <p className="text-xs text-gray-500">{staff.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 capitalize">{t(`admin.staff.role.${staff.role}`)}</td>
                      <td className="px-6 py-4 text-gray-500">
                        {staff.createdAt ? new Date(staff.createdAt.seconds * 1000).toLocaleDateString() : t('common.na')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={staff.status === 'active' ? 'success' : 'error'}>
                          {staff.status === 'active' ? t('admin.staff.status.active') : t('admin.staff.status.deactivated')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>

      {/* Staff Details Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">{t('admin.dashboard.staff.view_profile') || 'Staff Profile'}</h3>
              <Button variant="ghost" className="p-2 -mr-2" onClick={() => setSelectedStaff(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden relative shrink-0">
                  {selectedStaff.avatarUrl ? (
                    <Image src={selectedStaff.avatarUrl} alt="" fill className="object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{selectedStaff.displayName}</h4>
                  <Badge variant="info" className="capitalize mt-1">{t(`admin.staff.role.${selectedStaff.role}`)}</Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{selectedStaff.email}</span>
                </div>
                {selectedStaff.phoneNumber && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span dir="ltr">{selectedStaff.phoneNumber}</span>
                  </div>
                )}
                {selectedStaff.experienceYears !== undefined && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    <span>{selectedStaff.experienceYears} {t('admin.dashboard.modal.addUser.experience_years') || 'Years Experience'}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-500 mb-1">{t('admin.clients.table.total_consultations') || 'Total Consultations'}</p>
                  <p className="text-xl font-bold text-gray-900">{selectedStaff.totalConsultations || 0}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <p className="text-xs text-gray-500 mb-1">{t('admin.clients.table.active') || 'Active'}</p>
                  <p className="text-xl font-bold text-blue-600">{selectedStaff.activeConsultations || 0}</p>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <Button 
                  variant={selectedStaff.status === 'active' ? 'outline' : 'primary'}
                  className={`w-full ${selectedStaff.status === 'active' ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}`}
                  onClick={() => handleToggleStatus(selectedStaff.uid, selectedStaff.status || 'active')}
                  loading={updatingStatus}
                >
                  {selectedStaff.status === 'active' ? (t('admin.dashboard.staff.deactivate') || 'Deactivate User') : (t('admin.dashboard.staff.activate') || 'Activate User')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
