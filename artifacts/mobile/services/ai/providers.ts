import { AIProvider, AIProviderKey, AIProviderMeta } from './types';

// ── Provider metadata ────────────────────────────────────────────────────────
const PROVIDER_META: Record<AIProviderKey, AIProviderMeta> = {
  groq: {
    key: 'groq',
    displayName: 'Groq',
    color: '#00A67E',
    defaultModel: 'openai/gpt-oss-120b',
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
      { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
      { id: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B' },
    ],
  },
  openrouter: {
    key: 'openrouter',
    displayName: 'OpenRouter',
    color: '#7C3AED',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'openai/gpt-4o', label: 'GPT-4o' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'LLaMA 3.3 70B' },
    ],
  },
  gemini: {
    key: 'gemini',
    displayName: 'Google Gemini',
    color: '#4285F4',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
  },
  claude: {
    key: 'claude',
    displayName: 'Anthropic Claude',
    color: '#D97706',
    defaultModel: 'claude-haiku-4-5-20251001',
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
      { id: 'claude-opus-5', label: 'Claude Opus 5' },
    ],
  },
};
// ── Helpers ──────────────────────────────────────────────────────────────────

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  let msg = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    msg = body?.error?.message ?? body?.error?.code ?? body?.message ?? msg;
  } catch { }
  throw new Error(msg);
}

// ── Gemini ───────────────────────────────────────────────────────────────────

const geminiProvider: AIProvider = {
  meta: PROVIDER_META.gemini,

  async test(apiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    await throwIfNotOk(res);
  },

  async generate(apiKey, model, systemPrompt, userContent) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
          generationConfig: { maxOutputTokens: 2048 },
        }),
      },
    );
    await throwIfNotOk(res);
    const data = await res.json();
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty response.');
    return text.trim();
  },
};

// ── Claude ───────────────────────────────────────────────────────────────────

const claudeProvider: AIProvider = {
  meta: PROVIDER_META.claude,

  async test(apiKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
    await throwIfNotOk(res);
  },

  async generate(apiKey, model, systemPrompt, userContent) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    await throwIfNotOk(res);
    const data = await res.json();
    const text: string | undefined = data?.content?.[0]?.text;
    if (!text) throw new Error('Claude returned an empty response.');
    return text.trim();
  },
};

// ── Groq ─────────────────────────────────────────────────────────────────────

const groqProvider: AIProvider = {
  meta: PROVIDER_META.groq,

  async test(apiKey) {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    await throwIfNotOk(res);
  },

  async generate(apiKey, model, systemPrompt, userContent) {
    const res = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
      },
    );
    await throwIfNotOk(res);
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Groq returned an empty response.');
    return text.trim();
  },
};

// ── OpenRouter ───────────────────────────────────────────────────────────────

const openrouterProvider: AIProvider = {
  meta: PROVIDER_META.openrouter,

  async test(apiKey) {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    await throwIfNotOk(res);
  },

  async generate(apiKey, model, systemPrompt, userContent) {
    const res = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://scriptvault.app',
          'X-Title': 'ScriptVault',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
      },
    );
    await throwIfNotOk(res);
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenRouter returned an empty response.');
    return text.trim();
  },
};

// ── Factory ──────────────────────────────────────────────────────────────────

const PROVIDERS: Record<AIProviderKey, AIProvider> = {
  gemini: geminiProvider,
  claude: claudeProvider,
  groq: groqProvider,
  openrouter: openrouterProvider,
};

export function getProvider(key: AIProviderKey): AIProvider {
  return PROVIDERS[key];
}

export function getAllProviderMeta(): AIProviderMeta[] {
  return Object.values(PROVIDER_META);
}
