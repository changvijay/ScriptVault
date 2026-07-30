export type AIProviderKey = 'gemini' | 'claude' | 'groq' | 'openrouter';

export type AIAction =
  | 'enhance'
  | 'hooks'
  | 'grammar'
  | 'cta'
  | 'tone'
  | 'shorten'
  | 'expand'
  | 'trend_idea';

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

// ── Custom prompts & action ordering preferences ─────────────────────────────

export interface SavedCustomPrompt {
  id: string; // e.g. 'custom_172234000'
  label: string; // e.g. 'Translate'
  emoji: string; // e.g. '🌐'
  prompt: string; // e.g. 'Translate to Spanish'
}

export interface AIActionsPreferences {
  order: string[]; // array of action keys or custom prompt IDs
  hidden: string[]; // array of hidden action keys/IDs
  customPrompts: SavedCustomPrompt[];
}

export interface ContentNiche {
  id: string;
  niche: string;
  title: string;
  description: string;
  language: string; // e.g. 'Tamil', 'English', 'Hindi', etc.
  captions: string[];
}

export interface DailyIdea {
  date: string; // YYYY-MM-DD
  niche: string;
  language?: string;
  title: string;
  description: string;
  captions?: string[]; // viral captions/hashtags for target audience
  accepted: boolean;
  scriptId?: string;
}



