// Circle client: family/friends share jobs; one taps "I'll take it", everyone sees who is doing what.
import { request } from './net';
import { kvGet, kvSet } from './db';

export const CIRCLE_API = 'https://yeasinarafatbd.vercel.app/api/circle';

export type CircleTask = { id: string; title: string; by: string; byId: string; created: number; due: number | null; claimedBy: string | null; claimedById: string | null; done: boolean; doneBy?: string | null };
export type Circle = { id: string; code: string; name: string; members: { id: string; name: string }[]; tasks: CircleTask[]; feed: { at: number; who: string; text: string }[]; updated: number };
type Me = { id: string; name: string; circles: { id: string; name: string }[] };

export function me(): Me {
  try {
    const v = JSON.parse(kvGet('circle-me') || '');
    if (v?.id) return { circles: [], ...v };
  } catch {}
  const fresh = { id: Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('') + Date.now().toString(16), name: '', circles: [] };
  kvSet('circle-me', JSON.stringify(fresh));
  return fresh;
}
export function saveMe(m: Me) { kvSet('circle-me', JSON.stringify(m)); }
export function cached(id: string): Circle | null { try { return JSON.parse(kvGet('circle-' + id) || 'null'); } catch { return null; } }

function remember(c: Circle) {
  kvSet('circle-' + c.id, JSON.stringify(c));
  const m = me();
  if (!m.circles.some((x) => x.id === c.id)) saveMe({ ...m, circles: [...m.circles, { id: c.id, name: c.name }] });
}

async function call(a: string, body: Record<string, unknown>): Promise<{ circle?: Circle; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await request(`${CIRCLE_API}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (j.circle) remember(j.circle);
    return r.ok ? j : { circle: j.circle, error: j.error || 'Error' };
  } catch {
    return { error: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

const member = () => { const m = me(); return { id: m.id, name: m.name }; };
export const createCircle = (name: string) => call('create', { name, member: member() });
export const joinCircle = (code: string) => call('join', { code, member: member() });
export const getCircle = (id: string) => call('get', { id, m: me().id });
export const act = (id: string, op: string, extra: Record<string, unknown> = {}) => call('act', { id, m: me().id, op, ...extra });
export function forget(id: string) { const m = me(); saveMe({ ...m, circles: m.circles.filter((x) => x.id !== id) }); }

/** Pure: jobs for the screen, open ones first (unclaimed, then soonest due), done ones last. */
export function sortTasks(tasks: CircleTask[]): CircleTask[] {
  const rank = (t: CircleTask) => (t.done ? 2 : t.claimedById ? 1 : 0);
  return [...tasks].sort((a, b) => rank(a) - rank(b) || (a.due ?? 9e15) - (b.due ?? 9e15) || b.created - a.created);
}

/** Pure: the server writes activity in English; show it in Bangla when the app is in Bangla. */
export function feedText(text: string, bn: boolean): string {
  if (!bn) return text;
  const rules: [RegExp, string][] = [
    [/^added “(.+)”$/, '“$1” যোগ করেছে'], [/^will do “(.+)”$/, '“$1” করবে বলে নিয়েছে'], [/^gave back “(.+)”$/, '“$1” ফেরত দিয়েছে'],
    [/^finished “(.+)” ✓$/, '“$1” করে ফেলেছে ✓'], [/^removed “(.+)”$/, '“$1” মুছে দিয়েছে'], [/^joined$/, 'যোগ দিয়েছে'], [/^left$/, 'চলে গেছে'],
    [/^created the circle$/, 'সার্কেলটা বানিয়েছে'],
  ];
  for (const [re, to] of rules) if (re.test(text)) return text.replace(re, to);
  return text;
}
