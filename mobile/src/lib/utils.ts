export function formatDate(date: any, locale: string = 'en-US') {
  if (!date) return 'N/A';
  const d = date && typeof date.toDate === 'function' ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function truncate(str: string, max: number): string {
  if (!str || str.length <= max) return str;
  return str.slice(0, max) + '...';
}

export function caseNumber(id: string): string {
  return id ? `#${id.substring(0, 8).toUpperCase()}` : '';
}
