import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { chatService } from '@/src/services/chatService';
import { consultationService } from '@/src/services/consultationService';
import { ConsultationCase, Message } from '@/src/types';
import { Header } from '@/src/components/Header';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';

export function CaseChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { caseId } = route.params as { caseId: string };
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [caseData, setCaseData] = useState<ConsultationCase | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    const unsub1 = chatService.subscribeToMessages(caseId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const unsub2 = consultationService.subscribeToConsultation(caseId, setCaseData);
    return () => {
      unsub1();
      unsub2();
    };
  }, [caseId]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || !user || !profile || !caseData) return;
    setSending(true);
    try {
      await chatService.sendMessage(
        caseId,
        user.uid,
        profile.displayName || user.email || '',
        profile.role,
        text,
        caseData.clientId,
        caseData.consultantId,
      );
      setInput('');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header title={t('case.chat')} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.uid;
            return (
              <View style={[styles.msgRow, mine ? styles.msgRight : styles.msgLeft]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!mine ? <Text style={styles.senderName}>{item.senderName}</Text> : null}
                  <Text style={mine ? styles.textMine : styles.textTheirs}>{item.text}</Text>
                </View>
              </View>
            );
          }}
        />
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('support.message')}
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Pressable
            onPress={onSend}
            disabled={sending || !input.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              (!input.trim() || sending) && styles.sendBtnDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.sendText}>{t('support.send')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  msgRow: { flexDirection: 'row', marginVertical: 2 },
  msgLeft: { justifyContent: 'flex-start' },
  msgRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  textMine: { color: colors.primaryText, fontSize: 14 },
  textTheirs: { color: colors.text, fontSize: 14 },
  senderName: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 2 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    maxHeight: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: colors.primaryText, fontWeight: '600', fontSize: 14 },
  pressed: { opacity: 0.8 },
});
