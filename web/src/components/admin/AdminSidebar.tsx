'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/src/context/LanguageContext';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Shield,
  Headphones,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Briefcase,
  UserCheck,
} from 'lucide-react';

export type AdminTab =
  | 'overview'
  | 'conversations'
  | 'staff'
  | 'quality_reports'
  | 'support'
  | 'analytics';

type NavItemTab  = { kind: 'tab';  id: AdminTab; labelKey: string; icon: React.ReactNode };
type NavItemLink = { kind: 'link'; href: string; labelKey: string; icon: React.ReactNode };
type NavItem = NavItemTab | NavItemLink;

interface NavGroup { labelKey: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'admin.sidebar.group.operations',
    items: [
      { kind: 'tab',  id: 'overview',      labelKey: 'admin.dashboard.tab.overview',      icon: <LayoutDashboard className="w-4 h-4" /> },
      { kind: 'tab',  id: 'conversations', labelKey: 'admin.dashboard.tab.conversations',  icon: <MessageSquare   className="w-4 h-4" /> },
    ],
  },
  {
    labelKey: 'admin.sidebar.group.people',
    items: [
      { kind: 'tab',  id: 'staff',            labelKey: 'admin.dashboard.tab.staff',   icon: <Briefcase  className="w-4 h-4" /> },
      { kind: 'link', href: '/admin/clients',  labelKey: 'admin.sidebar.clients',       icon: <Users      className="w-4 h-4" /> },
      { kind: 'link', href: '/admin/staff',    labelKey: 'admin.sidebar.all_staff',     icon: <UserCheck  className="w-4 h-4" /> },
    ],
  },
  {
    labelKey: 'admin.sidebar.group.quality',
    items: [
      { kind: 'tab', id: 'quality_reports', labelKey: 'admin.dashboard.tab.qualityReports', icon: <Shield className="w-4 h-4" /> },
    ],
  },
  {
    labelKey: 'admin.sidebar.group.support',
    items: [
      { kind: 'tab', id: 'support', labelKey: 'admin.dashboard.tab.support', icon: <Headphones className="w-4 h-4" /> },
    ],
  },
  {
    labelKey: 'admin.sidebar.group.finance',
    items: [
      { kind: 'tab', id: 'analytics', labelKey: 'admin.dashboard.tab.analytics', icon: <BarChart3 className="w-4 h-4" /> },
    ],
  },
  {
    labelKey: 'admin.sidebar.group.system',
    items: [
      { kind: 'link', href: '/admin/staff/add', labelKey: 'admin.sidebar.add_staff', icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

interface Props {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onSettingsClick?: () => void;
}

export default function AdminSidebar({ activeTab, onTabChange, onSettingsClick }: Props) {
  const { t, isRTL } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const itemClass = (active: boolean) =>
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
      active
        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
        : 'text-brand-slate hover:bg-soft-blue hover:text-ink'
    }`;

  const SidebarContent = () => (
    <nav className="flex flex-col h-full" aria-label={t('admin.sidebar.nav_label')}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-soft-blue ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0" aria-hidden="true">
          <span className="text-white font-serif font-bold text-sm leading-none">RR</span>
        </div>
        {!collapsed && (
          <span className="font-serif font-bold text-sm text-ink truncate">Real Real Estate</span>
        )}
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto py-4 space-y-5 px-2">
        {NAV_GROUPS.map(group => (
          <div key={group.labelKey}>
            {!collapsed && (
              <p className="px-2 mb-1.5 text-[10px] font-bold text-brand-slate uppercase tracking-widest">
                {t(group.labelKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item, i) => {
                if (item.kind === 'tab') {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onTabChange(item.id); setMobileOpen(false); }}
                      aria-current={isActive ? 'page' : undefined}
                      title={collapsed ? t(item.labelKey) : undefined}
                      className={itemClass(isActive) + (collapsed ? ' justify-center' : isRTL ? ' flex-row-reverse text-right' : '')}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.href + i}
                    href={item.href}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={itemClass(false) + (collapsed ? ' justify-center' : isRTL ? ' flex-row-reverse text-right' : '')}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Collapse toggle — desktop */}
      <div className="hidden lg:flex border-t border-soft-blue p-3 justify-end">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-2 rounded-lg text-brand-slate hover:bg-soft-blue hover:text-ink transition-colors"
          aria-label={collapsed ? t('admin.sidebar.expand') : t('admin.sidebar.collapse')}
        >
          {isRTL
            ? (collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)
            : (collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />)
          }
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-xl shadow-md border border-soft-blue text-ink"
        onClick={() => setMobileOpen(o => !o)}
        aria-label={mobileOpen ? t('admin.sidebar.close_menu') : t('admin.sidebar.open_menu')}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-ink/40 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} z-50 w-60 bg-white shadow-2xl transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col h-screen sticky top-0 bg-white border-${isRTL ? 'l' : 'r'} border-soft-blue transition-all duration-200 shrink-0 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
