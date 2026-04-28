/**
 * AdminDashboardScreen
 * 4 tabs: Overview | Conversations | Quality | Settings
 * Replicates the web admin dashboard behaviour.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { consultationService } from '@/src/services/consultationService';
import { userService } from '@/src/services/userService';
import { qualityService } from '@/src/services/qualityService';
import { settingsService } from '@/src/services/settingsService';
import { ConsultationCase, QualityAuditReport, UserProfile } from '@/src/types';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Card } from '@/src/components/Card';
import { StatCard } from '@/src/components/StatCard';
import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Avatar } from '@/src/components/Avatar';
import { StatusBadge } from '@/src/components/StatusBadge';
import { SelectUserModal } from '@/src/components/SelectUserModal';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';
import { caseNumber, formatDate } from '@/src/lib/utils';

// ── Constants ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'conversations' | 'quality' | 'settings';

const ACTIVE_STATUSES = new Set([
  'new', 'assigned', 'active',
  'waiting_for_client', 'waiting_for_consultant', 'report_sent',
]);

// Which case + action is pending a user selection in SelectUserModal
type AssignTarget = { caseId: string; mode: 'consultant' | 'quality' } | null;

// ── Simple bar chart ─────────────────────────────────────────────────────────

function BarChart({ unassigned, active, completed }: { unassigned: number; active: number; completed: number }) {
  const max = Math.max(unassigned, active, completed, 1);
  const MAX_H = 80;
  const bars: { label: string; value: number; color: string }[] = [
    { label: 'Unassigned', value: unassigned, color: colors.warning },
    { label: 'Active', value: active, color: colors.info },
    { label: 'Completed', value: completed, color: colors.success },
  ];
  return (
    <View style={chartStyles.container}>
      {bars.map((b) => (
        <View key={b.label} style={chartStyles.barCol}>
          <Text style={chartStyles.barValue}>{b.value}</Text>
          <View style={chartStyles.barTrack}>
            <View
              style={[
                chartStyles.bar,
                { height: Math.max((b.value / max) * MAX_H, 4), backgroundColor: b.color },
              ]}
            />
          </View>
          <Text style={chartStyles.barLabel}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-end',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { width: '100%', height: 80, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '70%', borderRadius: 4 },
  barValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  barLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});

// ── Staff load row ────────────────────────────────────────────────────────────

function StaffLoadRow({ user, warnThreshold }: { user: UserProfile; warnThreshold: number }) {
  const isWarning = user.activeConsultations > warnThreshold;
  return (
    <View style={loadStyles.row}>
      <Avatar name={user.displayName} size={32} />
      <Text style={loadStyles.name} numberOfLines={1}>{user.displayName}</Text>
      <Badge
        label={String(user.activeConsultations)}
        variant={isWarning ? 'warning' : 'success'}
      />
    </View>
  );
}

const loadStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  name: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '500' },
});

// ── Settings modal ────────────────────────────────────────────────────────────

function SettingsTab({ t }: { t: (key: string, vars?: Record<string, string | number | null | undefined>) => string }) {
  const [fee, setFee] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService.getSettings().then((s) => {
      setFee(String(s.consultationFee));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const onSave = async () => {
    const parsed = parseFloat(fee);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('', 'Please enter a valid fee amount.');
      return;
    }
    setSaving(true);
    try {
      await settingsService.updateSettings({ consultationFee: parsed });
      Alert.alert('', t('admin.fee_updated'));
    } catch {
      Alert.alert('', t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView contentContainerStyle={settingsStyles.container}>
      <Card>
        <Text style={settingsStyles.title}>{t('admin.consultation_fee')}</Text>
        <TextInput
          style={settingsStyles.input}
          value={fee}
          onChangeText={setFee}
          keyboardType="decimal-pad"
          placeholder="500"
          placeholderTextColor={colors.textMuted}
        />
        <Button title={t('common.save')} onPress={onSave} loading={saving} />
      </Card>
    </ScrollView>
  );
}

const settingsStyles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 15,
    marginBottom: spacing.md,
  },
});

// ── Main component ────────────────────────────────────────────────────────────

export function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Cases
  const [cases, setCases] = useState<ConsultationCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);

  // Staff
  const [consultants, setConsultants] = useState<UserProfile[]>([]);
  const [qualityUsers, setQualityUsers] = useState<UserProfile[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  // Audit reports
  const [auditReports, setAuditReports] = useState<QualityAuditReport[]>([]);

  // Assign target (which case+mode is open in SelectUserModal)
  const [assignTarget, setAssignTarget] = useState<AssignTarget>(null);
  const [assigning, setAssigning] = useState<string | null>(null); // caseId + mode key

  // Subscribe to all consultations
  useEffect(() => {
    if (!user) return;
    const unsub = consultationService.subscribeToConsultations('admin', user.uid, (data) => {
      setCases(data);
      setCasesLoading(false);
    });
    return unsub;
  }, [user]);

  // Load staff once
  useEffect(() => {
    setStaffLoading(true);
    Promise.all([
      userService.getAllUsersByRole('consultant'),
      userService.getAllUsersByRole('quality'),
    ]).then(([c, q]) => {
      setConsultants(c);
      setQualityUsers(q);
    }).catch(() => {}).finally(() => setStaffLoading(false));
  }, []);

  // Subscribe to audit reports
  useEffect(() => {
    const unsub = qualityService.subscribeToAuditReports(setAuditReports);
    return unsub;
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const unassigned = cases.filter((c) => !c.consultantId && ACTIVE_STATUSES.has(c.status)).length;
    const active = cases.filter((c) => c.consultantId && ACTIVE_STATUSES.has(c.status)).length;
    const completed = cases.filter((c) => c.status === 'completed').length;
    const totalStaff = consultants.length + qualityUsers.length;
    return { unassigned, active, completed, totalStaff };
  }, [cases, consultants, qualityUsers]);

  const unassignedCases = useMemo(
    () => cases.filter((c) => !c.consultantId && ACTIVE_STATUSES.has(c.status)),
    [cases],
  );

  const activeCases = useMemo(
    () => cases.filter((c) => c.consultantId && ACTIVE_STATUSES.has(c.status)),
    [cases],
  );

  // Case lookup map for quality reports tab
  const caseMap = useMemo(() => {
    const m: Record<string, ConsultationCase> = {};
    cases.forEach((c) => { m[c.id] = c; });
    return m;
  }, [cases]);

  // ── Export state ──────────────────────────────────────────────────────────

  const [showExportModal, setShowExportModal] = useState(false);

  const exportCSV = async (filename: string, header: string, rows: string[]) => {
    if (rows.length === 0) {
      Alert.alert('', t('admin.export_empty'));
      return;
    }
    const csv = [header, ...rows].join('\n');
    try {
      await Share.share({ title: filename, message: csv });
    } catch {
      // user cancelled — ignore
    }
    setShowExportModal(false);
  };

  const onExportConsultations = () => {
    const header = 'ID,Client,Consultant,Quality,Status,Stage,CreatedAt';
    const rows = cases.map((c) =>
      [
        `"${c.id}"`,
        `"${c.clientName ?? ''}"`,
        `"${c.consultantName ?? ''}"`,
        `"${c.qualitySpecialistName ?? ''}"`,
        `"${c.status}"`,
        `"${c.stage}"`,
        `"${formatDate(c.createdAt, language)}"`,
      ].join(','),
    );
    exportCSV('consultations.csv', header, rows);
  };

  const onExportStaff = () => {
    const allStaff = [...consultants, ...qualityUsers];
    const header = 'Role,Name,ID';
    const rows = allStaff.map((u) =>
      [`"${u.role}"`, `"${u.displayName ?? ''}"`, `"${u.uid}"`].join(','),
    );
    exportCSV('staff.csv', header, rows);
  };

  const onExportQuality = () => {
    const header = 'ID,CaseID,QualitySpecialist,Status,Classification,MeetingStatus,Notes,CreatedAt';
    const rows = auditReports.map((r) =>
      [
        `"${r.id}"`,
        `"${r.caseId}"`,
        `"${r.specialistName}"`,
        `"${r.status}"`,
        `"${r.classification}"`,
        `"${r.meetingStatus}"`,
        `"${(r.notes ?? '').replace(/"/g, '""')}"`,
        `"${formatDate(r.createdAt, language)}"`,
      ].join(','),
    );
    exportCSV('quality_reports.csv', header, rows);
  };

  // ── Assign from unassigned cases ───────────────────────────────────────────

  const onAssignPress = useCallback((caseId: string, mode: 'consultant' | 'quality') => {
    setAssignTarget({ caseId, mode });
  }, []);

  const onAssignSelect = useCallback(async (selected: UserProfile) => {
    if (!assignTarget) return;
    const { caseId, mode } = assignTarget;
    setAssignTarget(null);
    const key = `${caseId}_${mode}`;
    setAssigning(key);
    try {
      if (mode === 'consultant') {
        await consultationService.assignConsultant(caseId, selected.uid, selected.displayName);
      } else {
        await consultationService.assignQualitySpecialist(caseId, selected.uid, selected.displayName);
      }
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('common.error'));
    } finally {
      setAssigning(null);
    }
  }, [assignTarget, t]);

  const modalUsers = assignTarget?.mode === 'quality' ? qualityUsers : consultants;
  const modalTitle = assignTarget?.mode === 'quality'
    ? t('admin.select_quality')
    : t('admin.assign_consultant');

  // ── Render tabs ────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('admin.overview') },
    { key: 'conversations', label: t('admin.conversations') },
    { key: 'quality', label: t('admin.quality_reports') },
    { key: 'settings', label: t('admin.settings') },
  ];

  const greeting = profile?.displayName ? `, ${profile.displayName.split(' ')[0]}` : '';

  const isOverview = activeTab === 'overview';
  const isConversations = activeTab === 'conversations';
  const isQuality = activeTab === 'quality';
  const isSettings = activeTab === 'settings';

  if (casesLoading) return <LoadingScreen />;

  return (
    <ScreenContainer padded={false}>
      <Header
        title={`${t('dashboard.welcome')}${greeting}`}
        right={
          <TouchableOpacity onPress={() => setShowExportModal(true)} style={styles.exportBtn}>
            <Text style={styles.exportBtnText}>{t('admin.export')}</Text>
          </TouchableOpacity>
        }
      />

      {/* ── Tab pills ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Tab content ── */}
      {isOverview && (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Stat cards */}
          <View style={styles.statsRow}>
            <StatCard label={t('dashboard.unassigned')} value={stats.unassigned} tone="warning" />
            <StatCard label={t('dashboard.active_cases')} value={stats.active} tone="info" />
          </View>
          <View style={styles.statsRow}>
            <StatCard label={t('dashboard.completed_cases')} value={stats.completed} tone="success" />
            <StatCard label={t('dashboard.total_staff')} value={stats.totalStaff} />
          </View>

          {/* Bar chart */}
          <Card>
            <BarChart
              unassigned={stats.unassigned}
              active={stats.active}
              completed={stats.completed}
            />
          </Card>

          {/* Unassigned cases */}
          <Text style={styles.sectionTitle}>{t('admin.unassigned_cases')}</Text>
          {unassignedCases.length === 0 ? (
            <EmptyState title={t('admin.no_unassigned')} />
          ) : (
            unassignedCases.map((item) => {
              const consultantKey = `${item.id}_consultant`;
              const qualityKey = `${item.id}_quality`;
              return (
                <Card key={item.id} style={styles.caseCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.caseNumber}>{caseNumber(item.id)}</Text>
                    <StatusBadge status={item.status} translationPrefix="case.status" />
                  </View>
                  <Text style={styles.caseClient}>{item.clientName ?? '—'}</Text>
                  <Text style={styles.caseMeta}>
                    {formatDate(item.createdAt, language)}
                  </Text>
                  {item.intake.selectedConsultantName ? (
                    <Badge label={item.intake.selectedConsultantName} variant="info" />
                  ) : null}
                  <View style={styles.assignRow}>
                    <Button
                      title={t('admin.assign_consultant')}
                      onPress={() => onAssignPress(item.id, 'consultant')}
                      loading={assigning === consultantKey}
                      style={styles.flex}
                    />
                    <Button
                      title={t('admin.assign_quality')}
                      variant="outline"
                      onPress={() => onAssignPress(item.id, 'quality')}
                      loading={assigning === qualityKey}
                      style={styles.flex}
                    />
                  </View>
                </Card>
              );
            })
          )}

          {/* Active cases */}
          <Text style={styles.sectionTitle}>{t('admin.active_cases')}</Text>
          {activeCases.length === 0 ? (
            <EmptyState title={t('admin.no_active')} />
          ) : (
            activeCases.map((item) => (
              <Card
                key={item.id}
                style={styles.caseCard}
                onPress={() => navigation.navigate('CaseDetail', { caseId: item.id })}
              >
                <View style={styles.rowBetween}>
                  <Text style={styles.caseNumber}>{caseNumber(item.id)}</Text>
                  <Badge label={t(`case.stage.${item.stage}`)} variant="info" />
                </View>
                <Text style={styles.caseClient}>{item.clientName ?? '—'}</Text>
                <Text style={styles.caseMeta}>{item.consultantName ?? t('case.no_consultant')}</Text>
              </Card>
            ))
          )}

          {/* Staff load */}
          {!staffLoading && (consultants.length > 0 || qualityUsers.length > 0) ? (
            <Card>
              <Text style={styles.sectionTitle}>{t('admin.staff_load')}</Text>
              {consultants.length > 0 ? (
                <>
                  <Text style={styles.subLabel}>{t('nav.staff')}</Text>
                  {consultants.map((c) => (
                    <StaffLoadRow key={c.uid} user={c} warnThreshold={3} />
                  ))}
                </>
              ) : null}
              {qualityUsers.length > 0 ? (
                <>
                  <Text style={[styles.subLabel, styles.subLabelTop]}>{t('quality.audit')}</Text>
                  {qualityUsers.map((q) => (
                    <StaffLoadRow key={q.uid} user={q} warnThreshold={5} />
                  ))}
                </>
              ) : null}
            </Card>
          ) : null}
        </ScrollView>
      )}

      {isConversations && (
        <FlatList
          data={cases}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.content}
          ListEmptyComponent={<EmptyState title={t('dashboard.no_cases')} />}
          renderItem={({ item }) => (
            <Card
              style={styles.caseCard}
              onPress={() => navigation.navigate('CaseDetail', { caseId: item.id })}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.caseNumber}>{caseNumber(item.id)}</Text>
                <StatusBadge status={item.status} translationPrefix="case.status" />
              </View>
              <Text style={styles.caseClient}>{item.clientName ?? '—'}</Text>
              <Text style={styles.caseMeta}>
                {item.consultantName ?? t('case.no_consultant')} · {t(`case.stage.${item.stage}`)}
              </Text>
              <Button
                title={t('admin.monitor')}
                variant="outline"
                onPress={() => navigation.navigate('CaseChat', { caseId: item.id })}
              />
            </Card>
          )}
        />
      )}

      {isQuality && (
        <FlatList
          data={auditReports}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.content}
          ListEmptyComponent={<EmptyState title={t('quality.no_reports')} />}
          renderItem={({ item }) => {
            const relatedCase = caseMap[item.caseId];
            const isCritical = item.classification === 'critical';
            const isFailed = item.meetingStatus === 'failed';
            return (
              <Card style={styles.caseCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.caseNumber}>
                    {relatedCase ? caseNumber(relatedCase.id) : item.caseId.substring(0, 8)}
                  </Text>
                  <Text style={styles.caseMeta}>{formatDate(item.createdAt, language)}</Text>
                </View>
                {relatedCase ? (
                  <Text style={styles.caseClient}>{relatedCase.clientName ?? '—'}</Text>
                ) : null}
                <View style={styles.badgeRow}>
                  <Badge
                    label={isCritical ? t('quality.critical') : t('quality.non_critical')}
                    variant={isCritical ? 'error' : 'success'}
                  />
                  <Badge
                    label={
                      item.meetingStatus === 'recorded'
                        ? t('quality.recorded')
                        : item.meetingStatus === 'not-recorded'
                        ? t('quality.not_recorded')
                        : t('quality.failed')
                    }
                    variant={item.meetingStatus === 'recorded' ? 'success' : isFailed ? 'error' : 'warning'}
                  />
                </View>
                {item.notes ? <Text style={styles.reportNotes}>{item.notes}</Text> : null}
                <Text style={styles.caseMeta}>{t('quality.audit')} · {item.specialistName}</Text>
              </Card>
            );
          }}
        />
      )}

      {isSettings && <SettingsTab t={t} />}

      {/* ── Assign user picker ── */}
      <SelectUserModal
        visible={assignTarget !== null}
        title={modalTitle}
        users={modalUsers}
        loading={staffLoading}
        onSelect={onAssignSelect}
        onClose={() => setAssignTarget(null)}
      />

      {/* ── Export modal ── */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <Pressable style={exportStyles.backdrop} onPress={() => setShowExportModal(false)}>
          <Pressable style={exportStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={exportStyles.title}>{t('admin.export_title')}</Text>
            <TouchableOpacity style={exportStyles.option} onPress={onExportConsultations}>
              <View style={[exportStyles.optionIcon, { backgroundColor: colors.infoBg }]}>
                <Text style={[exportStyles.optionIconText, { color: colors.info }]}>📋</Text>
              </View>
              <Text style={exportStyles.optionLabel}>{t('admin.export_consultations')}</Text>
              <Text style={exportStyles.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={exportStyles.option} onPress={onExportStaff}>
              <View style={[exportStyles.optionIcon, { backgroundColor: colors.successBg }]}>
                <Text style={[exportStyles.optionIconText, { color: colors.success }]}>👥</Text>
              </View>
              <Text style={exportStyles.optionLabel}>{t('admin.export_staff')}</Text>
              <Text style={exportStyles.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={exportStyles.option} onPress={onExportQuality}>
              <View style={[exportStyles.optionIcon, { backgroundColor: colors.warningBg }]}>
                <Text style={[exportStyles.optionIconText, { color: colors.warning }]}>📊</Text>
              </View>
              <Text style={exportStyles.optionLabel}>{t('admin.export_quality')}</Text>
              <Text style={exportStyles.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={exportStyles.cancelBtn}
              onPress={() => setShowExportModal(false)}
            >
              <Text style={exportStyles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexGrow: 0,
  },
  tabBarContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primaryText,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  subLabelTop: {
    marginTop: spacing.md,
  },
  caseCard: {
    gap: spacing.xs,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caseNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  caseClient: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  caseMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  assignRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  flex: { flex: 1 },
  reportNotes: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  exportBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exportBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },
});

const exportStyles = StyleSheet.create({
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
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconText: { fontSize: 18 },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  chevron: { fontSize: 20, color: colors.textMuted },
  cancelBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
