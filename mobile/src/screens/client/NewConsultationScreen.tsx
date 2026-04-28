import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ClientStackParamList } from '@/src/navigation/types';
import { useLanguage } from '@/src/context/LanguageContext';
import { consultantService } from '@/src/services/consultantService';
import { ConsultantProfile, IntakeData } from '@/src/types';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { Header } from '@/src/components/Header';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { TextField } from '@/src/components/TextField';
import { SectionHeader } from '@/src/components/SectionHeader';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { colors } from '@/src/constants/colors';
import { radius, spacing } from '@/src/constants/spacing';

type Props = NativeStackScreenProps<ClientStackParamList, 'NewConsultation'>;

const GOALS: IntakeData['goal'][] = ['living', 'investment', 'resale'];

export function NewConsultationScreen({ navigation }: Props) {
  const { t, isRTL } = useLanguage();
  const [consultants, setConsultants] = useState<ConsultantProfile[]>([]);
  const [loadingConsultants, setLoadingConsultants] = useState(true);
  const [consultantSearch, setConsultantSearch] = useState('');
  const [form, setForm] = useState<IntakeData>({
    goal: 'living',
    preferredArea: '',
    budgetRange: '',
    propertyType: '',
    preferredDeliveryTime: '',
    notes: '',
    projectsInMind: '',
    selectedConsultantUid: '',
    selectedConsultantName: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const all = await consultantService.getAllConsultants();
        setConsultants(all.sort((a, b) => b.rating - a.rating));
      } catch {
        setConsultants([]);
      } finally {
        setLoadingConsultants(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = consultantSearch.trim().toLowerCase();
    if (!s) return consultants;
    return consultants.filter((c) => c.name.toLowerCase().includes(s));
  }, [consultantSearch, consultants]);

  const onSubmit = () => {
    if (!form.propertyType.trim() || !form.preferredArea.trim() || !form.budgetRange.trim() || !form.preferredDeliveryTime.trim()) {
      setError(t('common.error'));
      return;
    }
    setError(null);
    const payload: IntakeData = { ...form };
    if (!payload.selectedConsultantUid) {
      delete payload.selectedConsultantUid;
      delete payload.selectedConsultantName;
    }
    navigation.navigate('Payment', { intake: payload });
  };

  return (
    <ScreenContainer padded={false} scroll avoidKeyboard>
      <Header title={t('intake.title')} onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <SectionHeader title={t('intake.goal_label')} />
        <View style={styles.goals}>
          {GOALS.map((goal) => {
            const selected = form.goal === goal;
            return (
              <Pressable
                key={goal}
                onPress={() => setForm({ ...form, goal })}
                style={[styles.goalBtn, selected && styles.goalBtnActive]}
              >
                <Text style={[styles.goalText, selected && styles.goalTextActive]}>
                  {t(`intake.goal.${goal}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label={t('intake.property_type')}
          value={form.propertyType}
          onChangeText={(v) => setForm({ ...form, propertyType: v })}
        />
        <TextField
          label={t('intake.preferred_area')}
          value={form.preferredArea}
          onChangeText={(v) => setForm({ ...form, preferredArea: v })}
        />
        <TextField
          label={t('intake.budget_range')}
          value={form.budgetRange}
          onChangeText={(v) => setForm({ ...form, budgetRange: v })}
          keyboardType="numeric"
        />
        <TextField
          label={t('intake.delivery_time')}
          value={form.preferredDeliveryTime}
          onChangeText={(v) => setForm({ ...form, preferredDeliveryTime: v })}
        />
        <TextField
          label={t('intake.projects')}
          value={form.projectsInMind ?? ''}
          onChangeText={(v) => setForm({ ...form, projectsInMind: v })}
        />
        <View>
          <Text style={styles.label}>{t('intake.notes')}</Text>
          <TextInput
            multiline
            numberOfLines={4}
            value={form.notes}
            onChangeText={(v) => setForm({ ...form, notes: v })}
            style={[styles.textarea, { textAlign: isRTL ? 'right' : 'left' }]}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <SectionHeader title={t('intake.select_consultant')} />
        <TextField
          placeholder={t('common.search')}
          value={consultantSearch}
          onChangeText={setConsultantSearch}
        />

        {loadingConsultants ? (
          <LoadingScreen inline />
        ) : (
          <View style={styles.consultants}>
            {form.selectedConsultantUid ? null : (
              <Card style={styles.dashed}>
                <Text style={styles.cardTitle}>{t('intake.assign_later')}</Text>
              </Card>
            )}
            {filtered.slice(0, 10).map((c) => {
              const selected = c.uid === form.selectedConsultantUid;
              return (
                <Card
                  key={c.uid}
                  onPress={() =>
                    setForm({
                      ...form,
                      selectedConsultantUid: selected ? '' : c.uid,
                      selectedConsultantName: selected ? '' : c.name,
                    })
                  }
                  style={selected ? styles.selectedCard : undefined}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>{c.name}</Text>
                    <Text style={styles.rating}>★ {c.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.cardBody} numberOfLines={2}>{c.bio}</Text>
                  {c.specialties?.length ? (
                    <Text style={styles.specialties}>{c.specialties.slice(0, 3).join(' · ')}</Text>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title={t('intake.proceed_to_payment')} onPress={onSubmit} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  goals: { flexDirection: 'row', gap: spacing.sm },
  goalBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  goalBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  goalText: { fontSize: 14, fontWeight: '600', color: colors.text },
  goalTextActive: { color: colors.primaryText },
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
  consultants: { gap: spacing.sm },
  dashed: { borderStyle: 'dashed', backgroundColor: colors.surface },
  selectedCard: { borderColor: colors.primary, borderWidth: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardBody: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  rating: { fontSize: 13, color: colors.warning, fontWeight: '600' },
  specialties: { fontSize: 12, color: colors.info, marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 13 },
});
