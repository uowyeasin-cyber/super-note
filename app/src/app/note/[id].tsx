import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../../lib/store';
import { deleteNote, getNote, setNoteFile, tasksForNote, updateNote } from '../../lib/db';
import { aiAvailable } from '../../lib/brain';
import { askAbout, explain, makeQuiz, summarize, type Quiz } from '../../lib/study';
import { Icon } from '../../components/Icon';
import { NoteThumb } from '../../components/NoteThumb';
import { Press } from '../../components/ui';
import { disarmTask } from '../../lib/alarms';
import { toggleTask } from '../../lib/actions';
import { AREAS, type Area } from '../../lib/classify';
import { whenLabel } from '../../lib/i18n';
import { AREA_COLORS } from '../../lib/theme';
import { Btn, Chip, IconBtn, Section, T, toast } from '../../components/ui';
import { ListCard, TaskRow } from '../../components/rows';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, t, s, version, bump, pro, plan } = useApp();
  const ctx = { key: s.aiKey, model: s.aiModel, pro, plan };
  const lang = s.lang === 'bn' ? 'bn' as const : 'en' as const;
  const [help, setHelp] = useState<{ kind: 'summary' | 'quiz' | 'explain'; busy: boolean; text?: string; quiz?: Quiz } | null>(null);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const insets = useSafeAreaInsets();
  const note = useMemo(() => { void version; return getNote(String(id)); }, [id, version]);
  const tasks = useMemo(() => { void version; return tasksForNote(String(id)); }, [id, version]);
  const [topic, setTopic] = useState(note?.topic ?? '');
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

  async function ask(kind: 'summary' | 'quiz' | 'explain') {
    if (!aiAvailable(ctx)) { toast(t.aiNeeded); return; }
    setHelp({ kind, busy: true }); setPicked({});
    const body = note!.text;
    if (kind === 'quiz') {
      const q = await makeQuiz(body, ctx, lang);
      setHelp(q ? { kind, busy: false, quiz: q } : { kind, busy: false, text: t.aiNeeded });
    } else {
      const r = kind === 'summary' ? await summarize(body, ctx, lang) : await explain(body, ctx, lang);
      setHelp({ kind, busy: false, text: r ?? t.aiNeeded });
    }
  }

  async function askQ() {
    const q = question.trim();
    if (!q || asking) return;
    if (!aiAvailable(ctx)) { toast(t.aiNeeded); return; }
    setAsking(true);
    const a = await askAbout(note!.text, q, chat, ctx, lang);
    setAsking(false);
    if (a) { setChat([...chat, { q, a }]); setQuestion(''); } else toast(t.aiNeeded);
  }

  function addAnswer(a: string) {
    updateNote(note!.id, note!.title, note!.text + '\n\n' + a); bump(); toast(t.saved);
  }

  function moveTo(area: Area, name: string) {
    const clean = name.trim() || note!.topic || (s.lang === 'bn' ? 'সাধারণ' : 'General');
    setNoteFile(note!.id, area, clean); setTopic(clean); bump();
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
          <T kind="small">{t[note.area]} › {note.topic || '—'} · {whenLabel(note.created, s.lang)}</T>
          {note.important ? <T kind="small" color={c.danger} style={{ fontWeight: '700' }}>● {t.important}</T> : null}
        </View>
        {editing ? (
          <TextInput value={title} onChangeText={setTitle} style={{ color: c.ink, fontSize: 26, fontWeight: '700', marginTop: 8, padding: 0 }} />
        ) : (
          <T kind="h1" style={{ marginTop: 8, fontSize: 26 }}>{note.title}</T>
        )}

        <NoteThumb note={note} big />
        {note.url ? <Chip label={t.openLink} icon="link" onPress={() => Linking.openURL(note.url).catch(() => {})} /> : null}

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

        <Section title={t.aiTools}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={t.summary} icon="sparkle" active={help?.kind === 'summary'} onPress={() => ask('summary')} />
            <Chip label={t.quiz} icon="check" active={help?.kind === 'quiz'} onPress={() => ask('quiz')} />
            <Chip label={t.explain} icon="book" active={help?.kind === 'explain'} onPress={() => ask('explain')} />
          </View>
          {help ? (
            <View style={{ marginTop: 12, backgroundColor: c.accentSoft, borderRadius: 18, padding: 16 }}>
              {help.busy ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><ActivityIndicator color={c.accent} /><T kind="body">{t.thinking}</T></View>
              ) : help.quiz ? (
                <View style={{ gap: 16 }}>
                  {help.quiz.map((q, i) => (
                    <View key={i}>
                      <T kind="h3">{i + 1}. {q.q}</T>
                      <View style={{ gap: 6, marginTop: 8 }}>
                        {q.options.map((o, j) => {
                          const chosen = picked[i];
                          const show = chosen !== undefined;
                          const right = j === q.answer;
                          return (
                            <Press key={j} onPress={() => setPicked({ ...picked, [i]: j })} style={{
                              padding: 12, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1.4,
                              borderColor: show && right ? c.ok : show && chosen === j ? c.danger : c.line,
                            }}>
                              <T kind="body">{o}</T>
                            </Press>
                          );
                        })}
                      </View>
                      {picked[i] !== undefined ? <T kind="small" color={picked[i] === q.answer ? c.ok : c.danger} style={{ marginTop: 6 }}>{picked[i] === q.answer ? '✓ ' : '✗ '}{q.why}</T> : null}
                    </View>
                  ))}
                </View>
              ) : (
                <T kind="body" style={{ fontSize: 16, lineHeight: 25 }}>{help.text}</T>
              )}
            </View>
          ) : null}
        </Section>

        <View style={{ marginTop: 12, gap: 10 }}>
          {chat.map((m, i) => (
            <View key={i} style={{ padding: 14, borderRadius: 16, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }}>
              <T kind="small" color={c.accent}>{m.q}</T>
              <T kind="body" style={{ marginTop: 6, lineHeight: 23 }}>{m.a}</T>
              <Press onPress={() => addAnswer(m.a)} style={{ marginTop: 8, alignSelf: 'flex-start' }}><T kind="small" color={c.accent} style={{ fontWeight: '700' }}>+ {t.addToNote}</T></Press>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, paddingLeft: 12, paddingRight: 6, minHeight: 48 }}>
            <TextInput accessibilityLabel={t.askNote} value={question} onChangeText={setQuestion} placeholder={t.askNote} placeholderTextColor={c.ink3} onSubmitEditing={askQ}
              style={{ flex: 1, color: c.ink, fontSize: 15, paddingVertical: 8 }} />
            {asking ? <ActivityIndicator color={c.accent} /> : (
              <Press accessibilityLabel={t.askNote} onPress={askQ} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="send" size={18} color={c.onAccent} />
              </Press>
            )}
          </View>
        </View>

        <Section title={t.moveFile}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {AREAS.map((a) => (
              <Chip key={a} label={t[a]} icon="folder" color={AREA_COLORS[a]} active={note.area === a} onPress={() => moveTo(a, topic)} />
            ))}
          </View>
          <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, paddingHorizontal: 12, height: 46 }}>
            <T kind="small" color={c.ink2}>{t.fileName}</T>
            <TextInput accessibilityLabel={t.fileName} value={topic} onChangeText={setTopic} onEndEditing={() => { if (topic.trim() !== note.topic) moveTo(note.area, topic); }}
              style={{ flex: 1, color: c.ink, fontSize: 15, fontWeight: '600', paddingVertical: 0 }} />
          </View>
        </Section>

        {editing ? <Btn style={{ marginTop: 26 }} label={t.save} icon="check" onPress={() => { updateNote(note.id, title.trim() || note.title, body.trim() || note.text); setEditing(false); bump(); toast(t.saved); }} /> : null}
      </ScrollView>
    </View>
  );
}
