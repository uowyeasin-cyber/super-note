// Offline-first storage on the phone (SQLite). Cloud sync can be added later without changing screens.
import * as SQLite from 'expo-sqlite';
import type { Area } from './classify';
import type { Level, Repeat } from './parse';

export type Kind = 'note' | 'task' | 'money' | 'class' | 'idea' | 'link' | 'photo';
export type Note = {
  id: string; text: string; title: string; area: Area; lang: string;
  created: number; updated: number; pinned: number;
  topic: string;      // the file inside the area folder ("CSE 101", "Rahim sir", "মা")
  important: number;  // 1 = needs attention
  kind: Kind;
  media: string;      // local photo or recording uri, '' if none
  url: string;        // source link, '' if none
};
export type MoneyEntry = { id: string; note_id: string; amount: number; dir: 'in' | 'out'; party: string; area: Area; topic: string; at: number };
export type Task = {
  id: string; note_id: string; title: string; at: number | null; repeat: Repeat; level: Level;
  escalate: number; done: number; done_at: number | null; created: number; area: Area;
};

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (db) return db;
  db = SQLite.openDatabaseSync('easylife.db');
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL, text TEXT NOT NULL, title TEXT NOT NULL, area TEXT NOT NULL,
      lang TEXT NOT NULL DEFAULT 'en', created INTEGER NOT NULL, updated INTEGER NOT NULL, pinned INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL, note_id TEXT NOT NULL, title TEXT NOT NULL, at INTEGER, repeat TEXT NOT NULL DEFAULT 'none',
      level TEXT NOT NULL DEFAULT 'normal', escalate INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0,
      done_at INTEGER, created INTEGER NOT NULL, area TEXT NOT NULL DEFAULT 'personal'
    );
    CREATE INDEX IF NOT EXISTS tasks_at ON tasks(at);
    CREATE INDEX IF NOT EXISTS tasks_note ON tasks(note_id);
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS money (
      id TEXT PRIMARY KEY NOT NULL, note_id TEXT NOT NULL, amount REAL NOT NULL, dir TEXT NOT NULL, party TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT 'business', topic TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS money_at ON money(at);
  `);
  // Columns added in 0.2: older installs get them here (ALTER fails harmlessly when present).
  for (const col of ["topic TEXT NOT NULL DEFAULT ''", 'important INTEGER NOT NULL DEFAULT 0', "kind TEXT NOT NULL DEFAULT 'note'", "media TEXT NOT NULL DEFAULT ''", "url TEXT NOT NULL DEFAULT ''"]) {
    try { db.execSync(`ALTER TABLE notes ADD COLUMN ${col}`); } catch {}
  }
  return db;
}

export function uid(prefix = ''): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function kvGet(k: string): string | null {
  return getDb().getFirstSync<{ v: string }>('SELECT v FROM kv WHERE k = ?', k)?.v ?? null;
}
export function kvSet(k: string, v: string) {
  getDb().runSync('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v);
}

export function insertNote(n: Note) {
  getDb().runSync('INSERT INTO notes (id, text, title, area, lang, created, updated, pinned, topic, important, kind, media, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    n.id, n.text, n.title, n.area, n.lang, n.created, n.updated, n.pinned, n.topic, n.important, n.kind, n.media, n.url);
}
export function setNoteFile(id: string, area: Area, topic: string) {
  getDb().runSync('UPDATE notes SET area = ?, topic = ?, updated = ? WHERE id = ?', area, topic, Date.now(), id);
  getDb().runSync('UPDATE tasks SET area = ? WHERE note_id = ?', area, id);
  getDb().runSync('UPDATE money SET area = ?, topic = ? WHERE note_id = ?', area, topic, id);
}
/** Every file (area + topic) with its note count, newest first. */
export function files(): { area: Area; topic: string; count: number; last: number }[] {
  return getDb().getAllSync<{ area: Area; topic: string; count: number; last: number }>(
    "SELECT area, topic, COUNT(*) AS count, MAX(created) AS last FROM notes WHERE topic != '' GROUP BY area, topic ORDER BY last DESC");
}
export function notesInFile(area: Area, topic: string): Note[] {
  return getDb().getAllSync<Note>('SELECT * FROM notes WHERE area = ? AND topic = ? ORDER BY created DESC', area, topic);
}
export function insertMoney(m: MoneyEntry) {
  getDb().runSync('INSERT INTO money (id, note_id, amount, dir, party, area, topic, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    m.id, m.note_id, m.amount, m.dir, m.party, m.area, m.topic, m.at);
}
export function moneySince(since: number): MoneyEntry[] {
  return getDb().getAllSync<MoneyEntry>('SELECT * FROM money WHERE at >= ? ORDER BY at DESC', since);
}
export function moneyInFile(area: Area, topic: string): MoneyEntry[] {
  return getDb().getAllSync<MoneyEntry>('SELECT * FROM money WHERE area = ? AND topic = ? ORDER BY at DESC', area, topic);
}
export function deleteMoney(id: string) {
  getDb().runSync('DELETE FROM money WHERE id = ?', id);
}
export function insertTask(t: Task) {
  getDb().runSync('INSERT INTO tasks (id, note_id, title, at, repeat, level, escalate, done, done_at, created, area) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    t.id, t.note_id, t.title, t.at, t.repeat, t.level, t.escalate, t.done, t.done_at, t.created, t.area);
}
export function updateNoteArea(id: string, area: Area) {
  getDb().runSync('UPDATE notes SET area = ?, updated = ? WHERE id = ?', area, Date.now(), id);
  getDb().runSync('UPDATE tasks SET area = ? WHERE note_id = ?', area, id);
}
export function updateNote(id: string, title: string, text: string) {
  getDb().runSync('UPDATE notes SET title = ?, text = ?, updated = ? WHERE id = ?', title, text, Date.now(), id);
}
export function setTaskDone(id: string, done: boolean) {
  getDb().runSync('UPDATE tasks SET done = ?, done_at = ? WHERE id = ?', done ? 1 : 0, done ? Date.now() : null, id);
}
export function setTaskTime(id: string, at: number) {
  getDb().runSync('UPDATE tasks SET at = ?, done = 0, done_at = NULL WHERE id = ?', at, id);
}
export function deleteNote(id: string) {
  getDb().runSync('DELETE FROM tasks WHERE note_id = ?', id);
  getDb().runSync('DELETE FROM money WHERE note_id = ?', id);
  getDb().runSync('DELETE FROM notes WHERE id = ?', id);
}

export function allNotes(): Note[] {
  return getDb().getAllSync<Note>('SELECT * FROM notes ORDER BY pinned DESC, created DESC');
}
export function getNote(id: string): Note | null {
  return getDb().getFirstSync<Note>('SELECT * FROM notes WHERE id = ?', id);
}
export function tasksForNote(id: string): Task[] {
  return getDb().getAllSync<Task>('SELECT * FROM tasks WHERE note_id = ? ORDER BY at IS NULL, at', id);
}
export function getTask(id: string): Task | null {
  return getDb().getFirstSync<Task>('SELECT * FROM tasks WHERE id = ?', id);
}
export function openTasks(): Task[] {
  return getDb().getAllSync<Task>('SELECT * FROM tasks WHERE done = 0 AND at IS NOT NULL ORDER BY at');
}
export function recentDone(since: number): Task[] {
  return getDb().getAllSync<Task>('SELECT * FROM tasks WHERE done = 1 AND done_at >= ? ORDER BY done_at DESC', since);
}
export function openTaskTitlesSince(since: number): Task[] {
  return getDb().getAllSync<Task>('SELECT * FROM tasks WHERE done = 0 AND created >= ?', since);
}
