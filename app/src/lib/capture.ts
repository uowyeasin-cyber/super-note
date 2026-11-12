// Turns what the user said into a saved note plus armed reminders.
import { classify, type Area } from './classify';
import { parseTasks, similar, type Level, type Repeat } from './parse';
import { insertNote, insertTask, openTaskTitlesSince, uid, type Task } from './db';
import { armTask } from './alarms';
import type { AiResult } from './ai';

export type Draft = {
  title: string;
  area: Area;
  tasks: { key: string; title: string; at: number | null; repeat: Repeat; level: Level; on: boolean; duplicate: boolean }[];
  byAi: boolean;
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

export function offlineDraft(text: string, defaultLevel: Level): Draft {
  const tasks = parseTasks(text)
    .filter((p) => p.at !== null)
    .map((p) => ({ key: uid('k'), title: p.title, at: p.at, repeat: p.repeat, level: p.level === 'normal' ? defaultLevel : p.level, on: true, duplicate: false }));
  const title = tasks.length === 1 ? tasks[0].title : shortTitle(text);
  return markDuplicates({ title, area: classify(text).area, tasks, byAi: false });
}

export function aiDraft(r: AiResult, defaultLevel: Level): Draft {
  const tasks = r.tasks
    .map((x) => ({ x, ms: x.at ? Date.parse(x.at) : NaN }))
    .filter(({ ms }) => !Number.isNaN(ms))
    .map(({ x, ms }) => ({ key: uid('k'), title: x.title, at: ms, repeat: x.repeat ?? 'none', level: x.level === 'normal' ? defaultLevel : x.level ?? defaultLevel, on: true, duplicate: false }));
  return markDuplicates({ title: r.title || '', area: r.area, tasks, byAi: true });
}

export function saveDraft(text: string, lang: string, d: Draft, escalate: boolean): { noteId: string; armed: number } {
  const now = Date.now();
  const noteId = uid('n');
  insertNote({ id: noteId, text: text.trim(), title: d.title.trim() || shortTitle(text), area: d.area, lang, created: now, updated: now, pinned: 0 });
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
