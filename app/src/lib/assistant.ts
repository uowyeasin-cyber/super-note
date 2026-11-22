// "Tell the AI": turns one sentence into an action in another app (WhatsApp, SMS, call,
// email, search, YouTube, maps, an app) or an answer. Android does not let an app press
// "send" inside another app, so Easy Life opens it with everything filled in.
import { smsUrl, whatsappUrl } from './message.ts';

export type ActionKind = 'whatsapp' | 'sms' | 'call' | 'email' | 'search' | 'youtube' | 'maps' | 'open' | 'note' | 'answer';
export type Action = { kind: ActionKind; to?: string; phone?: string; message?: string; query?: string; app?: string; answer?: string };

const PHONE_RE = /(?:\+?88)?01[3-9]\d{2}[-\s]?\d{6}|\+\d[\d\s-]{7,14}\d/;

export const APPS: Record<string, string> = {
  facebook: 'https://www.facebook.com/', messenger: 'https://www.messenger.com/', instagram: 'https://www.instagram.com/',
  youtube: 'https://www.youtube.com/', gmail: 'mailto:', whatsapp: 'whatsapp://send', telegram: 'https://t.me/',
  maps: 'https://maps.google.com/', chrome: 'https://www.google.com/', linkedin: 'https://www.linkedin.com/', tiktok: 'https://www.tiktok.com/',
  bkash: 'https://www.bkash.com/', daraz: 'https://www.daraz.com.bd/', x: 'https://x.com/', twitter: 'https://x.com/',
};
const APP_ALIASES: Record<string, string> = { ফেসবুক: 'facebook', মেসেঞ্জার: 'messenger', ইনস্টাগ্রাম: 'instagram', ইউটিউব: 'youtube', জিমেইল: 'gmail', টেলিগ্রাম: 'telegram', ম্যাপ: 'maps', বিকাশ: 'bkash', দারাজ: 'daraz' };

/** Offline reading of common commands, in English, Bangla and Banglish. */
export function offlineAction(text: string): Action | null {
  const s = text.trim();
  if (!s) return null;
  const low = s.toLowerCase();
  const phone = s.match(PHONE_RE)?.[0];
  // "<msg>" after a colon or quotes, or after "that/je/বলো যে".
  const said = s.match(/["“](.+?)["”]/)?.[1] ?? s.match(/[:：]\s*(.+)$/)?.[1] ?? s.match(/\b(?:that|je)\b\s+(.+)$/i)?.[1] ?? s.match(/যে\s+(.+)$/)?.[1];
  const to = s.match(/\b(?:to|ke)\s+([A-Zঀ-৿][\wঀ-৿]*)/)?.[1] ?? s.match(/([ঀ-৿]+)কে\b/)?.[1] ?? s.match(/([ঀ-৿]+)কে\s/)?.[1];

  if (/\b(whats\s?app|wa)\b|হোয়াটসঅ্যাপ|হোয়াটস অ্যাপ/i.test(s)) return { kind: 'whatsapp', to, phone, message: said ?? '' };
  if (/\b(sms|text message)\b|এসএমএস/i.test(s)) return { kind: 'sms', to, phone, message: said ?? '' };
  if (/\b(call|phone|ring|kol)\b|কল দা|কল কর|ফোন দা|ফোন কর/i.test(s) && !/\b(reminder|remind|at \d)/i.test(low)) return { kind: 'call', to, phone };
  if (/\b(e-?mail|mail)\b|ইমেইল|মেইল/i.test(s)) return { kind: 'email', to, message: said ?? '' };
  const yt = s.match(/(?:youtube|ইউটিউব)(?:\s*(?:e|এ|-এ|তে|on|search|খোঁজো|সার্চ))*\s+(.+)/i)?.[1];
  if (yt) return { kind: 'youtube', query: yt.replace(/\s*(?:search|খোঁজো|দেখাও|চালাও|play)\s*$/i, '').trim() };
  const map = s.match(/(?:directions? to|navigate to|map of|where is)\s+(.+)/i)?.[1] ?? s.match(/(.+?)\s*(?:কোথায়|এর রাস্তা|যাওয়ার রাস্তা)/)?.[1];
  if (map) return { kind: 'maps', query: map.trim() };
  const open = s.match(/^(?:open|kholo|খোলো|ওপেন কর[োু]?)\s+(\S+)/i)?.[1] ?? s.match(/^(\S+)\s+(?:open|kholo|খোলো|ওপেন কর[োু]?)\s*$/i)?.[1];
  if (open) {
    const k = APP_ALIASES[open] ?? open.toLowerCase();
    if (APPS[k]) return { kind: 'open', app: k };
  }
  const q = s.match(/^(?:search|google)\s+(?:for\s+)?(.+)/i)?.[1] ?? s.match(/(.+?)\s*(?:সার্চ কর[োু]?|গুগল কর[োু]?|খুঁজে দাও)\s*$/)?.[1];
  if (q) return { kind: 'search', query: q.trim() };
  return null;
}

/** The link that opens the right app with everything filled in. */
export function actionUrl(a: Action): string | null {
  const text = a.message ?? '';
  switch (a.kind) {
    case 'whatsapp': return whatsappUrl(a.phone ?? '', text);
    case 'sms': return smsUrl(a.phone ?? '', text);
    case 'call': return a.phone ? `tel:${a.phone.replace(/[^\d+]/g, '')}` : 'tel:';
    case 'email': return `mailto:${a.to && a.to.includes('@') ? a.to : ''}?body=${encodeURIComponent(text)}`;
    case 'search': return `https://www.google.com/search?q=${encodeURIComponent(a.query ?? '')}`;
    case 'youtube': return `https://www.youtube.com/results?search_query=${encodeURIComponent(a.query ?? '')}`;
    case 'maps': return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.query ?? '')}`;
    case 'open': return a.app ? APPS[a.app] ?? null : null;
    default: return null;
  }
}

/** True when the sentence reads like a command for another app, not a note. */
export const looksLikeCommand = (text: string) => !!offlineAction(text);
