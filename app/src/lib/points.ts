// Offline "point by point": splits a spoken or typed note into short bullet points.
// AI does this better (and fixes speech mistakes); this keeps notes tidy without it.
export function bulletPoints(text: string): string[] {
  const parts = text
    .replace(/\r/g, '')
    .split(/\n+|(?<=[.!?।])\s+|\s+(?:and then|then|তারপর|এরপর|আর একটা|এছাড়া)\s+|,?\s+and also\s+|,\s*also\s+/i)
    .map((p) => p.replace(/^(?:[-•*]|\d+[.)])\s+/, '').replace(/^(?:and then|then|also|তারপর|এরপর|এছাড়া)[,\s]+/i, '').replace(/[.।]\s*$/, '').trim())
    .filter((p) => p.length > 1);
  return parts.length > 1 ? parts.slice(0, 15) : [];
}

/** The text saved for a note: tidy points first, the original words kept underneath. */
export function tidyText(original: string, points: string[], bn: boolean): string {
  const o = original.trim();
  if (points.length < 2) return o;
  const list = points.map((p) => '• ' + p.trim()).join('\n');
  return `${list}\n\n${bn ? '— মূল কথা —' : '— Original —'}\n${o}`;
}
