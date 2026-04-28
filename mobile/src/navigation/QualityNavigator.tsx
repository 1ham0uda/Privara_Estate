import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QualityStackParamList, QualityTabsParamList } from './types';
import { QualityDashboardScreen } from '@/src/screens/quality/QualityDashboardScreen';
import { CaseDetailScreen } from '@/src/screens/shared/CaseDetailScreen';
import { SupportScreen } from '@/src/screens/shared/SupportScreen';
import { NotificationsScreen } from '@/src/screens/shared/NotificationsScreen';
import { ProfileScreen } from '@/src/screens/shared/ProfileScreen';
import { colors } from '@/src/constants/colors';
import { useLanguage } from '@/src/context/LanguageContext';

const Tab = createBottomTabNavigator<QualityTabsParamList>();
const Stack = createNativeStackNavigator<QualityStackParamList>();

function QualityTabs() {
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
        name="QualityDashboard"
        component={QualityDashboardScreen}
        options={{ title: t('nav.dashboard') }}
      />
      <Tab.Screen
        name="QualitySupport"
        component={SupportScreen}
        options={{ title: t('nav.support') }}
      />
      <Tab.Screen
        name="QualityProfile"
        component={ProfileScreen}
        options={{ title: t('nav.profile') }}
      />
    </Tab.Navigator>
  );
}

export function QualityNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="QualityTabs" component={QualityTabs} />
      <Stack.Screen name="CaseDetail" component={CaseDetailScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
