import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { notificationService } from '@/src/services/notificationService';
import { AppNotification } from '@/src/types';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Card } from '@/src/components/Card';
import { Badge } from '@/src/components/Badge';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { formatDate } from '@/src/lib/utils';

export function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = notificationService.subscribeToNotifications(user.uid, (n) => {
      setItems(n);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const renderTitle = (n: AppNotification) => {
    if (n.titleKey) {
      const resolved = t(n.titleKey, n.messageParams);
      if (resolved !== n.titleKey) return resolved;
    }
    return n.title;
  };

  const renderMessage = (n: AppNotification) => {
    if (n.messageKey) {
      const resolved = t(n.messageKey, n.messageParams);
      if (resolved !== n.messageKey) return resolved;
    }
    return n.message;
  };

  const onPress = async (n: AppNotification) => {
    if (!n.read) {
      try {
        await notificationService.markAsRead(n.id);
      } catch {
        // ignore
      }
    }
    if (n.caseId) {
      navigation.navigate('CaseDetail', { caseId: n.caseId });
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer padded={false}>
      <Header title={t('notifications.title')} onBack={() => navigation.goBack()} />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title={t('notifications.empty')} />}
        renderItem={({ item }) => (
          <Card onPress={() => onPress(item)} style={styles.item}>
            <View style={styles.row}>
              <Text style={styles.title} numberOfLines={1}>
                {renderTitle(item)}
              </Text>
              {!item.read ? <Badge label="•" variant="info" /> : null}
            </View>
            <Text style={styles.message} numberOfLines={3}>{renderMessage(item)}</Text>
            <Text style={styles.meta}>{formatDate(item.createdAt, language)}</Text>
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.sm },
  item: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
  message: { fontSize: 13, color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
