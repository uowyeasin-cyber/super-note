// Offline organiser: on top of the six life areas, finds the sub-folder (which class, teacher,
// subject, family member, person or business), whether the note matters, and money entries.
// Works with no key and no internet; the AI path can refine it.
import { classify, type Area } from './classify.ts';
import { toAsciiDigits } from './parse.ts';

export type Kind = 'note' | 'task' | 'money' | 'class' | 'idea' | 'link' | 'photo';

export type Money = { amount: number; dir: 'in' | 'out'; party: string };

export type Organized = {
  area: Area;
  topic: string;      // sub-folder inside the area, never empty
  important: boolean; // needs attention (deadline, money, exam, medicine…)
  later: boolean;     // idea / someday / not needed now
  money: Money | null;
};

const BN = /[ঀ-৿]/;
const isBn = (s: string) => BN.test(s);

const SUBJECTS: [RegExp, string, string][] = [
  [/\b(math|maths|mathematics)\b|গণিত|ম্যাথ/i, 'Math', 'গণিত'],
  [/\bphysics\b|পদার্থ|ফিজিক্স/i, 'Physics', 'পদার্থবিজ্ঞান'],
  [/\bchemistry\b|রসায়ন|কেমিস্ট্রি/i, 'Chemistry', 'রসায়ন'],
  [/\bbiology\b|জীববিজ্ঞান|বায়োলজি/i, 'Biology', 'জীববিজ্ঞান'],
  [/\b(accounting|accounts)\b|হিসাববিজ্ঞান|অ্যাকাউন্টিং/i, 'Accounting', 'হিসাববিজ্ঞান'],
  [/\bfinance\b|ফিন্যান্স/i, 'Finance', 'ফিন্যান্স'],
  [/\bmarketing\b|মার্কেটিং/i, 'Marketing', 'মার্কেটিং'],
  [/\bmanagement\b|ম্যানেজমেন্ট/i, 'Management', 'ম্যানেজমেন্ট'],
  [/\beconomics\b|অর্থনীতি|ইকোনমিক্স/i, 'Economics', 'অর্থনীতি'],
  [/\b(statistics|stat)\b|পরিসংখ্যান/i, 'Statistics', 'পরিসংখ্যান'],
  [/\benglish\b|ইংরেজি|ইংলিশ/i, 'English', 'ইংরেজি'],
  [/\bbangla\b|বাংলা ক্লাস|বাংলা পরীক্ষা/i, 'Bangla', 'বাংলা'],
  [/\b(ict|computer|programming|coding)\b|কম্পিউটার|প্রোগ্রামিং|কোডিং/i, 'Computer', 'কম্পিউটার'],
  [/\b(law)\b|আইন/i, 'Law', 'আইন'],
  [/\b(history)\b|ইতিহাস/i, 'History', 'ইতিহাস'],
  [/\b(islamic|quran|hadith)\b|ইসলাম|কুরআন|হাদিস/i, 'Islamic studies', 'ইসলাম শিক্ষা'],
  [/\bdesign\b|ডিজাইন/i, 'Design', 'ডিজাইন'],
];

const RELATIONS: [RegExp, string, string][] = [
  [/\b(mom|mother|ammu|amma|mum)\b|^মা|\sমা|মাকে|মায়ের|আম্মু|আম্মা/i, 'Mother', 'মা'],
  [/\b(dad|father|abbu|abba)\b|বাবা|আব্বু|আব্বা/i, 'Father', 'বাবা'],
  [/\b(brother|bhai|bhaiya)\b|ভাই|ভাইয়া/i, 'Brother', 'ভাই'],
  [/\b(sister|apu|apa)\b|বোন|আপু|আপা/i, 'Sister', 'বোন'],
  [/\b(wife)\b|স্ত্রী|বউ/i, 'Wife', 'স্ত্রী'],
  [/\b(husband)\b|স্বামী/i, 'Husband', 'স্বামী'],
  [/\b(son|daughter|kids?|children)\b|ছেলে|মেয়ে|বাচ্চা/i, 'Children', 'সন্তান'],
  [/\b(grandma|grandpa|nanu|dadu)\b|নানু|দাদু|নানা|দাদা|নানী|দাদী/i, 'Grandparents', 'দাদা-নানা'],
  [/\b(uncle|aunt|chacha|mama|khala|fupu)\b|চাচা|মামা|খালা|ফুপু|চাচী|মামী/i, 'Relatives', 'আত্মীয়'],
  [/\b(grocery|bazar|market)\b|বাজার/i, 'Bazar', 'বাজার'],
  [/\b(medicine|doctor|hospital)\b|ওষুধ|ঔষধ|ডাক্তার|হাসপাতাল/i, 'Health', 'স্বাস্থ্য'],
];

const PERSONAL: [RegExp, string, string][] = [
  [/\b(prayer|salah|namaz|quran)\b|নামাজ|কুরআন|দোয়া/i, 'Prayer', 'ইবাদত'],
  [/\b(health|sleep|gym|workout|walk|diet)\b|স্বাস্থ্য|ঘুম|জিম|ব্যায়াম|হাঁটা/i, 'Health', 'স্বাস্থ্য'],
  [/\b(shopping|buy)\b|কেনাকাটা|কিনতে/i, 'Shopping', 'কেনাকাটা'],
  [/\b(diary|journal|feel|felt)\b|ডায়েরি|মনে হচ্ছে|অনুভব/i, 'Diary', 'ডায়েরি'],
  [/\b(goal|plan|dream)\b|লক্ষ্য|পরিকল্পনা|স্বপ্ন/i, 'Goals', 'লক্ষ্য'],
];

const SKILLS: [RegExp, string, string][] = [
  [/\b(code|coding|programming|react|python|javascript|app)\b|কোডিং|প্রোগ্রামিং/i, 'Coding', 'কোডিং'],
  [/\b(english|ielts|spoken)\b|ইংরেজি|ইংলিশ/i, 'English', 'ইংরেজি'],
  [/\b(design|figma|photoshop|canva)\b|ডিজাইন/i, 'Design', 'ডিজাইন'],
  [/\b(video|editing|youtube)\b|ভিডিও|ইউটিউব/i, 'Video', 'ভিডিও'],
  [/\b(writing|blog|write)\b|লেখা|ব্লগ/i, 'Writing', 'লেখালেখি'],
  [/\b(marketing|seo|ads)\b|মার্কেটিং/i, 'Marketing', 'মার্কেটিং'],
  [/\b(gym|workout|fitness)\b|জিম|ব্যায়াম/i, 'Fitness', 'ফিটনেস'],
];

const pick = (text: string, list: [RegExp, string, string][]) => {
  for (const [re, en, bn] of list) if (re.test(text)) return isBn(text) ? bn : en;
  return '';
};

const cap = (w: string) => (isBn(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

/** "CSE 101", "Rahim sir", "করিম স্যার" … */
function teacherOrCourse(text: string): string {
  const course = text.match(/\b([A-Za-z]{2,4})[\s-]?(\d{3,4})\b/);
  if (course) return `${course[1].toUpperCase()} ${course[2]}`;
  const teacherEn = text.match(/\b([A-Za-z][a-z]{2,})\s+(sir|madam|ma'am|maam|miss|teacher)\b/i);
  if (teacherEn && !/^(the|my|our|your|his|her|class|today|tomorrow)$/i.test(teacherEn[1])) return `${cap(teacherEn[1])} ${teacherEn[2].toLowerCase()}`;
  const teacherBn = text.match(/([ঀ-৿]{2,})\s+(স্যার|ম্যাডাম|ম্যাম|মিস)/);
  if (teacherBn && !/^(আজ|কাল|ক্লাস|আমাদের|আমার)$/.test(teacherBn[1])) return `${teacherBn[1]} ${teacherBn[2]}`;
  return '';
}

/** Person the note is about: "call Rafi", "Rafi-কে ফোন", "meet with Sumon", "রাফির সাথে". */
export function person(text: string): string {
  const en = text.match(/\b(?:call|meet|text|message|tell|ask|remind|with|to|from|visit)\s+([A-Z][a-z]{2,})\b/);
  if (en && !/^(The|My|Me|Him|Her|Them|Tomorrow|Today|Friday|Monday|Sunday|Saturday|Tuesday|Wednesday|Thursday)$/.test(en[1])) return en[1];
  const bn = text.match(/([ঀ-৿]{2,}?)(কে|র সাথে|ের সাথে|এর সাথে|র কাছে|ের কাছে)\s/);
  if (bn && !/^(আমা|তোমা|তা|ও|এ|সবা|কা|মা|বাবা|ভাই|বোন|আপু|আম্মু|আব্বু)$/.test(bn[1])) return bn[1];
  return '';
}

const MONEY_WORD = /(taka|tk|bdt|৳|টাকা|টাকার)/i;
const OUT_WORDS = /\b(paid|pay(?:ed)?|gave|spent|spend|bought|sent|cost|expense)\b|খরচ|দিলাম|দিয়েছি|দিয়েছি|দিছি|কিনলাম|কিনেছি|পাঠালাম|পাঠিয়েছি|পাঠিয়েছি|বিল দিলাম|শোধ করলাম/i;
const IN_WORDS = /\b(received|got|earned|sold|income|salary came)\b|পেলাম|পেয়েছি|পেয়েছি|পাইছি|আসছে|এসেছে|এসেছে|বিক্রি করলাম|বিক্রি হয়েছে|বিক্রি হয়েছে|জমা হলো|আয়|আয়/i;

/** A money entry that already happened ("paid 500 tk to Rahim", "বিকাশে ১২০০ টাকা পেলাম"). Future plans are not entries. */
export function parseMoney(raw: string): Money | null {
  const text = toAsciiDigits(raw.normalize('NFC'));
  if (!MONEY_WORD.test(text) && !/\b(bkash|nagad|rocket)\b|বিকাশ|নগদ|রকেট/i.test(text)) return null;
  const dirOut = OUT_WORDS.test(text);
  const dirIn = IN_WORDS.test(text);
  if (dirOut === dirIn) return null; // no clear direction (or a plan like "pay rent on Friday")
  if (/\b(will|tomorrow|next)\b|দিতে হবে|দেব|দিবো|দিব\b|কাল\s/i.test(text) && !/দিলাম|পেলাম|paid|received|got|spent/i.test(text)) return null;
  // Prefer the number next to a money word ("500 tk", "৳500", "tk 500"); else the largest number.
  const num = (n: string, k?: string) => parseFloat(n.replace(/,/g, '')) * (k ? 1000 : 1);
  const tagged = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(k|হাজার)?\s*(?:taka|tk|bdt|৳|টাকা|টাকার)/i)
    || text.match(/(?:৳|tk\.?|bdt)\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?/i);
  let amount = tagged ? num(tagged[1], tagged[2]) : 0;
  if (!tagged) for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k|হাজার)?/gi)) amount = Math.max(amount, num(m[1], m[2]));
  if (!amount || amount <= 0) return null;
  return { amount, dir: dirOut ? 'out' : 'in', party: person(raw) };
}

const IMPORTANT = /\b(urgent|important|must|deadline|exam|test|quiz|submit|bill|pay|medicine|doctor|interview|due)\b|জরুরি|জরুরী|অবশ্যই|গুরুত্বপূর্ণ|পরীক্ষা|জমা দিতে|বিল|ওষুধ|ঔষধ|ডাক্তার|ইন্টারভিউ|শেষ তারিখ|কুইজ/i;
const LATER = /\b(idea|maybe|someday|sometime|random|for fun|later)\b|আইডিয়া|হয়তো|হয়তো|কোনো একদিন|কখনো|মজার|এমনি/i;

export function organize(text: string, opts: { hasTimedTask?: boolean; areaHint?: Area | null } = {}): Organized {
  const clean = text.normalize('NFC');
  const money = parseMoney(clean);
  let area: Area = opts.areaHint ?? classify(clean).area;
  if (!opts.areaHint && money && area === 'personal') area = 'business';

  let topic = '';
  switch (area) {
    case 'academic': topic = teacherOrCourse(clean) || pick(clean, SUBJECTS); break;
    case 'family': topic = pick(clean, RELATIONS); break;
    case 'business': topic = money ? (isBn(clean) ? 'হিসাব' : 'Accounts') : person(clean); break;
    case 'social': topic = person(clean); break;
    case 'skills': topic = pick(clean, SKILLS); break;
    case 'personal': topic = pick(clean, PERSONAL); break;
  }
  if (!topic) topic = isBn(clean) ? 'সাধারণ' : 'General';

  const important = !!opts.hasTimedTask || IMPORTANT.test(clean) || !!money;
  const later = !important && LATER.test(clean);
  return { area, topic, important, later, money };
}
