// Optional AI: reads a note with Google Gemini when the user adds their own key.
// Any failure falls back to the offline parser, so saving never depends on the network.
import { AREAS, type Area } from './classify';
import { gemini, parseJson } from './gemini';
import type { Level, Repeat } from './parse';

export type AiResult = {
  area: Area;
  topic?: string;
  important?: boolean;
  title: string;
  tasks: { title: string; at: string | null; repeat: Repeat; level: Level }[];
  points?: string[];
};

export const DEFAULT_MODEL = 'gemini-flash-latest';

function localIso(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00${sign}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

export async function aiRead(text: string, key: string, model = DEFAULT_MODEL, timeoutMs = 9000, fileNames: string[] = []): Promise<AiResult | null> {
  if (!key.trim()) return null;
  const now = new Date();
  const prompt = `You organise a personal note app. The user may speak Bangla, English or both.
Now is ${localIso(now)} (${now.toLocaleDateString('en-US', { weekday: 'long' })}).
Read the note and return JSON only:
{"area": one of ${JSON.stringify(AREAS)},
 "topic": the exact file inside that area: the course code, subject, teacher ("Rahim sir"), family member, friend, client or business the note is about.
   Reuse one of these existing files when it fits, spelled exactly: ${JSON.stringify(fileNames.slice(0, 80))}. Otherwise a short new name in the note's language, or "General".
 "important": true if it needs attention (deadline, exam, money, medicine, bills), false for ideas and small talk,
 "title": short title in the note's own language (max 8 words),
 "points": the note rewritten as short, clear bullet points in the note's own language (fix speech-to-text mistakes, keep every fact, number, name and date; 1 point for a one-line note, up to 10 for long ones),
 "tasks": [{"title": short action in the note's language, "at": ISO 8601 local time with offset or null, "repeat": "none"|"daily"|"weekly", "level": "normal"|"urgent"|"critical"}]}
Rules: one task per separate thing to do that has a time or day; if only a day is given use 09:00; bare hours 1-6 mean PM;
medicine and bills are "urgent"; "must/অবশ্যই/wake me" is "critical"; ideas and plain notes have no tasks.
Note: ${JSON.stringify(text)}`;
  const o = parseJson<AiResult>(await gemini(key, [{ text: prompt }], { model, temperature: 0.1, timeoutMs }));
  if (!o || typeof o !== 'object') return null;
  if (!AREAS.includes(o.area)) o.area = 'personal';
  if (!Array.isArray(o.tasks)) o.tasks = [];
  if (!Array.isArray(o.points)) o.points = [];
  return o;
}

export async function testKey(key: string, model = DEFAULT_MODEL): Promise<boolean> {
  const r = await aiRead('Test: call Rafi tomorrow at 7 pm', key, model, 25000);
  return !!r;
}
