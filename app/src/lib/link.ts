// Link → note: opens the page, keeps its title and main text, and (with AI) writes a short summary.
import { request } from './net';
import { AREAS, type Area } from './classify';
import { askJson, fileRules, type AiCtx } from './brain';

export const URL_RE = /\bhttps?:\/\/[^\s<>"']+/i;
export const findUrl = (text: string) => text.match(URL_RE)?.[0]?.replace(/[).,;!?]+$/, '') ?? '';

export type Page = { url: string; title: string; description: string; text: string };

const decode = (s: string) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Pure: pulls title, description and readable text out of HTML. */
export function readHtml(url: string, html: string): Page {
  const meta = (name: string) => {
    const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, 'i');
    const m = html.match(re);
    return decode((m?.[1] ?? m?.[2] ?? '').trim());
  };
  const title = meta('og:title') || decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()) || url;
  const description = meta('og:description') || meta('description');
  const body = html
    .replace(/<(script|style|noscript|svg|header|footer|nav|form)[\s\S]*?<\/\1>/gi, ' ')
    .match(/<(p|h1|h2|h3|li|article)[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
  const text = decode(body.map((b) => b.replace(/<[^>]+>/g, ' ')).join('\n'))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, 6000);
  return { url, title: title.replace(/\s+/g, ' ').slice(0, 160), description: description.slice(0, 400), text };
}

export async function fetchPage(url: string, timeoutMs = 12000): Promise<Page | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await request(url, { headers: { Accept: 'text/html,*/*', 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) EasyLife/0.2' }, signal: ctrl.signal });
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 600000);
    return readHtml(r.url || url, html);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type LinkNote = { title: string; text: string; area?: Area; topic?: string; important?: boolean };

/** Offline: title + description. With AI: a real summary in the person's language, filed. */
export async function linkToNote(page: Page, ctx: AiCtx, lang: 'en' | 'bn', fileNames: string[]): Promise<LinkNote> {
  const plain: LinkNote = { title: page.title, text: [page.title, page.description].filter(Boolean).join('\n\n') };
  const r = await askJson<{ title: string; summary: string; points: string[]; area: Area; topic: string; important: boolean }>(ctx,
    `Make a study/work note from this web page for a busy person. Write in ${lang === 'bn' ? 'Bangla' : 'English'}.
Return JSON only: {"title": short title, "summary": 2-3 sentence summary, "points": up to 6 key points,
 ${fileRules(AREAS, fileNames)}}
URL: ${page.url}
Title: ${page.title}
Description: ${page.description}
Text: ${page.text.slice(0, 5000)}`);
  if (!r || !r.summary) return plain;
  const points = Array.isArray(r.points) ? r.points.filter(Boolean).map((p) => '• ' + p).join('\n') : '';
  return {
    title: r.title || page.title,
    text: [r.summary, points].filter(Boolean).join('\n\n'),
    area: AREAS.includes(r.area) ? r.area : undefined, topic: r.topic, important: !!r.important,
  };
}
