import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold, useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PdfHost } from '@/components/pdf-host';
import { SosButton, Toast } from '@/components/ui';
import { useStore } from '@/state/store';
import { C, F } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Screens where the family SOS button is NOT shown in the header. */
const NO_SOS = new Set(['index', 'login', 'onboarding/about-you', 'onboarding/upload', 'onboarding/review', 'sos']);

export default function RootLayout() {
  const [loaded, error] = useFonts({
    IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold,
    IBMPlexMono_500Medium, IBMPlexMono_600SemiBold,
  });
  const tick = useStore((s) => s.tick);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  // Demo: the 24-hour monitor streams a new reading every 2 seconds once paired.
  useEffect(() => {
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [tick]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Stack
          screenOptions={({ route }) => ({
            headerTintColor: C.amberDeep,
            headerStyle: { backgroundColor: C.bg },
            headerShadowVisible: false,
            headerTitleStyle: { fontFamily: F.semibold, fontSize: 16, color: C.ink },
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: C.bg },
            headerRight: NO_SOS.has(route.name) || route.name.startsWith('pro/') ? undefined : () => <SosButton />,
          })}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/about-you" options={{ title: 'About you' }} />
          <Stack.Screen name="onboarding/upload" options={{ title: 'Discharge summary' }} />
          <Stack.Screen name="onboarding/review" options={{ title: 'Check what we read' }} />
          <Stack.Screen name="providers" options={{ title: 'Providers' }} />
          <Stack.Screen name="provider/[id]" options={{ title: 'Provider' }} />
          <Stack.Screen name="book" options={{ title: 'Book a visit' }} />
          <Stack.Screen name="booked" options={{ title: 'Booked', headerBackVisible: false, gestureEnabled: false }} />
          <Stack.Screen name="visit" options={{ title: 'Live visit' }} />
          <Stack.Screen name="care-plan" options={{ title: 'Care plan' }} />
          <Stack.Screen name="sos" options={{ title: 'SOS · Urgent help', presentation: 'modal', headerTintColor: C.red }} />
          <Stack.Screen name="bills" options={{ title: 'Bills and claims' }} />
          <Stack.Screen name="care-circle" options={{ title: 'Care circle' }} />
          <Stack.Screen name="equipment/index" options={{ title: 'Equipment' }} />
          <Stack.Screen name="equipment/[id]" options={{ title: 'Equipment' }} />
          <Stack.Screen name="equipment/order" options={{ title: 'Your order' }} />
          <Stack.Screen name="summary" options={{ title: 'Summary for your doctor' }} />
          <Stack.Screen name="monitor/index" options={{ title: '24-hour monitoring' }} />
          <Stack.Screen name="monitor/setup" options={{ title: 'Set up monitoring' }} />
          <Stack.Screen name="monitor/live" options={{ title: 'Live monitor' }} />
          <Stack.Screen name="pro/index" options={{ headerShown: false }} />
          <Stack.Screen name="pro/today" options={{ title: 'Today', headerBackVisible: false }} />
          <Stack.Screen name="pro/visit" options={{ title: 'Visit' }} />
          <Stack.Screen name="pro/desk" options={{ title: 'Monitoring desk' }} />
          <Stack.Screen name="pro/patient" options={{ title: 'Live patient' }} />
          <Stack.Screen name="pro/rates" options={{ title: 'Equipment desk', headerBackVisible: false }} />
        </Stack>
        <Toast />
        <PdfHost />
      </View>
    </SafeAreaProvider>
  );
}
