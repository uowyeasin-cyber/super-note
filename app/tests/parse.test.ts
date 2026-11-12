import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTasks, parseOne, fmtLocal, similar } from '../src/lib/parse.ts';

// Thursday 12 Nov 2026, 10:00 local.
const NOW = new Date(2026, 10, 12, 10, 0, 0);
const at = (t: { at: number | null }) => (t.at === null ? null : fmtLocal(t.at));

test('Bangla: tomorrow morning at 8 with medicine is urgent', () => {
  const t = parseOne('কাল সকাল ৮টায় মাকে ওষুধ খাওয়ানোর কথা মনে করিয়ে দিও', NOW);
  assert.equal(at(t), '2026-11-13 08:00');
  assert.equal(t.level, 'urgent');
  assert.match(t.title, /মাকে ওষুধ/);
  assert.doesNotMatch(t.title, /মনে করিয়ে/);
});

test('Bangla: two tasks in one sentence', () => {
  const ts = parseTasks('আজ বিকাল ৪টায় ব্যাংকে যাব, আর শুক্রবার দোকান ভাড়া দিতে হবে', NOW);
  assert.equal(ts.length, 2);
  assert.equal(at(ts[0]), '2026-11-12 16:00');
  assert.equal(at(ts[1]), '2026-11-13 09:00');
  assert.equal(ts[1].timeGuessed, true);
});

test('Bangla: সাড়ে and পৌনে', () => {
  assert.equal(at(parseOne('রাত সাড়ে ৯টায় পড়তে বসব', NOW)), '2026-11-12 21:30');
  assert.equal(at(parseOne('সন্ধ্যা পৌনে ৭টায় মিটিং', NOW)), '2026-11-12 18:45');
});

test('Bangla: relative minutes and hours', () => {
  assert.equal(at(parseOne('১০ মিনিট পরে চা নামাতে হবে', NOW)), '2026-11-12 10:10');
  assert.equal(at(parseOne('২ ঘণ্টা পর কল দিতে হবে', NOW)), '2026-11-12 12:00');
});

test('Bangla: every day repeats', () => {
  const t = parseOne('প্রতিদিন রাত ১০টায় ওষুধ', NOW);
  assert.equal(t.repeat, 'daily');
  assert.equal(at(t), '2026-11-12 22:00');
});

test('Bangla: date with month', () => {
  const t = parseOne('১০ ডিসেম্বর টিউশন ফি দিতে হবে', NOW);
  assert.equal(at(t), '2026-12-10 09:00');
});

test('Bangla: critical words', () => {
  assert.equal(parseOne('অবশ্যই কাল ভোর ৫টায় উঠতে হবে', NOW).level, 'critical');
});

test('Bangla: bare afternoon hour means pm', () => {
  assert.equal(at(parseOne('৩টায় ক্লায়েন্ট মিটিং', NOW)), '2026-11-12 15:00');
});

test('English: tomorrow 7 pm and multiple tasks', () => {
  const ts = parseTasks('Remind me to call Rafi tomorrow at 7 pm and pay the electricity bill on Saturday', NOW);
  assert.equal(ts.length, 2);
  assert.equal(at(ts[0]), '2026-11-13 19:00');
  assert.match(ts[0].title, /call Rafi/i);
  assert.equal(at(ts[1]), '2026-11-14 09:00');
  assert.match(ts[1].title, /pay the electricity bill/i);
});

test('English: in 30 minutes', () => {
  assert.equal(at(parseOne('take the pizza out in 30 minutes', NOW)), '2026-11-12 10:30');
});

test('English: past clock today rolls forward', () => {
  assert.equal(at(parseOne('meeting at 9', NOW)), '2026-11-12 21:00');
  assert.equal(at(parseOne('gym at 6:30 am', NOW)), '2026-11-13 06:30');
});

test('English: every Friday is weekly', () => {
  const t = parseOne('every friday 8 pm family call', NOW);
  assert.equal(t.repeat, 'weekly');
  assert.equal(at(t), '2026-11-13 20:00');
});

test('No time stays a plain note', () => {
  const t = parseOne('idea: a Bangla flashcard app', NOW);
  assert.equal(t.at, null);
});

test('similar catches duplicates', () => {
  assert.equal(similar('Pay shop rent', 'pay the shop rent'), true);
  assert.equal(similar('Pay shop rent', 'Call Rafi'), false);
});

import { classify } from '../src/lib/classify.ts';
test('classify sorts into life areas', () => {
  assert.equal(classify('মাকে ওষুধ খাওয়ানো').area, 'family');
  assert.equal(classify('দোকান ভাড়া দিতে হবে').area, 'business');
  assert.equal(classify('Accounting class quiz on Monday').area, 'academic');
  assert.equal(classify('Practice coding for an hour').area, 'skills');
  assert.equal(classify('Rafi birthday party').area, 'social');
});

test('precomposed Bangla letters from speech still match', () => {
  const t = parseOne('কাল সকালে মায়ের ওষুধ'.replace(/য়/g, 'য়'), NOW);
  assert.equal(at(t), '2026-11-13 08:00');
  assert.equal(classify(t.title).area, 'family');
});
