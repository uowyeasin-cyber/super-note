// Optional AI: reads a note with Google Gemini when the user adds their own key.
// Any failure falls back to the offline parser, so saving never depends on the network.
import { AREAS, type Area } from './classify';
import type { Level, Repeat } from './parse';

export type AiResult = {
  area: Area;
  title: string;
  tasks: { title: string; at: string | null; repeat: Repeat; level: Level }[];
};

export const DEFAULT_MODEL = 'gemini-2.5-flash';

function localIso(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00${sign}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

export async function aiRead(text: string, key: string, model = DEFAULT_MODEL, timeoutMs = 9000): Promise<AiResult | null> {
  if (!key.trim()) return null;
  const now = new Date();
  const prompt = `You organise a personal note app. The user may speak Bangla, English or both.
Now is ${localIso(now)} (${now.toLocaleDateString('en-US', { weekday: 'long' })}).
Read the note and return JSON only:
{"area": one of ${JSON.stringify(AREAS)}, "title": short title in the note's own language (max 8 words),
 "tasks": [{"title": short action in the note's language, "at": ISO 8601 local time with offset or null, "repeat": "none"|"daily"|"weekly", "level": "normal"|"urgent"|"critical"}]}
Rules: one task per separate thing to do that has a time or day; if only a day is given use 09:00; bare hours 1-6 mean PM;
medicine and bills are "urgent"; "must/অবশ্যই/wake me" is "critical"; ideas and plain notes have no tasks.
Note: ${JSON.stringify(text)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.trim() },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    const raw = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof raw !== 'string') return null;
    const o = JSON.parse(raw);
    if (!AREAS.includes(o.area)) o.area = 'personal';
    if (!Array.isArray(o.tasks)) o.tasks = [];
    return o as AiResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function testKey(key: string, model = DEFAULT_MODEL): Promise<boolean> {
  const r = await aiRead('Test: call Rafi tomorrow at 7 pm', key, model, 12000);
  return !!r;
}
