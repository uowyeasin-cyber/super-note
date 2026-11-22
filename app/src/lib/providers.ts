// Any AI the person adds: Gemini, or any service that speaks the OpenAI chat format
// (Groq, OpenAI, OpenRouter, xAI Grok, DeepSeek, Mistral, Claude, or a custom address).
// Keys are kept as lines in one setting, tried top to bottom until one answers.
export type ProviderId = 'gemini' | 'groq' | 'openai' | 'openrouter' | 'xai' | 'deepseek' | 'mistral' | 'anthropic' | 'custom';
export type AiKey = { provider: ProviderId; key: string; model?: string; url?: string };

export const PROVIDERS: Record<ProviderId, { name: string; base: string; keyUrl: string; prefer: RegExp[] }> = {
  gemini: { name: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta', keyUrl: 'https://aistudio.google.com/apikey', prefer: [] },
  groq: { name: 'Groq', base: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', prefer: [/gpt-oss-120b/, /llama-4-maverick/, /llama-3\.3-70b/, /qwen/, /kimi/, /gpt-oss-20b/, /llama/] },
  openai: { name: 'OpenAI', base: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', prefer: [/^gpt-[\d.]+-mini$/, /^gpt-[\d.]+o?-mini/, /^gpt-[\d.]+$/, /^gpt-/] },
  openrouter: { name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', prefer: [/^openrouter\/auto$/, /:free$/] },
  xai: { name: 'Grok (xAI)', base: 'https://api.x.ai/v1', keyUrl: 'https://console.x.ai', prefer: [/grok-[\d.]+-fast/, /grok-[\d.]+-mini/, /^grok-/] },
  deepseek: { name: 'DeepSeek', base: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys', prefer: [/deepseek-chat/, /deepseek/] },
  mistral: { name: 'Mistral', base: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys', prefer: [/mistral-small-latest/, /mistral-medium-latest/, /-latest$/] },
  anthropic: { name: 'Claude', base: 'https://api.anthropic.com/v1', keyUrl: 'https://console.anthropic.com/settings/keys', prefer: [/haiku/, /sonnet/] },
  custom: { name: 'Custom', base: '', keyUrl: '', prefer: [] },
};

/** Guesses the service from the key's shape. sk- alone could be OpenAI or DeepSeek: OpenAI wins. */
export function detect(key: string): ProviderId {
  const k = key.trim();
  if (/^AIza/.test(k)) return 'gemini';
  if (/^gsk_/.test(k)) return 'groq';
  if (/^sk-or-/.test(k)) return 'openrouter';
  if (/^sk-ant-/.test(k)) return 'anthropic';
  if (/^xai-/.test(k)) return 'xai';
  if (/^sk-/.test(k)) return 'openai';
  return 'gemini';
}

/** One line per key: "key", or "provider|key", or "provider|key|model", or "custom|key|model|https://base/v1". */
export function parseRing(text: string): AiKey[] {
  const out: AiKey[] = [];
  for (const line of (text || '').split(/\n+/)) {
    const parts = line.trim().split('|').map((p) => p.trim());
    if (!parts[0]) continue;
    if (parts.length === 1) { out.push({ provider: detect(parts[0]), key: parts[0] }); continue; }
    const provider = (parts[0] in PROVIDERS ? parts[0] : detect(parts[1])) as ProviderId;
    const k: AiKey = { provider, key: parts[1] ?? '' };
    if (parts[2]) k.model = parts[2];
    if (parts[3]) k.url = parts[3].replace(/\/+$/, '');
    if (k.key && (provider !== 'custom' || k.url)) out.push(k);
  }
  return out;
}

export function ringText(keys: AiKey[]): string {
  return keys.map((k) => [k.provider, k.key, k.model ?? '', k.url ?? ''].join('|').replace(/\|+$/, '')).join('\n');
}

export const mask = (key: string) => (key.length > 10 ? key.slice(0, 4) + '…' + key.slice(-4) : '••••');

/** Picks a chat model from a service's live model list (names change often). */
export function pickModel(provider: ProviderId, ids: string[]): string | null {
  const chat = ids.filter((id) => !/embed|whisper|tts|speech|audio|image|dall-e|moderation|guard|realtime|transcribe|search|rerank|ocr|codestral-embed|orpheus|compound/i.test(id));
  for (const re of PROVIDERS[provider].prefer) {
    const hit = chat.filter((id) => re.test(id)).sort().reverse()[0];
    if (hit) return hit;
  }
  return chat[0] ?? null;
}
