import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminStackParamList, AdminTabsParamList } from './types';
import { AdminDashboardScreen } from '@/src/screens/admin/AdminDashboardScreen';
import { AdminClientsScreen } from '@/src/screens/admin/AdminClientsScreen';
import { AdminStaffScreen } from '@/src/screens/admin/AdminStaffScreen';
import { AddStaffScreen } from '@/src/screens/admin/AddStaffScreen';
import { AdminSupportScreen } from '@/src/screens/admin/AdminSupportScreen';
import { CaseDetailScreen } from '@/src/screens/shared/CaseDetailScreen';
import { CaseChatScreen } from '@/src/screens/shared/CaseChatScreen';
import { NotificationsScreen } from '@/src/screens/shared/NotificationsScreen';
import { ProfileScreen } from '@/src/screens/shared/ProfileScreen';
import { colors } from '@/src/constants/colors';
import { useLanguage } from '@/src/context/LanguageContext';

const Tab = createBottomTabNavigator<AdminTabsParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();

function AdminTabs() {
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
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: t('nav.dashboard') }}
      />
      <Tab.Screen
        name="AdminClients"
        component={AdminClientsScreen}
        options={{ title: t('nav.clients') }}
      />
      <Tab.Screen
        name="AdminStaff"
        component={AdminStaffScreen}
        options={{ title: t('nav.staff') }}
      />
      <Tab.Screen
        name="AdminSupport"
        component={AdminSupportScreen}
        options={{ title: t('nav.support') }}
      />
      <Tab.Screen
        name="AdminProfile"
        component={ProfileScreen}
        options={{ title: t('nav.profile') }}
      />
    </Tab.Navigator>
  );
}

export function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} />
      <Stack.Screen name="CaseDetail" component={CaseDetailScreen} />
      <Stack.Screen name="CaseChat" component={CaseChatScreen} />
      <Stack.Screen name="AddStaff" component={AddStaffScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
