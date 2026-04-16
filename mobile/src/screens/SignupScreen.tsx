import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@/src/navigation/types';
import { useAuth } from '@/src/context/AuthContext';
import { useAuthForm } from '@/src/hooks/useAuthForm';
import { Button } from '@/src/components/Button';
import { TextField } from '@/src/components/TextField';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const form = useAuthForm();

  const onSubmit = async () => {
    if (!form.isValid) {
      form.setError('Enter a valid email and a password with 6+ characters.');
      return;
    }
    form.setError(null);
    form.setSubmitting(true);
    try {
      await signUp(form.email.trim(), form.password);
    } catch (err) {
      form.setError(err instanceof Error ? err.message : 'Could not create your account. Please try again.');
    } finally {
      form.setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start in under a minute.</Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={form.email}
            onChangeText={form.setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <TextField
            label="Password"
            value={form.password}
            onChangeText={form.setPassword}
            secureTextEntry
            placeholder="At least 6 characters"
          />
          {form.error ? <Text style={styles.error}>{form.error}</Text> : null}
          <Button title="Sign up" onPress={onSubmit} loading={form.submitting} />
          <Button
            title="I already have an account"
            variant="outline"
            onPress={() => navigation.navigate('Login')}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs },
  form: { marginTop: spacing.xl, gap: spacing.md },
  error: { color: colors.danger, fontSize: 13 },
});
