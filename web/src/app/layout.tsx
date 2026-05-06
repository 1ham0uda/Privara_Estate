import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google';
import Script from 'next/script';
import { AuthProvider } from '@/src/context/AuthContext';
import { LanguageProvider } from '@/src/context/LanguageContext';
import ErrorBoundary from '@/src/components/ErrorBoundary';
import AriaAnnouncer from '@/src/components/AriaAnnouncer';
import CookieBanner from '@/src/components/CookieBanner';
import MaintenanceGate from '@/src/components/MaintenanceGate';
import PostHogPageView from '@/src/components/PostHogPageView';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-playfair',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Real Real Estate | Independent Advisory · Egypt',
  description: 'Fee-based, unbiased real estate advisory in Egypt. No commissions, no hidden agenda — one consultation fee, one honest answer.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get('lang')?.value;
  const lang = langCookie === 'ar' ? 'ar' : 'en';
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <html
      lang={lang}
      dir={dir}
      className={`scroll-smooth ${playfair.variable} ${dmSans.variable} ${dmMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1B2235" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Real Real Estate" />
        <script
          dangerouslySetInnerHTML={{
            __html: `self.__FIREBASE_CONFIG__ = ${JSON.stringify({
              apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
              authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
              projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
              storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
              messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
              appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
            })};`,
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {/* GA4 — only injected when measurement ID is configured */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');`}
            </Script>
          </>
        )}
        <AriaAnnouncer />
        <ErrorBoundary>
          <LanguageProvider>
            <AuthProvider>
              <PostHogPageView />
              <MaintenanceGate>
                {children}
              </MaintenanceGate>
            </AuthProvider>
            <CookieBanner />
          </LanguageProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
