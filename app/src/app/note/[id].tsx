import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../../lib/store';
import { deleteNote, getNote, tasksForNote, updateNote, updateNoteArea } from '../../lib/db';
import { disarmTask } from '../../lib/alarms';
import { toggleTask } from '../../lib/actions';
import { AREAS } from '../../lib/classify';
import { whenLabel } from '../../lib/i18n';
import { AREA_COLORS } from '../../lib/theme';
import { Btn, Chip, IconBtn, Section, T, toast } from '../../components/ui';
import { ListCard, TaskRow } from '../../components/rows';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, t, s, version, bump } = useApp();
  const insets = useSafeAreaInsets();
  const note = useMemo(() => { void version; return getNote(String(id)); }, [id, version]);
  const tasks = useMemo(() => { void version; return tasksForNote(String(id)); }, [id, version]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.text ?? '');

  if (!note) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 14, paddingHorizontal: 20 }}>
        <IconBtn name="left" label="Back" onPress={() => router.back()} />
      </View>
    );
  }

  function remove() {
    Alert.alert(t.delete, t.deleteConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => {
        tasks.forEach((x) => disarmTask(x.id));
        deleteNote(note!.id);
        bump();
        router.back();
      } },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBtn name="left" label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1 }} />
        <IconBtn name="copy" label={t.copy} onPress={async () => { await Clipboard.setStringAsync(note.text); toast(t.copied); }} />
        <IconBtn name="share" label={t.share} onPress={() => Share.share({ message: note.text })} />
        <IconBtn name="trash" label={t.delete} onPress={remove} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: AREA_COLORS[note.area] }} />
          <T kind="small">{t[note.area]} · {whenLabel(note.created, s.lang)}</T>
        </View>
        {editing ? (
          <TextInput value={title} onChangeText={setTitle} style={{ color: c.ink, fontSize: 26, fontWeight: '700', marginTop: 8, padding: 0 }} />
        ) : (
          <T kind="h1" style={{ marginTop: 8, fontSize: 26 }}>{note.title}</T>
        )}

        {tasks.length ? (
          <Section title={t.tasks}>
            <ListCard>{tasks.map((x, i) => <TaskRow key={x.id} task={x} last={i === tasks.length - 1} onToggle={() => toggleTask(x, t, bump)} />)}</ListCard>
          </Section>
        ) : null}

        <Section title={t.fullText} right={
          <Chip label={editing ? t.save : t.edit} active={editing} onPress={() => {
            if (editing) { updateNote(note.id, title.trim() || note.title, body.trim() || note.text); bump(); toast(t.saved); }
            else { setTitle(note.title); setBody(note.text); }
            setEditing(!editing);
          }} />
        }>
          <View style={{ backgroundColor: c.surface, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, padding: 16 }}>
            {editing ? (
              <TextInput value={body} onChangeText={setBody} multiline style={{ color: c.ink, fontSize: 16, lineHeight: 24, minHeight: 120, textAlignVertical: 'top', padding: 0 }} />
            ) : (
              <T kind="body" style={{ fontSize: 16, lineHeight: 25 }}>{note.text}</T>
            )}
          </View>
        </Section>

        <Section title={t.folder}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {AREAS.map((a) => (
              <Chip key={a} label={t[a]} icon="folder" color={AREA_COLORS[a]} active={note.area === a} onPress={() => { updateNoteArea(note.id, a); bump(); }} />
            ))}
          </View>
        </Section>

        {editing ? <Btn style={{ marginTop: 26 }} label={t.save} icon="check" onPress={() => { updateNote(note.id, title.trim() || note.title, body.trim() || note.text); setEditing(false); bump(); toast(t.saved); }} /> : null}
      </ScrollView>
    </View>
  );
}
