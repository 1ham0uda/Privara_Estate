import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { RootStackParamList } from './types';
import { AuthStack } from './AuthStack';
import { ClientNavigator } from './ClientNavigator';
import { ConsultantNavigator } from './ConsultantNavigator';
import { AdminNavigator } from './AdminNavigator';
import { QualityNavigator } from './QualityNavigator';
import { VerifyEmailScreen } from '@/src/screens/auth/VerifyEmailScreen';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { useAuth } from '@/src/context/AuthContext';
import { UserRole } from '@/src/types';

// Deep-link configuration — maps privara:// URLs to navigator routes.
// Payment return is handled synchronously inside PaymentScreen via
// WebBrowser.openAuthSessionAsync result; we only need CaseDetail here
// for notification taps that launch/foreground the app.
// The nested path config for sub-navigators can't be inferred from
// RootStackParamList alone — cast to any to satisfy LinkingOptions.
const linking: any = {
  prefixes: ['privara://'],
  config: {
    screens: {
      ClientRoot: {
        screens: {
          CaseDetail: 'case/:caseId',
          // payment-return is handled in PaymentScreen, not as a nav route
        },
      },
      ConsultantRoot: {
        screens: {
          CaseDetail: 'consultant/case/:caseId',
        },
      },
      AdminRoot: {
        screens: {
          CaseDetail: 'admin/case/:caseId',
        },
      },
      QualityRoot: {
        screens: {
          CaseDetail: 'quality/case/:caseId',
        },
      },
    },
  },
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function resolveRoleStack(role: UserRole | undefined) {
  switch (role) {
    case 'consultant':
      return { name: 'ConsultantRoot' as const, component: ConsultantNavigator };
    case 'admin':
      return { name: 'AdminRoot' as const, component: AdminNavigator };
    case 'quality':
      return { name: 'QualityRoot' as const, component: QualityNavigator };
    default:
      return { name: 'ClientRoot' as const, component: ClientNavigator };
  }
}

export function RootNavigator() {
  const { user, profile, initializing } = useAuth();

  // Hide the native splash screen once Firebase auth has resolved.
  useEffect(() => {
    if (!initializing) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [initializing]);

  if (initializing) {
    return <LoadingScreen />;
  }

  let screen: React.ReactNode;
  if (!user) {
    screen = <Stack.Screen name="Auth" component={AuthStack} />;
  } else if (!user.emailVerified) {
    screen = <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />;
  } else if (!profile) {
    screen = <Stack.Screen name="Loading" component={LoadingScreen} />;
  } else {
    const role = resolveRoleStack(profile.role as UserRole | undefined);
    screen = <Stack.Screen name={role.name} component={role.component} />;
  }

  return (
    <ErrorBoundary>
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {screen}
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
