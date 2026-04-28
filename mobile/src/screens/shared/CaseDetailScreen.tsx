import React, { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { consultationService } from '@/src/services/consultationService';
import { ConsultationCase } from '@/src/types';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Badge } from '@/src/components/Badge';
import { StatusBadge } from '@/src/components/StatusBadge';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { EmptyState } from '@/src/components/EmptyState';
import { AdminCaseActionsSection } from './AdminCaseActionsSection';
import { QualityAuditSection } from './QualityAuditSection';
import { ClientCaseActionsSection } from './ClientCaseActionsSection';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { caseNumber, formatDate } from '@/src/lib/utils';

export function CaseDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { caseId } = route.params as { caseId: string };
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const [data, setData] = useState<ConsultationCase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = consultationService.subscribeToConsultation(caseId, (c) => {
      setData(c);
      setLoading(false);
    });
    return unsub;
  }, [caseId]);

  if (loading) return <LoadingScreen />;
  if (!data) {
    return (
      <ScreenContainer padded={false}>
        <Header title={t('nav.cases')} onBack={() => navigation.goBack()} />
        <EmptyState title={t('common.empty')} />
      </ScreenContainer>
    );
  }

  const role = profile?.role;
  const isAdmin = role === 'admin';
  const isQuality = role === 'quality';
  const isClient = role === 'client';
  const isPaid = data.paymentStatus === 'paid';

  const openChat = () => navigation.navigate('CaseChat', { caseId });

  const openReport = async () => {
    if (!data.reportUrl) return;
    try {
      await Linking.openURL(data.reportUrl);
    } catch {
      Alert.alert('', t('common.error'));
    }
  };

  return (
    <ScreenContainer padded={false} scroll>
      <Header
        title={caseNumber(data.id)}
        subtitle={t(`case.status.${data.status}`)}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.content}>

        {/* ── Status / stage badges ── */}
        <Card>
          <View style={styles.row}>
            <StatusBadge status={data.status} translationPrefix="case.status" />
            <Badge label={t(`case.stage.${data.stage}`)} variant="info" />
            {isPaid ? (
              <Badge label={t('common.completed')} variant="success" />
            ) : (
              <Badge label={t('common.pending')} variant="warning" />
            )}
          </View>
          <Text style={styles.meta}>{formatDate(data.createdAt, language)}</Text>
        </Card>

        {/* ── Intake info ── */}
        <Card>
          <Text style={styles.sectionTitle}>{t('case.intake_info')}</Text>
          <Row label={t('case.goal')} value={t(`intake.goal.${data.intake.goal}`)} />
          <Row label={t('case.property_type')} value={data.intake.propertyType} />
          <Row label={t('case.preferred_area')} value={data.intake.preferredArea} />
          <Row label={t('case.budget_range')} value={data.intake.budgetRange} />
          <Row label={t('case.delivery_time')} value={data.intake.preferredDeliveryTime} />
          {data.intake.projectsInMind ? (
            <Row label={t('case.projects_in_mind')} value={data.intake.projectsInMind} />
          ) : null}
          {data.intake.notes ? <Row label={t('case.notes')} value={data.intake.notes} /> : null}
        </Card>

        {/* ── Assigned consultant ── */}
        <Card>
          <Text style={styles.sectionTitle}>{t('case.consultant')}</Text>
          <Text style={styles.value}>
            {data.consultantName ?? t('case.no_consultant')}
          </Text>
          {data.qualitySpecialistId ? (
            <>
              <Text style={[styles.sectionTitle, styles.qualityLabel]}>
                {t('admin.assign_quality')}
              </Text>
              <Text style={styles.value}>{data.qualitySpecialistName}</Text>
            </>
          ) : null}
        </Card>

        {/* ── Admin: activity timeline ── */}
        {isAdmin ? (
          <Card>
            <Text style={styles.sectionTitle}>{t('admin.timeline')}</Text>
            <TimelineEntry
              dot="green"
              label={t('admin.timeline_case_created')}
              date={formatDate(data.createdAt, language)}
            />
            {isPaid ? (
              <TimelineEntry
                dot="green"
                label={t('admin.timeline_payment_paid')}
                date={data.payment?.paidAt ? formatDate(data.payment.paidAt, language) : ''}
              />
            ) : (
              <TimelineEntry dot="amber" label={t('admin.timeline_payment_pending')} date="" />
            )}
            {data.consultantId ? (
              <TimelineEntry
                dot="blue"
                label={`${t('admin.timeline_consultant_assigned')}: ${data.consultantName ?? ''}`}
                date=""
              />
            ) : null}
            {data.qualitySpecialistId ? (
              <TimelineEntry
                dot="blue"
                label={`${t('admin.timeline_quality_assigned')}: ${data.qualitySpecialistName ?? ''}`}
                date=""
              />
            ) : null}
          </Card>
        ) : null}

        {/* ── Internal notes (admin only) ── */}
        {isAdmin && data.internalNotes ? (
          <Card>
            <Text style={styles.sectionTitle}>{t('case.internal_notes')}</Text>
            <Text style={styles.value}>{data.internalNotes}</Text>
          </Card>
        ) : null}

        {/* ── Report download ── */}
        {data.reportUrl ? (
          <Card>
            <Text style={styles.sectionTitle}>{t('case.report')}</Text>
            <Button title={t('case.download_report')} onPress={openReport} />
          </Card>
        ) : null}

        {/* ══════════════════════════════════════════════════
            ROLE-SPECIFIC SECTIONS
        ══════════════════════════════════════════════════ */}

        {/* ── Admin: assign / reassign / approve requests ── */}
        {isAdmin && profile ? (
          <AdminCaseActionsSection data={data} />
        ) : null}

        {/* ── Admin: quality audit reports (read-only) ── */}
        {isAdmin && profile ? (
          <QualityAuditSection
            caseId={data.id}
            isAdmin
            profile={profile}
            language={language}
          />
        ) : null}

        {/* ── Quality: submit audit form + view reports ── */}
        {isQuality && profile ? (
          <QualityAuditSection
            caseId={data.id}
            isAdmin={false}
            profile={profile}
            language={language}
          />
        ) : null}

        {/* ── Client: reassignment request + rating ── */}
        {isClient ? (
          <ClientCaseActionsSection data={data} />
        ) : null}

        {/* ── Admin: view chat history button ── */}
        {isAdmin ? (
          <Button
            title={t('case.view_chat')}
            variant="outline"
            onPress={openChat}
          />
        ) : null}

        {/* ── Chat button (non-admin roles) ── */}
        {!isAdmin ? (
          <Button title={t('case.chat')} onPress={openChat} />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function TimelineEntry({ dot, label, date }: { dot: 'green' | 'amber' | 'blue'; label: string; date: string }) {
  const dotColor = dot === 'green' ? '#22C55E' : dot === 'amber' ? '#F59E0B' : '#3B82F6';
  return (
    <View style={timelineStyles.row}>
      <View style={[timelineStyles.dot, { backgroundColor: dotColor }]} />
      <View style={timelineStyles.textBlock}>
        <Text style={timelineStyles.label}>{label}</Text>
        {date ? <Text style={timelineStyles.date}>{date}</Text> : null}
      </View>
    </View>
  );
}

const timelineStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  textBlock: { flex: 1 },
  label: { fontSize: 13, color: colors.text, fontWeight: '500' },
  date: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
});

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  qualityLabel: { marginTop: spacing.md },
  infoRow: { paddingVertical: spacing.xs, gap: 2 },
  label: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  value: { fontSize: 14, color: colors.text, fontWeight: '500' },
});
