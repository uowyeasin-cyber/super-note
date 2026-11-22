import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, RefreshControl, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../lib/store';
import { act, cached, createCircle, feedText, forget, getCircle, joinCircle, me, saveMe, sortTasks, type Circle, type CircleTask } from '../lib/circle';
import { saveDraft } from '../lib/capture';
import { whenLabel } from '../lib/i18n';
import { Icon } from '../components/Icon';
import { Btn, Chip, IconBtn, Press, T, toast } from '../components/ui';
import { Field } from '../components/Field';

const at = (kind: 'hour' | 'tonight' | 'tomorrow') => {
  const d = new Date();
  if (kind === 'hour') return Date.now() + 3600e3;
  if (kind === 'tonight') { d.setHours(20, 0, 0, 0); return d.getTime() > Date.now() ? d.getTime() : d.getTime() + 86400e3; }
  d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.getTime();
};

/** Circle: family and friends share jobs; one claims it with "I'll take it"; everyone sees the activity. */
export default function CircleScreen() {
  const { c, t, s, bump, pro } = useApp();
  const insets = useSafeAreaInsets();
  const [who, setWho] = useState(me());
  const [name, setName] = useState(who.name);
  const [id, setId] = useState(who.circles[0]?.id ?? '');
  const [circle, setCircle] = useState<Circle | null>(id ? cached(id) : null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [newName, setNewName] = useState(s.lang === 'bn' ? 'পরিবার' : 'Family');
  const [code, setCode] = useState('');
  const [job, setJob] = useState('');
  const [due, setDue] = useState<number | null>(null);
  const bn = s.lang === 'bn';

  const load = useCallback(async () => {
    if (!id) return;
    const r = await getCircle(id);
    if (r.circle) { setCircle(r.circle); setOffline(false); } else if (r.error === 'offline') setOffline(true);
  }, [id]);

  useFocusEffect(useCallback(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]));
  useEffect(() => { load(); }, [load]);

  const done = (r: { circle?: Circle; error?: string }) => {
    if (r.circle) { setCircle(r.circle); setId(r.circle.id); setWho(me()); }
    if (r.error) toast(r.error === 'offline' ? t.circleOffline : r.error);
  };
  async function run(f: () => Promise<{ circle?: Circle; error?: string }>) {
    setBusy(true);
    try { done(await f()); } finally { setBusy(false); }
  }
  const saveName = () => { const m = { ...me(), name: name.trim() }; saveMe(m); setWho(m); };

  function remind(task: CircleTask, when: number) {
    saveDraft(task.title, bn ? 'bn' : 'en', {
      title: task.title, area: 'family', topic: circle?.name || (bn ? 'পরিবার' : 'Family'), important: true, money: null, kind: 'task', byAi: false,
      tasks: [{ key: 'c' + task.id, title: task.title, at: when, repeat: 'none', level: 'urgent', on: true, duplicate: false }],
    }, s.escalate && pro);
    bump(); toast(t.reminderSet);
  }
  function askRemind(task: CircleTask) {
    if (task.due && task.due > Date.now()) { remind(task, task.due); return; }
    Alert.alert(t.remindMe, task.title, [
      { text: t.inHour, onPress: () => remind(task, at('hour')) },
      { text: t.tonight, onPress: () => remind(task, at('tonight')) },
      { text: t.tomorrowAm, onPress: () => remind(task, at('tomorrow')) },
    ], { cancelable: true });
  }

  const tasks = useMemo(() => sortTasks(circle?.tasks ?? []), [circle]);
  const header = (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconBtn name="left" label={t.back} onPress={() => router.back()} />
      <T kind="h2" style={{ flex: 1 }} numberOfLines={1}>{circle?.name || t.circle}</T>
      {circle ? <Chip label={t.invite} icon="share" onPress={() => {
        const msg = t.inviteText(circle.name, circle.code);
        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`).catch(() => Share.share({ message: msg }));
      }} /> : null}
    </View>
  );

  // Step 1: a name, then create or join.
  if (!who.name || !circle) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }}>
        {header}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <T kind="body" color={c.ink2}>{t.circleHint}</T>
          <Field label={t.yourName} value={name} onChange={setName} />
          {!who.name ? (
            <Btn label={t.save} icon="check" style={{ marginTop: 14 }} disabled={!name.trim()} onPress={saveName} />
          ) : (
            <>
              <T kind="label" style={{ marginTop: 24 }}>{t.newCircle}</T>
              <Field label={t.circleName} value={newName} onChange={setNewName} />
              <Btn label={t.create} icon="plus" style={{ marginTop: 12 }} disabled={busy || !newName.trim()} onPress={() => { saveName(); run(() => createCircle(newName.trim())); }} />
              <T kind="label" style={{ marginTop: 28 }}>{t.joinCode}</T>
              <Field label={t.codeHint} value={code} onChange={(v) => setCode(v.toUpperCase())} />
              <Btn label={t.join} kind="ghost" icon="user" style={{ marginTop: 12 }} disabled={busy || code.trim().length < 6} onPress={() => { saveName(); run(() => joinCircle(code.trim())); }} />
              {busy ? <ActivityIndicator style={{ marginTop: 14 }} color={c.accent} /> : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }}>
      {header}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={c.accent} />}>
        {offline ? <T kind="small" color={c.warn} style={{ marginBottom: 8 }}>{t.circleOffline}</T> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {circle.members.map((m) => (
            <View key={m.id} style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: m.id === who.id ? c.accent : c.accentSoft, justifyContent: 'center' }}>
              <T kind="small" color={m.id === who.id ? c.onAccent : c.accent} style={{ fontWeight: '700' }}>{m.id === who.id ? t.you : m.name}</T>
            </View>
          ))}
          <T kind="small" style={{ marginLeft: 4 }}>{t.inviteCode(circle.code)}</T>
        </View>

        <View style={{ marginTop: 16, padding: 12, borderRadius: 18, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }}>
          <TextInput accessibilityLabel={t.newJob} value={job} onChangeText={setJob} placeholder={t.newJob} placeholderTextColor={c.ink3}
            style={{ color: c.ink, fontSize: 16, paddingVertical: 6 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <Chip label={t.noTime} active={due === null} onPress={() => setDue(null)} />
            <Chip label={t.inHour} active={due !== null && Math.abs(due - at('hour')) < 120e3} onPress={() => setDue(at('hour'))} />
            <Chip label={t.tonight} active={due === at('tonight')} onPress={() => setDue(at('tonight'))} />
            <Chip label={t.tomorrowAm} active={due === at('tomorrow')} onPress={() => setDue(at('tomorrow'))} />
          </View>
          <Btn label={t.addJob} icon="plus" style={{ marginTop: 10 }} disabled={!job.trim() || busy}
            onPress={() => run(async () => { const r = await act(circle.id, 'add', { title: job.trim(), due }); if (r.circle) { setJob(''); setDue(null); } return r; })} />
        </View>

        <View style={{ marginTop: 16, gap: 10 }}>
          {tasks.length === 0 ? <T kind="body" color={c.ink2}>{t.noJobs}</T> : null}
          {tasks.map((x) => {
            const mine = x.claimedById === who.id;
            return (
              <View key={x.id} style={{ padding: 14, borderRadius: 18, backgroundColor: c.surface, borderWidth: mine && !x.done ? 1.5 : StyleSheet.hairlineWidth, borderColor: mine && !x.done ? c.accent : c.line, opacity: x.done ? 0.6 : 1 }}>
                <T kind="h3" style={{ textDecorationLine: x.done ? 'line-through' : 'none' }}>{x.title}</T>
                <T kind="small" style={{ marginTop: 3 }}>
                  {x.by}{x.due ? ' · ' + t.dueAt(whenLabel(x.due, s.lang)) : ''}
                </T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
                  {x.done ? (
                    <><Icon name="check" size={16} color={c.ok} /><T kind="small" color={c.ok} style={{ fontWeight: '700' }}>{t.doneBy(x.doneBy === who.name ? t.you : x.doneBy || '')}</T>
                      <Chip label="↺" onPress={() => run(() => act(circle.id, 'undo', { taskId: x.id }))} /></>
                  ) : !x.claimedById ? (
                    <Chip label={t.illTakeIt} icon="user" active onPress={() => run(() => act(circle.id, 'claim', { taskId: x.id }))} />
                  ) : mine ? (
                    <>
                      <Chip label={t.jobDone} icon="check" active onPress={() => run(() => act(circle.id, 'done', { taskId: x.id }))} />
                      <Chip label={t.remindMe} icon="bell" onPress={() => askRemind(x)} />
                      <Chip label={t.giveBack} onPress={() => run(() => act(circle.id, 'release', { taskId: x.id }))} />
                    </>
                  ) : (
                    <T kind="small" color={c.accent} style={{ fontWeight: '700' }}>{t.takenBy(x.claimedBy || '')}</T>
                  )}
                  {x.byId === who.id && !x.done ? (
                    <Press accessibilityLabel={t.delete} onPress={() => run(() => act(circle.id, 'remove', { taskId: x.id }))} style={{ marginLeft: 'auto', padding: 4 }}>
                      <Icon name="trash" size={16} color={c.ink3} />
                    </Press>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {circle.feed.length ? (
          <>
            <T kind="label" style={{ marginTop: 24, marginBottom: 8 }}>{t.activity}</T>
            {circle.feed.slice(0, 25).map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, paddingVertical: 6 }}>
                <T kind="small" style={{ width: 92 }}>{whenLabel(f.at, s.lang)}</T>
                <T kind="body" style={{ flex: 1 }}><T kind="body" style={{ fontWeight: '700' }}>{f.who === who.name ? t.you : f.who}</T> {feedText(f.text, bn)}</T>
              </View>
            ))}
          </>
        ) : null}

        <Btn label={t.leaveCircle} kind="danger" style={{ marginTop: 26 }} onPress={() => Alert.alert(t.leaveCircle, circle.name, [
          { text: t.cancel, style: 'cancel' },
          { text: t.leaveCircle, style: 'destructive', onPress: async () => { await act(circle.id, 'leave'); forget(circle.id); setCircle(null); setId(''); setWho(me()); } },
        ])} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
