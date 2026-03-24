'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { UserRole } from '@/src/types';
import { Button, Input, Card } from '@/src/components/UI';
import Navbar from '@/src/components/Navbar';
import { useLanguage } from '@/src/context/LanguageContext';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';

export default function AddStaffPage() {
  useRoleGuard(['admin']);
  const { t, isRTL } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'consultant' as UserRole,
    specialties: '',
    bio: '',
    phoneNumber: '',
    experienceYears: ''
  });

  const getExperienceLabel = () => {
    if (formData.role === 'quality') return t('admin.dashboard.modal.addUser.experience_quality') || 'Years of Experience in Quality';
    return t('admin.dashboard.modal.addUser.experience_real_estate') || 'Years of Experience in Real Estate';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }

      const idToken = await user.getIdToken();

      const response = await fetch('/api/admin/create-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create staff');
      }

      router.push('/admin/staff');
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" className="p-2" as={Link} href="/admin/staff">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('admin.dashboard.action.addConsultant')}</h1>
        </div>

        <Card className="p-6 bg-white shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.dashboard.modal.addUser.name')}</label>
              <Input 
                value={formData.displayName} 
                onChange={(e: any) => setFormData({...formData, displayName: e.target.value})} 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.dashboard.modal.addUser.email')}</label>
              <Input 
                type="email" 
                value={formData.email} 
                onChange={(e: any) => setFormData({...formData, email: e.target.value})} 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.dashboard.modal.addUser.password')}</label>
              <Input 
                type="password" 
                value={formData.password} 
                onChange={(e: any) => setFormData({...formData, password: e.target.value})} 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.dashboard.modal.addUser.phone') || 'Mobile Number'}</label>
              <Input 
                type="tel" 
                value={formData.phoneNumber} 
                onChange={(e: any) => setFormData({...formData, phoneNumber: e.target.value})} 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{getExperienceLabel()}</label>
              <Input 
                type="number" 
                min="0"
                value={formData.experienceYears} 
                onChange={(e: any) => setFormData({...formData, experienceYears: e.target.value})} 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select 
                value={formData.role} 
                onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all text-sm"
              >
                <option value="consultant">Consultant</option>
                <option value="quality">Quality Specialist</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {formData.role === 'consultant' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.specialties')}</label>
                  <Input 
                    value={formData.specialties} 
                    onChange={(e: any) => setFormData({...formData, specialties: e.target.value})} 
                    placeholder={t('dashboard.specialties_placeholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea 
                    value={formData.bio} 
                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all text-sm"
                    rows={4}
                  />
                </div>
              </>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="ghost" onClick={() => router.back()} type="button">{t('common.cancel')}</Button>
              <Button variant="primary" type="submit" loading={loading}>{t('admin.dashboard.modal.addUser.submit')}</Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
