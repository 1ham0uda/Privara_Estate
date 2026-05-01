'use client';

import Navbar from '@/src/components/Navbar';
import { useLanguage } from '@/src/context/LanguageContext';

export default function TermsPage() {
  const { isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12">
          <p className="text-xs font-mono tracking-widest text-brand-slate uppercase mb-3">Legal</p>
          <h1 className="font-serif text-4xl font-bold text-ink leading-tight mb-4">Terms of Service</h1>
          <p className="text-brand-slate">Last updated: April 2026</p>
        </div>

        <div className="space-y-8 text-ink">
          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">1. The Service</h2>
            <p className="text-brand-slate leading-relaxed">
              Real Real Estate provides independent, fee-based real estate advisory services in Egypt.
              By creating an account and submitting a consultation request, you agree to these Terms.
              We act solely as your advisor — we do not act as a broker, developer agent, or sales
              representative for any property or project.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">2. Consultation Fee</h2>
            <p className="text-brand-slate leading-relaxed">
              The consultation fee is fixed and displayed at checkout. Payment is processed securely via
              Geidea. The fee covers one complete consultation engagement as described on the service page.
              Fees are non-refundable once a consultant has been assigned and the case opened, except where
              required by Egyptian consumer protection law.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">3. Independence Guarantee</h2>
            <p className="text-brand-slate leading-relaxed">
              Our consultants do not receive commissions, referral fees, or any incentive from property
              developers, banks, or agencies. All advice is based solely on your stated goals and publicly
              available market data. This independence is the foundation of our service.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">4. Scope of Advice</h2>
            <p className="text-brand-slate leading-relaxed">
              Our advice is informational and analytical. It does not constitute a legal, financial, or
              investment guarantee. Final property decisions remain entirely yours. We recommend engaging
              a licensed Egyptian real estate lawyer before executing any purchase or rental contract.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">5. Account Responsibilities</h2>
            <p className="text-brand-slate leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials.
              You must provide accurate information in your consultation intake form. Providing false or
              misleading information may result in case suspension without refund.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">6. Acceptable Use</h2>
            <p className="text-brand-slate leading-relaxed">
              You may not use this platform to harass consultants, share offensive content, attempt
              unauthorised access to other accounts, or circumvent payment for services rendered.
              Violations will result in immediate account suspension and, where applicable, legal action.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">7. Intellectual Property</h2>
            <p className="text-brand-slate leading-relaxed">
              All written reports and analysis produced during your consultation are provided for your
              personal use only. You may not reproduce, redistribute, or publish consultant reports
              without written consent.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">8. Limitation of Liability</h2>
            <p className="text-brand-slate leading-relaxed">
              To the fullest extent permitted by Egyptian law, our liability is limited to the consultation
              fee paid. We are not liable for investment losses, opportunity costs, or any indirect damages
              arising from reliance on our advice.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">9. Governing Law</h2>
            <p className="text-brand-slate leading-relaxed">
              These Terms are governed by the laws of the Arab Republic of Egypt. Any disputes shall be
              subject to the exclusive jurisdiction of Egyptian courts.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">10. Changes to These Terms</h2>
            <p className="text-brand-slate leading-relaxed">
              We may update these Terms. Continued use of the service after notice of changes constitutes
              acceptance. Material changes will be notified by email to registered users.
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
