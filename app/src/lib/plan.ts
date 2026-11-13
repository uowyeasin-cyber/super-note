// Free plan + Pro. Every phone gets a Pro trial; after it, the app stays free with limits.
// The owner controls trials, keys, renewals and blocks from the licence page on the website.
import * as Application from 'expo-application';
import { getDb, kvGet, kvSet } from './db';

export const LICENSE_API = 'https://yeasinarafatbd.vercel.app/api/license?app=easylife';
export const FREE_NOTES_PER_DAY = 15;
const DAY = 86400000;
const GRACE_DAYS = 3;

export type PlanState = {
  key: string;              // licence key the buyer typed, '' if none
  status: 'trial' | 'pro' | 'free';
  plan: string;             // lifetime | monthly | yearly (for pro)
  expires: string;          // YYYY-MM-DD or ''
  trialDays: number;        // trial length from the server, default 14
  firstRun: number;         // ms
  checkedAt: number;        // last successful server check
  message: string;          // server message when a key did not work
  prices: { monthly: string; yearly: string; lifetime: string };
  contact: string;
};

const DEFAULT: PlanState = {
  key: '', status: 'trial', plan: '', expires: '', trialDays: 14, firstRun: 0, checkedAt: 0, message: '',
  prices: { monthly: '৳149 a month', yearly: '৳1,490 a year', lifetime: '৳596 once' }, contact: 'WhatsApp +60178151865',
};

export function loadPlan(): PlanState {
  let p: PlanState = DEFAULT;
  try { const raw = kvGet('plan'); if (raw) p = { ...DEFAULT, ...JSON.parse(raw) }; } catch {}
  if (!p.firstRun) { p = { ...p, firstRun: Date.now() }; savePlan(p); }
  return p;
}
export function savePlan(p: PlanState) { kvSet('plan', JSON.stringify(p)); }

/** Short code that identifies this phone to the owner. Survives reinstalling the app. */
export function deviceCode(): string {
  let id = '';
  try { id = Application.getAndroidId() || ''; } catch {}
  if (!id) {
    id = kvGet('device') || Math.random().toString(16).slice(2, 18);
    kvSet('device', id);
  }
  return id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
}

export function trialDaysLeft(p: PlanState, now = Date.now()): number {
  return Math.max(0, Math.ceil((p.firstRun + p.trialDays * DAY - now) / DAY));
}

/** True when Pro features are on: a valid key, or the trial still running. Works offline. */
export function isPro(p: PlanState, now = Date.now()): boolean {
  if (p.status === 'pro') {
    if (!p.expires || p.plan === 'lifetime') return true;
    return now <= new Date(p.expires + 'T23:59:59').getTime() + GRACE_DAYS * DAY;
  }
  if (p.status === 'trial') return trialDaysLeft(p, now) > 0;
  return false;
}

/** Ask the website for this phone's plan. Offline or errors keep the last known state. */
export async function refreshPlan(p: PlanState, key = p.key): Promise<PlanState> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const [check, info] = await Promise.all([
      fetch(LICENSE_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, host: deviceCode() }), signal: ctrl.signal }).then((r) => r.json()),
      fetch(LICENSE_API + '&a=info', { signal: ctrl.signal }).then((r) => r.json()).catch(() => null),
    ]);
    const next: PlanState = { ...p, key, checkedAt: Date.now(), message: '' };
    if (info?.prices) next.prices = { ...p.prices, ...info.prices };
    if (info?.contact) next.contact = info.contact;
    if (typeof info?.days === 'number') next.trialDays = info.days;
    if (check.status === 'active') {
      if (key) Object.assign(next, { status: 'pro', plan: check.plan || 'lifetime', expires: check.expires || '' });
      else Object.assign(next, { status: 'pro', plan: 'lifetime', expires: '' }); // owner switched the lock off
    } else if (check.status === 'trial') {
      next.status = 'trial';
      if (check.left && typeof check.left.days === 'number') next.firstRun = Date.now() - (next.trialDays - check.left.days) * DAY;
    } else {
      next.status = key ? 'free' : trialDaysLeft(next) > 0 ? 'trial' : 'free';
      if (!key) next.firstRun = Math.min(next.firstRun, Date.now() - next.trialDays * DAY);
      next.message = key ? String(check.message || '') : '';
      if (key) next.key = p.status === 'pro' && p.key !== key ? p.key : key;
    }
    savePlan(next);
    return next;
  } catch {
    return p;
  } finally {
    clearTimeout(timer);
  }
}

export function notesToday(): number {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM notes WHERE created >= ?', start.getTime())?.n ?? 0;
}

/** Pro AI through the website, using the owner's AI key. */
export async function proAiRead(text: string, p: PlanState): Promise<unknown | null> {
  const now = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const off = -now.getTimezoneOffset();
  const iso = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}T${p2(now.getHours())}:${p2(now.getMinutes())}:00${off >= 0 ? '+' : '-'}${p2(Math.floor(Math.abs(off) / 60))}:${p2(Math.abs(off) % 60)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(LICENSE_API + '&a=ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ key: p.key, host: deviceCode(), text, now: iso, weekday: now.toLocaleDateString('en-US', { weekday: 'long' }) }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
