// One door to the AI for every feature (notes, photos, links, classes, messages).
// Uses the person's own AI keys when set, otherwise Pro's built-in AI; returns null
// when neither is available or the call fails, so every caller has an offline path.
import { parseJson } from './gemini';
import { askAll } from './llm';
import { DEFAULT_MODEL } from './ai';
import { proAiRead, type PlanState } from './plan';

export type AiCtx = { key: string; model: string; pro: boolean; plan: PlanState };
export type Img = { base64: string; mime: string };

export const aiAvailable = (ctx: AiCtx) => !!ctx.key.trim() || ctx.pro;

export function nowLine(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  const off = -now.getTimezoneOffset();
  const iso = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}:00${off >= 0 ? '+' : '-'}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
  return `${iso} (${now.toLocaleDateString('en-US', { weekday: 'long' })})`;
}

/** Ask for JSON. `prompt` must describe the JSON shape. */
export async function askJson<T = Record<string, unknown>>(ctx: AiCtx, prompt: string, image?: Img, timeoutMs = 25000): Promise<T | null> {
  if (ctx.key.trim()) return direct<T>(ctx.key.trim(), ctx.model || DEFAULT_MODEL, prompt, image, timeoutMs);
  if (ctx.pro) {
    const r = await proAiRead('', ctx.plan, [], 'raw', { prompt, image: image ?? null });
    if (r && typeof r === 'object') return r as T;
    if (typeof r === 'string') { try { return JSON.parse(r) as T; } catch { return null; } }
  }
  return null;
}

async function direct<T>(key: string, model: string, prompt: string, image: Img | undefined, timeoutMs: number): Promise<T | null> {
  return parseJson<T>(await askAll(key, prompt, image, { model, timeoutMs }));
}

/** The shared part of every "organise this" prompt. */
export function fileRules(areas: readonly string[], fileNames: string[]) {
  return `"area": one of ${JSON.stringify(areas)},
 "topic": the exact file inside that area (course code, subject, teacher like "Rahim sir", family member, friend, client or business).
   Reuse one of these existing files when it fits, spelled exactly: ${JSON.stringify(fileNames.slice(0, 80))}; otherwise a short new name in the content's language, or "General".
 "important": true if it needs attention (deadline, exam, money, medicine, bills), false otherwise`;
}
