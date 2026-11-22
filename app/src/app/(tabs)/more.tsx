import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../lib/store';
import { Icon, type IconName } from '../../components/Icon';
import { Press, T } from '../../components/ui';

type Tool = { icon: IconName; title: string; hint?: string; go?: () => void; soon?: boolean };

/** Every tool in one place, as big friendly tiles. Tools not built yet say so honestly. */
export default function More() {
  const { c, t } = useApp();
  const insets = useSafeAreaInsets();
  const tools: Tool[] = [
    { icon: 'sparkle', title: t.askAi, go: () => router.push('/assistant') },
    { icon: 'school', title: t.classMode, go: () => router.push('/class') },
    { icon: 'camera', title: t.photoNote, go: () => router.push('/capture') },
    { icon: 'link', title: t.link, go: () => router.push('/capture') },
    { icon: 'message', title: t.message, go: () => router.push('/message') },
    { icon: 'user', title: t.profile, go: () => router.push('/profile') },
    { icon: 'wallet', title: t.money, go: () => router.navigate('/money') },
    { icon: 'book', title: t.lifeStory, soon: true },
    { icon: 'send', title: t.inbox, soon: true },
    { icon: 'user', title: t.circle, go: () => router.push('/circle') },
    { icon: 'settings', title: t.settingsTitle, go: () => router.push('/settings') },
  ];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 130 }}>
      <T kind="h1">{t.tools}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        {tools.map((x) => (
          <Press key={x.title} accessibilityLabel={x.title} disabled={x.soon} onPress={x.go} style={{
            width: '47.5%', minHeight: 112, padding: 16, borderRadius: 20, backgroundColor: c.surface,
            borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, opacity: x.soon ? 0.55 : 1, justifyContent: 'space-between',
          }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={x.icon} size={21} color={c.accent} />
            </View>
            <View style={{ marginTop: 12 }}>
              <T kind="h3" style={{ fontSize: 15 }}>{x.title}</T>
              {x.soon ? <T kind="small" style={{ marginTop: 2 }}>{t.comingSoon}</T> : null}
            </View>
          </Press>
        ))}
      </View>
    </ScrollView>
  );
}
