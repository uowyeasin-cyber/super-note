import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useApp } from '../lib/store';
import { ACCENTS, type AccentName } from '../lib/theme';
import { askNotificationPermission, engineAvailable, engineStatus, SuperAlarm, type EngineStatus } from '../lib/alarms';
import { testKey } from '../lib/ai';
import type { Level } from '../lib/parse';
import { Icon, type IconName } from '../components/Icon';
import { Btn, Chip, IconBtn, Press, Section, T, toast } from '../components/ui';
import { needPro, planLabel, ProTag } from '../components/PlanBadge';

const PORTFOLIO = 'https://yeasinarafatbd.vercel.app/';
const SITE = 'https://yeasinarafatbd.vercel.app/easy-life/';

function Group({ children }: { children: React.ReactNode }) {
  const { c } = useApp();
  return <View style={{ backgroundColor: c.surface, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, overflow: 'hidden' }}>{children}</View>;
}

function Row({ icon, title, hint, right, onPress, last }: { icon?: IconName; title: string; hint?: string; right?: React.ReactNode; onPress?: () => void; last?: boolean }) {
  const { c } = useApp();
  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.line }}>
      {icon ? (
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={c.accent} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T kind="h3" style={{ fontSize: 15 }}>{title}</T>
        {hint ? <T kind="small" style={{ marginTop: 2 }}>{hint}</T> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? <Press onPress={onPress}>{inner}</Press> : inner;
}

export default function Settings() {
  const app = useApp();
  const { c, t, s, set, pro, plan } = app;
  const insets = useSafeAreaInsets();
  const [st, setSt] = useState<EngineStatus>(engineStatus());
  const [key, setKey] = useState(s.aiKey);
  const [checking, setChecking] = useState(false);
  const refresh = useCallback(() => setSt(engineStatus()), []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (x) => { if (x === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const status = (ok: boolean, fix: () => void) => ok
    ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="check" size={16} color={c.ok} stroke={2.4} /><T kind="small" color={c.ok}>{t.allowed}</T></View>
    : <Chip label={t.allow} active onPress={fix} />;

  const levels: Level[] = ['normal', 'urgent', 'critical'];
  const version = Constants.expoConfig?.version ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBtn name="left" label="Back" onPress={() => router.back()} />
        <T kind="h2">{t.settings}</T>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>
        <Press onPress={() => router.push('/upgrade')} style={{ marginTop: 18, borderRadius: 20, padding: 18, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#ffffff33', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkle" size={22} color={c.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <T kind="h3" color={c.onAccent}>{planLabel(app)}</T>
            <T kind="small" color={c.onAccent} style={{ opacity: 0.85, marginTop: 2 }}>{pro && plan.status === 'pro' ? t.proActive : t.upgradeSub}</T>
          </View>
          <Icon name="right" size={18} color={c.onAccent} />
        </Press>

        <Section title={t.language}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="English" active={s.lang === 'en'} onPress={() => set({ lang: 'en' })} />
            <Chip label="বাংলা" active={s.lang === 'bn'} onPress={() => set({ lang: 'bn' })} />
          </View>
          <T kind="small" style={{ marginTop: 14, marginBottom: 8 }}>{t.speakIn}</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="English" active={s.speech === 'en-US'} onPress={() => set({ speech: 'en-US' })} />
            <Chip label="বাংলা" active={s.speech === 'bn-BD'} onPress={() => set({ speech: 'bn-BD' })} />
          </View>
        </Section>

        <Section title={t.reminderEngine}>
          <T kind="small" style={{ marginBottom: 10 }}>{t.reminderEngineHint}</T>
          <Group>
            <Row icon="bell" title={t.notifications} right={status(st.notifications, async () => {
              const ok = await askNotificationPermission();
              if (!ok) SuperAlarm?.openNotificationSettings();
              refresh();
            })} />
            <Row icon="clock" title={t.exactAlarms} right={status(st.exact, () => SuperAlarm?.openExactAlarmSettings())} />
            <Row icon="phone" title={t.fullScreen} right={status(st.fullScreen, () => SuperAlarm?.openFullScreenSettings())} />
            <Row icon="shield" title={t.battery} last right={status(st.battery, () => SuperAlarm?.openBatterySettings())} />
          </Group>

          <T kind="small" style={{ marginTop: 16, marginBottom: 8 }}>{t.defaultLevel}</T>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {levels.map((l) => <Chip key={l} label={t[l] + (l === 'critical' && !pro ? ' · PRO' : '')} icon={l === 'critical' ? 'phone' : l === 'urgent' ? 'alarm' : 'bell'} active={s.defaultLevel === l} onPress={() => { if (l === 'critical' && needPro(app, toast, t.proFeature)) return; set({ defaultLevel: l }); }} />)}
          </View>
          <View style={{ marginTop: 12 }}>
            <Group>
              <Row icon="alarm" title={t.escalate} hint={t.escalateHint} last right={pro
                ? <Switch value={s.escalate} onValueChange={(v) => set({ escalate: v })} trackColor={{ true: c.accent, false: c.line }} thumbColor="#fff" />
                : <Press onPress={() => needPro(app, toast, t.proFeature)}><ProTag /></Press>} />
            </Group>
          </View>
          {engineAvailable ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {levels.map((l) => <Chip key={l} label={'▶ ' + t[l]} onPress={() => { SuperAlarm?.testRing(l); toast(t.testRing); }} />)}
            </View>
          ) : null}
        </Section>

        <Section title={t.look}>
          <T kind="small" style={{ marginBottom: 8 }}>{t.mode}</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['auto', 'light', 'dark'] as const).map((m) => <Chip key={m} label={t[m]} active={s.mode === m} onPress={() => set({ mode: m })} />)}
          </View>
          <T kind="small" style={{ marginTop: 14, marginBottom: 8 }}>{t.accent}</T>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {(Object.keys(ACCENTS) as AccentName[]).map((a) => (
              <Press key={a} accessibilityLabel={a} onPress={() => set({ accent: a })} style={{
                width: 36, height: 36, borderRadius: 18, backgroundColor: ACCENTS[a][c.dark ? 1 : 0], alignItems: 'center', justifyContent: 'center',
                borderWidth: s.accent === a ? 3 : 0, borderColor: c.surface,
              }}>
                {s.accent === a ? <Icon name="check" size={16} color={c.dark ? '#0b0f17' : '#fff'} stroke={2.6} /> : null}
              </Press>
            ))}
          </View>
        </Section>

        <Section title={t.ai}>
          <T kind="small" style={{ marginBottom: 10 }}>{t.aiHint}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, paddingHorizontal: 14, height: 50 }}>
            <Icon name="sparkle" size={18} color={s.aiKey ? c.accent : c.ink3} />
            <TextInput value={key} onChangeText={setKey} placeholder={t.aiKeyPlaceholder} placeholderTextColor={c.ink3} secureTextEntry autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: c.ink, fontSize: 15 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Btn style={{ flex: 1 }} label={checking ? '…' : t.save} disabled={checking} onPress={async () => {
              if (!key.trim()) { set({ aiKey: '' }); toast(t.aiOff); return; }
              setChecking(true);
              const ok = await testKey(key.trim(), s.aiModel);
              setChecking(false);
              if (ok) { set({ aiKey: key.trim() }); toast(t.aiOn); } else toast('Key did not work');
            }} />
            <Btn style={{ flex: 1 }} kind="ghost" label={t.getKey} onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} />
          </View>
          <T kind="small" style={{ marginTop: 8 }}>{s.aiKey || pro ? '● ' + t.aiOn + (pro && !s.aiKey ? ' · Pro' : '') : '○ ' + t.aiOff}</T>
        </Section>

        <Section title={t.privacy}>
          <Group><Row icon="shield" title={t.privacy} hint={t.privacyHint} last /></Group>
        </Section>

        <Section title={t.about}>
          <Group>
            <Row icon="grid" title={t.moreApps} hint="Amalnama · Averroes Code · Storefront Pro" onPress={() => Linking.openURL(PORTFOLIO)} right={<Icon name="right" size={18} color={c.ink3} />} />
            <Row icon="sparkle" title={`${t.appName} ${version}`} hint={t.beta} last onPress={() => Linking.openURL(SITE)} right={<Icon name="right" size={18} color={c.ink3} />} />
          </Group>
        </Section>
      </ScrollView>
    </View>
  );
}
