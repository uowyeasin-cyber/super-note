// Study help on any saved note (class transcript, photo of a board, article):
// a short summary, a quiz, and a plain-language explanation. All need AI.
import { askJson, type AiCtx } from './brain';
import type { Tone } from './message';
import { APPS, type Action } from './assistant';

export type Quiz = { q: string; options: string[]; answer: number; why: string }[];

const langName = (lang: 'en' | 'bn') => (lang === 'bn' ? 'Bangla' : 'English');

export async function summarize(text: string, ctx: AiCtx, lang: 'en' | 'bn'): Promise<string | null> {
  const r = await askJson<{ summary: string; points: string[] }>(ctx,
    `Summarise this note for a student or busy person, in ${langName(lang)}.
Return JSON only: {"summary": 2-4 sentences, "points": up to 8 key points (short)}
Note:
${text.slice(0, 12000)}`);
  if (!r?.summary) return null;
  const pts = Array.isArray(r.points) ? r.points.filter(Boolean).map((p) => '• ' + p).join('\n') : '';
  return [r.summary, pts].filter(Boolean).join('\n\n');
}

export async function makeQuiz(text: string, ctx: AiCtx, lang: 'en' | 'bn'): Promise<Quiz | null> {
  const r = await askJson<{ questions: Quiz }>(ctx,
    `Make a 5-question multiple-choice quiz from this note to check understanding, in ${langName(lang)}.
Return JSON only: {"questions":[{"q": question, "options": 4 short options, "answer": index 0-3 of the right option, "why": one-line reason}]}
Note:
${text.slice(0, 12000)}`);
  const qs = Array.isArray(r?.questions) ? r!.questions : [];
  const ok = qs.filter((x) => x && x.q && Array.isArray(x.options) && x.options.length >= 2 && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.options.length);
  return ok.length ? ok.slice(0, 8) : null;
}

export async function explain(text: string, ctx: AiCtx, lang: 'en' | 'bn', part = ''): Promise<string | null> {
  const r = await askJson<{ explanation: string }>(ctx,
    `Explain ${part ? `this part: "${part.slice(0, 600)}" from the note below` : 'the note below'} very simply, like a kind teacher to a first-year student, in ${langName(lang)}.
Use an everyday example. Keep it under 180 words.
Return JSON only: {"explanation": text}
Note:
${text.slice(0, 10000)}`);
  return r?.explanation?.trim() || null;
}

export async function writeMessage(what: string, tone: Tone, lang: 'en' | 'bn', ctx: AiCtx): Promise<string | null> {
  const r = await askJson<{ message: string }>(ctx,
    `Write a short ready-to-send chat message for this person. What they want to say (may be Bangla, English or mixed): "${what.slice(0, 2000)}".
Tone: ${tone}. Language: ${lang === 'bn' ? 'Bangla (natural, not bookish)' : 'English'}. If they wrote in another language, translate it.
Do not add facts they did not give. No subject line. Return JSON only: {"message": text}`);
  return r?.message?.trim() || null;
}

/** AI reading of a command: which app, who, and the finished message (written nicely). */
export async function planAction(text: string, ctx: AiCtx, lang: 'en' | 'bn'): Promise<Action | null> {
  const r = await askJson<Action>(ctx,
    `The person told their assistant app (Bangladesh; Bangla, English or Banglish): "${text.slice(0, 1500)}".
Decide what to do. Return JSON only:
{"kind": one of ["whatsapp","sms","call","email","search","youtube","maps","open","note","answer"],
 "to": person's name if any, "phone": phone number if given (digits), 
 "message": for whatsapp/sms/email the finished, polite message to send, in the language they used,
 "query": for search/youtube/maps, "app": for open one of ${JSON.stringify(Object.keys(APPS))},
 "answer": for "answer" (a question they want answered) a short helpful answer in ${lang === 'bn' ? 'Bangla' : 'English'}}
Use "note" when it is something to remember or a reminder.`);
  if (!r || !r.kind) return null;
  return r;
}

/** Ask anything about a note, as many times as wanted. */
export async function askAbout(note: string, question: string, history: { q: string; a: string }[], ctx: AiCtx, lang: 'en' | 'bn'): Promise<string | null> {
  const past = history.slice(-6).map((h) => `Q: ${h.q}\nA: ${h.a}`).join('\n');
  const r = await askJson<{ answer: string }>(ctx,
    `You are helping with this saved note. Answer the question in ${lang === 'bn' ? 'Bangla' : 'English'}, clearly and briefly.
You may use general knowledge, but say so if the note does not cover it. Return JSON only: {"answer": text}
Note:
${note.slice(0, 10000)}
${past ? `Earlier questions:\n${past}\n` : ''}Question: ${question.slice(0, 1000)}`);
  return r?.answer?.trim() || null;
}
