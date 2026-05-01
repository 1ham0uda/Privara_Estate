'use client';

import React, { useMemo } from 'react';
import { ConsultationCase, ConsultantProfile } from '@/src/types';
import { Card } from '@/src/components/UI';
import { useLanguage } from '@/src/context/LanguageContext';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TrendingUp, Clock, Users, Star, Repeat, DollarSign } from 'lucide-react';

interface Props {
  cases: ConsultationCase[];
  consultants: ConsultantProfile[];
  consultationFee: number;
}

function monthKey(ts: any): string {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleString('default', {
    month: 'short',
    year: '2-digit',
  });
}

export default function AdminAnalyticsTab({ cases, consultants, consultationFee }: Props) {
  const { t, isRTL } = useLanguage();

  const paidCases = useMemo(() => cases.filter(c => c.paymentStatus === 'paid'), [cases]);
  const completedCases = useMemo(() => cases.filter(c => c.status === 'completed'), [cases]);

  // MRR: sum of fees for paid cases grouped by month (last 6 months)
  const mrrData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    paidCases.forEach(c => {
      const key = monthKey(c.createdAt);
      byMonth[key] = (byMonth[key] ?? 0) + (c.payment?.amount ?? consultationFee);
    });
    const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    return sorted.map(([key, value]) => ({ month: monthLabel(key), revenue: value }));
  }, [paidCases, consultationFee]);

  // Avg time-to-complete (days from createdAt to completedAt)
  const avgCompletionDays = useMemo(() => {
    const timed = completedCases.filter(c => c.completedAt && c.createdAt);
    if (!timed.length) return null;
    const totalMs = timed.reduce((sum, c) => {
      const start = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      const end = c.completedAt?.toDate ? c.completedAt.toDate() : new Date(c.completedAt);
      return sum + (end.getTime() - start.getTime());
    }, 0);
    return Math.round(totalMs / timed.length / 86_400_000);
  }, [completedCases]);

  // SLA breach: consultations unassigned for more than 48 hours
  const slaBreach = useMemo(() => {
    const now = Date.now();
    const breached = cases.filter(c => {
      if (c.consultantId) return false;
      const created = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      return now - created.getTime() > 48 * 3_600_000;
    });
    const total = cases.filter(c => !c.consultantId).length;
    return { breached: breached.length, total, pct: total ? Math.round((breached.length / total) * 100) : 0 };
  }, [cases]);

  // Consultant utilization: active cases per consultant
  const utilizationData = useMemo(() => {
    return consultants.map(con => ({
      name: con.name.split(' ')[0],
      active: cases.filter(c => c.consultantId === con.uid && c.status !== 'completed').length,
      completed: cases.filter(c => c.consultantId === con.uid && c.status === 'completed').length,
    }));
  }, [consultants, cases]);

  // Repeat client rate
  const repeatClientRate = useMemo(() => {
    const clientCounts: Record<string, number> = {};
    paidCases.forEach(c => {
      clientCounts[c.clientId] = (clientCounts[c.clientId] ?? 0) + 1;
    });
    const total = Object.keys(clientCounts).length;
    const repeat = Object.values(clientCounts).filter(n => n > 1).length;
    return total ? Math.round((repeat / total) * 100) : 0;
  }, [paidCases]);

  // Avg NPS + monthly NPS trend
  const avgNps = useMemo(() => {
    const rated = completedCases.filter(c => c.ratingDetails?.nps != null);
    if (!rated.length) return null;
    return Math.round((rated.reduce((s, c) => s + (c.ratingDetails!.nps ?? 0), 0) / rated.length) * 10) / 10;
  }, [completedCases]);

  const npsTrend = useMemo(() => {
    const byMonth: Record<string, number[]> = {};
    completedCases.forEach(c => {
      if (c.ratingDetails?.nps == null || !c.completedAt) return;
      const key = monthKey(c.completedAt);
      (byMonth[key] = byMonth[key] ?? []).push(c.ratingDetails.nps);
    });
    const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    return sorted.map(([key, scores]) => ({
      month: monthLabel(key),
      nps: Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10,
    }));
  }, [completedCases]);

  // Avg overall rating trend
  const ratingTrend = useMemo(() => {
    const byMonth: Record<string, number[]> = {};
    completedCases.forEach(c => {
      if (c.rating == null || !c.completedAt) return;
      const key = monthKey(c.completedAt);
      (byMonth[key] = byMonth[key] ?? []).push(c.rating);
    });
    const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    return sorted.map(([key, scores]) => ({
      month: monthLabel(key),
      rating: Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10,
    }));
  }, [completedCases]);

  const totalRevenue = paidCases.reduce((s, c) => s + (c.payment?.amount ?? consultationFee), 0);

  return (
    <div className="space-y-10" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <Kpi
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          color="bg-emerald-50"
          label={t('analytics.total_revenue')}
          value={`${totalRevenue.toLocaleString()} EGP`}
          sub={t('analytics.all_time')}
        />
        <Kpi
          icon={<Clock className="w-5 h-5 text-blue-600" />}
          color="bg-blue-50"
          label={t('analytics.avg_completion')}
          value={avgCompletionDays != null ? `${avgCompletionDays}d` : '—'}
          sub={t('analytics.avg_completion_sub')}
        />
        <Kpi
          icon={<TrendingUp className="w-5 h-5 text-amber-600" />}
          color="bg-amber-50"
          label={t('analytics.sla_breach')}
          value={`${slaBreach.pct}%`}
          sub={`${slaBreach.breached} / ${slaBreach.total} ${t('analytics.unassigned')}`}
          danger={slaBreach.pct > 20}
        />
        <Kpi
          icon={<Repeat className="w-5 h-5 text-purple-600" />}
          color="bg-purple-50"
          label={t('analytics.repeat_rate')}
          value={`${repeatClientRate}%`}
          sub={t('analytics.repeat_rate_sub')}
        />
      </div>

      {/* Revenue trend */}
      {mrrData.length > 0 && (
        <Card className="p-8 bg-white border-none shadow-sm" hover={false}>
          <h2 className={`text-lg font-bold mb-6 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <DollarSign className="w-5 h-5 text-emerald-600" />
            {t('analytics.revenue_trend')}
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mrrData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString()} EGP`, t('analytics.revenue')]}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={36} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Consultant utilization */}
      {utilizationData.length > 0 && (
        <Card className="p-8 bg-white border-none shadow-sm" hover={false}>
          <h2 className={`text-lg font-bold mb-6 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Users className="w-5 h-5 text-blue-600" />
            {t('analytics.consultant_utilization')}
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} width={60} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="active" name={t('analytics.active_cases')} radius={[0, 4, 4, 0]} barSize={14} fill="#3b82f6" />
                <Bar dataKey="completed" name={t('analytics.completed_cases')} radius={[0, 4, 4, 0]} barSize={14} fill="#d1fae5">
                  {utilizationData.map((_, i) => (
                    <Cell key={i} fill="#10b981" opacity={0.4} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* NPS + Rating cohort */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-8 bg-white border-none shadow-sm" hover={false}>
          <h2 className={`text-lg font-bold mb-2 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Star className="w-5 h-5 text-amber-500" />
            {t('analytics.nps_trend')}
          </h2>
          <p className="text-xs text-brand-slate mb-5">
            {t('analytics.avg_nps_label')}: <strong>{avgNps != null ? avgNps : '—'}</strong> / 10
          </p>
          {npsTrend.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={npsTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="nps" name="NPS" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-brand-slate italic">{t('analytics.no_data')}</p>
          )}
        </Card>

        <Card className="p-8 bg-white border-none shadow-sm" hover={false}>
          <h2 className={`text-lg font-bold mb-2 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Star className="w-5 h-5 text-blue-500" />
            {t('analytics.rating_trend')}
          </h2>
          <p className="text-xs text-brand-slate mb-5">
            {t('analytics.overall_rating')}: <strong>
              {completedCases.filter(c => c.rating).length > 0
                ? (completedCases.reduce((s, c) => s + (c.rating ?? 0), 0) / completedCases.filter(c => c.rating).length).toFixed(1)
                : '—'}
            </strong> / 5
          </p>
          {ratingTrend.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratingTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="rating" name={t('analytics.rating')} stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-brand-slate italic">{t('analytics.no_data')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  color,
  label,
  value,
  sub,
  danger,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <Card className="bg-white border-none shadow-sm p-6" hover={false}>
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center shrink-0`}>{icon}</div>
        <div>
          <p className="text-xs text-brand-slate mb-1">{label}</p>
          <p className={`text-2xl font-bold ${danger ? 'text-red-600' : 'text-ink'}`}>{value}</p>
          {sub && <p className="text-[10px] text-brand-slate mt-0.5">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}
