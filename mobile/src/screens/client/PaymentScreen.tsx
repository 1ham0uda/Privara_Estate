import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ClientStackParamList } from '@/src/navigation/types';
import { useLanguage } from '@/src/context/LanguageContext';
import { settingsService } from '@/src/services/settingsService';
import { consultationService } from '@/src/services/consultationService';
import { paymentService } from '@/src/services/paymentService';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

const PAYMENT_RETURN_SCHEME = 'privara://payment-return';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

type Props = NativeStackScreenProps<ClientStackParamList, 'Payment'>;

export function PaymentScreen({ route, navigation }: Props) {
  const { intake } = route.params;
  const { t, language } = useLanguage();
  const [fee, setFee] = useState(500);
  const [processing, setProcessing] = useState(false);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  useEffect(() => {
    settingsService
      .getSettings()
      .then((s) => setFee(s.consultationFee ?? 500))
      .catch(() => {});
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const beginPolling = (caseId: string) => {
    stopPolling();
    pollStartRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      // Enforce 5-minute hard timeout
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        stopPolling();
        setProcessing(false);
        setPollingTimedOut(true);
        return;
      }
      try {
        const c = await consultationService.getConsultation(caseId);
        if (c?.paymentStatus === 'paid') {
          stopPolling();
          setProcessing(false);
          navigation.replace('CaseDetail', { caseId });
        }
      } catch {
        // ignore transient network errors, keep polling
      }
    }, POLL_INTERVAL_MS);
  };

  const onPay = async () => {
    setProcessing(true);
    setPollingTimedOut(false);
    try {
      const res = await paymentService.initiate({
        intake: pendingCaseId ? undefined : intake,
        caseId: pendingCaseId ?? undefined,
        language,
      });
      setPendingCaseId(res.caseId);
      const url = paymentService.buildCheckoutUrl(res.sessionId, language as 'en' | 'ar');

      // Second arg is the redirect URL — browser closes automatically when
      // Geidea redirects to privara://payment-return after payment.
      const result = await WebBrowser.openAuthSessionAsync(url, PAYMENT_RETURN_SCHEME);

      if (result.type === 'cancel' || result.type === 'dismiss') {
        // User dismissed the browser without completing payment
        setProcessing(false);
        return;
      }

      if (result.type === 'success') {
        // Parse query params from the return URL
        const returnUrl = result.url ?? '';
        const query = returnUrl.includes('?') ? returnUrl.split('?')[1] : '';
        const params = new URLSearchParams(query);
        const status = params.get('status');
        const urlCaseId = params.get('caseId') ?? res.caseId;

        if (status === 'paid') {
          stopPolling();
          setProcessing(false);
          navigation.replace('CaseDetail', { caseId: urlCaseId });
          return;
        }
        if (status === 'failed' || status === 'cancelled') {
          setProcessing(false);
          Alert.alert('', t('payment.failed'));
          return;
        }
      }

      // Geidea didn't pass a definitive status — fall back to polling
      beginPolling(res.caseId);
    } catch (err: any) {
      Alert.alert('', err?.message ?? t('payment.failed'));
      setProcessing(false);
    }
  };

  const onCheckAgain = async () => {
    if (!pendingCaseId) return;
    setPollingTimedOut(false);
    setProcessing(true);
    try {
      const c = await consultationService.getConsultation(pendingCaseId);
      if (c?.paymentStatus === 'paid') {
        stopPolling();
        setProcessing(false);
        navigation.replace('CaseDetail', { caseId: pendingCaseId });
      } else {
        // Restart polling with a fresh timeout
        beginPolling(pendingCaseId);
      }
    } catch {
      setProcessing(false);
      setPollingTimedOut(true);
    }
  };

  const onCancelPayment = () => {
    stopPolling();
    setProcessing(false);
    setPollingTimedOut(false);
    navigation.goBack();
  };

  return (
    <ScreenContainer padded={false} scroll>
      <Header title={t('payment.title')} onBack={processing ? undefined : () => navigation.goBack()} />
      <View style={styles.content}>
        <Card>
          <Text style={styles.label}>{t('payment.fee')}</Text>
          <Text style={styles.amount}>{fee.toLocaleString()} EGP</Text>
          <Text style={styles.secure}>{t('payment.secure')}</Text>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>{t('case.intake_info')}</Text>
          <Row label={t('intake.goal_label')} value={t(`intake.goal.${intake.goal}`)} />
          <Row label={t('intake.property_type')} value={intake.propertyType} />
          <Row label={t('intake.preferred_area')} value={intake.preferredArea} />
          <Row label={t('intake.budget_range')} value={intake.budgetRange} />
          <Row label={t('intake.delivery_time')} value={intake.preferredDeliveryTime} />
          {intake.selectedConsultantName ? (
            <Row label={t('case.consultant')} value={intake.selectedConsultantName} />
          ) : null}
        </Card>

        {/* Polling timed out — offer manual check or cancel */}
        {pollingTimedOut ? (
          <View style={styles.timeoutBox}>
            <Text style={styles.timeoutText}>{t('payment.timeout')}</Text>
            <Button title={t('payment.check_again')} onPress={onCheckAgain} loading={processing} />
            <Button title={t('payment.cancel')} onPress={onCancelPayment} variant="outline" />
          </View>
        ) : processing ? (
          <View style={styles.timeoutBox}>
            <Text style={styles.verifyingText}>{t('payment.checking')}</Text>
            <Button title={t('payment.cancel')} onPress={onCancelPayment} variant="outline" />
          </View>
        ) : (
          <Button title={t('payment.pay_now')} onPress={onPay} />
        )}
      </View>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  label: { fontSize: 13, color: colors.textMuted, fontWeight: '500', textTransform: 'uppercase' },
  amount: { fontSize: 32, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  secure: { fontSize: 13, color: colors.success, marginTop: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'right', flex: 1 },
  timeoutBox: { gap: spacing.sm },
  timeoutText: { fontSize: 14, color: colors.warning, fontWeight: '600', textAlign: 'center' },
  verifyingText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
