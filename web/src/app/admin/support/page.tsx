import { Suspense } from 'react';
import AdminSupportPageClient from './AdminSupportPageClient';

type AdminSupportPageProps = {
  searchParams?: Promise<{
    ticketId?: string;
    messageId?: string;
  }>;
};

export default async function AdminSupportPage({ searchParams }: AdminSupportPageProps) {
  const params = (await searchParams) ?? {};
  const initialTicketId = params.ticketId || params.messageId || null;

  return (
    <Suspense fallback={<div className="min-h-screen bg-cloud" />}>
      <AdminSupportPageClient initialTicketId={initialTicketId} />
    </Suspense>
  );
}
