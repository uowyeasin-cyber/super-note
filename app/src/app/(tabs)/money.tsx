import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../lib/store';
import { moneySince, type MoneyEntry } from '../../lib/db';
import { toBnDigits, whenLabel } from '../../lib/i18n';
import { Icon } from '../../components/Icon';
import { Btn, Chip, Press, T } from '../../components/ui';
import { ListCard } from '../../components/rows';

const taka = (n: number, bn: boolean) => {
  const v = Math.round(n).toLocaleString('en-US');
  return '৳' + (bn ? toBnDigits(v) : v);
};

/** Money: every entry the app picked up from notes, with month and day totals, grouped by business or person. */
export default function Money() {
  const { c, t, s, version } = useApp();
  const insets = useSafeAreaInsets();
  const bn = s.lang === 'bn';
  const [range, setRange] = useState<'month' | 'today'>('month');
  const since = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (range === 'month') d.setDate(1);
    return d.getTime();
  }, [range]);
  const list = useMemo(() => { void version; return moneySince(since); }, [since, version]);
  const sum = (dir: 'in' | 'out') => list.filter((m) => m.dir === dir).reduce((a, m) => a + m.amount, 0);
  const inSum = sum('in'), outSum = sum('out');

  const groups = useMemo(() => {
    const g = new Map<string, { label: string; area: MoneyEntry['area']; topic: string; in: number; out: number }>();
    for (const m of list) {
      const label = m.party || m.topic;
      const k = label.toLowerCase();
      const v = g.get(k) ?? { label, area: m.area, topic: m.topic, in: 0, out: 0 };
      v[m.dir] += m.amount;
      g.set(k, v);
    }
    return [...g.values()].sort((a, b) => b.in + b.out - (a.in + a.out));
  }, [list]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 130 }}>
      <T kind="h1">{t.money}</T>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Chip label={t.thisMonth} active={range === 'month'} onPress={() => setRange('month')} />
        <Chip label={t.todayMoney} active={range === 'today'} onPress={() => setRange('today')} />
      </View>

      <View style={{ marginTop: 14, padding: 20, borderRadius: 22, backgroundColor: c.accent }}>
        <T kind="small" color={c.onAccent} style={{ opacity: 0.8 }}>{t.balance}</T>
        <T kind="h1" color={c.onAccent} style={{ marginTop: 2 }}>{inSum - outSum < 0 ? '−' : ''}{taka(Math.abs(inSum - outSum), bn)}</T>
        <View style={{ flexDirection: 'row', marginTop: 14, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="down" size={16} color={c.onAccent} /><T kind="body" color={c.onAccent}>{t.received} {taka(inSum, bn)}</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="up" size={16} color={c.onAccent} /><T kind="body" color={c.onAccent}>{t.spent} {taka(outSum, bn)}</T>
          </View>
        </View>
      </View>

      {list.length === 0 ? (
        <View style={{ marginTop: 16, padding: 20, borderRadius: 20, backgroundColor: c.accentSoft }}>
          <T kind="h3">{t.noMoney}</T>
          <T kind="body" color={c.ink2} style={{ marginTop: 6 }}>{t.addMoneyHint}</T>
          <Btn label={t.addEntry} icon="mic" style={{ marginTop: 14 }} onPress={() => router.push('/capture')} />
        </View>
      ) : (
        <>
          <T kind="label" style={{ marginTop: 22, marginBottom: 8 }}>{t.byFile}</T>
          <ListCard>
            {groups.map((g, i) => (
              <Press key={g.label} onPress={() => router.push({ pathname: '/file', params: { area: g.area, topic: g.topic } })}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: i === groups.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.line }}>
                <T kind="h3" style={{ flex: 1 }} numberOfLines={1}>{g.label}</T>
                {g.in ? <T kind="body" color={c.ok} style={{ fontWeight: '700' }}>+{taka(g.in, bn)} </T> : null}
                {g.out ? <T kind="body" color={c.danger} style={{ fontWeight: '700' }}> −{taka(g.out, bn)}</T> : null}
              </Press>
            ))}
          </ListCard>

          <T kind="label" style={{ marginTop: 22, marginBottom: 8 }}>{range === 'month' ? t.thisMonth : t.todayMoney}</T>
          <ListCard>
            {list.map((m, i) => (
              <Press key={m.id} onPress={() => router.push(`/note/${m.note_id}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === list.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.line }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: (m.dir === 'in' ? c.ok : c.danger) + '1f' }}>
                  <Icon name={m.dir === 'in' ? 'down' : 'up'} size={16} color={m.dir === 'in' ? c.ok : c.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <T kind="h3" numberOfLines={1}>{m.party || m.topic}</T>
                  <T kind="small">{whenLabel(m.at, s.lang)}</T>
                </View>
                <T kind="h3" color={m.dir === 'in' ? c.ok : c.danger}>{m.dir === 'in' ? '+' : '−'}{taka(m.amount, bn)}</T>
              </Press>
            ))}
          </ListCard>
        </>
      )}
    </ScrollView>
  );
}
