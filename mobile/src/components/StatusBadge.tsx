import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { statusColors, colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';
import { useLanguage } from '@/src/context/LanguageContext';

interface StatusBadgeProps {
  status: string;
  translationPrefix?: string;
  style?: ViewStyle;
}

export function StatusBadge({ status, translationPrefix = 'status', style }: StatusBadgeProps) {
  const { t } = useLanguage();
  const palette = statusColors[status] ?? { bg: colors.neutralBg, fg: colors.neutral };
  const key = `${translationPrefix}.${status}`;
  const label = t(key);

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      <Text style={[styles.text, { color: palette.fg }]}>
        {label === key ? status.replace(/_/g, ' ') : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
