import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  onPress?: () => void;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  style?: ViewStyle;
}

const tones = {
  default: colors.text,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
} as const;

export function StatCard({ label, value, hint, onPress, tone = 'default', style }: StatCardProps) {
  const content = (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: tones[tone] }]}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed, styles.flex]}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.flex}>{content}</View>;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
});
