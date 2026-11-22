// Asks every AI key the person saved, top to bottom, until one answers.
// Gemini uses Google's API; every other service uses the OpenAI chat format.
import { gemini, type GeminiPart } from './gemini';
import { request } from './net';
import { parseRing, pickModel, PROVIDERS, type AiKey } from './providers';

const VISION = /vision|llama-4|gpt-[45]|gpt-4o|grok-[2-9]|claude|haiku|sonnet|pixtral|qwen.*vl|gemma-3/i;
const models = new Map<string, string[]>();

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, ms));
  try { return await run(ctrl.signal); } catch { return null; } finally { clearTimeout(timer); }
}

async function chatModels(base: string, k: AiKey, vision: boolean, ms: number): Promise<string[]> {
  if (k.model) return [k.model];
  if (!models.has(base)) {
    const ids = await withTimeout(ms, async (signal) => {
      const r = await request(`${base}/models`, { headers: { Authorization: `Bearer ${k.key}`, 'x-api-key': k.key, 'anthropic-version': '2023-06-01' }, signal });
      if (!r.ok) return null;
      const j = await r.json();
      return ((j?.data ?? []) as { id: string; active?: boolean }[]).filter((m) => m.active !== false).map((m) => m.id);
    });
    if (!ids?.length) return [];
    models.set(base, ids);
  }
  let ids = models.get(base)!;
  if (vision) ids = ids.filter((id) => VISION.test(id));
  const out: string[] = [];
  const first = pickModel(k.provider, ids);
  if (first) out.push(first);
  for (const id of ids) if (out.length < 2 && !out.includes(id) && pickModel(k.provider, [id])) out.push(id);
  return out;
}

async function viaChat(k: AiKey, prompt: string, image: { base64: string; mime: string } | undefined, temperature: number, deadline: number): Promise<string | null> {
  const base = k.provider === 'custom' ? k.url ?? '' : PROVIDERS[k.provider].base;
  if (!base) return null;
  const content = image ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } }] : prompt;
  for (const model of await chatModels(base, k, !!image, Math.min(8000, deadline - Date.now()))) {
    const left = deadline - Date.now();
    if (left < 1500) return null;
    const body: Record<string, unknown> = { model, temperature, messages: [{ role: 'user', content }] };
    if (k.provider !== 'anthropic') body.response_format = { type: 'json_object' };
    const res = await withTimeout(left, async (signal) => {
      const r = await request(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k.key}` }, body: JSON.stringify(body), signal });
      if (r.status === 401 || r.status === 403) return 'bad';
      if (!r.ok) return null;
      const j = await r.json();
      return String(j?.choices?.[0]?.message?.content ?? '') || null;
    });
    if (res === 'bad') return null;
    if (res) return res;
  }
  return null;
}

/** Tries one key. Returns the model's text, or null. */
export async function askKey(k: AiKey, prompt: string, image?: { base64: string; mime: string }, opts: { model?: string; temperature?: number; timeoutMs?: number } = {}): Promise<string | null> {
  const ms = opts.timeoutMs ?? 20000;
  if (k.provider === 'gemini') {
    const parts: GeminiPart[] = [{ text: prompt }];
    if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.base64 } });
    return gemini(k.key, parts, { model: k.model ?? opts.model, temperature: opts.temperature, timeoutMs: ms });
  }
  return viaChat(k, prompt, image, opts.temperature ?? 0.2, Date.now() + ms);
}

/** `ring` is the saved key list (one key per line; an old single Gemini key still works). */
export async function askAll(ring: string, prompt: string, image?: { base64: string; mime: string }, opts: { model?: string; temperature?: number; timeoutMs?: number } = {}): Promise<string | null> {
  const keys = parseRing(ring);
  const deadline = Date.now() + (opts.timeoutMs ?? 20000);
  for (const k of keys) {
    const left = deadline - Date.now();
    if (left < 1500) break;
    // Give every key a fair share of the time, but at least 6 seconds.
    const share = Math.max(6000, Math.floor(left / Math.max(1, keys.length - keys.indexOf(k))));
    const out = await askKey(k, prompt, image, { ...opts, timeoutMs: Math.min(left, keys.length > 1 ? share : left) });
    if (out) return out;
  }
  return null;
}
