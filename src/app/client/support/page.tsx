import { Suspense } from 'react';
import ClientSupportPageClient from './ClientSupportPageClient';

type PageProps = {
  searchParams?: Promise<{
    ticketId?: string;
    messageId?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const initialTicketId = params.ticketId || params.messageId || null;

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ClientSupportPageClient initialTicketId={initialTicketId} />
    </Suspense>
  );
}
