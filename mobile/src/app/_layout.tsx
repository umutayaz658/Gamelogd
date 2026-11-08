import '../../global.css';

import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/AuthContext';
import { AnonBannerProvider } from '@/context/AnonBannerContext';
import { ToastProvider } from '@/context/ToastContext';
import { useRouteGuard } from '@/lib/auth/routeGuard';

function GuardedSlot() {
  useRouteGuard();
  return <Slot />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ToastProvider>
        <AuthProvider>
          <AnonBannerProvider>
            <GuardedSlot />
          </AnonBannerProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
