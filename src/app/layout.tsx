import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/src/context/AuthContext';
import { LanguageProvider } from '@/src/context/LanguageContext';

export const metadata: Metadata = {
  title: 'Privara Estate | Private Real Estate Consultation',
  description: 'Private real estate consultations, secure in-app communication, and guided case management with Privara Estate.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <LanguageProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
