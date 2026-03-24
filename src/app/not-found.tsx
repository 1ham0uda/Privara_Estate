'use client';

import Link from 'next/link';
import { Shield, Home } from 'lucide-react';
import { Button } from '@/src/components/UI';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-8">
        <Shield className="text-white w-8 h-8" />
      </div>
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-gray-500 mb-8 text-center max-w-md">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/">
        <Button className="rounded-xl h-12 px-8">
          <Home className="w-5 h-5 mr-2" /> Back to Home
        </Button>
      </Link>
    </div>
  );
}
