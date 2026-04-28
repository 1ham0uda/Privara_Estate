import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';
import { useLanguage } from '@/src/context/LanguageContext';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const next = language === 'en' ? 'ar' : 'en';

  return (
    <Pressable
      onPress={() => setLanguage(next)}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      hitSlop={8}
    >
      <Text style={styles.text}>{language === 'en' ? 'العربية' : 'English'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
