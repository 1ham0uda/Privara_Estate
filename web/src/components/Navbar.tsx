'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { User, LogOut, Menu, X, Globe, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import NotificationDropdown from './NotificationDropdown';
import GlobalSearch from './GlobalSearch';

export default function Navbar({ forceLanguage }: { forceLanguage?: 'en' | 'ar' }) {
  const { profile, signOut } = useAuth();
  const { language: globalLanguage, setLanguage, t: translate, tForLanguage, isRTL: globalIsRTL } = useLanguage();
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  const language  = forceLanguage || globalLanguage;
  const isRTL     = forceLanguage ? forceLanguage === 'ar' : globalIsRTL;
  const t         = (key: string) => forceLanguage ? tForLanguage(key, forceLanguage) : translate(key);
  const toggleLanguage = () => { if (!forceLanguage) setLanguage(language === 'en' ? 'ar' : 'en'); };

  const isAdmin = profile?.role === 'admin';

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && isAdmin) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isAdmin]);

  return (
    <>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      <nav className="bg-white/90 backdrop-blur-sm border-b border-soft-blue sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex justify-between h-14 sm:h-16 ${isRTL ? 'flex-row-reverse' : ''}`}>

            {/* Logo */}
            <div className="flex items-center min-w-0">
              <Link
                href="/"
                className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2.5 min-w-0`}
              >
                {/* RR monogram — PDF §02 */}
                <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 bg-blue-600 rounded-lg flex items-center justify-center select-none">
                  <span className="text-white font-serif font-bold text-sm sm:text-base leading-none tracking-tight" aria-hidden="true">RR</span>
                </div>
                <div className="flex flex-col leading-none truncate max-w-[11rem] sm:max-w-none">
                  <span className="font-serif font-bold text-base sm:text-lg leading-tight">
                    <span className="text-ink">Real </span><span className="text-blue-600">Real</span><span className="text-ink"> Estate</span>
                  </span>
                  <span className="hidden sm:block text-[10px] font-mono text-brand-slate tracking-[0.12em] uppercase">
                    Independent Advisory · Egypt
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Nav */}
            <div className={`hidden md:flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-6`}>
              <Link
                href="/#how-it-works"
                className="text-sm font-medium text-brand-slate hover:text-ink transition-colors"
              >
                {t('hero.how_it_works')}
              </Link>

              {!forceLanguage && (
                <button
                  onClick={toggleLanguage}
                  className="flex items-center gap-1 text-sm font-medium text-brand-slate hover:text-ink transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  {language === 'en' ? 'العربية' : 'English'}
                </button>
              )}

              {profile ? (
                <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-4`}>
                  {isAdmin && (
                    <button
                      onClick={() => setSearchOpen(true)}
                      className={`hidden lg:flex items-center gap-2 h-8 px-3 bg-cloud border border-soft-blue rounded-lg text-xs text-brand-slate hover:bg-soft-blue transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
                      title="Global search (Ctrl+K)"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Search</span>
                      <kbd className="ml-1 px-1 py-0.5 bg-white border border-soft-blue rounded text-[10px] font-mono">⌘K</kbd>
                    </button>
                  )}
                  <NotificationDropdown />
                  <Link
                    href={`/${profile.role}/dashboard`}
                    className="text-sm font-medium text-blue-600 bg-soft-blue px-4 py-2 rounded-full hover:bg-blue-100 transition-colors"
                  >
                    {t('nav.dashboard')}
                  </Link>
                  <Link
                    href="/profile"
                    className={`flex items-center gap-2 p-2 text-brand-slate hover:text-ink transition-colors rounded-full hover:bg-soft-blue ${isRTL ? 'flex-row-reverse' : ''}`}
                    title={t('nav.profile')}
                  >
                    <User className="w-5 h-5" />
                    <span className="text-xs font-mono font-medium uppercase tracking-wide text-brand-slate">
                      {t(`admin.staff.role.${profile.role}`)}
                    </span>
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="text-brand-slate hover:text-rose-600 transition-colors"
                    aria-label={t('nav.logout')}
                    title={t('nav.logout')}
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-4`}>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-brand-slate hover:text-ink transition-colors"
                  >
                    {t('nav.login')}
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm font-medium text-white bg-blue-600 px-5 sm:px-6 py-2 rounded-full hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/15"
                  >
                    {t('nav.register')}
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center shrink-0 gap-2">
              {isAdmin && (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 text-brand-slate hover:bg-soft-blue rounded-lg"
                  aria-label="Search"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-brand-slate p-2 rounded-lg hover:bg-soft-blue"
                aria-label={isOpen ? t('nav.close_menu') : t('nav.open_menu')}
                aria-expanded={isOpen}
                aria-controls="mobile-nav"
              >
                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              id="mobile-nav"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-b border-soft-blue overflow-hidden"
            >
              <div className={`px-4 pt-2 pb-6 space-y-1 ${isRTL ? 'text-right' : ''}`}>
                <Link
                  href="/#how-it-works"
                  className="block px-3 py-2.5 text-sm font-medium text-brand-slate hover:text-ink"
                >
                  {t('hero.how_it_works')}
                </Link>
                {!forceLanguage && (
                  <button
                    onClick={toggleLanguage}
                    className={`w-full px-3 py-2.5 text-sm font-medium text-brand-slate ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {language === 'en' ? 'العربية' : 'English'}
                  </button>
                )}
                {profile ? (
                  <>
                    <div className={`flex items-center justify-between px-3 py-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Link href={`/${profile.role}/dashboard`} className="text-sm font-medium text-ink">
                        {t('nav.dashboard')}
                      </Link>
                      <NotificationDropdown />
                    </div>
                    <Link
                      href="/profile"
                      className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-brand-slate ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                      <User className="w-4 h-4" />
                      <span>{t('nav.profile')}</span>
                      <span className="text-xs font-mono uppercase tracking-wide text-brand-slate ms-auto">
                        {t(`admin.staff.role.${profile.role}`)}
                      </span>
                    </Link>
                    <button
                      onClick={() => signOut()}
                      className={`block w-full px-3 py-2.5 text-sm font-medium text-rose-600 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('nav.logout')}
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="block px-3 py-2.5 text-sm font-medium text-brand-slate">
                      {t('nav.login')}
                    </Link>
                    <Link href="/register" className="block px-3 py-2.5 text-sm font-medium text-blue-600">
                      {t('nav.register')}
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}
