// One place that talks to Google Gemini. Google retires model names (gemini-2.5-flash now
// answers 404) and the newest model is often "high demand" (503), so every call walks a
// short list: the always-current Flash alias first, then the lighter Flash-Lite alias.
import { request } from './net';

export const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

/** Saved model names from older versions point at retired models; use the current list instead. */
export const modelsFor = (saved?: string) => {
  const s = (saved || '').trim();
  const ok = s && !/^gemini-(1\.|2\.)/.test(s) && !MODELS.includes(s);
  return ok ? [s, ...MODELS] : MODELS;
};

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

/** Returns the model's JSON text, or null. `bad key` stops at once instead of trying other models. */
export async function gemini(key: string, parts: GeminiPart[], opts: { model?: string; temperature?: number; timeoutMs?: number } = {}): Promise<string | null> {
  const deadline = Date.now() + (opts.timeoutMs ?? 20000);
  for (const model of modelsFor(opts.model)) {
    const left = deadline - Date.now();
    if (left < 1500) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), left);
    try {
      const res = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.trim() },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: opts.temperature ?? 0.2 } }),
        signal: ctrl.signal,
      });
      if (res.ok) {
        const j = await res.json();
        const raw = (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
        if (raw) return raw;
        continue;
      }
      // 400/401/403 = the key itself is wrong; other models will not help.
      if ([400, 401, 403].includes(res.status)) return null;
    } catch {
      // timeout or network: try the next model while time is left
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  try { return m ? (JSON.parse(m[0]) as T) : null; } catch { return null; }
}
