/**
 * AdminClientsScreen
 * Full parity with web /admin/clients:
 *   - 3 stat cards
 *   - Search + filter (all / with consultations / without)
 *   - Client list with status badge
 *   - Tap → Client details modal (full info + Activate/Deactivate)
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
import { useLanguage } from '@/src/context/LanguageContext';
import { userService } from '@/src/services/userService';
import { UserProfile } from '@/src/types';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Card } from '@/src/components/Card';
import { StatCard } from '@/src/components/StatCard';
import { Avatar } from '@/src/components/Avatar';
import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';
import { formatDate } from '@/src/lib/utils';

type FilterKey = 'all' | 'with' | 'without';

// ── Detail modal ──────────────────────────────────────────────────────────────

interface ClientModalProps {
  client: UserProfile;
  onToggle: () => void;
  toggling: boolean;
  onClose: () => void;
  t: (key: string) => string;
  language: string;
}

function ClientModal({ client, onToggle, toggling, onClose, t, language }: ClientModalProps) {
  const isActive = client.status !== 'deactivated';
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <Pressable style={modalStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <Pressable style={modalStyles.closeBtn} onPress={onClose} hitSlop={12}>
            <Text style={modalStyles.closeText}>✕</Text>
          </Pressable>

          <View style={modalStyles.avatarRow}>
            <Avatar name={client.displayName} size={56} />
            <View style={modalStyles.avatarInfo}>
              <Text style={modalStyles.name}>{client.displayName}</Text>
              <View style={modalStyles.badgeRow}>
                <Badge label={t('nav.clients').slice(0, -1)} variant="info" />
                <Badge
                  label={isActive ? t('common.active') : t('admin.clients.deactivated')}
                  variant={isActive ? 'success' : 'error'}
                />
              </View>
            </View>
          </View>

          <View style={modalStyles.infoBlock}>
            <Text style={modalStyles.infoLabel}>{t('auth.email')}</Text>
            <Text style={modalStyles.infoValue}>{client.email}</Text>
          </View>
          {client.phoneNumber ? (
            <View style={modalStyles.infoBlock}>
              <Text style={modalStyles.infoLabel}>{t('profile.phone')}</Text>
              <Text style={modalStyles.infoValue}>{client.phoneNumber}</Text>
            </View>
          ) : null}
          {client.createdAt ? (
            <View style={modalStyles.infoBlock}>
              <Text style={modalStyles.infoLabel}>{t('nav.clients')}</Text>
              <Text style={modalStyles.infoValue}>{formatDate(client.createdAt, language)}</Text>
            </View>
          ) : null}

          <View style={modalStyles.statsRow}>
            <View style={modalStyles.statBox}>
              <Text style={modalStyles.statValue}>{client.totalConsultations ?? 0}</Text>
              <Text style={modalStyles.statLabel}>{t('dashboard.total_cases')}</Text>
            </View>
            <View style={modalStyles.statBox}>
              <Text style={[modalStyles.statValue, { color: colors.info }]}>
                {client.activeConsultations ?? 0}
              </Text>
              <Text style={modalStyles.statLabel}>{t('admin.clients.active_count')}</Text>
            </View>
            <View style={modalStyles.statBox}>
              <Text style={[modalStyles.statValue, { color: colors.success }]}>
                {client.completedConsultations ?? 0}
              </Text>
              <Text style={modalStyles.statLabel}>{t('admin.clients.completed_count')}</Text>
            </View>
          </View>

          <Button
            title={isActive ? t('admin.deactivate') : t('admin.activate')}
            variant={isActive ? 'outline' : 'primary'}
            onPress={onToggle}
            loading={toggling}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
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
  closeBtn: { alignSelf: 'flex-end' },
  closeText: { fontSize: 18, color: colors.textMuted },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarInfo: { flex: 1, gap: spacing.xs },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  infoBlock: { gap: 2 },
  infoLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  infoValue: { fontSize: 14, color: colors.text },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
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
});

// ── Main screen ───────────────────────────────────────────────────────────────

export function AdminClientsScreen() {
  const { t, language } = useLanguage();
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await userService.getAllUsers();
      setClients(all.filter((u) => u.role === 'client'));
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const withC = clients.filter((c) => (c.totalConsultations ?? 0) > 0).length;
    return { total: clients.length, with: withC, without: clients.length - withC };
  }, [clients]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return clients.filter((c) => {
      const matchSearch = !s ||
        c.displayName?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s);
      const matchFilter =
        filter === 'all' ||
        (filter === 'with' && (c.totalConsultations ?? 0) > 0) ||
        (filter === 'without' && (c.totalConsultations ?? 0) === 0);
      return matchSearch && matchFilter;
    });
  }, [clients, search, filter]);

  // ── Toggle status ─────────────────────────────────────────────────────────

  const onToggleStatus = async () => {
    if (!selected) return;
    const newStatus = selected.status === 'deactivated' ? 'active' : 'deactivated';
    setToggling(true);
    try {
      await userService.updateUserProfile(selected.uid, { status: newStatus });
      const updated = { ...selected, status: newStatus as 'active' | 'deactivated' };
      setClients((prev) => prev.map((c) => (c.uid === selected.uid ? updated : c)));
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
    const header = 'Name,Email,Joined,Total Consultations,Status';
    const rows = filtered.map((c) =>
      [
        `"${c.displayName ?? ''}"`,
        `"${c.email ?? ''}"`,
        `"${formatDate(c.createdAt, language)}"`,
        String(c.totalConsultations ?? 0),
        `"${c.status ?? 'active'}"`,
      ].join(','),
    );
    const csv = [header, ...rows].join('\n');
    try {
      await Share.share({ title: 'clients.csv', message: csv });
    } catch {
      // user cancelled share sheet — ignore
    }
  };

  // ── Filter pills ──────────────────────────────────────────────────────────

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('admin.clients.filter_all') },
    { key: 'with', label: t('admin.clients.filter_with') },
    { key: 'without', label: t('admin.clients.filter_without') },
  ];

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer padded={false}>
      <Header
        title={t('admin.clients.title')}
        right={
          <Button title={t('admin.export')} variant="outline" onPress={onExport} />
        }
      />

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.uid}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {/* Stat cards */}
            <View style={styles.statsRow}>
              <StatCard label={t('admin.clients.total')} value={stats.total} />
              <StatCard label={t('admin.clients.with_consultations')} value={stats.with} tone="success" />
              <StatCard label={t('admin.clients.without_consultations')} value={stats.without} tone="warning" />
            </View>

            {/* Search */}
            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={t('common.search')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>

            {/* Filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {FILTERS.map((f) => {
                const isActive = filter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.pill, isActive && styles.pillActive]}
                    onPress={() => setFilter(f.key)}
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
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>
                      {item.totalConsultations ?? 0} {t('dashboard.total_cases')}
                    </Text>
                    <Badge
                      label={isActive ? t('common.active') : t('admin.clients.deactivated')}
                      variant={isActive ? 'success' : 'error'}
                    />
                  </View>
                </View>
              </View>
            </Card>
          );
        }}
      />

      {selected ? (
        <ClientModal
          client={selected}
          onToggle={onToggleStatus}
          toggling={toggling}
          onClose={() => setSelected(null)}
          t={t}
          language={language}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.sm },
  headerBlock: { gap: spacing.md, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  searchBox: { marginHorizontal: 0 },
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
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  meta: { fontSize: 12, color: colors.textMuted },
});
