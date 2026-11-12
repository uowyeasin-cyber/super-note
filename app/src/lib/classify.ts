// Offline sorter: puts a note into one of six life areas by keywords (Bangla + English).
// The AI path can override it; this keeps the app useful with no key and no internet.

export const AREAS = ['academic', 'business', 'skills', 'social', 'family', 'personal'] as const;
export type Area = (typeof AREAS)[number];

const WORDS: Record<Area, string[]> = {
  academic: ['class', 'lecture', 'exam', 'assignment', 'quiz', 'semester', 'course', 'professor', 'sir', 'madam', 'tuition', 'homework', 'thesis', 'study', 'chapter', 'university', 'college', 'school', 'accounting', 'math', 'physics',
    'ক্লাস', 'লেকচার', 'পরীক্ষা', 'এক্সাম', 'অ্যাসাইনমেন্ট', 'কুইজ', 'সেমিস্টার', 'কোর্স', 'স্যার', 'ম্যাডাম', 'পড়া', 'পড়তে', 'পড়তে', 'বই', 'অধ্যায়', 'ভার্সিটি', 'কলেজ', 'স্কুল', 'হোমওয়ার্ক', 'টিউশন'],
  business: ['client', 'customer', 'order', 'invoice', 'payment', 'sales', 'supplier', 'shop', 'stock', 'profit', 'meeting', 'deal', 'deliver', 'project', 'office', 'rent', 'bkash', 'nagad', 'bank', 'loan', 'salary',
    'ক্লায়েন্ট', 'কাস্টমার', 'অর্ডার', 'ইনভয়েস', 'পেমেন্ট', 'বিক্রি', 'দোকান', 'স্টক', 'লাভ', 'মিটিং', 'ডেলিভারি', 'প্রজেক্ট', 'অফিস', 'ভাড়া', 'বিকাশ', 'নগদ', 'ব্যাংক', 'লোন', 'টাকা', 'বেতন', 'ব্যবসা', 'সাপ্লায়ার'],
  skills: ['learn', 'practice', 'tutorial', 'code', 'coding', 'design', 'english', 'language', 'skill', 'course', 'youtube', 'workout', 'gym', 'idea', 'app', 'write', 'blog',
    'শিখ', 'প্র্যাকটিস', 'অনুশীলন', 'কোডিং', 'ডিজাইন', 'ইংরেজি', 'স্কিল', 'ভিডিও', 'জিম', 'ব্যায়াম', 'আইডিয়া', 'লিখতে', 'লেখা'],
  social: ['friend', 'party', 'wedding', 'birthday', 'event', 'invite', 'call', 'facebook', 'whatsapp', 'message', 'reply', 'visit', 'hangout', 'mosque', 'community',
    'বন্ধু', 'দাওয়াত', 'দাওয়াত', 'বিয়ে', 'বিয়ে', 'জন্মদিন', 'অনুষ্ঠান', 'ফেসবুক', 'হোয়াটসঅ্যাপ', 'মেসেজ', 'রিপ্লাই', 'দেখা', 'আড্ডা', 'মসজিদ'],
  family: ['mom', 'mother', 'dad', 'father', 'abbu', 'ammu', 'brother', 'sister', 'wife', 'husband', 'son', 'daughter', 'family', 'home', 'grocery', 'bazar', 'medicine', 'doctor', 'uncle', 'aunt',
    'মা', 'মাকে', 'মায়ের', 'মায়ের', 'আম্মু', 'আম্মা', 'বাবা', 'আব্বু', 'আব্বা', 'ভাই', 'বোন', 'আপু', 'স্ত্রী', 'বউ', 'ছেলে', 'মেয়ে', 'মেয়ে', 'পরিবার', 'বাসা', 'বাড়ি', 'বাড়ি', 'বাজার', 'ওষুধ', 'ঔষধ', 'ডাক্তার', 'চাচা', 'মামা', 'খালা', 'ফুপু', 'নানু', 'দাদু'],
  personal: ['me', 'myself', 'health', 'sleep', 'diary', 'journal', 'prayer', 'salah', 'quran', 'goal', 'plan', 'haircut', 'shopping', 'self',
    'নিজে', 'নিজের', 'স্বাস্থ্য', 'ঘুম', 'ডায়েরি', 'ডায়েরি', 'নামাজ', 'কুরআন', 'লক্ষ্য', 'পরিকল্পনা', 'চুল', 'কেনাকাটা'],
};

function tokens(text: string): string[] {
  return text.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

/** Best area plus a confidence 0..1. Falls back to personal. */
export function classify(text: string): { area: Area; confidence: number } {
  const toks = tokens(text);
  const scores = AREAS.map((area) => {
    let s = 0;
    for (const w of WORDS[area]) {
      const lw = w.toLowerCase();
      for (const t of toks) {
        // Bangla words take endings (মাকে, বাজারে), so match on prefix for Bangla, exact for English.
        if (t === lw || (/[ঀ-৿]/.test(lw) && lw.length >= 2 && t.startsWith(lw) && t.length - lw.length <= 3)) { s += 1; break; }
      }
    }
    return { area, s };
  });
  scores.sort((a, b) => b.s - a.s);
  const top = scores[0];
  if (top.s === 0) return { area: 'personal', confidence: 0.2 };
  const second = scores[1].s;
  return { area: top.area, confidence: Math.min(1, 0.5 + (top.s - second) * 0.25) };
}
