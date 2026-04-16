import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

export function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.subtitle}>
        {user ? `Signed in as ${user.email}` : 'Not signed in'}
      </Text>

      <View style={styles.actions}>
        <Button title="Sign out" variant="outline" onPress={() => { void signOut(); }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs },
  actions: { marginTop: spacing.xl, gap: spacing.md },
});
