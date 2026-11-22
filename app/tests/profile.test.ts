import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cvHtml, EMPTY_PROFILE } from '../src/lib/profile.ts';

const L = { about: 'About', education: 'Education', experience: 'Work', skills: 'Skills' };

test('CV has the name, escapes HTML and leaves out empty sections', () => {
  const html = cvHtml({ ...EMPTY_PROFILE, name: 'Arif <Hossain>', skills: 'Excel, Design ,', education: '- BSc CSE\n- HSC' }, L);
  assert.ok(html.includes('Arif &lt;Hossain&gt;'));
  assert.ok(html.includes('<li>BSc CSE</li>') && html.includes('<li>HSC</li>'));
  assert.ok(html.includes('<span>Excel</span><span>Design</span>'));
  assert.ok(!html.includes('>Work<'));
  assert.ok(!html.includes('>About<'));
});
