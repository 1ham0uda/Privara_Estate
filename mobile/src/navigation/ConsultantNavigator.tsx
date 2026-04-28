import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ConsultantStackParamList, ConsultantTabsParamList } from './types';
import { ConsultantDashboardScreen } from '@/src/screens/consultant/ConsultantDashboardScreen';
import { CaseDetailScreen } from '@/src/screens/shared/CaseDetailScreen';
import { CaseChatScreen } from '@/src/screens/shared/CaseChatScreen';
import { SupportScreen } from '@/src/screens/shared/SupportScreen';
import { NotificationsScreen } from '@/src/screens/shared/NotificationsScreen';
import { ProfileScreen } from '@/src/screens/shared/ProfileScreen';
import { colors } from '@/src/constants/colors';
import { useLanguage } from '@/src/context/LanguageContext';

const Tab = createBottomTabNavigator<ConsultantTabsParamList>();
const Stack = createNativeStackNavigator<ConsultantStackParamList>();

function ConsultantTabs() {
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
        name="ConsultantDashboard"
        component={ConsultantDashboardScreen}
        options={{ title: t('nav.dashboard') }}
      />
      <Tab.Screen
        name="ConsultantSupport"
        component={SupportScreen}
        options={{ title: t('nav.support') }}
      />
      <Tab.Screen
        name="ConsultantProfile"
        component={ProfileScreen}
        options={{ title: t('nav.profile') }}
      />
    </Tab.Navigator>
  );
}

export function ConsultantNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ConsultantTabs" component={ConsultantTabs} />
      <Stack.Screen name="CaseDetail" component={CaseDetailScreen} />
      <Stack.Screen name="CaseChat" component={CaseChatScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
