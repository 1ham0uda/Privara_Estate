import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { userService } from '@/src/services/userService';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Button } from '@/src/components/Button';
import { TextField } from '@/src/components/TextField';
import { Avatar } from '@/src/components/Avatar';
import { Card } from '@/src/components/Card';
import { LanguageToggle } from '@/src/components/LanguageToggle';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

export function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { t } = useLanguage();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [phone, setPhone] = useState(profile?.phoneNumber ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await userService.updateUserProfile(user.uid, {
        displayName: displayName.trim(),
        phoneNumber: phone.trim(),
        location: location.trim(),
      });
      await refreshProfile();
      Alert.alert('', t('profile.saved'));
    } catch {
      Alert.alert('', t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const onSignOut = async () => {
    try {
      await signOut();
    } catch {
      Alert.alert('', t('common.error'));
    }
  };

  return (
    <ScreenContainer padded={false} scroll>
      <Header title={t('profile.title')} right={<LanguageToggle />} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Avatar name={profile?.displayName ?? user?.email ?? undefined} size={72} />
          <Text style={styles.name}>{profile?.displayName ?? user?.email}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.role}>{profile?.role ?? ''}</Text>
        </View>

        <Card>
          <View style={styles.form}>
            <TextField
              label={t('profile.display_name')}
              value={displayName}
              onChangeText={setDisplayName}
            />
            <TextField
              label={t('profile.phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TextField
              label={t('profile.location')}
              value={location}
              onChangeText={setLocation}
            />
            <Button
              title={t('profile.save_changes')}
              onPress={onSave}
              loading={saving}
            />
          </View>
        </Card>

        <Button
          title={t('nav.logout')}
          variant="outline"
          onPress={onSignOut}
          style={styles.signOut}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  name: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  email: { fontSize: 14, color: colors.textMuted },
  role: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  form: { gap: spacing.md },
  signOut: { marginTop: spacing.lg },
});
