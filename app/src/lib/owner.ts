// The app owner signs in once (website admin email + password); after that the app keeps
// the server's AI keys the same as the keys saved here, so Pro users always have AI.
import { kvGet, kvSet } from './db';
import { request } from './net';
import { LICENSE_API } from './plan';

const TOKEN = 'owner.token';
export type ServerKey = { provider: string; key: string; model: string };

export const ownerToken = () => kvGet(TOKEN) || '';

async function post(a: string, body: unknown): Promise<{ status: number; j: any } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await request(`${LICENSE_API}&a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    return { status: r.status, j: await r.json().catch(() => ({})) };
  } catch { return null; } finally { clearTimeout(timer); }
}

/** 'ok', 'wrong' (bad email/password) or 'offline'. */
export async function ownerSignIn(email: string, password: string): Promise<'ok' | 'wrong' | 'offline'> {
  const r = await post('owner', { email: email.trim(), password });
  if (!r) return 'offline';
  if (r.status === 200 && r.j?.token) { kvSet(TOKEN, String(r.j.token)); return 'ok'; }
  return r.status === 401 ? 'wrong' : 'offline';
}

export const ownerSignOut = () => kvSet(TOKEN, '');

/** Sends the key list to the server (or only reads it when `ring` is undefined). Null = failed. */
export async function syncKeys(ring?: string): Promise<ServerKey[] | null> {
  const token = ownerToken();
  if (!token) return null;
  const r = await post('aikeys', ring === undefined ? { token } : { token, ring });
  if (r?.status === 401) ownerSignOut();
  return r?.status === 200 && Array.isArray(r.j?.keys) ? r.j.keys : null;
}
