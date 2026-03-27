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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const steps = [
    { icon: Search, title: t('how.step1.title'), desc: t('how.step1.desc') },
    { icon: CheckCircle2, title: t('how.step2.title'), desc: t('how.step2.desc') },
    { icon: Users, title: t('how.step3.title'), desc: t('how.step3.desc') },
    { icon: FileText, title: t('how.step4.title'), desc: t('how.step4.desc') },
  ];

  const features = [
    { icon: Shield, title: t('features.no_phone'), desc: t('features.no_phone_desc') },
    { icon: MessageSquare, title: t('features.in_app'), desc: t('features.in_app_desc') },
    { icon: Lock, title: t('features.expert'), desc: t('features.expert_desc') },
  ];

  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />

      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-14 sm:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 mb-5">
              <Shield className="w-4 h-4" />
              {t('hero.tagline')}
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08]">
              {t('hero.title')}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-gray-600 max-w-2xl leading-7">
              {t('hero.subtitle')}
            </p>
            <div className={`mt-8 flex flex-col sm:flex-row gap-3 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
              <Link href="/register">
                <Button className="w-full sm:w-auto h-11 sm:h-12 rounded-xl">
                  {t('hero.cta')}
                  <ArrowRight className={`w-4 h-4 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
                </Button>
              </Link>
              <Link href="/#how-it-works">
                <Button variant="outline" className="w-full sm:w-auto h-11 sm:h-12 rounded-xl">
                  {t('hero.how_it_works')}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
        <div className="absolute inset-x-0 top-0 -z-10 h-[320px] bg-gradient-to-b from-gray-50 to-white" />
      </section>

      <section className="py-10 sm:py-14 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
            >
              <Card className="h-full border-none shadow-sm" hover={false}>
                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-6">{feature.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`mb-10 ${isRTL ? 'text-right' : 'text-left'}`}>
            <h2 className="text-3xl sm:text-4xl font-bold">{t('hero.how_it_works')}</h2>
            <p className="text-gray-600 mt-3 max-w-2xl">{t('how.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
            {steps.map((step, index) => (
              <Card key={step.title} className="border-gray-100" hover={false}>
                <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
                  <step.icon className="w-5 h-5 text-black" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-2">
                  0{index + 1}
                </p>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-6">{step.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 sm:gap-10 items-start">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold">{t('about.title')}</h2>
            <p className="text-gray-600 mt-4 leading-7">{t('about.desc')}</p>
          </div>
          <Card className="bg-gray-50 border-none" hover={false}>
            <ul className="space-y-3">
              {[t('about.item1'), t('about.item2'), t('about.item3')].map((item) => (
                <li key={item} className={`flex items-start gap-3 text-sm sm:text-base ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <footer className="py-8 sm:py-10 border-t border-gray-100">
        <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-4 justify-between items-center ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <span className="font-bold text-base sm:text-lg">Privara Estate</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500">
            © 2026 Privara Estate. {t('footer.rights')}
          </p>
          <div className={`flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm text-gray-500 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <span>{t('footer.privacy')}</span>
            <span>{t('footer.terms')}</span>
            <span>{t('footer.contact')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
