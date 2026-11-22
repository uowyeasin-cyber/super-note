import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../lib/store';
import { moneyInFile, notesInFile } from '../lib/db';
import type { Area } from '../lib/classify';
import { whenLabel } from '../lib/i18n';
import { AREA_COLORS } from '../lib/theme';
import { Icon } from '../components/Icon';
import { Btn, IconBtn, Press, T } from '../components/ui';
import { NoteThumb } from '../components/NoteThumb';

/** One file: every note saved into it, newest first, like pages of a notebook. */
export default function FileScreen() {
  const { c, t, s, version } = useApp();
  const insets = useSafeAreaInsets();
  const { area, topic } = useLocalSearchParams<{ area: Area; topic: string }>();
  const notes = useMemo(() => { void version; return notesInFile(area, topic); }, [area, topic, version]);
  const money = useMemo(() => { void version; return moneyInFile(area, topic); }, [area, topic, version]);
  const inSum = money.filter((m) => m.dir === 'in').reduce((a, m) => a + m.amount, 0);
  const outSum = money.filter((m) => m.dir === 'out').reduce((a, m) => a + m.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBtn name="left" label={t.back} onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <T kind="small" color={AREA_COLORS[area]}>{t[area]}</T>
          <T kind="h2" numberOfLines={1}>{topic}</T>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <T kind="small">{t.entries(notes.length)}</T>
        <Btn label={t.addToFile} icon="mic" style={{ marginTop: 12 }} onPress={() => router.push({ pathname: '/capture', params: { area, topic } })} />
        {money.length ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }}>
              <T kind="small">{t.received}</T><T kind="h2" color={c.ok}>৳{inSum.toLocaleString('en-US')}</T>
            </View>
            <View style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }}>
              <T kind="small">{t.spent}</T><T kind="h2" color={c.danger}>৳{outSum.toLocaleString('en-US')}</T>
            </View>
          </View>
        ) : null}
        <View style={{ marginTop: 14, gap: 10 }}>
          {notes.map((n) => (
            <Press key={n.id} onPress={() => router.push(`/note/${n.id}`)} style={{ padding: 16, borderRadius: 18, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T kind="small">{whenLabel(n.created, s.lang)}</T>
                {n.important ? <T kind="small" color={c.danger} style={{ fontWeight: '700' }}>● {t.important}</T> : null}
                {n.kind === 'link' ? <Icon name="link" size={13} color={c.ink3} /> : n.kind === 'photo' ? <Icon name="image" size={13} color={c.ink3} /> : n.kind === 'class' ? <Icon name="school" size={13} color={c.ink3} /> : null}
              </View>
              <T kind="h3" style={{ marginTop: 6 }}>{n.title}</T>
              {n.text !== n.title ? <T kind="body" color={c.ink2} numberOfLines={4} style={{ marginTop: 4 }}>{n.text}</T> : null}
              <NoteThumb note={n} />
            </Press>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
