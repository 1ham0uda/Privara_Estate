'use client';

import React, { useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { userService } from '@/src/lib/db';
import { Button, Input } from '@/src/components/UI';
import { UserRole, UserProfile } from '@/src/types';
import { useLanguage } from '@/src/context/LanguageContext';

interface AddStaffModalProps {
  onClose: () => void;
  onAdd: () => void;
}

export default function AddStaffModal({ onClose, onAdd }: AddStaffModalProps) {
  const { t, isRTL } = useLanguage();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('consultant');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newProfile: UserProfile = {
        uid: crypto.randomUUID(),
        email,
        displayName,
        role,
        createdAt: serverTimestamp() as any,
        status: 'active',
        totalConsultations: 0,
        activeConsultations: 0,
        completedConsultations: 0,
      };
      await userService.createUserProfile(newProfile);
      onAdd();
    } catch (error) {
      console.error('Failed to add staff:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{t('admin.staff.add')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder={t('auth.full_name')}
            value={displayName}
            onChange={(e: any) => setDisplayName(e.target.value)}
            required
            className={isRTL ? 'text-right' : ''}
          />
          <Input
            type="email"
            placeholder={t('auth.email')}
            value={email}
            onChange={(e: any) => setEmail(e.target.value)}
            required
            dir="ltr"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={`w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all text-sm ${isRTL ? 'text-right' : ''}`}
          >
            <option value="consultant">{t('admin.staff.role.consultant')}</option>
            <option value="quality">{t('admin.staff.role.quality')}</option>
            <option value="admin">{t('admin.staff.role.admin')}</option>
          </select>
          <div className={`flex gap-2 justify-end ${isRTL ? 'flex-row-reverse justify-start' : ''}`}>
            <Button variant="ghost" onClick={onClose} type="button">{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" loading={loading}>{t('admin.staff.add')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
