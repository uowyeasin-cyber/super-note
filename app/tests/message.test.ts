import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intlPhone, smsUrl, whatsappUrl } from '../src/lib/message.ts';

test('Bangladesh numbers get the country code', () => {
  assert.equal(intlPhone('01712-345678'), '8801712345678');
  assert.equal(intlPhone('+880 1712 345678'), '8801712345678');
  assert.equal(intlPhone('008801712345678'), '8801712345678');
});

test('WhatsApp link with and without a number', () => {
  assert.equal(whatsappUrl('01712345678', 'হ্যালো'), 'https://wa.me/8801712345678?text=' + encodeURIComponent('হ্যালো'));
  assert.equal(whatsappUrl('', 'hi there'), 'whatsapp://send?text=hi%20there');
});

test('SMS link keeps the number', () => {
  assert.equal(smsUrl('+880 1712', 'ok'), 'sms:+8801712?body=ok');
});
