'use client';

import Navbar from '@/src/components/Navbar';
import { useLanguage } from '@/src/context/LanguageContext';
import { Mail, Shield, Clock } from 'lucide-react';

export default function ContactPage() {
  const { isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12">
          <p className="text-xs font-mono tracking-widest text-brand-slate uppercase mb-3">Support</p>
          <h1 className="font-serif text-4xl font-bold text-ink leading-tight mb-4">Contact Us</h1>
          <p className="text-brand-slate leading-relaxed max-w-xl">
            We&apos;re an independent advisory firm. Questions, complaints, or data requests — we read everything
            and respond within two business days.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-2xl p-6 border border-soft-blue">
            <div className="w-10 h-10 bg-soft-blue rounded-xl flex items-center justify-center mb-4">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-bold text-ink mb-1">General Enquiries</h3>
            <p className="text-sm text-brand-slate">Questions about consultations, pricing, or the platform.</p>
            <a
              href="mailto:hello@realrealestate.eg"
              className="text-sm text-blue-600 hover:underline mt-3 block font-mono"
            >
              hello@realrealestate.eg
            </a>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-soft-blue">
            <div className="w-10 h-10 bg-soft-blue rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-bold text-ink mb-1">Data &amp; Privacy</h3>
            <p className="text-sm text-brand-slate">Access requests, deletion requests, or PDPL concerns.</p>
            <a
              href="mailto:privacy@realrealestate.eg"
              className="text-sm text-blue-600 hover:underline mt-3 block font-mono"
            >
              privacy@realrealestate.eg
            </a>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-soft-blue">
            <div className="w-10 h-10 bg-soft-blue rounded-xl flex items-center justify-center mb-4">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-bold text-ink mb-1">Response Time</h3>
            <p className="text-sm text-brand-slate">We reply within 2 business days, Sunday through Thursday.</p>
            <p className="text-sm font-mono text-brand-slate mt-3">Cairo, Egypt (EET / UTC+2)</p>
          </div>
        </div>

        <div className="bg-ink rounded-2xl p-8 text-white">
          <h2 className="font-serif text-2xl font-bold mb-2">Already have a consultation?</h2>
          <p className="text-white/70 mb-6 leading-relaxed">
            For questions about an active case, use the built-in support chat inside your dashboard.
            Our team monitors it during business hours and your consultant is always reachable directly
            within the case thread.
          </p>
          <a
            href="/client/dashboard"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Go to dashboard
          </a>
        </div>
      </main>

      <footer className="border-t border-soft-blue mt-16 py-8 text-center">
        <p className="text-xs font-mono text-brand-slate tracking-wide">
          © 2026 Real Real Estate. Independent Advisory · Egypt
        </p>
      </footer>
    </div>
  );
}
