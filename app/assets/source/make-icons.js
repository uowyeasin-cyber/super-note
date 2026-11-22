const { chromium } = require('playwright');
const fs = require('fs');
// Glyph: an "e" drawn as one stroke whose tail sweeps up into a tick, plus a gold spark.
const glyph = (stroke, spark, sw=70) => `<g transform="translate(10 6)">
  <path d="M362 528 H660 C660 430 594 362 510 362 C420 362 356 432 356 524 C356 618 424 684 516 684 C572 684 616 662 648 626"
        fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
  <g transform="translate(700 354) scale(1.3) translate(-700 -354)"><path d="M700 300 C706 336 718 348 754 354 C718 360 706 372 700 408 C694 372 682 360 646 354 C682 348 694 336 700 300 Z" fill="${spark}"/></g></g>`;
const bgDefs = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7B6CFF"/><stop offset=".55" stop-color="#4B3BE0"/><stop offset="1" stop-color="#22177A"/>
    </linearGradient>
    <radialGradient id="h" cx=".28" cy=".18" r=".7">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".28"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="w" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E6E3FF"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFE29A"/><stop offset="1" stop-color="#F5B83D"/>
    </linearGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#120B4A" flood-opacity=".45"/></filter>
  </defs>`;
const bg = `<rect width="1024" height="1024" fill="url(#g)"/><rect width="1024" height="1024" fill="url(#h)"/>`;
const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${bgDefs}${inner}</svg>`;
// Foreground scaled to sit inside the adaptive-icon safe zone (scale .78 around center).
const fg = (inner) => `<g transform="translate(512 512) scale(.92) translate(-512 -512)">${inner}</g>`;
const files = {
  'icon.svg': svg(bg + `<g filter="url(#s)">${glyph('url(#w)','url(#gold)')}</g>`),
  'android-icon-background.svg': svg(bg),
  'android-icon-foreground.svg': svg(fg(`<g filter="url(#s)">${glyph('url(#w)','url(#gold)')}</g>`)),
  'android-icon-monochrome.svg': svg(fg(glyph('#000','#000'))),
  'splash-icon.svg': svg(`<g transform="translate(512 512) scale(1) translate(-512 -512)">
     <rect x="192" y="192" width="640" height="640" rx="176" fill="url(#g)"/><rect x="192" y="192" width="640" height="640" rx="176" fill="url(#h)"/>
     <g transform="translate(512 512) scale(.62) translate(-512 -512)" filter="url(#s)">${glyph('url(#w)','url(#gold)')}</g></g>`),
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
  for (const [n, s] of Object.entries(files)) {
    fs.writeFileSync(n, s);
    await p.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
    await p.screenshot({ path: n.replace('.svg', '.png'), omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  }
  // Preview: launcher masks (circle, squircle) at a few sizes, on light and dark wallpapers.
  const icon = fs.readFileSync('icon.png').toString('base64');
  const cell = (r, sz) => `<img src="data:image/png;base64,${icon}" style="width:${sz}px;height:${sz}px;border-radius:${r};margin:18px;box-shadow:0 6px 18px rgba(0,0,0,.25)">`;
  const row = (bgc) => `<div style="background:${bgc};padding:20px;display:flex;align-items:center">${cell('50%',180)}${cell('28%',180)}${cell('50%',96)}${cell('28%',64)}${cell('50%',48)}</div>`;
  await p.setViewportSize({ width: 900, height: 520 });
  await p.setContent(`<body style="margin:0">${row('#ECEEF3')}${row('#2B2F3A')}</body>`);
  await p.screenshot({ path: 'preview.png' });
  await b.close();
})();
