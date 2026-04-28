import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { consultationService } from '@/src/services/consultationService';
import { ConsultationCase } from '@/src/types';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { StatCard } from '@/src/components/StatCard';
import { StatusBadge } from '@/src/components/StatusBadge';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { caseNumber, formatDate } from '@/src/lib/utils';

export function ClientDashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const [cases, setCases] = useState<ConsultationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = consultationService.subscribeToConsultations('client', user.uid, (data) => {
      setCases(data);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const stats = useMemo(() => {
    const active = cases.filter((c) => ['assigned', 'active', 'waiting_for_client', 'waiting_for_consultant', 'report_sent'].includes(c.status)).length;
    const completed = cases.filter((c) => c.status === 'completed').length;
    return { active, completed, total: cases.length };
  }, [cases]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const openCase = (id: string) => {
    navigation.navigate('CaseDetail', { caseId: id });
  };

  if (loading) return <LoadingScreen message={t('common.loading')} />;

  return (
    <ScreenContainer padded={false}>
      <Header
        title={`${t('dashboard.welcome')}${profile?.displayName ? `, ${profile.displayName.split(' ')[0]}` : ''}`}
      />
      <FlatList
        data={cases}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.stats}>
              <StatCard label={t('dashboard.active_cases')} value={stats.active} tone="info" />
              <StatCard label={t('dashboard.completed_cases')} value={stats.completed} tone="success" />
            </View>
            <Button
              title={t('dashboard.start_consultation')}
              onPress={() => navigation.navigate('NewConsultation')}
            />
            <Text style={styles.sectionTitle}>{t('nav.cases')}</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('dashboard.no_cases')}
            action={
              <Button
                title={t('dashboard.start_consultation')}
                onPress={() => navigation.navigate('NewConsultation')}
              />
            }
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => openCase(item.id)} style={styles.caseCard}>
            <View style={styles.caseHeader}>
              <Text style={styles.caseNumber}>{caseNumber(item.id)}</Text>
              <StatusBadge status={item.status} translationPrefix="case.status" />
            </View>
            <Text style={styles.caseConsultant}>
              {t('case.consultant')}: {item.consultantName ?? t('case.no_consultant')}
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
  caseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  caseNumber: { fontSize: 14, fontWeight: '700', color: colors.text },
  caseConsultant: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  caseMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
