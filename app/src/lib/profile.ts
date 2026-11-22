// "My profile": filled once, turned into a clean one-page CV / intro as HTML for PDF.
export type Profile = { name: string; headline: string; phone: string; email: string; about: string; education: string; experience: string; skills: string };
export const EMPTY_PROFILE: Profile = { name: '', headline: '', phone: '', email: '', about: '', education: '', experience: '', skills: '' };

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lines = (v: string) => v.split(/\n+/).map((l) => l.trim()).filter(Boolean);

/** Pure: the CV as a print-ready HTML page. Empty sections are left out. */
export function cvHtml(p: Profile, labels: { about: string; education: string; experience: string; skills: string }): string {
  const section = (title: string, body: string) => (body ? `<h2>${esc(title)}</h2>${body}` : '');
  const list = (v: string) => (lines(v).length ? `<ul>${lines(v).map((l) => `<li>${esc(l.replace(/^[-•]\s*/, ''))}</li>`).join('')}</ul>` : '');
  const skills = p.skills.split(',').map((x) => x.trim()).filter(Boolean);
  const contact = [p.phone, p.email].filter(Boolean).map(esc).join(' · ');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { margin: 28px; }
body { font-family: 'Noto Sans Bengali', 'Noto Sans', sans-serif; color: #1b1d29; margin: 0; }
header { border-bottom: 3px solid #4b3be0; padding-bottom: 14px; margin-bottom: 8px; }
h1 { margin: 0; font-size: 28px; } .head { color: #4b3be0; font-size: 15px; margin-top: 4px; } .contact { color: #555; font-size: 13px; margin-top: 6px; }
h2 { font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: #4b3be0; margin: 20px 0 6px; }
p, li { font-size: 13.5px; line-height: 1.55; } ul { margin: 0; padding-left: 18px; }
.chips span { display: inline-block; border: 1px solid #c9c5f5; border-radius: 12px; padding: 3px 10px; margin: 0 6px 6px 0; font-size: 12.5px; }
</style></head><body>
<header><h1>${esc(p.name)}</h1>${p.headline ? `<div class="head">${esc(p.headline)}</div>` : ''}${contact ? `<div class="contact">${contact}</div>` : ''}</header>
${section(labels.about, p.about.trim() ? `<p>${esc(p.about.trim()).replace(/\n/g, '<br>')}</p>` : '')}
${section(labels.experience, list(p.experience))}
${section(labels.education, list(p.education))}
${section(labels.skills, skills.length ? `<div class="chips">${skills.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : '')}
</body></html>`;
}
