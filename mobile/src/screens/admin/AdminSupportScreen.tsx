/**
 * AdminSupportScreen
 * Admin-specific support workspace — full parity with web AdminSupportWorkspace:
 *   - Left panel: all tickets list (tap to select)
 *   - Right/main panel: selected ticket thread (initial message + replies)
 *   - Reply to open tickets
 *   - Close open tickets
 * Admin does NOT create new tickets.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { supportService } from '@/src/services/supportService';
import { SupportMessage } from '@/src/types';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';
import { formatDate, truncate } from '@/src/lib/utils';

// ── Ticket list item ──────────────────────────────────────────────────────────

function TicketItem({
  ticket, selected, onPress, language,
}: {
  ticket: SupportMessage;
  selected: boolean;
  onPress: () => void;
  language: string;
}) {
  const isOpen = ticket.status === 'open';
  return (
    <Pressable
      onPress={onPress}
      style={[ticketStyles.item, selected && ticketStyles.itemSelected]}
    >
      <View style={ticketStyles.row}>
        <Text style={ticketStyles.userName} numberOfLines={1}>{ticket.userName}</Text>
        <Badge label={ticket.status} variant={isOpen ? 'warning' : 'neutral'} />
      </View>
      <Text style={ticketStyles.email} numberOfLines={1}>{ticket.userEmail}</Text>
      <Text style={ticketStyles.preview} numberOfLines={2}>{truncate(ticket.text, 100)}</Text>
      <Text style={ticketStyles.date}>
        {formatDate(ticket.updatedAt ?? ticket.createdAt, language)}
      </Text>
    </Pressable>
  );
}

const ticketStyles = StyleSheet.create({
  item: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  itemSelected: { backgroundColor: colors.infoBg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userName: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.xs },
  email: { fontSize: 12, color: colors.textMuted },
  preview: { fontSize: 12, color: colors.text },
  date: { fontSize: 11, color: colors.textMuted },
});

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ senderName, role, text, date, isAdmin }: {
  senderName: string;
  role: string;
  text: string;
  date: string;
  isAdmin: boolean;
}) {
  return (
    <View style={[bubbleStyles.wrapper, isAdmin ? bubbleStyles.right : bubbleStyles.left]}>
      <View style={[bubbleStyles.bubble, isAdmin ? bubbleStyles.adminBubble : bubbleStyles.userBubble]}>
        <Text style={[bubbleStyles.sender, isAdmin && bubbleStyles.senderAdmin]}>
          {senderName} · {role}
        </Text>
        <Text style={[bubbleStyles.text, isAdmin && bubbleStyles.textAdmin]}>{text}</Text>
        <Text style={[bubbleStyles.date, isAdmin && bubbleStyles.dateAdmin]}>{date}</Text>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrapper: { marginBottom: spacing.sm },
  left: { alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
  bubble: { maxWidth: '85%', padding: spacing.md, borderRadius: radius.md, gap: 4 },
  userBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  adminBubble: { backgroundColor: colors.primary },
  sender: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  senderAdmin: { color: 'rgba(255,255,255,0.7)' },
  text: { fontSize: 14, color: colors.text },
  textAdmin: { color: colors.primaryText },
  date: { fontSize: 11, color: colors.textMuted },
  dateAdmin: { color: 'rgba(255,255,255,0.5)' },
});

// ── Main component ────────────────────────────────────────────────────────────

export function AdminSupportScreen() {
  const { profile } = useAuth();
  const { t, language } = useLanguage();

  const [tickets, setTickets] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // Subscribe to all support messages
  useEffect(() => {
    const unsub = supportService.subscribeToSupportMessages(undefined, (msgs) => {
      setTickets(msgs);
      setLoading(false);
      // Auto-select first ticket if nothing selected
      setSelectedId((prev) => {
        if (prev) {
          // Keep selection if ticket still exists
          const still = msgs.find((m) => m.id === prev);
          return still ? prev : (msgs[0]?.id ?? null);
        }
        return msgs[0]?.id ?? null;
      });
    });
    return unsub;
  }, []);

  const selectedTicket = tickets.find((t) => t.id === selectedId) ?? null;

  // ── Reply ─────────────────────────────────────────────────────────────────

  const onSendReply = async () => {
    if (!profile || !selectedTicket || !replyText.trim()) return;
    setSending(true);
    try {
      await supportService.replyToSupportMessage(
        selectedTicket.id,
        profile.uid,
        profile.displayName ?? '',
        'admin',
        replyText.trim(),
      );
      setReplyText('');
      // Scroll to bottom after reply
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('common.error'));
    } finally {
      setSending(false);
    }
  };

  // ── Close ─────────────────────────────────────────────────────────────────

  const onCloseTicket = () => {
    if (!selectedTicket || !profile) return;
    Alert.alert('', t('admin.support.close_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.support.close_ticket'),
        style: 'destructive',
        onPress: async () => {
          setClosing(true);
          try {
            await supportService.closeSupportMessage(
              selectedTicket.id,
              profile.uid,
              profile.displayName ?? '',
            );
          } catch (err: any) {
            Alert.alert('', err?.message ?? t('common.error'));
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <LoadingScreen />;

  const isOpen = selectedTicket?.status === 'open';
  const canSend = replyText.trim().length > 0 && !sending;

  return (
    <ScreenContainer padded={false}>
      <Header title={t('nav.support')} />

      <View style={styles.container}>
        {/* ── Ticket list (left / top panel) ── */}
        <View style={styles.ticketPanel}>
          {tickets.length === 0 ? (
            <EmptyState title={t('support.no_tickets')} />
          ) : (
            <FlatList
              data={tickets}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <TicketItem
                  ticket={item}
                  selected={item.id === selectedId}
                  onPress={() => setSelectedId(item.id)}
                  language={language}
                />
              )}
            />
          )}
        </View>

        {/* ── Ticket detail (right / bottom panel) ── */}
        <KeyboardAvoidingView
          style={styles.detailPanel}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}
        >
          {!selectedTicket ? (
            <View style={styles.emptyDetail}>
              <Text style={styles.emptyDetailText}>{t('admin.support.select_ticket')}</Text>
            </View>
          ) : (
            <>
              {/* Detail header */}
              <View style={styles.detailHeader}>
                <View style={styles.detailHeaderLeft}>
                  <Text style={styles.detailName}>{selectedTicket.userName}</Text>
                  <Text style={styles.detailMeta}>
                    {selectedTicket.userEmail} · {selectedTicket.userRole}
                  </Text>
                </View>
                {isOpen ? (
                  <Button
                    title={t('admin.support.close_ticket')}
                    variant="outline"
                    onPress={onCloseTicket}
                    loading={closing}
                  />
                ) : (
                  <Badge label={t('support.status.closed')} variant="neutral" />
                )}
              </View>

              {/* Thread */}
              <ScrollView
                ref={scrollRef}
                style={styles.thread}
                contentContainerStyle={styles.threadContent}
              >
                {/* Original message */}
                <MessageBubble
                  senderName={selectedTicket.userName}
                  role={selectedTicket.userRole}
                  text={selectedTicket.text}
                  date={formatDate(selectedTicket.createdAt, language)}
                  isAdmin={false}
                />

                {/* Replies */}
                {(selectedTicket.replies ?? []).map((reply, idx) => {
                  const isAdminReply = reply.senderRole === 'admin';
                  return (
                    <MessageBubble
                      key={idx}
                      senderName={reply.senderName}
                      role={reply.senderRole}
                      text={reply.text}
                      date={formatDate(reply.createdAt, language)}
                      isAdmin={isAdminReply}
                    />
                  );
                })}
              </ScrollView>

              {/* Reply box or closed notice */}
              {isOpen ? (
                <View style={styles.replyBox}>
                  <TextInput
                    style={styles.replyInput}
                    value={replyText}
                    onChangeText={setReplyText}
                    placeholder={t('admin.support.type_reply')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <Button
                    title={t('admin.support.send')}
                    onPress={onSendReply}
                    loading={sending}
                    disabled={!canSend}
                  />
                </View>
              ) : (
                <View style={styles.closedNotice}>
                  <Text style={styles.closedText}>{t('admin.support.ticket_closed')}</Text>
                </View>
              )}
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  // Ticket list occupies ~35% of screen
  ticketPanel: {
    flex: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // Detail panel occupies ~65%
  detailPanel: {
    flex: 6,
  },
  emptyDetail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyDetailText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  detailHeaderLeft: { flex: 1, gap: 2 },
  detailName: { fontSize: 15, fontWeight: '700', color: colors.text },
  detailMeta: { fontSize: 12, color: colors.textMuted },
  thread: { flex: 1 },
  threadContent: { padding: spacing.md },
  replyBox: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  replyInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  closedNotice: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  closedText: { fontSize: 13, color: colors.textMuted },
});
