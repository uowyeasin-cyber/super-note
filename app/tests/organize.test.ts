import { test } from 'node:test';
import assert from 'node:assert/strict';
import { organize, parseMoney, person } from '../src/lib/organize.ts';

test('academic notes go to the course, teacher or subject', () => {
  assert.deepEqual(pickAT('CSE 101 lecture: binary trees, exam next week'), ['academic', 'CSE 101']);
  assert.deepEqual(pickAT('Rahim sir said the assignment is due Sunday'), ['academic', 'Rahim sir']);
  assert.deepEqual(pickAT('আজ করিম স্যার ক্লাসে বললেন অধ্যায় ৩ পড়তে'), ['academic', 'করিম স্যার']);
  assert.deepEqual(pickAT('physics class notes on motion'), ['academic', 'Physics']);
  assert.deepEqual(pickAT('হিসাববিজ্ঞান ক্লাসে জার্নাল এন্ট্রি শিখলাম'), ['academic', 'হিসাববিজ্ঞান']);
});

test('family notes go to the person', () => {
  assert.deepEqual(pickAT('মাকে ওষুধ খাওয়াতে হবে'), ['family', 'মা']);
  assert.deepEqual(pickAT('buy medicine for dad'), ['family', 'Father']);
});

test('social notes go to the friend', () => {
  assert.equal(person('call Rafi about the wedding'), 'Rafi');
  assert.equal(person('কাল রাফির সাথে দেখা করব'), 'রাফি');
  assert.deepEqual(pickAT('meet with Sumon for the birthday party'), ['social', 'Sumon']);
});

test('money entries are found, plans are not', () => {
  assert.deepEqual(parseMoney('paid 500 tk to Rahim for rent'), { amount: 500, dir: 'out', party: 'Rahim' });
  assert.deepEqual(parseMoney('বিকাশে ১২০০ টাকা পেলাম'), { amount: 1200, dir: 'in', party: '' });
  assert.deepEqual(parseMoney('বাজারে ৩৫০ টাকা খরচ হলো'), { amount: 350, dir: 'out', party: '' });
  assert.equal(parseMoney('pay rent on Friday')?.amount, undefined);
  assert.equal(parseMoney('কাল ৫০০ টাকা দিতে হবে'), null);
  assert.equal(parseMoney('call the bank'), null);
  const o = organize('sold 3 shirts, received 2,400 taka from a customer');
  assert.equal(o.area, 'business');
  assert.equal(o.topic, 'Accounts');
  assert.equal(o.money?.amount, 2400);
  assert.equal(o.money?.dir, 'in');
});

test('important vs later', () => {
  assert.equal(organize('exam on Sunday, must revise chapter 2').important, true);
  assert.equal(organize('অবশ্যই কাল বিল দিতে হবে').important, true);
  const idea = organize('random idea: maybe a podcast about books');
  assert.equal(idea.important, false);
  assert.equal(idea.later, true);
});

test('every note gets a folder, even with nothing to go on', () => {
  assert.equal(organize('hello there').topic, 'General');
  assert.equal(organize('কিছু একটা').topic, 'সাধারণ');
});

function pickAT(s: string) { const o = organize(s); return [o.area, o.topic]; }
