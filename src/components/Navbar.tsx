'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { Shield, User, LogOut, Menu, X, Globe, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import NotificationDropdown from './NotificationDropdown';

export default function Navbar({ forceLanguage }: { forceLanguage?: 'en' | 'ar' }) {
  const { profile, signOut } = useAuth();
  const { language: globalLanguage, setLanguage, t: translate, tForLanguage, isRTL: globalIsRTL } = useLanguage();
  const [isOpen, setIsOpen] = React.useState(false);

  const language = forceLanguage || globalLanguage;
  const isRTL = forceLanguage ? (forceLanguage === 'ar') : globalIsRTL;
  
  // Create a local t function if language is forced
  const t = (key: string) => {
    if (forceLanguage) {
      return tForLanguage(key, forceLanguage);
    }
    return translate(key);
  };

  const toggleLanguage = () => {
    if (forceLanguage) return;
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between h-16 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="flex items-center">
            <Link href="/" className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2`}>
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <Shield className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight">Privately</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className={`hidden md:flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-8`}>
            <Link href="/#how-it-works" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">{t('hero.how_it_works')}</Link>
            
            {!forceLanguage && (
              <button 
                onClick={toggleLanguage}
                className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-black transition-colors"
              >
                <Globe className="w-4 h-4" />
                {language === 'en' ? 'العربية' : 'English'}
              </button>
            )}

            {profile ? (
              <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-4`}>
                <NotificationDropdown />
                <Link 
                  href={`/${profile.role}/dashboard`}
                  className="text-sm font-medium text-gray-900 bg-gray-100 px-4 py-2 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {t('nav.dashboard')}
                </Link>
                <Link 
                  href="/profile"
                  className="p-2 text-gray-600 hover:text-black transition-colors rounded-full hover:bg-gray-100"
                  title={t('nav.profile')}
                >
                  <User className="w-5 h-5" />
                </Link>
                <button 
                  onClick={() => signOut()}
                  className="text-gray-500 hover:text-red-600 transition-colors"
                  title={t('nav.logout')}
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-4`}>
                <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">{t('nav.login')}</Link>
                <Link 
                  href="/register" 
                  className="text-sm font-medium text-white bg-black px-6 py-2 rounded-full hover:bg-gray-800 transition-all shadow-lg shadow-black/10"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-600">
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-gray-100 overflow-hidden"
          >
            <div className={`px-4 pt-2 pb-6 space-y-2 ${isRTL ? 'text-right' : ''}`}>
              <Link href="/#how-it-works" className="block px-3 py-2 text-base font-medium text-gray-600">{t('hero.how_it_works')}</Link>
              {!forceLanguage && (
                <button 
                  onClick={toggleLanguage}
                  className="w-full text-left px-3 py-2 text-base font-medium text-gray-600"
                >
                  {language === 'en' ? 'العربية' : 'English'}
                </button>
              )}
              {profile ? (
                <>
                  <Link href={`/${profile.role}/dashboard`} className="block px-3 py-2 text-base font-medium text-black">{t('nav.dashboard')}</Link>
                  <button onClick={() => signOut()} className="block w-full text-left px-3 py-2 text-base font-medium text-red-600">{t('nav.logout')}</button>
                </>
              ) : (
                <>
                  <Link href="/login" className="block px-3 py-2 text-base font-medium text-gray-600">{t('nav.login')}</Link>
                  <Link href="/register" className="block px-3 py-2 text-base font-medium text-black">{t('nav.register')}</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
