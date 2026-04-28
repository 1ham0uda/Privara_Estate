import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@/src/navigation/types';
import { authService } from '@/src/services/authService';
import { useLanguage } from '@/src/context/LanguageContext';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Button } from '@/src/components/Button';
import { TextField } from '@/src/components/TextField';
import { Header } from '@/src/components/Header';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const onSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      setMessage({ type: 'error', text: t('auth.forgotPassword.error.invalid_email') });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await authService.resetPassword(email);
      setMessage({ type: 'success', text: t('auth.forgotPassword.success') });
    } catch (err: any) {
      const code = err?.code ?? '';
      const key =
        code === 'auth/invalid-email'
          ? 'auth.forgotPassword.error.invalid_email'
          : code === 'auth/too-many-requests'
            ? 'auth.forgotPassword.error.too_many_requests'
            : 'auth.forgotPassword.error.generic';
      setMessage({ type: 'error', text: t(key) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer avoidKeyboard padded={false}>
      <Header title={t('auth.forgotPassword.title')} onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <Text style={styles.subtitle}>{t('auth.forgotPassword.subtitle')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t('auth.forgotPassword.email_placeholder')}
          />
          {message ? (
            <Text style={[styles.message, message.type === 'error' ? styles.error : styles.success]}>
              {message.text}
            </Text>
          ) : null}
          <Button
            title={t('auth.forgotPassword.submit')}
            onPress={onSubmit}
            loading={submitting}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  subtitle: { fontSize: 15, color: colors.textMuted },
  form: { marginTop: spacing.md, gap: spacing.md },
  message: { fontSize: 13 },
  error: { color: colors.danger },
  success: { color: colors.success },
});
