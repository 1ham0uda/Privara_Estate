import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { UserProfile } from '@/src/types';
import { Avatar } from './Avatar';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';

interface Props {
  visible: boolean;
  title: string;
  users: UserProfile[];
  loading?: boolean;
  onSelect: (user: UserProfile) => void;
  onClose: () => void;
}

export function SelectUserModal({ visible, title, users, loading, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');

  // Reset search whenever the sheet opens
  useEffect(() => {
    if (!visible) setSearch('');
  }, [visible]);

  const filtered = users.filter(
    (u) =>
      u.status !== 'deactivated' &&
      u.displayName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner Pressable stops taps on the sheet from bubbling to backdrop */}
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.search}
            placeholder="Search…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />

          {loading ? (
            <ActivityIndicator style={styles.spinner} color={colors.primary} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(u) => u.uid}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.empty}>No users found</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                  onPress={() => onSelect(item)}
                >
                  <Avatar name={item.displayName} size={36} />
                  <View style={styles.itemText}>
                    <Text style={styles.itemName}>{item.displayName}</Text>
                    {item.experienceYears ? (
                      <Text style={styles.itemMeta}>{item.experienceYears} yrs exp</Text>
                    ) : null}
                    {item.specialties && item.specialties.length > 0 ? (
                      <Text style={styles.itemMeta} numberOfLines={1}>
                        {item.specialties.slice(0, 3).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '75%',
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  close: { fontSize: 18, color: colors.textMuted },
  search: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  itemPressed: { backgroundColor: colors.surface },
  itemText: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  spinner: { paddingVertical: spacing.xl },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    paddingVertical: spacing.xl,
    fontSize: 14,
  },
});
