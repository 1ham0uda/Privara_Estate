/**
 * ClientCaseActionsSection
 * Rendered inside CaseDetailScreen when profile.role === 'client'.
 * Covers:
 *   1. Request consultant reassignment (with reason)
 *   2. Submit rating + feedback when case is completed
 */
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { consultationService } from '@/src/services/consultationService';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { ConsultationCase } from '@/src/types';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Badge } from '@/src/components/Badge';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';

interface Props {
  data: ConsultationCase;
}

// ── Star Rating ────────────────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.7}>
          <Text style={[starStyles.star, value >= star && starStyles.starFilled]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  star: { fontSize: 32, color: colors.border },
  starFilled: { color: '#F59E0B' },
});

export function ClientCaseActionsSection({ data }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();

  // ── Reassignment state ────────────────────────────────────────────────────
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reason, setReason] = useState('');
  const [submittingReassign, setSubmittingReassign] = useState(false);

  // ── Rating state ──────────────────────────────────────────────────────────
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const hasPendingReassignment = data.reassignmentRequestStatus === 'pending';
  // Client can request a change only when a consultant is assigned, no pending
  // request exists, and the case is not already completed.
  const canRequestChange =
    !!data.consultantId &&
    !hasPendingReassignment &&
    data.status !== 'completed' &&
    data.status !== 'reassigned';

  const canRate = data.status === 'completed' && !data.rating;
  const hasRated = !!data.rating;

  // ── Reassignment handlers ─────────────────────────────────────────────────

  const onRequestReassign = async () => {
    if (!reason.trim()) {
      Alert.alert('', t('case.reason_required'));
      return;
    }
    if (!user || !data.consultantId) return;
    setSubmittingReassign(true);
    try {
      await consultationService.requestConsultantChange(
        data.id,
        user.uid,
        data.consultantId,
        reason.trim(),
      );
      setReason('');
      setShowReassignModal(false);
      Alert.alert('', t('case.change_request_submitted'));
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('common.error'));
    } finally {
      setSubmittingReassign(false);
    }
  };

  // ── Rating handlers ───────────────────────────────────────────────────────

  const onSubmitRating = async () => {
    if (rating === 0) {
      Alert.alert('', t('case.rating_required'));
      return;
    }
    setSubmittingRating(true);
    try {
      await consultationService.submitRating(data.id, rating, feedback.trim());
      Alert.alert('', t('case.thank_you_rating'));
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('common.error'));
    } finally {
      setSubmittingRating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Consultant reassignment ── */}
      {canRequestChange && (
        <Card>
          <Text style={styles.sectionTitle}>{t('case.request_change')}</Text>
          <Text style={styles.hint}>{t('case.change_hint')}</Text>
          <Button
            title={t('case.request_change')}
            variant="outline"
            onPress={() => setShowReassignModal(true)}
          />
        </Card>
      )}

      {hasPendingReassignment && (
        <Card style={styles.pendingCard}>
          <View style={styles.row}>
            <Text style={styles.sectionTitle}>{t('case.request_change')}</Text>
            <Badge label={t('case.change_pending')} variant="warning" />
          </View>
          <Text style={styles.hint}>{t('case.change_pending_hint')}</Text>
        </Card>
      )}

      {/* ── Rating form (only shown when completed and not yet rated) ── */}
      {canRate && (
        <Card style={styles.ratingCard}>
          <Text style={styles.sectionTitle}>{t('case.submit_rating')}</Text>
          <StarRating value={rating} onChange={setRating} />
          <TextInput
            style={styles.feedbackInput}
            value={feedback}
            onChangeText={setFeedback}
            placeholder={t('case.rate_placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Button
            title={t('case.submit_rating')}
            onPress={onSubmitRating}
            loading={submittingRating}
          />
        </Card>
      )}

      {/* Already rated — show the submitted rating */}
      {hasRated && (
        <Card>
          <Text style={styles.sectionTitle}>{t('case.rating')}</Text>
          <Text style={styles.ratingDisplay}>{'★'.repeat(data.rating ?? 0)} {data.rating}/5</Text>
          {data.feedback ? <Text style={styles.feedbackDisplay}>{data.feedback}</Text> : null}
        </Card>
      )}

      {/* ── Reassignment reason modal ── */}
      <Modal
        visible={showReassignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReassignModal(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowReassignModal(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('case.request_change')}</Text>
            <Text style={styles.modalSubtitle}>{t('case.change_reason_hint')}</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder={t('case.change_reason')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button
                title={t('common.cancel')}
                variant="outline"
                onPress={() => {
                  setReason('');
                  setShowReassignModal(false);
                }}
                style={styles.flex}
                disabled={submittingReassign}
              />
              <Button
                title={t('common.submit')}
                onPress={onRequestReassign}
                loading={submittingReassign}
                style={styles.flex}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  pendingCard: {
    borderWidth: 1,
    borderColor: colors.warning,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  ratingCard: { gap: spacing.md },
  ratingDisplay: { fontSize: 18, color: '#F59E0B', fontWeight: '700' },
  feedbackDisplay: { fontSize: 14, color: colors.text, marginTop: spacing.xs },
  feedbackInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  // Reassignment modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalSubtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  reasonInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
