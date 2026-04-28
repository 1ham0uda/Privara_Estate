import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClientStackParamList, ClientTabsParamList } from './types';
import { ClientDashboardScreen } from '@/src/screens/client/ClientDashboardScreen';
import { NewConsultationScreen } from '@/src/screens/client/NewConsultationScreen';
import { PaymentScreen } from '@/src/screens/client/PaymentScreen';
import { CaseDetailScreen } from '@/src/screens/shared/CaseDetailScreen';
import { CaseChatScreen } from '@/src/screens/shared/CaseChatScreen';
import { SupportScreen } from '@/src/screens/shared/SupportScreen';
import { NotificationsScreen } from '@/src/screens/shared/NotificationsScreen';
import { PlaceholderScreen } from '@/src/screens/shared/PlaceholderScreen';
import { ProfileScreen } from '@/src/screens/shared/ProfileScreen';
import { colors } from '@/src/constants/colors';
import { useLanguage } from '@/src/context/LanguageContext';

const Tab = createBottomTabNavigator<ClientTabsParamList>();
const Stack = createNativeStackNavigator<ClientStackParamList>();

function ClientTabs() {
  const { t } = useLanguage();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="ClientDashboard"
        component={ClientDashboardScreen}
        options={{ title: t('nav.dashboard') }}
      />
      <Tab.Screen
        name="ClientSupport"
        component={SupportScreen}
        options={{ title: t('nav.support') }}
      />
      <Tab.Screen
        name="ClientProfile"
        component={ProfileScreen}
        options={{ title: t('nav.profile') }}
      />
    </Tab.Navigator>
  );
}

export function ClientNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientTabs" component={ClientTabs} />
      <Stack.Screen name="NewConsultation" component={NewConsultationScreen} />
      <Stack.Screen name="CaseDetail" component={CaseDetailScreen} />
      <Stack.Screen name="CaseChat" component={CaseChatScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="ConsultantDetail" component={PlaceholderScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
