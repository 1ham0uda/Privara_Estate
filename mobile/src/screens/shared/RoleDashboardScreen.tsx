import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { consultationService } from '@/src/services/consultationService';
import { ConsultationCase, UserRole } from '@/src/types';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Card } from '@/src/components/Card';
import { StatCard } from '@/src/components/StatCard';
import { StatusBadge } from '@/src/components/StatusBadge';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { caseNumber, formatDate } from '@/src/lib/utils';

interface Props {
  role: UserRole;
}

const ACTIVE_STATUSES = new Set([
  'new',
  'assigned',
  'active',
  'waiting_for_client',
  'waiting_for_consultant',
  'report_sent',
]);

export function RoleDashboardScreen({ role }: Props) {
  const navigation = useNavigation<any>();
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const [cases, setCases] = useState<ConsultationCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = consultationService.subscribeToConsultations(role, user.uid, (data) => {
      setCases(data);
      setLoading(false);
    });
    return unsub;
  }, [user, role]);

  const stats = useMemo(() => {
    const active = cases.filter((c) => ACTIVE_STATUSES.has(c.status)).length;
    const completed = cases.filter((c) => c.status === 'completed').length;
    const unassigned = cases.filter((c) => !c.consultantId).length;
    return { active, completed, unassigned, total: cases.length };
  }, [cases]);

  if (loading) return <LoadingScreen />;

  const greeting = profile?.displayName ? `, ${profile.displayName.split(' ')[0]}` : '';

  return (
    <ScreenContainer padded={false}>
      <Header title={`${t('dashboard.welcome')}${greeting}`} />
      <FlatList
        data={cases}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.stats}>
              <StatCard label={t('dashboard.active_cases')} value={stats.active} tone="info" />
              <StatCard label={t('dashboard.completed_cases')} value={stats.completed} tone="success" />
            </View>
            {role === 'admin' ? (
              <View style={styles.stats}>
                <StatCard label={t('dashboard.total_cases')} value={stats.total} />
                <StatCard label={t('dashboard.unassigned')} value={stats.unassigned} tone="warning" />
              </View>
            ) : null}
            <Text style={styles.sectionTitle}>{t('nav.cases')}</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState title={t('dashboard.no_cases')} />}
        renderItem={({ item }) => (
          <Card
            onPress={() => navigation.navigate('CaseDetail', { caseId: item.id })}
            style={styles.caseCard}
          >
            <View style={styles.rowBetween}>
              <Text style={styles.caseNumber}>{caseNumber(item.id)}</Text>
              <StatusBadge status={item.status} translationPrefix="case.status" />
            </View>
            <Text style={styles.caseClient}>
              {role === 'client'
                ? item.consultantName ?? t('case.no_consultant')
                : item.clientName ?? '—'}
            </Text>
            <Text style={styles.caseMeta}>
              {formatDate(item.createdAt, language)} · {t(`case.stage.${item.stage}`)}
            </Text>
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.sm },
  headerContent: { gap: spacing.md, marginBottom: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  caseCard: { marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caseNumber: { fontSize: 14, fontWeight: '700', color: colors.text },
  caseClient: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  caseMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
