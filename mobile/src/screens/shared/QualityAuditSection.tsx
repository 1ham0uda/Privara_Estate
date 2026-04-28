/**
 * QualityAuditSection
 * Rendered inside CaseDetailScreen for:
 *   - quality role  → submit form + list of all reports for this case
 *   - admin role    → read-only list of reports
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { qualityService } from '@/src/services/qualityService';
import { useLanguage } from '@/src/context/LanguageContext';
import { QualityAuditReport, UserProfile } from '@/src/types';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Badge } from '@/src/components/Badge';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { EmptyState } from '@/src/components/EmptyState';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';
import { formatDate } from '@/src/lib/utils';

interface Props {
  caseId: string;
  isAdmin: boolean;
  profile: UserProfile;
  language: string;
}

type Classification = 'critical' | 'non-critical';
type MeetingStatus = 'recorded' | 'not-recorded' | 'failed';

// ── Small option-toggle button ────────────────────────────────────────────────
function OptionButton({
  label,
  selected,
  danger,
  onPress,
}: {
  label: string;
  selected: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const bg = selected ? (danger ? colors.danger : colors.primary) : colors.surface;
  const fg = selected ? colors.primaryText : colors.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.optionBtn, { backgroundColor: bg, borderColor: selected ? bg : colors.border }]}
      activeOpacity={0.75}
    >
      <Text style={[styles.optionText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function QualityAuditSection({ caseId, isAdmin, profile, language }: Props) {
  const { t } = useLanguage();
  const [reports, setReports] = useState<QualityAuditReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  // Form state — only used by quality role
  const [classification, setClassification] = useState<Classification>('non-critical');
  const [meetingStatus, setMeetingStatus] = useState<MeetingStatus>('recorded');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReports = useCallback(() => {
    setLoadingReports(true);
    qualityService
      .getAuditReports(caseId)
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoadingReports(false));
  }, [caseId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const onSubmit = async () => {
    if (!notes.trim()) {
      Alert.alert('', t('quality.notes_required'));
      return;
    }
    setSubmitting(true);
    try {
      await qualityService.submitAuditReport({
        caseId,
        specialistId: profile.uid,
        specialistName: profile.displayName,
        status: 'completed',
        classification,
        meetingStatus,
        notes: notes.trim(),
      });
      setNotes('');
      setClassification('non-critical');
      setMeetingStatus('recorded');
      // Reload the reports list after a successful submission
      fetchReports();
      Alert.alert('', t('quality.report_submitted'));
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Submit form (quality role only) ── */}
      {!isAdmin && (
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>{t('quality.submit_audit')}</Text>

          {/* Classification */}
          <Text style={styles.fieldLabel}>{t('quality.classification')}</Text>
          <View style={styles.optionRow}>
            <OptionButton
              label={t('quality.non_critical')}
              selected={classification === 'non-critical'}
              onPress={() => setClassification('non-critical')}
            />
            <OptionButton
              label={t('quality.critical')}
              selected={classification === 'critical'}
              danger
              onPress={() => setClassification('critical')}
            />
          </View>

          {/* Meeting status */}
          <Text style={styles.fieldLabel}>{t('quality.meeting_status')}</Text>
          <View style={styles.optionRow}>
            <OptionButton
              label={t('quality.recorded')}
              selected={meetingStatus === 'recorded'}
              onPress={() => setMeetingStatus('recorded')}
            />
            <OptionButton
              label={t('quality.not_recorded')}
              selected={meetingStatus === 'not-recorded'}
              onPress={() => setMeetingStatus('not-recorded')}
            />
            <OptionButton
              label={t('quality.failed')}
              selected={meetingStatus === 'failed'}
              danger
              onPress={() => setMeetingStatus('failed')}
            />
          </View>

          {/* Notes */}
          <Text style={styles.fieldLabel}>{t('quality.audit_notes')}</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('quality.notes_placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <Button title={t('quality.submit_audit')} onPress={onSubmit} loading={submitting} />
        </Card>
      )}

      {/* ── Previous reports list ── */}
      <Card>
        <Text style={styles.sectionTitle}>{t('quality.previous_reports')}</Text>
        {loadingReports ? (
          <LoadingScreen />
        ) : reports.length === 0 ? (
          <EmptyState title={t('quality.no_reports')} />
        ) : (
          <View style={styles.reportsList}>
            {reports.map((rep) => (
              <View key={rep.id} style={styles.reportItem}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportSpecialist}>{rep.specialistName}</Text>
                  <Text style={styles.reportDate}>{formatDate(rep.createdAt, language)}</Text>
                </View>
                <View style={styles.reportBadges}>
                  <Badge
                    label={rep.classification === 'critical' ? t('quality.critical') : t('quality.non_critical')}
                    variant={rep.classification === 'critical' ? 'error' : 'success'}
                  />
                  <Badge
                    label={
                      rep.meetingStatus === 'recorded'
                        ? t('quality.recorded')
                        : rep.meetingStatus === 'not-recorded'
                        ? t('quality.not_recorded')
                        : t('quality.failed')
                    }
                    variant={
                      rep.meetingStatus === 'recorded'
                        ? 'success'
                        : rep.meetingStatus === 'not-recorded'
                        ? 'warning'
                        : 'error'
                    }
                  />
                </View>
                {rep.notes ? <Text style={styles.reportNotes}>{rep.notes}</Text> : null}
                {/* Divider between reports */}
                <View style={styles.divider} />
              </View>
            ))}
          </View>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  formCard: { gap: spacing.md },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  optionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  optionText: { fontSize: 13, fontWeight: '600' },
  notesInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  reportsList: { gap: spacing.sm },
  reportItem: { gap: spacing.xs },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportSpecialist: { fontSize: 14, fontWeight: '600', color: colors.text },
  reportDate: { fontSize: 12, color: colors.textMuted },
  reportBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reportNotes: { fontSize: 13, color: colors.text, lineHeight: 18 },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
});
