import React, { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../lib/store';
import { getDb } from '../lib/db';
import { rearmAll, syncEvents } from '../lib/alarms';
import { ToastHost } from '../components/ui';

getDb();

function Shell() {
  const { c, bump, checkPlan } = useApp();
  useEffect(() => {
    try { syncEvents(); rearmAll(); } catch {}
    bump();
    checkPlan().catch(() => {});
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') { try { if (syncEvents() > 0) bump(); else bump(); } catch {} }
    });
    return () => sub.remove();
  }, [bump, checkPlan]);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="capture" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="note/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="upgrade" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <ToastHost />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}
