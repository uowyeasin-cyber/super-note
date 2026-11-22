import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionUrl, offlineAction } from '../src/lib/assistant.ts';

test('WhatsApp with a number and a message', () => {
  const a = offlineAction('WhatsApp 01712345678: I will be 10 minutes late')!;
  assert.equal(a.kind, 'whatsapp');
  assert.equal(a.message, 'I will be 10 minutes late');
  assert.ok(actionUrl(a)!.startsWith('https://wa.me/8801712345678?text=I%20will'));
});

test('Bangla: call and SMS', () => {
  assert.equal(offlineAction('মাকে কল দাও')!.kind, 'call');
  const s = offlineAction('রহিমকে এসএমএস কর যে আমি আসছি')!;
  assert.equal(s.kind, 'sms');
  assert.equal(s.message, 'আমি আসছি');
});

test('YouTube, search, maps, open app', () => {
  assert.equal(offlineAction('youtube e search physics chapter 3')!.query, 'physics chapter 3');
  assert.equal(offlineAction('search best laptop under 50000')!.kind, 'search');
  assert.equal(offlineAction('directions to Dhanmondi 27')!.kind, 'maps');
  assert.deepEqual(offlineAction('open facebook'), { kind: 'open', app: 'facebook' });
  assert.equal(actionUrl({ kind: 'open', app: 'facebook' }), 'https://www.facebook.com/');
});

test('Plain notes are not commands', () => {
  assert.equal(offlineAction('Buy milk tomorrow at 9am'), null);
  assert.equal(offlineAction('Remind me to call the bank at 5pm'), null);
});
