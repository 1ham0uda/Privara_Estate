import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { sendEmailVerification } from 'firebase/auth';
import { AuthStackParamList } from '@/src/navigation/types';
import { authService } from '@/src/services/authService';
import { userService } from '@/src/services/userService';
import { useAuthForm } from '@/src/hooks/useAuthForm';
import { useLanguage } from '@/src/context/LanguageContext';
import { Button } from '@/src/components/Button';
import { TextField } from '@/src/components/TextField';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { LanguageToggle } from '@/src/components/LanguageToggle';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const form = useAuthForm();
  const [displayName, setDisplayName] = useState('');

  const onSubmit = async () => {
    if (!displayName.trim()) {
      form.setError(t('auth.register.error.generic'));
      return;
    }
    if (!form.isValid) {
      form.setError(t('auth.register.error.weak_password'));
      return;
    }
    form.setError(null);
    form.setSubmitting(true);
    try {
      const user = await authService.signup({
        email: form.email.trim(),
        password: form.password,
        displayName: displayName.trim(),
      });
      await userService.createUserProfile({
        uid: user.uid,
        email: user.email ?? form.email.trim(),
        displayName: displayName.trim(),
        role: 'client',
        active: true,
      } as any);
      try {
        await sendEmailVerification(user);
      } catch {
        // non-fatal; user can resend on VerifyEmail
      }
    } catch (err: any) {
      const code = err?.code ?? '';
      const key =
        code === 'auth/email-already-in-use'
          ? 'auth.register.error.email_in_use'
          : code === 'auth/invalid-email'
            ? 'auth.register.error.invalid_email'
            : code === 'auth/weak-password'
              ? 'auth.register.error.weak_password'
              : 'auth.register.error.generic';
      form.setError(t(key));
    } finally {
      form.setSubmitting(false);
    }
  };

  return (
    <ScreenContainer avoidKeyboard padded={false} scroll>
      <View style={styles.topBar}>
        <LanguageToggle />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.register_title')}</Text>
        <Text style={styles.subtitle}>{t('auth.register_subtitle')}</Text>

        <View style={styles.form}>
          <TextField
            label={t('auth.full_name')}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('auth.full_name_placeholder')}
          />
          <TextField
            label={t('auth.email')}
            value={form.email}
            onChangeText={form.setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t('auth.email_placeholder')}
          />
          <TextField
            label={t('auth.password')}
            value={form.password}
            onChangeText={form.setPassword}
            secureTextEntry
            placeholder={t('auth.password_placeholder')}
          />
          {form.error ? <Text style={styles.error}>{form.error}</Text> : null}
          <Button
            title={t('auth.register_button')}
            onPress={onSubmit}
            loading={form.submitting}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.already_have')}</Text>
          <Text style={styles.footerLink} onPress={() => navigation.navigate('Login')}>
            {t('auth.signin_instead')}
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.md },
  content: { padding: spacing.lg },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs },
  form: { marginTop: spacing.xl, gap: spacing.md },
  error: { color: colors.danger, fontSize: 13 },
  footer: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
