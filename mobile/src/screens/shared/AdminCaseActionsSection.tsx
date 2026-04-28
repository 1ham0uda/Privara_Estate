/**
 * AdminCaseActionsSection
 * Rendered inside CaseDetailScreen when profile.role === 'admin'.
 * Covers:
 *   - Mark as paid
 *   - Participants info (client, requested consultant, assigned consultant, quality)
 *   - Assign / reassign consultant
 *   - Approve / reject reassignment requests
 *   - Assign quality specialist
 */
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { consultationService } from '@/src/services/consultationService';
import { userService } from '@/src/services/userService';
import { useLanguage } from '@/src/context/LanguageContext';
import { ConsultationCase, UserProfile, ChangeRequest } from '@/src/types';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Badge } from '@/src/components/Badge';
import { SelectUserModal } from '@/src/components/SelectUserModal';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

interface Props {
  data: ConsultationCase;
}

// Which bottom-sheet picker is open
type ModalMode = 'assign_consultant' | 'reassign_consultant' | 'assign_quality' | null;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function AdminCaseActionsSection({ data }: Props) {
  const { t } = useLanguage();

  const [consultants, setConsultants] = useState<UserProfile[]>([]);
  const [qualityUsers, setQualityUsers] = useState<UserProfile[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Participant emails (loaded separately)
  const [clientEmail, setClientEmail] = useState('');
  const [consultantEmail, setConsultantEmail] = useState('');

  // Which picker modal is open
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  // If approving a request, store the request ID so we can pass it to reassign
  const [pendingApprovalReqId, setPendingApprovalReqId] = useState<string | null>(null);

  // Which button is currently loading
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    setLoadingUsers(true);
    Promise.all([
      userService.getAllUsersByRole('consultant'),
      userService.getAllUsersByRole('quality'),
      consultationService.getChangeRequests(data.id),
    ])
      .then(([c, q, cr]) => {
        setConsultants(c);
        setQualityUsers(q);
        setChangeRequests(cr.filter((r) => r.status === 'pending'));
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [data.id]);

  // Load participant emails
  useEffect(() => {
    if (data.clientId) {
      userService.getUserProfile(data.clientId).then((u) => {
        if (u) setClientEmail(u.email);
      }).catch(() => {});
    }
  }, [data.clientId]);

  useEffect(() => {
    if (data.consultantId) {
      userService.getUserProfile(data.consultantId).then((u) => {
        if (u) setConsultantEmail(u.email);
      }).catch(() => {});
    } else {
      setConsultantEmail('');
    }
  }, [data.consultantId]);

  // ── Mark as paid ─────────────────────────────────────────────────────────────

  const onMarkPaid = () => {
    Alert.alert('', t('admin.mark_paid_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.mark_paid'),
        onPress: async () => {
          setSubmitting('mark_paid');
          try {
            await consultationService.updateConsultation(data.id, { paymentStatus: 'paid' });
          } catch (err: any) {
            Alert.alert('', err?.message ?? t('common.error'));
          } finally {
            setSubmitting(null);
          }
        },
      },
    ]);
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const openModal = (mode: ModalMode) => setModalMode(mode);
  const closeModal = () => {
    setModalMode(null);
    setPendingApprovalReqId(null);
  };

  const onModalSelect = (user: UserProfile) => {
    const mode = modalMode;
    const approvalReqId = pendingApprovalReqId;
    closeModal();
    if (mode === 'assign_consultant') doAssignConsultant(user);
    else if (mode === 'reassign_consultant') doReassignConsultant(user, approvalReqId ?? undefined);
    else if (mode === 'assign_quality') doAssignQuality(user);
  };

  // ── Service calls ─────────────────────────────────────────────────────────

  const doAssignConsultant = async (user: UserProfile) => {
    setSubmitting('consultant');
    try {
      await consultationService.assignConsultant(data.id, user.uid, user.displayName);
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('common.error'));
    } finally {
      setSubmitting(null);
    }
  };

  const doReassignConsultant = async (user: UserProfile, requestId?: string) => {
    setSubmitting('consultant');
    try {
      await consultationService.reassignConsultant(data.id, user.uid, user.displayName, requestId);
      if (requestId) {
        setChangeRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('common.error'));
    } finally {
      setSubmitting(null);
    }
  };

  const doAssignQuality = async (user: UserProfile) => {
    setSubmitting('quality');
    try {
      await consultationService.assignQualitySpecialist(data.id, user.uid, user.displayName);
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('common.error'));
    } finally {
      setSubmitting(null);
    }
  };

  const onApproveRequest = (req: ChangeRequest) => {
    setPendingApprovalReqId(req.id);
    openModal('reassign_consultant');
  };

  const onRejectRequest = async (req: ChangeRequest) => {
    setSubmitting(`reject_${req.id}`);
    try {
      await consultationService.rejectConsultantChange(data.id, req.id);
      setChangeRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('common.error'));
    } finally {
      setSubmitting(null);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const availableConsultants = consultants.filter((c) => c.uid !== data.consultantId);
  const modalUsers = modalMode === 'assign_quality' ? qualityUsers : availableConsultants;

  const modalTitle =
    modalMode === 'assign_quality'
      ? t('admin.select_quality')
      : modalMode === 'assign_consultant'
      ? t('admin.assign_consultant')
      : t('admin.reassign_consultant');

  const isPaid = data.paymentStatus === 'paid';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Mark as Paid ── */}
      {!isPaid && (
        <Card style={styles.paidCard}>
          <View style={styles.paidRow}>
            <Badge label={t('common.pending')} variant="warning" />
            <Button
              title={t('admin.mark_paid')}
              onPress={onMarkPaid}
              loading={submitting === 'mark_paid'}
            />
          </View>
        </Card>
      )}

      {/* ── Participants ── */}
      <Card>
        <Text style={styles.sectionTitle}>{t('admin.participants')}</Text>
        <InfoRow
          label={t('admin.client')}
          value={[data.clientName, clientEmail].filter(Boolean).join(' · ') || t('admin.none')}
        />
        {data.intake.selectedConsultantName ? (
          <InfoRow label={t('admin.requested_consultant')} value={data.intake.selectedConsultantName} />
        ) : null}
        <InfoRow
          label={t('case.consultant')}
          value={
            data.consultantName
              ? [data.consultantName, consultantEmail].filter(Boolean).join(' · ')
              : t('case.no_consultant')
          }
        />
        <InfoRow
          label={t('admin.assign_quality')}
          value={data.qualitySpecialistName ?? t('admin.none')}
        />
      </Card>

      {/* ── Pending reassignment requests ── */}
      {changeRequests.map((req) => (
        <Card key={req.id} style={styles.pendingCard}>
          <View style={styles.reqHeader}>
            <Text style={styles.sectionTitle}>{t('admin.pending_reassignment')}</Text>
            <Badge label={t('common.pending')} variant="warning" />
          </View>
          <Text style={styles.reqReason}>{req.reason}</Text>
          <View style={styles.reqActions}>
            <Button
              title={t('admin.reject')}
              variant="outline"
              onPress={() => onRejectRequest(req)}
              loading={submitting === `reject_${req.id}`}
              style={styles.flex}
            />
            <Button
              title={t('admin.approve')}
              onPress={() => onApproveRequest(req)}
              loading={submitting === `approve_${req.id}`}
              style={styles.flex}
            />
          </View>
        </Card>
      ))}

      {/* ── Consultant assignment ── */}
      <Card>
        <Text style={styles.sectionTitle}>
          {data.consultantId ? t('case.consultant') : t('admin.assign_consultant')}
        </Text>
        {data.consultantId ? (
          <View style={styles.assignedRow}>
            <Text style={styles.assignedName}>{data.consultantName}</Text>
            <Button
              title={t('admin.reassign_consultant')}
              variant="outline"
              onPress={() => openModal('reassign_consultant')}
              loading={submitting === 'consultant' && modalMode === null}
            />
          </View>
        ) : (
          <Button
            title={t('admin.assign_consultant')}
            onPress={() => openModal('assign_consultant')}
            loading={submitting === 'consultant'}
          />
        )}
      </Card>

      {/* ── Quality specialist assignment ── */}
      <Card>
        <Text style={styles.sectionTitle}>{t('admin.assign_quality')}</Text>
        {data.qualitySpecialistId ? (
          <View style={styles.assignedRow}>
            <Text style={styles.assignedName}>{data.qualitySpecialistName}</Text>
            <Button
              title={t('admin.reassign_quality')}
              variant="outline"
              onPress={() => openModal('assign_quality')}
              loading={submitting === 'quality' && modalMode === null}
            />
          </View>
        ) : (
          <Button
            title={t('admin.assign_quality')}
            onPress={() => openModal('assign_quality')}
            loading={submitting === 'quality'}
          />
        )}
      </Card>

      {/* ── User picker sheet ── */}
      <SelectUserModal
        visible={modalMode !== null}
        title={modalTitle}
        users={modalUsers}
        loading={loadingUsers}
        onSelect={onModalSelect}
        onClose={closeModal}
      />
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
  paidCard: {
    borderWidth: 1,
    borderColor: colors.warning,
  },
  paidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  infoRow: {
    paddingVertical: spacing.xs,
    gap: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  pendingCard: {
    borderWidth: 1,
    borderColor: colors.warning,
    gap: spacing.sm,
  },
  reqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reqReason: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  reqActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  flex: { flex: 1 },
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  assignedName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
