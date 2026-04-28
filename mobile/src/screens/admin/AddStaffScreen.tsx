import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '@/src/context/LanguageContext';
import { adminService } from '@/src/services/adminService';
import { StaffRole } from '@/src/types';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Button } from '@/src/components/Button';
import { TextField } from '@/src/components/TextField';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';

const ROLES: StaffRole[] = ['consultant', 'quality', 'admin'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddStaffScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [role, setRole] = useState<StaffRole>('consultant');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [experience, setExperience] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConsultant = role === 'consultant';

  const onSubmit = async () => {
    if (!displayName.trim()) {
      setError(t('auth.register.error.generic'));
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError(t('auth.register.error.invalid_email'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.register.error.weak_password'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await adminService.createStaff({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role,
        specialties: isConsultant ? specialties : '',
        bio: isConsultant ? bio : '',
        phoneNumber: phone.trim(),
        experienceYears: experience ? Number(experience) : null,
      });
      Alert.alert('', t('common.save'));
      navigation.goBack();
    } catch (err: any) {
      setError(err?.message ?? t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer padded={false} scroll avoidKeyboard>
      <Header title={t('admin.staff.add')} onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <View style={styles.roleRow}>
          {ROLES.map((r) => {
            const selected = r === role;
            return (
              <Pressable
                key={r}
                onPress={() => setRole(r)}
                style={[styles.roleBtn, selected && styles.roleBtnActive]}
              >
                <Text style={[styles.roleText, selected && styles.roleTextActive]}>
                  {r}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label={t('auth.full_name')}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextField
          label={t('profile.phone')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <TextField
          label={'Experience (years)'}
          value={experience}
          onChangeText={setExperience}
          keyboardType="numeric"
        />

        {isConsultant ? (
          <>
            <TextField
              label={'Specialties (comma separated)'}
              value={specialties}
              onChangeText={setSpecialties}
            />
            <View>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                multiline
                numberOfLines={4}
                value={bio}
                onChangeText={setBio}
                style={styles.textarea}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={t('common.save')} onPress={onSubmit} loading={submitting} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  roleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  roleText: { fontSize: 14, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  roleTextActive: { color: colors.primaryText },
  label: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginBottom: spacing.xs },
  textarea: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  error: { color: colors.danger, fontSize: 13 },
});
