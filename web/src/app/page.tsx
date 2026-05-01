'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Shield,
  Lock,
  MessageSquare,
  FileText,
  Search,
  CheckCircle2,
  Users,
  ArrowRight,
} from 'lucide-react';
import Navbar from '@/src/components/Navbar';
import { Button, Card } from '@/src/components/UI';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';

export default function LandingPage() {
  const { profile, loading } = useAuth();
  const { t, isRTL } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile) {
      router.push(`/${profile.role}/dashboard`);
    }
  }, [profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cloud">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  const steps = [
    { icon: Search,      title: t('how.step1.title'), desc: t('how.step1.desc') },
    { icon: CheckCircle2,title: t('how.step2.title'), desc: t('how.step2.desc') },
    { icon: Users,       title: t('how.step3.title'), desc: t('how.step3.desc') },
    { icon: FileText,    title: t('how.step4.title'), desc: t('how.step4.desc') },
  ];

  const features = [
    { icon: Shield,       title: t('features.no_phone'), desc: t('features.no_phone_desc') },
    { icon: MessageSquare,title: t('features.in_app'),   desc: t('features.in_app_desc') },
    { icon: Lock,         title: t('features.expert'),   desc: t('features.expert_desc') },
  ];

  return (
    <div
      className="min-h-screen bg-white text-ink selection:bg-blue-600 selection:text-white"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 pb-20 sm:pb-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            {/* Label / PDF §05 positioning line */}
            <span className="inline-flex items-center gap-2 rounded-full bg-soft-blue px-3.5 py-1.5 text-xs font-mono font-medium text-blue-600 tracking-[0.12em] uppercase mb-6">
              <Shield className="w-3.5 h-3.5" />
              {t('hero.tagline')}
            </span>

            {/* Headline — Playfair Display, PDF §04 */}
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] text-ink">
              {t('hero.title')}
            </h1>

            {/* Subhead — DM Sans, slate color */}
            <p className="mt-5 text-base sm:text-lg text-brand-slate max-w-2xl leading-7">
              {t('hero.subtitle')}
            </p>

            {/* CTAs */}
            <div className={`mt-10 flex flex-col sm:flex-row gap-3 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
              <Link href="/register">
                <Button className="w-full sm:w-auto h-11 sm:h-12 rounded-full px-8">
                  {t('hero.cta')}
                  <ArrowRight className={`w-4 h-4 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
                </Button>
              </Link>
              <Link href="/#how-it-works">
                <Button variant="outline" className="w-full sm:w-auto h-11 sm:h-12 rounded-full px-8">
                  {t('hero.how_it_works')}
                </Button>
              </Link>
            </div>

            {/* Trust line — PDF §05 */}
            <p className="mt-8 text-xs font-mono text-brand-slate tracking-[0.14em] uppercase">
              No commission · No agenda · Just clarity
            </p>
          </motion.div>
        </div>

        {/* Soft-blue gradient wash — PDF §03 SOFT BLUE */}
        <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-soft-blue to-white" />
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-cloud">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
            >
              <Card className="h-full border-soft-blue shadow-none" hover={false}>
                {/* Blue icon container — PDF §03 BLUE */}
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mb-5">
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-serif text-lg font-bold mb-2 text-ink">{feature.title}</h3>
                <p className="text-sm text-brand-slate leading-6">{feature.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`mb-12 ${isRTL ? 'text-right' : 'text-left'}`}>
            <span className="text-xs font-mono text-blue-600 tracking-[0.16em] uppercase">
              {t('hero.how_it_works')}
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-ink mt-2">
              {t('how.subtitle')}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 sm:gap-6">
            {steps.map((step, index) => (
              <Card key={step.title} className="border-soft-blue" hover={false}>
                {/* Step icon — soft-blue container with blue icon */}
                <div className="w-11 h-11 rounded-xl bg-soft-blue flex items-center justify-center mb-5">
                  <step.icon className="w-5 h-5 text-blue-600" />
                </div>
                {/* Step counter — DM Mono */}
                <p className="text-xs font-mono font-medium tracking-[0.18em] text-blue-600 mb-2">
                  0{index + 1}
                </p>
                <h3 className="font-serif text-lg font-bold mb-2 text-ink">{step.title}</h3>
                <p className="text-sm text-brand-slate leading-6">{step.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-t border-soft-blue bg-cloud">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 sm:gap-14 items-start">
          <div>
            <span className="text-xs font-mono text-blue-600 tracking-[0.16em] uppercase">
              {t('about.title')}
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-ink mt-2">
              {t('about.title')}
            </h2>
            <p className="text-brand-slate mt-5 leading-7 max-w-prose">{t('about.desc')}</p>
          </div>

          {/* Promise card — PDF §01 Our Promise */}
          <Card className="bg-white border-soft-blue shadow-none" hover={false}>
            <ul className="space-y-4">
              {[t('about.item1'), t('about.item2'), t('about.item3')].map((item) => (
                <li
                  key={item}
                  className={`flex items-start gap-3 text-sm sm:text-base ${isRTL ? 'flex-row-reverse text-right' : ''}`}
                >
                  <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* ── Footer — dark INK background, premium consulting feel ─────── */}
      <footer className="bg-ink text-white">
        <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 flex flex-col md:flex-row gap-6 justify-between items-center ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          {/* Logo — PDF §02 wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center select-none" aria-hidden="true">
              <span className="text-white font-serif font-bold text-sm leading-none">RR</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-serif font-bold text-base text-white tracking-tight">
                Real <span className="text-blue-300">Real</span> Estate
              </span>
              <span className="text-[10px] font-mono text-white/50 tracking-[0.12em] uppercase">
                Independent · Unbiased · Egypt
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-white/40 font-mono tracking-wide">
            © 2026 Real Real Estate. {t('footer.rights')}
          </p>

          <div className={`flex flex-wrap items-center justify-center gap-5 text-xs sm:text-sm text-white/50 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <Link href="/privacy" className="hover:text-white transition-colors">{t('footer.privacy')}</Link>
            <Link href="/terms"   className="hover:text-white transition-colors">{t('footer.terms')}</Link>
            <Link href="/contact" className="hover:text-white transition-colors">{t('footer.contact')}</Link>
            <Link href="/accessibility" className="hover:text-white transition-colors">{t('footer.accessibility')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
