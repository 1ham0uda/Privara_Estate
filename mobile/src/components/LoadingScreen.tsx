import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

interface LoadingScreenProps {
  message?: string;
  inline?: boolean;
}

export function LoadingScreen({ message, inline }: LoadingScreenProps) {
  return (
    <View style={[styles.container, inline && styles.inline]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  inline: {
    flex: 0,
    paddingVertical: spacing.xl,
  },
  text: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
