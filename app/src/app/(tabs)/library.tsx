import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../lib/store';
import { allNotes, files } from '../../lib/db';
import { AREAS, type Area } from '../../lib/classify';
import { toBnDigits, whenLabel } from '../../lib/i18n';
import { AREA_COLORS } from '../../lib/theme';
import { Icon } from '../../components/Icon';
import { Chip, Press, T } from '../../components/ui';
import { ListCard, NoteRow } from '../../components/rows';

/** Library: six folders → files inside each folder → the notes in a file. Search looks everywhere. */
export default function Library() {
  const { c, t, s, version } = useApp();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [area, setArea] = useState<Area | 'all'>('all');
  const [onlyImportant, setOnlyImportant] = useState(false);
  const notes = useMemo(() => { void version; return allNotes(); }, [version]);
  const allFiles = useMemo(() => { void version; return files(); }, [version]);
  const num = (n: number) => (s.lang === 'bn' ? toBnDigits(n) : String(n));
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of notes) m[n.area] = (m[n.area] ?? 0) + 1;
    return m;
  }, [notes]);

  const query = q.trim().toLowerCase();
  const found = query ? notes.filter((n) => (n.title + ' ' + n.text + ' ' + n.topic).toLowerCase().includes(query)) : [];
  const shownFiles = allFiles.filter((f) => area === 'all' || f.area === area);
  const important = notes.filter((n) => n.important && (area === 'all' || n.area === area));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 130 }}>
      <T kind="h1">{t.library}</T>
      <T kind="small" style={{ marginTop: 2 }}>{num(notes.length)} {t.notes} · {num(allFiles.length)} {t.files}</T>

      <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, paddingHorizontal: 14, height: 48 }}>
        <Icon name="search" size={18} color={c.ink3} />
        <TextInput value={q} onChangeText={setQ} placeholder={t.search} placeholderTextColor={c.ink3} style={{ flex: 1, color: c.ink, fontSize: 15 }} />
        {q ? <Press onPress={() => setQ('')} hitSlop={10}><Icon name="x" size={16} color={c.ink3} /></Press> : null}
      </View>

      {query ? (
        <View style={{ marginTop: 16 }}>
          {found.length ? <ListCard>{found.map((n, i) => <NoteRow key={n.id} note={n} last={i === found.length - 1} />)}</ListCard>
            : <T kind="body" color={c.ink2}>{t.noNotes}</T>}
        </View>
      ) : (
        <>
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

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {area !== 'all' ? <Chip label={`${t[area]}  ✕`} active onPress={() => setArea('all')} /> : null}
            <Chip label={`● ${t.importantOnly}`} active={onlyImportant} onPress={() => setOnlyImportant(!onlyImportant)} />
          </View>

          <View style={{ marginTop: 14 }}>
            {onlyImportant ? (
              important.length ? <ListCard>{important.map((n, i) => <NoteRow key={n.id} note={n} last={i === important.length - 1} />)}</ListCard>
                : <T kind="body" color={c.ink2}>{t.noNotes}</T>
            ) : shownFiles.length ? (
              <ListCard>
                {shownFiles.map((f, i) => (
                  <Press key={f.area + '/' + f.topic} accessibilityLabel={f.topic}
                    onPress={() => router.push({ pathname: '/file', params: { area: f.area, topic: f.topic } })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: i === shownFiles.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.line }}>
                    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: AREA_COLORS[f.area] + '1f', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="book" size={17} color={AREA_COLORS[f.area]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T kind="h3" numberOfLines={1}>{f.topic}</T>
                      <T kind="small">{t[f.area]} · {t.entries(f.count)} · {whenLabel(f.last, s.lang)}</T>
                    </View>
                    <Icon name="right" size={16} color={c.ink3} />
                  </Press>
                ))}
              </ListCard>
            ) : (
              <View style={{ padding: 22, borderRadius: 20, backgroundColor: c.accentSoft }}>
                <T kind="h2">{t.noNotes}</T>
                <T kind="body" color={c.ink2} style={{ marginTop: 6 }}>{t.noNotesHint}</T>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
