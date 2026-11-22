// Turns what the user said into a saved note plus armed reminders.
import { bulletPoints, tidyText } from './points';
import { type Area } from './classify';
import { parseTasks, similar, type Level, type Repeat } from './parse';
import { allNotes, files, getDb, insertMoney, insertNote, insertTask, openTaskTitlesSince, uid, type Kind, type Task } from './db';
import { organize, type Money } from './organize';
import { armTask } from './alarms';
import type { AiResult } from './ai';

export type Draft = {
  title: string;
  area: Area;
  topic: string;          // the file the note goes into
  important: boolean;
  money: Money | null;
  kind: Kind;
  media?: string;
  url?: string;
  tasks: { key: string; title: string; at: number | null; repeat: Repeat; level: Level; on: boolean; duplicate: boolean }[];
  byAi: boolean;
  points: string[];       // the note as short bullet points (AI, or the offline splitter)
};

function shortTitle(text: string) {
  const first = text.split(/[\n।.!?]/)[0].trim();
  const words = first.split(/\s+/);
  return words.length > 8 ? words.slice(0, 8).join(' ') + '…' : first;
}

function markDuplicates(d: Draft): Draft {
  const recent = openTaskTitlesSince(Date.now() - 14 * 86400000);
  for (const t of d.tasks) {
    t.duplicate = recent.some((r) => similar(r.title, t.title) && (r.at === null || t.at === null || Math.abs((r.at ?? 0) - (t.at ?? 0)) < 45 * 60000));
    if (t.duplicate) t.on = false;
  }
  return d;
}

const GENERIC = /^(general|সাধারণ|accounts|হিসাব)$/i;

/**
 * Picks the exact file for a note. If the note names a file that already exists
 * ("CSE 101", "Rahim sir", "Rafi"), it goes there, even across folders; otherwise the
 * organiser's own guess. Same file = same place, so a subject's notes stay together.
 */
export function chooseFile(text: string, guess: { area: Area; topic: string }, existing = files()): { area: Area; topic: string } {
  const low = text.normalize('NFC').toLowerCase();
  const named = existing
    .filter((f) => !GENERIC.test(f.topic) && f.topic.length >= 2 && low.includes(f.topic.toLowerCase()))
    .sort((a, b) => b.topic.length - a.topic.length || b.count - a.count);
  if (named.length) {
    const same = named.find((f) => f.area === guess.area);
    return same ?? named[0];
  }
  // Same topic name already used in this area with different case/spelling of spaces.
  const same = existing.find((f) => f.area === guess.area && f.topic.toLowerCase().replace(/\s+/g, '') === guess.topic.toLowerCase().replace(/\s+/g, ''));
  return same ? { area: same.area, topic: same.topic } : guess;
}

export function offlineDraft(text: string, defaultLevel: Level, extra: { kind?: Kind; media?: string; url?: string; areaHint?: Area; topicHint?: string } = {}): Draft {
  const tasks = parseTasks(text)
    .filter((p) => p.at !== null)
    .map((p) => ({ key: uid('k'), title: p.title, at: p.at, repeat: p.repeat, level: p.level === 'normal' ? defaultLevel : p.level, on: true, duplicate: false }));
  const title = tasks.length === 1 ? tasks[0].title : shortTitle(text);
  const o = organize(text, { hasTimedTask: tasks.length > 0, areaHint: extra.areaHint ?? null });
  const file = extra.topicHint ? { area: extra.areaHint ?? o.area, topic: extra.topicHint } : chooseFile(text, o);
  const kind: Kind = extra.kind ?? (o.money ? 'money' : tasks.length ? 'task' : o.later ? 'idea' : 'note');
  return markDuplicates({ title, area: file.area, topic: file.topic, important: o.important, money: o.money, kind, media: extra.media, url: extra.url, tasks, byAi: false, points: bulletPoints(text) });
}

/** `keepFile`: the person picked the file (opened from a file or class), so the AI may not move it. */
export function aiDraft(r: AiResult, defaultLevel: Level, base: Draft, keepFile = false): Draft {
  const tasks = r.tasks
    .map((x) => ({ x, ms: x.at ? Date.parse(x.at) : NaN }))
    .filter(({ ms }) => !Number.isNaN(ms))
    .map(({ x, ms }) => ({ key: uid('k'), title: x.title, at: ms, repeat: x.repeat ?? 'none', level: x.level === 'normal' ? defaultLevel : x.level ?? defaultLevel, on: true, duplicate: false }));
  const topic = (r.topic || '').trim();
  const file = keepFile ? { area: base.area, topic: base.topic } : topic ? chooseFile(topic + ' ' + r.title, { area: r.area, topic }) : { area: r.area, topic: base.topic };
  return markDuplicates({
    ...base, title: r.title || base.title, area: file.area, topic: file.topic,
    important: typeof r.important === 'boolean' ? r.important || tasks.length > 0 : base.important,
    kind: base.kind === 'note' && tasks.length ? 'task' : base.kind, tasks, byAi: true,
    points: Array.isArray(r.points) && r.points.length > 1 ? r.points.map(String).filter(Boolean).slice(0, 15) : base.points,
  });
}

export function saveDraft(text: string, lang: string, d: Draft, escalate: boolean): { noteId: string; armed: number } {
  const now = Date.now();
  const noteId = uid('n');
  insertNote({
    id: noteId, text: tidyText(text, d.points ?? [], lang === 'bn'), title: d.title.trim() || shortTitle(text), area: d.area, lang, created: now, updated: now, pinned: 0,
    topic: d.topic, important: d.important ? 1 : 0, kind: d.kind, media: d.media ?? '', url: d.url ?? '',
  });
  if (d.money) insertMoney({ id: uid('m'), note_id: noteId, amount: d.money.amount, dir: d.money.dir, party: d.money.party, area: d.area, topic: d.topic, at: now });
  let armed = 0;
  for (const x of d.tasks) {
    if (!x.on) continue;
    const t: Task = {
      id: uid('t'), note_id: noteId, title: x.title, at: x.at, repeat: x.repeat, level: x.level,
      escalate: escalate && x.level !== 'critical' ? 1 : 0, done: 0, done_at: null, created: now, area: d.area,
    };
    insertTask(t);
    armTask(t, d.title !== x.title ? d.title : '');
    armed++;
  }
  return { noteId, armed };
}

/** Notes saved before files existed get one now (runs once per install). */
export function backfillFiles() {
  try {
    for (const n of allNotes()) {
      if (n.topic) continue;
      const o = organize(n.text, { areaHint: n.area });
      getDb().runSync('UPDATE notes SET topic = ?, important = ? WHERE id = ?', o.topic, o.important ? 1 : 0, n.id);
    }
  } catch {}
}
