import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: any, locale: string = 'en-US') {
  if (!date) return 'N/A';
  // Handle Firestore Timestamp
  const d = date && typeof date.toDate === 'function' ? date.toDate() : new Date(date);
  
  if (isNaN(d.getTime())) return 'N/A';

  return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
