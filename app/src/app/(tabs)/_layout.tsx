import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../lib/store';
import { Icon } from '../../components/Icon';
import { Press } from '../../components/ui';

function TabBar({ state, navigation }: { state: { index: number; routes: { name: string; key: string }[] }; navigation: { navigate: (n: string) => void } }) {
  const { c, t } = useApp();
  const insets = useSafeAreaInsets();
  const item = (name: string, label: string, icon: 'home' | 'library') => {
    const i = state.routes.findIndex((r) => r.name === name);
    const on = state.index === i;
    return (
      <Press key={name} onPress={() => navigation.navigate(name)} style={{ flex: 1, alignItems: 'center', gap: 3, paddingTop: 10 }}>
        <Icon name={icon} size={22} color={on ? c.accent : c.ink3} />
        <Text style={{ fontSize: 11.5, fontWeight: '600', color: on ? c.accent : c.ink3 }}>{label}</Text>
      </Press>
    );
  };
  return (
    <View style={{
      flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line,
      paddingBottom: Math.max(insets.bottom, 10), height: 66 + Math.max(insets.bottom, 10),
    }}>
      {item('index', t.today, 'home')}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Press accessibilityLabel="New note" onPress={() => router.push('/capture')} style={{
          marginTop: -22, width: 64, height: 64, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
          shadowColor: c.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
        }}>
          <Icon name="mic" size={28} color={c.onAccent} stroke={2.1} />
        </Press>
      </View>
      {item('library', t.library, 'library')}
    </View>
  );
}

export default function TabsLayout() {
  const { c } = useApp();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
      tabBar={(p: any) => <TabBar state={p.state} navigation={p.navigation} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="library" />
    </Tabs>
  );
}
