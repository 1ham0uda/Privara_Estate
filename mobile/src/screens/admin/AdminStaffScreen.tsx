/**
 * AdminStaffScreen
 * Full parity with web /admin/staff:
 *   - Search + filter by role
 *   - Staff list with status badge
 *   - Tap → Staff details modal:
 *       contact info, stats, active cases with per-case reassign,
 *       Activate/Deactivate (blocks if active cases when deactivating)
 *   - Export to CSV via Share sheet
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
import { useLanguage } from '@/src/context/LanguageContext';
import { userService } from '@/src/services/userService';
import { consultantService } from '@/src/services/consultantService';
import { consultationService } from '@/src/services/consultationService';
import { ConsultationCase, UserProfile, StaffRole } from '@/src/types';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Card } from '@/src/components/Card';
import { Avatar } from '@/src/components/Avatar';
import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { SelectUserModal } from '@/src/components/SelectUserModal';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';
import { caseNumber, formatDate } from '@/src/lib/utils';

type FilterRole = 'all' | StaffRole;

const ACTIVE_STATUSES = new Set([
  'new', 'assigned', 'active',
  'waiting_for_client', 'waiting_for_consultant', 'report_sent',
]);

// ── Staff Details Modal ───────────────────────────────────────────────────────

interface StaffModalProps {
  staff: UserProfile;
  cases: ConsultationCase[];
  allConsultants: UserProfile[];
  allQuality: UserProfile[];
  toggling: boolean;
  onToggle: () => void;
  onClose: () => void;
  t: (key: string) => string;
  language: string;
}

function StaffDetailsModal({
  staff, cases, allConsultants, allQuality,
  toggling, onToggle, onClose, t, language,
}: StaffModalProps) {
  const isActive = staff.status !== 'deactivated';
  const isConsultant = staff.role === 'consultant';

  // Cases assigned to this staff member (active only)
  const activeCases = cases.filter(
    (c) =>
      ACTIVE_STATUSES.has(c.status) &&
      (c.consultantId === staff.uid || c.qualitySpecialistId === staff.uid),
  );

  // Reassignment state per case
  const [reassigningCaseId, setReassigningCaseId] = useState<string | null>(null);
  const [reassignLoading, setReassignLoading] = useState(false);

  const substituteList = isConsultant
    ? allConsultants.filter((u) => u.uid !== staff.uid && u.status !== 'deactivated')
    : allQuality.filter((u) => u.uid !== staff.uid && u.status !== 'deactivated');

  const onReassignSelect = async (newUser: UserProfile) => {
    if (!reassigningCaseId) return;
    const caseId = reassigningCaseId;
    setReassigningCaseId(null);
    setReassignLoading(true);
    try {
      if (isConsultant) {
        await consultationService.assignConsultant(caseId, newUser.uid, newUser.displayName);
      } else {
        await consultationService.assignQualitySpecialist(caseId, newUser.uid, newUser.displayName);
      }
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('common.error'));
    } finally {
      setReassignLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={ms.backdrop} onPress={onClose}>
        <Pressable style={ms.sheet} onPress={(e) => e.stopPropagation()}>
          <Pressable style={ms.closeBtn} onPress={onClose} hitSlop={12}>
            <Text style={ms.closeText}>✕</Text>
          </Pressable>

          {/* Header */}
          <View style={ms.avatarRow}>
            <Avatar name={staff.displayName} size={56} />
            <View style={ms.avatarInfo}>
              <Text style={ms.name}>{staff.displayName}</Text>
              <View style={ms.badgeRow}>
                <Badge
                  label={staff.role}
                  variant={staff.role === 'consultant' ? 'info' : staff.role === 'quality' ? 'success' : 'error'}
                />
                <Badge
                  label={isActive ? t('common.active') : t('admin.clients.deactivated')}
                  variant={isActive ? 'success' : 'error'}
                />
              </View>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={ms.scroll}>
            {/* Contact */}
            <View style={ms.infoBlock}>
              <Text style={ms.infoLabel}>{t('auth.email')}</Text>
              <Text style={ms.infoValue}>{staff.email}</Text>
            </View>
            {staff.phoneNumber ? (
              <View style={ms.infoBlock}>
                <Text style={ms.infoLabel}>{t('profile.phone')}</Text>
                <Text style={ms.infoValue}>{staff.phoneNumber}</Text>
              </View>
            ) : null}
            {staff.experienceYears !== undefined ? (
              <View style={ms.infoBlock}>
                <Text style={ms.infoLabel}>{t('admin.staff.experience')}</Text>
                <Text style={ms.infoValue}>{staff.experienceYears} {t('admin.staff.years_exp')}</Text>
              </View>
            ) : null}

            {/* Stats */}
            <View style={ms.statsRow}>
              <View style={ms.statBox}>
                <Text style={ms.statValue}>{staff.totalConsultations ?? 0}</Text>
                <Text style={ms.statLabel}>{t('admin.staff.total_consultations')}</Text>
              </View>
              <View style={ms.statBox}>
                <Text style={[ms.statValue, { color: colors.info }]}>
                  {staff.activeConsultations ?? 0}
                </Text>
                <Text style={ms.statLabel}>{t('admin.staff.active_consultations')}</Text>
              </View>
            </View>

            {/* Active cases */}
            <Text style={ms.sectionTitle}>{t('admin.staff.cases_in_progress')}</Text>
            {activeCases.length === 0 ? (
              <Text style={ms.emptyText}>{t('admin.staff.no_active_cases')}</Text>
            ) : (
              activeCases.map((c) => (
                <View key={c.id} style={ms.caseRow}>
                  <View style={ms.caseInfo}>
                    <Text style={ms.caseName}>{caseNumber(c.id)}</Text>
                    <Text style={ms.caseMeta}>{c.clientName ?? '—'} · {t(`case.stage.${c.stage}`)}</Text>
                  </View>
                  {reassignLoading && reassigningCaseId === c.id ? (
                    <Text style={ms.reassigningText}>{t('admin.staff.reassigning')}</Text>
                  ) : (
                    <Button
                      title={t('admin.staff.reassign')}
                      variant="outline"
                      onPress={() => setReassigningCaseId(c.id)}
                    />
                  )}
                </View>
              ))
            )}

            {/* Status toggle */}
            <Button
              title={isActive ? t('admin.deactivate') : t('admin.activate')}
              variant={isActive ? 'outline' : 'primary'}
              onPress={onToggle}
              loading={toggling}
            />
          </ScrollView>
        </Pressable>
      </Pressable>

      {/* Reassign user picker */}
      <SelectUserModal
        visible={reassigningCaseId !== null}
        title={isConsultant ? t('admin.reassign_consultant') : t('admin.reassign_quality')}
        users={substituteList}
        onSelect={onReassignSelect}
        onClose={() => setReassigningCaseId(null)}
      />
    </Modal>
  );
}

const ms = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
    paddingBottom: spacing.xxl,
  },
  closeBtn: { alignSelf: 'flex-end' },
  closeText: { fontSize: 18, color: colors.textMuted },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  avatarInfo: { flex: 1, gap: spacing.xs },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  scroll: { flex: 1 },
  infoBlock: { gap: 2, marginBottom: spacing.sm },
  infoLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  infoValue: { fontSize: 14, color: colors.text },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptyText: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  caseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  caseInfo: { flex: 1 },
  caseName: { fontSize: 13, fontWeight: '700', color: colors.text },
  caseMeta: { fontSize: 12, color: colors.textMuted },
  reassigningText: { fontSize: 12, color: colors.textMuted },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export function AdminStaffScreen() {
  const navigation = useNavigation<any>();
  const { t, language } = useLanguage();

  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [cases, setCases] = useState<ConsultationCase[]>([]);
  const [consultants, setConsultants] = useState<UserProfile[]>([]);
  const [qualityUsers, setQualityUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, consultantList, qualityList] = await Promise.all([
        userService.getAllUsers(),
        userService.getAllUsersByRole('consultant'),
        userService.getAllUsersByRole('quality'),
      ]);
      setStaff(all.filter((u) => u.role !== 'client'));
      setConsultants(consultantList);
      setQualityUsers(qualityList);
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Subscribe to cases for active-case checks
  useEffect(() => {
    const unsub = consultationService.subscribeToConsultations('admin', 'admin', (data) => {
      setCases(data);
    });
    return unsub;
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return staff.filter((u) => {
      const matchSearch = !s ||
        u.displayName?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s);
      const matchRole = filterRole === 'all' || u.role === filterRole;
      return matchSearch && matchRole;
    });
  }, [staff, search, filterRole]);

  // ── Toggle status ─────────────────────────────────────────────────────────

  const onToggleStatus = async () => {
    if (!selected) return;
    const isActive = selected.status !== 'deactivated';

    if (isActive) {
      // Check for active cases before deactivating
      const activeCases = cases.filter(
        (c) =>
          ACTIVE_STATUSES.has(c.status) &&
          (c.consultantId === selected.uid || c.qualitySpecialistId === selected.uid),
      );
      if (activeCases.length > 0) {
        Alert.alert('', t('admin.cannot_deactivate'));
        return;
      }
    }

    const newStatus = isActive ? 'deactivated' : 'active';
    setToggling(true);
    try {
      await userService.updateUserProfile(selected.uid, { status: newStatus });
      if (selected.role === 'consultant') {
        await consultantService.updateConsultantProfile(selected.uid, { status: newStatus });
      }
      const updated = { ...selected, status: newStatus as 'active' | 'deactivated' };
      setStaff((prev) => prev.map((u) => (u.uid === selected.uid ? updated : u)));
      setSelected(updated);
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('common.error'));
    } finally {
      setToggling(false);
    }
  };

  // ── Export CSV ────────────────────────────────────────────────────────────

  const onExport = async () => {
    if (filtered.length === 0) {
      Alert.alert('', t('admin.export_empty'));
      return;
    }
    const header = 'Name,Email,Role,Joined,Status';
    const rows = filtered.map((u) =>
      [
        `"${u.displayName ?? ''}"`,
        `"${u.email ?? ''}"`,
        `"${u.role}"`,
        `"${formatDate(u.createdAt, language)}"`,
        `"${u.status ?? 'active'}"`,
      ].join(','),
    );
    const csv = [header, ...rows].join('\n');
    try {
      await Share.share({ title: 'staff.csv', message: csv });
    } catch {
      // user cancelled — ignore
    }
  };

  const ROLE_FILTERS: { key: FilterRole; label: string }[] = [
    { key: 'all', label: t('admin.staff.filter_all') },
    { key: 'consultant', label: 'Consultant' },
    { key: 'quality', label: 'Quality' },
    { key: 'admin', label: 'Admin' },
  ];

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer padded={false}>
      <Header
        title={t('admin.staff.title')}
        right={
          <View style={styles.headerBtns}>
            <Button title={t('admin.export')} variant="outline" onPress={onExport} />
            <Button title={t('admin.staff.add')} onPress={() => navigation.navigate('AddStaff')} />
          </View>
        }
      />

      <FlatList
        data={filtered}
        keyExtractor={(u) => u.uid}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t('common.search')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {ROLE_FILTERS.map((f) => {
                const isActive = filterRole === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.pill, isActive && styles.pillActive]}
                    onPress={() => setFilterRole(f.key)}
                  >
                    <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={<EmptyState title={t('common.empty')} />}
        renderItem={({ item }) => {
          const isActive = item.status !== 'deactivated';
          return (
            <Card style={styles.itemCard} onPress={() => setSelected(item)}>
              <View style={styles.row}>
                <Avatar name={item.displayName} size={40} />
                <View style={styles.body}>
                  <Text style={styles.name}>{item.displayName}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                </View>
                <View style={styles.rightCol}>
                  <Badge
                    label={item.role}
                    variant={item.role === 'consultant' ? 'info' : item.role === 'quality' ? 'success' : 'error'}
                  />
                  <Badge
                    label={isActive ? t('common.active') : t('admin.clients.deactivated')}
                    variant={isActive ? 'success' : 'neutral'}
                  />
                </View>
              </View>
            </Card>
          );
        }}
      />

      {selected ? (
        <StaffDetailsModal
          staff={selected}
          cases={cases}
          allConsultants={consultants}
          allQuality={qualityUsers}
          toggling={toggling}
          onToggle={onToggleStatus}
          onClose={() => setSelected(null)}
          t={t}
          language={language}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerBtns: { flexDirection: 'row', gap: spacing.xs },
  list: { padding: spacing.md, gap: spacing.sm },
  headerBlock: { gap: spacing.sm, marginBottom: spacing.md },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  filterRow: { gap: spacing.xs, paddingVertical: 2 },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  pillTextActive: { color: colors.primaryText },
  itemCard: { marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  email: { fontSize: 13, color: colors.textMuted },
  rightCol: { gap: spacing.xs, alignItems: 'flex-end' },
});
