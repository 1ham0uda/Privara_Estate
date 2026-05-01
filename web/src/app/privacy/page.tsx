'use client';

import Navbar from '@/src/components/Navbar';
import { useLanguage } from '@/src/context/LanguageContext';

export default function PrivacyPage() {
  const { isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12">
          <p className="text-xs font-mono tracking-widest text-brand-slate uppercase mb-3">Legal</p>
          <h1 className="font-serif text-4xl font-bold text-ink leading-tight mb-4">Privacy Policy</h1>
          <p className="text-brand-slate">Last updated: April 2026</p>
        </div>

        <div className="prose max-w-none space-y-8 text-ink">
          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">1. Who We Are</h2>
            <p className="text-brand-slate leading-relaxed">
              Real Real Estate (&quot;we&quot;, &quot;our&quot;, &quot;the Company&quot;) is an independent real estate advisory firm
              operating in Egypt. We provide fee-based consultation services with no sales commissions or
              third-party referral arrangements. Our registered business address is Cairo, Egypt.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">2. Data We Collect</h2>
            <p className="text-brand-slate leading-relaxed mb-3">
              We collect only the information necessary to deliver your consultation:
            </p>
            <ul className="list-disc list-inside space-y-2 text-brand-slate">
              <li><strong className="text-ink">Account data:</strong> name, email address, phone number.</li>
              <li><strong className="text-ink">Consultation intake:</strong> property goals, budget range, preferred areas, notes.</li>
              <li><strong className="text-ink">Communication data:</strong> messages, voice notes, and files shared inside your consultation case.</li>
              <li><strong className="text-ink">Payment data:</strong> transaction identifiers processed by Geidea. We do not store card numbers.</li>
              <li><strong className="text-ink">Usage data:</strong> login timestamps and page-level analytics for service improvement.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">3. How We Use Your Data</h2>
            <p className="text-brand-slate leading-relaxed">
              Your data is used exclusively to provide and improve your consultation service. We do not sell,
              rent, or share personal data with real estate developers, agencies, or any third party for
              marketing purposes. Data may be shared with sub-processors (Firebase/Google Cloud for hosting;
              Geidea for payment processing) solely to deliver the service.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">4. Legal Basis (Egypt PDPL)</h2>
            <p className="text-brand-slate leading-relaxed">
              We process personal data in accordance with Egypt&apos;s Personal Data Protection Law (Law No. 151
              of 2020) and its Executive Regulations. Our lawful bases are: (a) performance of the
              consultation contract you entered into; (b) compliance with legal obligations; and (c) our
              legitimate interest in improving service quality where it does not override your rights.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">5. Data Retention</h2>
            <p className="text-brand-slate leading-relaxed">
              Consultation records are retained for five years following case closure to satisfy potential
              legal or regulatory requirements. Account data is deleted upon a verified deletion request
              once no active consultation exists on the account.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">6. Your Rights</h2>
            <p className="text-brand-slate leading-relaxed">
              You have the right to access, correct, or request deletion of your personal data. You may also
              object to processing or request data portability. To exercise these rights, contact us at the
              address below. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">7. Cookies</h2>
            <p className="text-brand-slate leading-relaxed">
              We use a single session cookie (<code className="font-mono text-sm bg-soft-blue px-1.5 py-0.5 rounded">privara-session</code>) strictly
              necessary for authentication. No third-party advertising or tracking cookies are used.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">8. Contact</h2>
            <p className="text-brand-slate leading-relaxed">
              For privacy enquiries, write to us via the{' '}
              <a href="/contact" className="text-blue-600 hover:underline">contact page</a>.
            </p>
          </section>
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
