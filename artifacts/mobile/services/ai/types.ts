export type AIProviderKey = 'gemini' | 'claude' | 'groq' | 'openrouter';

export type AIAction =
  | 'enhance'
  | 'hooks'
  | 'grammar'
  | 'cta'
  | 'tone'
  | 'shorten'
  | 'expand';

export interface AIActionMeta {
  key: AIAction;
  label: string;
  emoji: string;
  description: string;
}

export interface AIProviderConfigEntry {
  apiKey: string;
  enabled: boolean;
  selectedModel: string;
}

/** Persisted provider config — API keys stored separately in SecureStore. */
export interface StoredAIProviderConfigEntry {
  enabled: boolean;
  selectedModel: string;
}

export type AIProvidersMap = Partial<Record<AIProviderKey, AIProviderConfigEntry>>;

export interface AISettings {
  providers: AIProvidersMap;
  activeProvider: AIProviderKey | null;
}

// ── Shared provider interface ────────────────────────────────────────────────

export interface AIProviderMeta {
  key: AIProviderKey;
  displayName: string;
  color: string;
  models: { id: string; label: string }[];
  defaultModel: string;
}

export interface AIProvider {
  meta: AIProviderMeta;
  /** Returns true if the API key is valid (makes a cheap test call). */
  test(apiKey: string): Promise<void>; // throws on failure
  /** Generates text using the given system prompt and user content. */
  generate(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userContent: string,
  ): Promise<string>;
}
