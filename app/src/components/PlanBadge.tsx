import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../lib/store';
import { trialDaysLeft } from '../lib/plan';
import { Icon } from './Icon';
import { Press, T } from './ui';

/** One-line plan status that opens the upgrade sheet. */
export function planLabel(ctx: ReturnType<typeof useApp>): string {
  const { plan, pro, t } = ctx;
  if (!pro) return t.freePlan;
  if (plan.status === 'trial') return t.proTrial(trialDaysLeft(plan));
  if (plan.plan === 'lifetime' || !plan.expires) return t.proLifetime;
  return t.proUntil(plan.expires);
}

export function PlanPill() {
  const ctx = useApp();
  const { c, pro, plan } = ctx;
  const strong = !pro || plan.status === 'trial';
  return (
    <Press onPress={() => router.push('/upgrade')} style={{
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8,
      paddingHorizontal: 10, height: 28, borderRadius: 999, backgroundColor: strong ? c.accentSoft : c.sunken,
    }}>
      <Icon name="sparkle" size={13} color={c.accent} />
      <T kind="small" color={c.accent} style={{ fontWeight: '700' }}>{planLabel(ctx)}</T>
    </Press>
  );
}

export function ProTag() {
  const { c } = useApp();
  return (
    <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: c.accentSoft }}>
      <T kind="small" color={c.accent} style={{ fontWeight: '800', fontSize: 11 }}>PRO</T>
    </View>
  );
}

/** Opens the upgrade sheet when a free user taps a Pro feature. */
export function needPro(ctx: { pro: boolean }, toastFn: (m: string) => void, msg: string): boolean {
  if (ctx.pro) return false;
  toastFn(msg);
  router.push('/upgrade');
  return true;
}
