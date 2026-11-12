import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../lib/store';
import { allNotes, openTasks, recentDone, type Task } from '../../lib/db';
import { toggleTask } from '../../lib/actions';
import { toBnDigits } from '../../lib/i18n';
import { Icon } from '../../components/Icon';
import { IconBtn, Press, Section, T } from '../../components/ui';
import { ListCard, NoteRow, TaskRow } from '../../components/rows';

export default function Today() {
  const { c, t, s, version, bump } = useApp();
  const insets = useSafeAreaInsets();
  const { overdue, today, later, done, notes } = useMemo(() => {
    void version;
    const now = Date.now();
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const open = openTasks();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    return {
      overdue: open.filter((x) => (x.at ?? 0) < now && x.repeat === 'none'),
      today: open.filter((x) => (x.at ?? 0) >= now && (x.at ?? 0) <= end.getTime()),
      later: open.filter((x) => (x.at ?? 0) > end.getTime()).slice(0, 6),
      done: recentDone(startToday.getTime()),
      notes: allNotes().slice(0, 4),
    };
  }, [version]);

  const h = new Date().getHours();
  const hello = h < 12 ? t.goodMorning : h < 17 ? t.goodAfternoon : t.goodEvening;
  const d = new Date();
  const dateLabel = s.lang === 'bn'
    ? `${['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'][d.getDay()]}, ${toBnDigits(d.getDate())} ${['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'][d.getMonth()]}`
    : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const count = today.length + overdue.length;
  const empty = !overdue.length && !today.length && !later.length;

  const list = (items: Task[]) => (
    <ListCard>{items.map((x, i) => <TaskRow key={x.id} task={x} last={i === items.length - 1} onToggle={() => toggleTask(x, t, bump)} />)}</ListCard>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T kind="small">{dateLabel}</T>
          <T kind="h1" style={{ marginTop: 2 }}>{hello}</T>
        </View>
        <IconBtn name="settings" label={t.settings} onPress={() => router.push('/settings')} />
      </View>

      <Press onPress={() => router.push('/capture')} style={{
        marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, padding: 8, paddingLeft: 16,
      }}>
        <View style={{ flex: 1 }}>
          <T kind="h3" color={c.ink2}>{t.sayAnything}</T>
          <T kind="small" style={{ marginTop: 2 }}>{t.sayHint}</T>
        </View>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="mic" size={22} color={c.onAccent} />
        </View>
      </Press>

      {count > 0 ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Stat n={today.length} label={t.upNext} color={c.accent} />
          <Stat n={overdue.length} label={t.overdue} color={overdue.length ? c.danger : c.ink3} />
          <Stat n={done.length} label={t.done} color={c.ok} />
        </View>
      ) : null}

      {overdue.length ? <Section title={t.overdue}>{list(overdue)}</Section> : null}
      {today.length ? <Section title={t.today}>{list(today)}</Section> : null}
      {later.length ? <Section title={t.later}>{list(later)}</Section> : null}

      {empty ? (
        <View style={{ marginTop: 28, padding: 22, borderRadius: 20, backgroundColor: c.accentSoft }}>
          <Icon name="sparkle" size={24} color={c.accent} />
          <T kind="h2" style={{ marginTop: 10 }}>{t.nothingToday}</T>
          <T kind="body" color={c.ink2} style={{ marginTop: 6 }}>{t.nothingTodayHint}</T>
        </View>
      ) : null}

      {notes.length ? (
        <Section title={t.recentNotes} right={<Press onPress={() => router.navigate('/library')}><T kind="small" color={c.accent} style={{ fontWeight: '700' }}>{t.seeAll}</T></Press>}>
          <ListCard>{notes.map((n, i) => <NoteRow key={n.id} note={n} last={i === notes.length - 1} />)}</ListCard>
        </Section>
      ) : null}
    </ScrollView>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  const { c, s } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, padding: 14 }}>
      <T kind="h2" color={color}>{s.lang === 'bn' ? toBnDigits(n) : String(n)}</T>
      <T kind="small" style={{ marginTop: 2 }}>{label}</T>
    </View>
  );
}
