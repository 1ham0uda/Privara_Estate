import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@/src/navigation/types';
import { useAuth } from '@/src/context/AuthContext';
import { useAuthForm } from '@/src/hooks/useAuthForm';
import { useLanguage } from '@/src/context/LanguageContext';
import { Button } from '@/src/components/Button';
import { TextField } from '@/src/components/TextField';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { LanguageToggle } from '@/src/components/LanguageToggle';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const form = useAuthForm();

  const onSubmit = async () => {
    if (!form.isValid) {
      form.setError(t('auth.login.error.invalid_email'));
      return;
    }
    form.setError(null);
    form.setSubmitting(true);
    try {
      await signIn(form.email.trim(), form.password);
    } catch (err: any) {
      const code = err?.code ?? '';
      const key =
        code === 'auth/invalid-email'
          ? 'auth.login.error.invalid_email'
          : code === 'auth/too-many-requests'
            ? 'auth.login.error.too_many_requests'
            : code === 'auth/user-not-found' ||
              code === 'auth/wrong-password' ||
              code === 'auth/invalid-credential'
              ? 'auth.login.error.invalid_credentials'
              : 'auth.login.error.generic';
      form.setError(t(key));
    } finally {
      form.setSubmitting(false);
    }
  };

  return (
    <ScreenContainer avoidKeyboard padded={false}>
      <View style={styles.topBar}>
        <LanguageToggle />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.signin_title')}</Text>
        <Text style={styles.subtitle}>{t('auth.login_subtitle')}</Text>

        <View style={styles.form}>
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
            title={t('auth.signin_button')}
            onPress={onSubmit}
            loading={form.submitting}
          />
          <Button
            title={t('auth.forgotPassword.link')}
            variant="outline"
            onPress={() => navigation.navigate('ForgotPassword')}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.new_to')}</Text>
          <Text style={styles.footerLink} onPress={() => navigation.navigate('Signup')}>
            {t('auth.create_account')}
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.md },
  content: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
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
