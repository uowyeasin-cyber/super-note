import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useApp } from '../lib/store';
import { deviceCode } from '../lib/plan';
import { Icon, type IconName } from '../components/Icon';
import { Btn, IconBtn, Press, T, toast } from '../components/ui';
import { planLabel } from '../components/PlanBadge';

type PlanId = 'monthly' | 'yearly' | 'lifetime';

export default function Upgrade() {
  const ctx = useApp();
  const { c, t, plan, pro, checkPlan } = ctx;
  const insets = useSafeAreaInsets();
  const [pick, setPick] = useState<PlanId>('yearly');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const code = deviceCode();
  const phone = (plan.contact.match(/\+?\d[\d\s-]{7,}/)?.[0] || '+60178151865').replace(/[^\d]/g, '');

  const features: [IconName, string][] = [
    ['sparkle', t.fAi], ['mic', t.fUnlimited], ['phone', t.fCall], ['alarm', t.fEscalate],
  ];

  async function activate() {
    const k = key.trim().toUpperCase();
    if (!k || busy) return;
    setBusy(true);
    const before = plan.checkedAt;
    const next = await checkPlan(k);
    setBusy(false);
    if (next.checkedAt === before) { toast(t.offline); return; }
    if (next.status === 'pro' && next.key === k) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(t.activated);
      router.back();
    } else toast(next.message || t.keyFailed);
  }

  function buy() {
    const msg = `Hi, I want Easy Life Pro (${t[pick]}). My phone code: ${code}`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconBtn name="x" label={t.cancel} onPress={() => router.back()} />
        <View style={{ paddingHorizontal: 12, height: 30, borderRadius: 999, justifyContent: 'center', backgroundColor: pro ? c.accentSoft : c.sunken }}>
          <T kind="small" color={pro ? c.accent : c.ink2} style={{ fontWeight: '700' }}>{planLabel(ctx)}</T>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={28} color={c.onAccent} />
        </View>
        <T kind="h1" style={{ marginTop: 16 }}>{t.upgradeTitle}</T>
        <T kind="body" color={c.ink2} style={{ marginTop: 6 }}>{t.upgradeSub}</T>

        <View style={{ marginTop: 20, gap: 14 }}>
          {features.map(([ic, label]) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={ic} size={17} color={c.accent} />
              </View>
              <T kind="h3" style={{ flex: 1, fontSize: 15 }}>{label}</T>
            </View>
          ))}
          <T kind="small" style={{ marginTop: 2 }}>{t.fSoon}</T>
        </View>

        <View style={{ marginTop: 24, gap: 10 }}>
          {(['yearly', 'lifetime', 'monthly'] as PlanId[]).map((id) => {
            const on = pick === id;
            return (
              <Press key={id} onPress={() => setPick(id)} style={{
                flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: c.surface,
                borderWidth: on ? 2 : StyleSheet.hairlineWidth, borderColor: on ? c.accent : c.line,
              }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? c.accent : c.ink3, alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent }} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <T kind="h3">{t[id]}</T>
                    {id === 'yearly' ? <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: c.accent }}><T kind="small" color={c.onAccent} style={{ fontWeight: '800', fontSize: 11 }}>{t.bestValue}</T></View> : null}
                  </View>
                  <T kind="small" color={c.ink2} style={{ marginTop: 2 }}>{plan.prices[id]}</T>
                </View>
              </Press>
            );
          })}
        </View>

        <Btn style={{ marginTop: 18 }} label={t.buyWhatsApp} icon="share" onPress={buy} />
        <T kind="small" style={{ marginTop: 8, textAlign: 'center' }}>{t.howToBuy}</T>

        <View style={{ marginTop: 28, padding: 16, borderRadius: 18, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }}>
          <T kind="h3">{t.haveKey}</T>
          <TextInput value={key} onChangeText={setKey} placeholder={t.keyPlaceholder} placeholderTextColor={c.ink3} autoCapitalize="characters" autoCorrect={false}
            style={{ marginTop: 10, height: 48, borderRadius: 12, backgroundColor: c.sunken, color: c.ink, paddingHorizontal: 14, fontSize: 15, letterSpacing: 1 }} />
          <Btn style={{ marginTop: 10 }} kind="ghost" label={busy ? t.activating : t.activate} disabled={!key.trim() || busy} onPress={activate} />
          <Press onPress={async () => { await Clipboard.setStringAsync(code); toast(t.copied); }} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T kind="small">{t.phoneCode}: </T>
            <T kind="small" color={c.ink} style={{ fontWeight: '700', letterSpacing: 0.5 }}>{code}</T>
            <Icon name="copy" size={13} color={c.ink3} />
          </Press>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
