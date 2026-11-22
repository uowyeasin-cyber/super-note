import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bulletPoints, tidyText } from '../src/lib/points.ts';

test('splits sentences and spoken "then" into points', () => {
  assert.deepEqual(bulletPoints('Buy rice. Pay the electricity bill then call Rafi'), ['Buy rice', 'Pay the electricity bill', 'call Rafi']);
  assert.deepEqual(bulletPoints('মায়ের ওষুধ কিনতে হবে। তারপর বাজার করতে হবে।'), ['মায়ের ওষুধ কিনতে হবে', 'বাজার করতে হবে']);
});

test('numbers at the start are kept, list markers removed', () => {
  assert.deepEqual(bulletPoints('500 tk rent paid.\n2) Call Rafi'), ['500 tk rent paid', 'Call Rafi']);
});

test('one-line notes stay as they are', () => {
  assert.deepEqual(bulletPoints('Call the bank at 5 pm'), []);
  assert.equal(tidyText('Call the bank at 5 pm', [], false), 'Call the bank at 5 pm');
});

test('tidy text keeps the original under the points', () => {
  assert.equal(tidyText('a. b', ['a', 'b'], false), '• a\n• b\n\n— Original —\na. b');
});
