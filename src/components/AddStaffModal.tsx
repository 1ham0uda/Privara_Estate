'use client';

import React, { useState } from 'react';
import { Button, Input } from './UI';
import { userService } from '@/src/lib/db';
import { UserProfile, UserRole } from '@/src/types';
import { serverTimestamp } from 'firebase/firestore';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: () => void;
}

export default function AddStaffModal({ isOpen, onClose, onAdd }: AddStaffModalProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('consultant');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add Staff</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            placeholder="Display Name" 
            value={displayName} 
            onChange={(e: any) => setDisplayName(e.target.value)} 
            required 
          />
          <Input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e: any) => setEmail(e.target.value)} 
            required 
          />
          <select 
            value={role} 
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all text-sm"
          >
            <option value="consultant">Consultant</option>
            <option value="quality">Quality Specialist</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
            <Button variant="primary" type="submit" loading={loading}>Add</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
