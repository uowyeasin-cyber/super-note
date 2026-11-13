import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../lib/store';
import { allNotes } from '../../lib/db';
import { AREAS, type Area } from '../../lib/classify';
import { toBnDigits } from '../../lib/i18n';
import { AREA_COLORS } from '../../lib/theme';
import { Icon } from '../../components/Icon';
import { Chip, Press, T } from '../../components/ui';
import { ListCard, NoteRow } from '../../components/rows';

export default function Library() {
  const { c, t, s, version } = useApp();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [area, setArea] = useState<Area | 'all'>('all');
  const notes = useMemo(() => { void version; return allNotes(); }, [version]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of notes) m[n.area] = (m[n.area] ?? 0) + 1;
    return m;
  }, [notes]);
  const shown = notes.filter((n) => (area === 'all' || n.area === area) && (!q.trim() || (n.title + ' ' + n.text).toLowerCase().includes(q.trim().toLowerCase())));
  const num = (n: number) => (s.lang === 'bn' ? toBnDigits(n) : String(n));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 40 }}>
      <T kind="h1">{t.library}</T>
      <T kind="small" style={{ marginTop: 2 }}>{num(notes.length)} {t.notes}</T>

      <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, paddingHorizontal: 14, height: 48 }}>
        <Icon name="search" size={18} color={c.ink3} />
        <TextInput value={q} onChangeText={setQ} placeholder={t.search} placeholderTextColor={c.ink3} style={{ flex: 1, color: c.ink, fontSize: 15 }} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
        {AREAS.map((a) => (
          <Press key={a} onPress={() => setArea(area === a ? 'all' : a)} style={{
            width: '31.5%', backgroundColor: area === a ? c.accentSoft : c.surface, borderRadius: 16, padding: 12,
            borderWidth: area === a ? 1.5 : StyleSheet.hairlineWidth, borderColor: area === a ? c.accent : c.line,
          }}>
            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: AREA_COLORS[a] + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="folder" size={16} color={AREA_COLORS[a]} />
            </View>
            <T kind="h3" style={{ marginTop: 8, fontSize: 14 }} numberOfLines={1}>{t[a]}</T>
            <T kind="small">{num(counts[a] ?? 0)}</T>
          </Press>
        ))}
      </View>

      {area !== 'all' ? <View style={{ flexDirection: 'row', marginTop: 14 }}><Chip label={`${t.all}  ✕`} onPress={() => setArea('all')} /></View> : null}

      <View style={{ marginTop: 16 }}>
        {shown.length ? (
          <ListCard>{shown.map((n, i) => <NoteRow key={n.id} note={n} last={i === shown.length - 1} />)}</ListCard>
        ) : (
          <View style={{ padding: 22, borderRadius: 20, backgroundColor: c.accentSoft }}>
            <T kind="h2">{t.noNotes}</T>
            <T kind="body" color={c.ink2} style={{ marginTop: 6 }}>{t.noNotesHint}</T>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
