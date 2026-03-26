import { Suspense } from 'react';
import AdminSupportPageClient from './AdminSupportPageClient';

type AdminSupportPageProps = {
  searchParams?: {
    ticketId?: string;
    messageId?: string;
  };
};

export default function AdminSupportPage({ searchParams }: AdminSupportPageProps) {
  const initialTicketId = searchParams?.ticketId || searchParams?.messageId || null;

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <AdminSupportPageClient initialTicketId={initialTicketId} />
    </Suspense>
  );
}