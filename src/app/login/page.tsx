import { Suspense } from 'react';
import LoginPageClient from './LoginPageClient';

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const initialRedirect = getParam(params.redirect);

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LoginPageClient initialRedirect={initialRedirect} />
    </Suspense>
  );
}
