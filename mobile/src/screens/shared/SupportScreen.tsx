import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { supportService } from '@/src/services/supportService';
import { SupportMessage } from '@/src/types';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Card } from '@/src/components/Card';
import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';
import { formatDate, truncate } from '@/src/lib/utils';

export function SupportScreen() {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    const uid = profile.role === 'admin' ? undefined : user.uid;
    const unsub = supportService.subscribeToSupportMessages(uid, (msgs) => {
      setMessages(msgs);
      setLoading(false);
    });
    return unsub;
  }, [user, profile]);

  const onSend = async () => {
    if (!user || !profile || !text.trim()) return;
    setSending(true);
    try {
      await supportService.sendSupportMessage(
        user.uid,
        profile.displayName ?? user.email ?? '',
        user.email ?? '',
        profile.role,
        text.trim(),
      );
      setText('');
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('common.error'));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer padded={false}>
      <Header title={t('support.title')} />
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Card style={styles.newCard}>
            <Text style={styles.sectionTitle}>{t('support.new_ticket')}</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('support.message')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              style={styles.input}
            />
            <Button title={t('support.send')} onPress={onSend} loading={sending} />
          </Card>
        }
        ListEmptyComponent={<EmptyState title={t('support.no_tickets')} />}
        renderItem={({ item }) => (
          <Card style={styles.ticket}>
            <View style={styles.row}>
              <Text style={styles.ticketUser}>{item.userName}</Text>
              <Badge
                label={t(`support.status.${item.status}`)}
                variant={item.status === 'open' ? 'warning' : 'neutral'}
              />
            </View>
            <Text style={styles.ticketText}>{truncate(item.text, 140)}</Text>
            <Text style={styles.ticketMeta}>{formatDate(item.createdAt, language)}</Text>
            {item.replies && item.replies.length > 0 ? (
              <Text style={styles.repliesCount}>
                {item.replies.length} {item.replies.length === 1 ? 'reply' : 'replies'}
              </Text>
            ) : null}
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.sm },
  newCard: { marginBottom: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  ticket: { marginBottom: spacing.sm, gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketUser: { fontSize: 14, fontWeight: '700', color: colors.text },
  ticketText: { fontSize: 13, color: colors.text },
  ticketMeta: { fontSize: 12, color: colors.textMuted },
  repliesCount: { fontSize: 12, color: colors.info, fontWeight: '600' },
});
