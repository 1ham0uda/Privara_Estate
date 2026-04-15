'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import type { StaffRole } from '@/src/types';
import { Button, Input, Card } from '@/src/components/UI';
import Navbar from '@/src/components/Navbar';
import { useLanguage } from '@/src/context/LanguageContext';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { auth } from '@/src/lib/firebase';

const staffRoleOptions: StaffRole[] = ['consultant', 'quality', 'admin'];

function getCreateStaffErrorMessage(code: string | undefined, fallback: string | undefined, t: (key: string) => string) {
  switch (code) {
    case 'unauthorized':
      return t('admin.staff.add.error.unauthorized');
    case 'forbidden':
      return t('admin.staff.add.error.forbidden');
    case 'missing-required-fields':
      return t('admin.staff.add.error.missing_required_fields');
    case 'invalid-role':
      return t('admin.staff.add.error.invalid_role');
    case 'invalid-experience':
      return t('admin.staff.add.error.invalid_experience');
    case 'auth/email-already-exists':
      return t('admin.staff.add.error.email_exists');
    case 'auth/invalid-email':
      return t('admin.staff.add.error.invalid_email');
    case 'auth/invalid-password':
      return t('admin.staff.add.error.weak_password');
    case 'profile-create-failed':
      return t('admin.staff.add.error.profile_create_failed');
    default:
      return fallback || t('admin.staff.add.error.generic');
  }
}

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
    role: 'consultant' as StaffRole,
    specialties: '',
    bio: '',
    phoneNumber: '',
    experienceYears: '',
  });

  const roleOptions = useMemo(
    () => staffRoleOptions.map((role) => ({ value: role, label: t(`admin.staff.role.${role}`) })),
    [t]
  );

  const getExperienceLabel = () => {
    if (formData.role === 'quality') {
      return t('admin.dashboard.modal.addUser.experience_quality');
    }

    if (formData.role === 'consultant') {
      return t('admin.dashboard.modal.addUser.experience_real_estate');
    }

    return t('admin.dashboard.modal.addUser.experience_years');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error(t('admin.staff.add.error.unauthorized'));
      }

      const idToken = await currentUser.getIdToken();
      const normalizedRole = formData.role;
      const normalizedExperience = formData.experienceYears.trim();
      const parsedExperience = normalizedExperience === '' ? 0 : Number(normalizedExperience);

      if (!staffRoleOptions.includes(normalizedRole)) {
        setError(t('admin.staff.add.error.invalid_role'));
        setLoading(false);
        return;
      }

      if (!Number.isFinite(parsedExperience) || parsedExperience < 0) {
        setError(t('admin.staff.add.error.invalid_experience'));
        setLoading(false);
        return;
      }

      const payload = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        displayName: formData.displayName.trim(),
        role: normalizedRole,
        specialties: normalizedRole === 'consultant' ? formData.specialties : '',
        bio: normalizedRole === 'consultant' ? formData.bio.trim() : '',
        phoneNumber: formData.phoneNumber.trim(),
        experienceYears: parsedExperience,
      };

      const response = await fetch('/api/admin/create-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getCreateStaffErrorMessage(data?.code, data?.error, t));
      }

      router.push('/admin/staff');
    } catch (err: any) {
      setError(err.message || t('admin.staff.add.error.generic'));
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('admin.staff.add.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('admin.staff.add.subtitle')}</p>
          </div>
        </div>

        <Card className="p-6 bg-white shadow-sm" hover={false}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.dashboard.modal.addUser.name')}</label>
              <Input
                value={formData.displayName}
                onChange={(e: any) => setFormData({ ...formData, displayName: e.target.value })}
                required
                placeholder={t('auth.full_name_placeholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.dashboard.modal.addUser.email')}</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder={t('auth.email_placeholder')}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.dashboard.modal.addUser.password')}</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e: any) => setFormData({ ...formData, password: e.target.value })}
                required
                placeholder={t('auth.password_placeholder')}
              />
              <p className="text-xs text-gray-500 mt-1">{t('admin.staff.add.password_hint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.dashboard.modal.addUser.phone')}</label>
              <Input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e: any) => setFormData({ ...formData, phoneNumber: e.target.value })}
                required
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{getExperienceLabel()}</label>
              <Input
                type="number"
                min="0"
                value={formData.experienceYears}
                onChange={(e: any) => setFormData({ ...formData, experienceYears: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.staff.add.role_label')}</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as StaffRole })}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all text-sm"
              >
                {roleOptions.map((roleOption) => (
                  <option key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.role === 'consultant' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.dashboard.modal.addUser.specialties')}</label>
                  <Input
                    value={formData.specialties}
                    onChange={(e: any) => setFormData({ ...formData, specialties: e.target.value })}
                    placeholder={t('admin.dashboard.modal.addUser.specialties_placeholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.dashboard.modal.addUser.bio')}</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all text-sm"
                    rows={4}
                    placeholder={t('admin.staff.add.bio_placeholder')}
                  />
                </div>
              </>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="ghost" onClick={() => router.back()} type="button">{t('common.cancel')}</Button>
              <Button variant="primary" type="submit" loading={loading}>{t('admin.staff.add.submit')}</Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
