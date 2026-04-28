import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Button } from '@/src/components/Button';
import { LanguageToggle } from '@/src/components/LanguageToggle';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

const COOLDOWN_SECONDS = 60;

export function VerifyEmailScreen() {
  const { user, refreshEmailVerification, sendVerificationEmail, signOut } = useAuth();
  const { t } = useLanguage();
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const onCheck = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      const verified = await refreshEmailVerification();
      if (!verified) {
        setFeedback({ type: 'error', text: t('auth.verify_email.not_verified_yet') });
      }
    } catch {
      setFeedback({ type: 'error', text: t('common.error') });
    } finally {
      setChecking(false);
    }
  };

  const onResend = async () => {
    if (cooldown > 0) return;
    setFeedback(null);
    try {
      await sendVerificationEmail();
      setCooldown(COOLDOWN_SECONDS);
      setFeedback({ type: 'success', text: t('auth.verify_email.resend_success') });
    } catch {
      setFeedback({ type: 'error', text: t('auth.verify_email.resend_error') });
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <LanguageToggle />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.verify_email.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.verify_email.subtitle')}</Text>
        {user?.email ? (
          <Text style={styles.email}>
            {t('auth.verify_email.sent_to')} {user.email}
          </Text>
        ) : null}

        {feedback ? (
          <Text style={[styles.message, feedback.type === 'error' ? styles.error : styles.success]}>
            {feedback.text}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            title={checking ? t('auth.verify_email.checking') : t('auth.verify_email.ive_verified')}
            onPress={onCheck}
            loading={checking}
          />
          <Button
            title={
              cooldown > 0
                ? t('auth.verify_email.cooldown', { seconds: cooldown })
                : t('auth.verify_email.resend')
            }
            variant="outline"
            onPress={onResend}
            disabled={cooldown > 0}
          />
          <Button
            title={t('auth.verify_email.use_different')}
            variant="outline"
            onPress={() => signOut()}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.md },
  content: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted },
  email: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  message: { fontSize: 13, marginTop: spacing.sm },
  error: { color: colors.danger },
  success: { color: colors.success },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
});
