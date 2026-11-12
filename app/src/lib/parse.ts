// Offline Bangla + English parser: turns one spoken sentence into tasks with times.
// Works with no internet and no AI key. The AI path (ai.ts) can refine it when a key is set.
// Pure TypeScript with no imports, so it runs in the app and in `node --test`.

export type Level = 'normal' | 'urgent' | 'critical';
export type Repeat = 'none' | 'daily' | 'weekly';

export type ParsedTask = {
  title: string;
  /** Epoch ms, or null when no time was said. */
  at: number | null;
  /** True when only a day was said ("tomorrow"), so the time is a sensible default. */
  timeGuessed: boolean;
  repeat: Repeat;
  level: Level;
  /** The original words this task came from. */
  source: string;
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export function toAsciiDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

const BN_NUM_WORDS: Record<string, number> = {
  এক: 1, দুই: 2, দু: 2, তিন: 3, চার: 4, পাঁচ: 5, ছয়: 6, সাত: 7, আট: 8, নয়: 9, দশ: 10,
  এগারো: 11, এগার: 11, বারো: 12, বার: 12, পনেরো: 15, বিশ: 20, ত্রিশ: 30, আধা: 0.5,
};
const EN_NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, half: 0.5, an: 1, a: 1,
};

const WEEKDAYS: [RegExp, number][] = [
  [/(রবিবার|রোববার|sunday|\bsun\b)/i, 0],
  [/(সোমবার|monday|\bmon\b)/i, 1],
  [/(মঙ্গলবার|tuesday|\btue\b)/i, 2],
  [/(বুধবার|wednesday|\bwed\b)/i, 3],
  [/(বৃহস্পতিবার|thursday|\bthu\b)/i, 4],
  [/(শুক্রবার|friday|\bfri\b)/i, 5],
  [/(শনিবার|saturday|\bsat\b)/i, 6],
];

const MONTHS: [RegExp, number][] = [
  [/(জানুয়ারি|জানুয়ারি|january|\bjan\b)/i, 0], [/(ফেব্রুয়ারি|ফেব্রুয়ারি|february|\bfeb\b)/i, 1],
  [/(মার্চ|march|\bmar\b)/i, 2], [/(এপ্রিল|april|\bapr\b)/i, 3], [/(মে|\bmay\b)/i, 4],
  [/(জুন|june|\bjun\b)/i, 5], [/(জুলাই|july|\bjul\b)/i, 6], [/(আগস্ট|august|\baug\b)/i, 7],
  [/(সেপ্টেম্বর|september|\bsept?\b)/i, 8], [/(অক্টোবর|october|\boct\b)/i, 9],
  [/(নভেম্বর|november|\bnov\b)/i, 10], [/(ডিসেম্বর|december|\bdec\b)/i, 11],
];

// Part of day → default hour, and how to read a bare clock hour in that part.
const PERIODS: [RegExp, number, 'am' | 'pm' | 'noon'][] = [
  [/(ভোর|dawn|fajr|ফজর)/i, 5, 'am'],
  [/(সকাল|সকালে|morning)/i, 8, 'am'],
  [/(দুপুর|দুপুরে|noon|afternoon|যোহর|জোহর)/i, 13, 'noon'],
  [/(বিকাল|বিকালে|বিকেল|বিকেলে|আসর)/i, 16, 'pm'],
  [/(সন্ধ্যা|সন্ধ্যায়|সন্ধ্যায়|evening|মাগরিব)/i, 19, 'pm'],
  [/(রাত|রাতে|tonight|night|এশা|ইশা)/i, 21, 'pm'],
];

// Words that join several tasks in one sentence.
const SPLIT = /\s*(?:[,;।]|\.(?=\s)|(?:^|\s)(?:এবং|আর|তারপর|তারপরে)(?:\s|$)|\band then\b|\band also\b|\balso\b|\bthen\b|\band\b(?=\s+(?:remind|call|pay|buy|send|meet|take|go|tell|bring|book|check)))\s*/i;

const FILLER = [
  /মনে\s*করিয়ে\s*(দিও|দিবে|দেবে|দিয়ো|দিন|দাও)/g, /মনে\s*করাও/g, /রিমাইন্ডার\s*(দাও|দিও|সেট\s*কর[োো]?)/g,
  /অ্যালার্ম\s*(দাও|দিও|সেট\s*কর[োো]?)/g, /অবশ্যই/g, /জরুরি(ভাবে)?/g, /প্লিজ|দয়া\s*করে|দয়া\s*করে/g,
  /\bremind me (to|about|that)\b/gi, /\bremind me\b/gi, /\bset (a |an )?(reminder|alarm)( to| for)?\b/gi,
  /\bplease\b/gi, /\bdon'?t let me forget( to)?\b/gi, /\bi (need|have) to\b/gi, /\bmust\b/gi,
  /\b(urgent(ly)?|important)\b/gi,
];

function pad(n: number) { return n < 10 ? '0' + n : String(n); }
export function fmtLocal(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function numFrom(word: string): number | null {
  const w = toAsciiDigits(word.trim().toLowerCase());
  if (/^\d+(\.\d+)?$/.test(w)) return parseFloat(w);
  if (w in BN_NUM_WORDS) return BN_NUM_WORDS[w];
  if (w in EN_NUM_WORDS) return EN_NUM_WORDS[w];
  return null;
}

/** Parse one task phrase. `now` is injectable for tests. */
export function parseOne(phrase: string, now: Date = new Date()): ParsedTask {
  const source = phrase.normalize('NFC').trim();
  let s = ' ' + toAsciiDigits(source) + ' ';
  const lower = s.toLowerCase();
  const cut = (re: RegExp) => { s = s.replace(re, ' '); };

  // Level
  let level: Level = 'normal';
  if (/(অবশ্যই|কোনোভাবেই\s*ভুল|কল\s*দিয়ে|ফোন\s*করে\s*জাগা|\bcritical\b|\bmust not miss\b|\bwake me\b|\bcall me\b)/i.test(lower)) level = 'critical';
  else if (/(জরুরি|ইমার্জেন্সি|ওষুধ|ঔষধ|অ্যালার্ম|এলার্ম|\burgent|\bimportant\b|\bmedicine\b|\bpill|\balarm\b)/i.test(lower)) level = 'urgent';

  // Repeat
  let repeat: Repeat = 'none';
  let weeklyDay: number | null = null;
  if (/(প্রতিদিন|রোজ|প্রত্যেক\s*দিন|\bevery\s*day\b|\bdaily\b|\beveryday\b)/i.test(lower)) {
    repeat = 'daily';
    cut(/(প্রতিদিন|রোজ|প্রত্যেক\s*দিন|\bevery\s*day\b|\bdaily\b|\beveryday\b)/gi);
  } else {
    for (const [re, wd] of WEEKDAYS) {
      const m = new RegExp('(প্রতি|প্রত্যেক|\\bevery)\\s*' + re.source, 'i');
      if (m.test(s)) { repeat = 'weekly'; weeklyDay = wd; cut(new RegExp(m.source, 'gi')); break; }
    }
  }

  const base = new Date(now.getTime());
  let day: Date | null = null; // date chosen from words
  let hour: number | null = null;
  let minute = 0;
  let relMs: number | null = null;

  // Relative: "10 মিনিট পরে", "in 2 hours", "আধা ঘণ্টা পর"
  const relBn = s.match(/(\S+)\s*(মিনিট|ঘণ্টা|ঘন্টা|দিন)\s*(পরে|পর)/);
  const relEn = s.match(/\bin\s+(\S+)\s+(minutes?|mins?|hours?|hrs?|days?)\b/i) || s.match(/\b(\S+)\s+(minutes?|mins?|hours?|days?)\s+later\b/i);
  const rel = relBn || relEn;
  if (rel) {
    const n = numFrom(rel[1]) ?? 1;
    const unit = rel[2].toLowerCase();
    const mult = /মিনিট|min/.test(unit) ? 60e3 : /ঘণ্টা|ঘন্টা|h/.test(unit) ? 3600e3 : 86400e3;
    relMs = n * mult;
    cut(new RegExp(rel[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
  }

  // Day words
  if (/(আগামী\s*পরশু|পরশু|day after tomorrow)/i.test(s)) {
    day = addDays(base, 2); cut(/(আগামী\s*পরশু|পরশু|day after tomorrow)/gi);
  } else if (/(আগামীকাল|আগামী\s*কাল|কালকে|(?:^|\s)কাল(?=\s)|\btomorrow\b|\btmrw\b)/i.test(s)) {
    day = addDays(base, 1); cut(/(আগামীকাল|আগামী\s*কাল|কালকে|(?:^|\s)কাল(?=\s)|\btomorrow\b|\btmrw\b)/gi);
  } else if (/(আজকে|আজ|\btoday\b|\btonight\b)/i.test(s)) {
    day = new Date(base); cut(/(আজকে|আজ|\btoday\b)/gi);
  }
  if (/(আগামী\s*সপ্তাহে|\bnext week\b)/i.test(s) && !day) {
    day = addDays(base, 7); cut(/(আগামী\s*সপ্তাহে|\bnext week\b)/gi);
  }
  if (!day) {
    for (const [re, wd] of WEEKDAYS) {
      const m = s.match(new RegExp('(আগামী\\s*|\\bnext\\s+|\\bon\\s+|\\bthis\\s+)?' + re.source + '(\\s*দিন)?', 'i'));
      if (m) { day = nextWeekday(base, wd); cut(new RegExp(m[0], 'gi')); break; }
    }
  }
  if (weeklyDay !== null && !day) day = nextWeekday(base, weeklyDay, true);

  // Dates: "10 ডিসেম্বর", "Dec 10", "10/12", "১০ তারিখে"
  if (!day) {
    for (const [re, mo] of MONTHS) {
      const a = s.match(new RegExp('\\b(\\d{1,2})(st|nd|rd|th)?\\s*(তারিখ|তারিখে)?\\s*' + re.source + '(\\s*মাসে?)?', 'i'));
      const b = s.match(new RegExp(re.source + '\\s+(\\d{1,2})(st|nd|rd|th)?\\b', 'i'));
      const m = a || b;
      if (m) {
        const d = parseInt(a ? a[1] : (b as RegExpMatchArray)[2], 10);
        if (d >= 1 && d <= 31) {
          day = new Date(base.getFullYear(), mo, d);
          if (startOfDay(day) < startOfDay(base)) day.setFullYear(base.getFullYear() + 1);
          cut(new RegExp(m[0], 'gi'));
          break;
        }
      }
    }
  }
  if (!day) {
    const m = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/) ;
    if (m && !/[:]/.test(m[0])) {
      const d = parseInt(m[1], 10), mo = parseInt(m[2], 10) - 1;
      if (d >= 1 && d <= 31 && mo >= 0 && mo < 12) {
        const y = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)) : base.getFullYear();
        day = new Date(y, mo, d);
        if (!m[3] && startOfDay(day) < startOfDay(base)) day.setFullYear(y + 1);
        cut(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
      }
    }
  }
  if (!day) {
    const m = s.match(/(\d{1,2})\s*(তারিখ|তারিখে)/);
    if (m) {
      const d = parseInt(m[1], 10);
      day = new Date(base.getFullYear(), base.getMonth(), d);
      if (startOfDay(day) < startOfDay(base)) day.setMonth(day.getMonth() + 1);
      cut(new RegExp(m[0], 'g'));
    }
  }

  // Part of day
  let period: 'am' | 'pm' | 'noon' | null = null;
  let periodHour: number | null = null;
  for (const [re, h, kind] of PERIODS) {
    if (re.test(s)) { period = kind; periodHour = h; cut(new RegExp(re.source, 'gi')); break; }
  }

  // Clock: "সাড়ে ৮টা", "পৌনে ৯", "সোয়া ৭", "8:30", "8 pm", "at 7", "৮টায়"
  const bnClock = s.match(/(সাড়ে|সাড়ে|পৌনে|সোয়া|সোয়া)?\s*(\d{1,2})(?::(\d{2}))?\s*(টায়|টায়|টা|টার\s*দিকে|টার|ঘটিকায়)/);
  const enClock = s.match(/\b(?:at\s+|by\s+|@\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|o'?clock)\b/i)
    || s.match(/\b(?:at|by|@)\s*(\d{1,2})(?::(\d{2}))?\b/i)
    || s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (bnClock) {
    hour = parseInt(bnClock[2], 10);
    minute = bnClock[3] ? parseInt(bnClock[3], 10) : 0;
    const q = bnClock[1] || '';
    if (/সাড়ে|সাড়ে/.test(q)) minute = 30;
    else if (/সোয়া|সোয়া/.test(q)) minute = 15;
    else if (/পৌনে/.test(q)) { hour -= 1; minute = 45; }
    cut(new RegExp(bnClock[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
  } else if (enClock) {
    hour = parseInt(enClock[1], 10);
    minute = enClock[2] ? parseInt(enClock[2], 10) : 0;
    const ap = (enClock[3] || '').toLowerCase().replace(/\./g, '');
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    if (ap === 'am' || ap === 'pm') period = null; // explicit wins
    cut(new RegExp(enClock[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
    if (ap === 'am' || ap === 'pm') periodHour = -1;
  }
  if (hour !== null && periodHour !== -1) {
    if (period === 'pm' && hour < 12) hour += 12;
    else if (period === 'noon' && hour < 11) hour += 12; // দুপুর ২টা → 14
    else if (period === 'am' && hour === 12) hour = 0;
  }

  // Compose
  let at: number | null = null;
  let timeGuessed = false;
  if (relMs !== null) {
    at = now.getTime() + relMs;
  } else if (hour !== null || day || periodHour !== null) {
    const d = day ? new Date(day) : new Date(base);
    if (hour === null) {
      hour = periodHour !== null && periodHour >= 0 ? periodHour : 9;
      minute = 0;
      timeGuessed = periodHour === null || periodHour < 0;
    }
    d.setHours(hour, minute, 0, 0);
    // No day said and no period: pick the next time this clock comes round.
    if (!day && d.getTime() <= now.getTime()) {
      if (period === null && periodHour !== -1 && hour < 12 && hour + 12 < 24) {
        const pm = new Date(d); pm.setHours(hour + 12);
        if (pm.getTime() > now.getTime()) d.setTime(pm.getTime()); else d.setDate(d.getDate() + 1);
      } else {
        d.setDate(d.getDate() + 1);
      }
    } else if (!day && period === null && periodHour !== -1 && hour >= 1 && hour <= 6) {
      // "৩টায়" with no part of day almost always means afternoon.
      d.setHours(hour + 12);
    }
    at = d.getTime();
  }

  // Title: remove filler and leftover joiners.
  for (const f of FILLER) s = s.replace(f, ' ');
  let title = s
    .replace(/\b(at|on|by|in|for|to)\s*$/i, ' ')
    .replace(/^\s*(to|that|about)\b/i, ' ')
    .replace(/(যে|কে\s+যেন|যেন)\s*$/, ' ')
    .replace(/(নোর|নো|র|এর)?\s+কথা\s*$/, (m, g) => (g === 'নোর' ? 'নো' : g === 'র' || g === 'এর' ? '' : (g || '')))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,.\-–—\s]+|[,.\-–—\s]+$/g, '');
  if (!title) title = source;
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, at, timeGuessed, repeat, level, source };
}

/** Split a sentence into task phrases and parse each. Empty pieces are dropped. */
export function parseTasks(text: string, now: Date = new Date()): ParsedTask[] {
  const parts = text
    .normalize('NFC')
    .split(SPLIT)
    .map((p) => (p || '').trim().replace(/^(এবং|আর|তারপর|and|also|then)\s+/i, '').trim())
    .filter((p) => p.length > 1);
  return parts.map((p) => parseOne(p, now));
}

/** Same task said twice? Compare words, ignoring case and punctuation. */
export function similar(a: string, b: string): boolean {
  const norm = (x: string) => toAsciiDigits(x.normalize('NFC').toLowerCase()).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const A = new Set(norm(a)), B = new Set(norm(b));
  if (!A.size || !B.size) return false;
  let both = 0;
  A.forEach((w) => { if (B.has(w)) both++; });
  return both / Math.min(A.size, B.size) >= 0.8;
}

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
function nextWeekday(from: Date, wd: number, allowToday = false) {
  const x = new Date(from);
  let diff = (wd - x.getDay() + 7) % 7;
  if (diff === 0 && !allowToday) diff = 7;
  x.setDate(x.getDate() + diff);
  return x;
}
