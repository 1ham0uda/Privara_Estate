import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

export function ProfileScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>{user?.email ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs },
});
