import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AIProviderKey, DailyIdea, ContentNiche } from './types';

const SETTINGS_KEY = '@scriptvault:ai:settings';
const KEY_PREFIX = '@scriptvault:ai:key:';

function secureKey(provider: AIProviderKey): string {
  return `${KEY_PREFIX}${provider}`;
}

/** Read an API key from AsyncStorage (with migration fallback from SecureStore). */
export async function getApiKey(provider: AIProviderKey): Promise<string | null> {
  const key = secureKey(provider);
  let value = await AsyncStorage.getItem(key);
  
  if (!value && Platform.OS !== 'web') {
    try {
      value = await SecureStore.getItemAsync(key);
      if (value) {
        // Migrate to AsyncStorage for life-long persistence
        await AsyncStorage.setItem(key, value);
        await SecureStore.deleteItemAsync(key);
      }
    } catch {
      // ignore errors during migration
    }
  }
  
  return value;
}

/** Persist an API key using AsyncStorage. Pass empty string to delete. */
export async function setApiKey(provider: AIProviderKey, apiKey: string): Promise<void> {
  const key = secureKey(provider);
  const trimmed = apiKey.trim();

  if (trimmed) await AsyncStorage.setItem(key, trimmed);
  else await AsyncStorage.removeItem(key);
}

/** Non-sensitive AI settings (no API keys). */
export async function loadSettings(): Promise<string | null> {
  return AsyncStorage.getItem(SETTINGS_KEY);
}

export async function saveSettings(json: string): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, json);
}

/** Migrate API keys from legacy combined AsyncStorage blob. */
export async function migrateLegacyStorage(
  legacyRaw: string,
): Promise<void> {
  try {
    const parsed = JSON.parse(legacyRaw) as {
      providers?: Partial<
        Record<AIProviderKey, { apiKey?: string; enabled?: boolean; selectedModel?: string }>
      >;
      activeProvider?: AIProviderKey | null;
    };

    const providers = parsed.providers ?? {};
    for (const [key, cfg] of Object.entries(providers) as [
      AIProviderKey,
      { apiKey?: string; enabled?: boolean; selectedModel?: string },
    ][]) {
      if (cfg?.apiKey?.trim()) {
        await setApiKey(key, cfg.apiKey);
      }
    }

    const sanitized = {
      providers: Object.fromEntries(
        Object.entries(providers).map(([k, cfg]) => [
          k,
          { enabled: cfg?.enabled ?? false, selectedModel: cfg?.selectedModel },
        ]),
      ),
      activeProvider: parsed.activeProvider ?? null,
    };
    await saveSettings(JSON.stringify(sanitized));
    await AsyncStorage.removeItem('@scriptvault:ai');
  } catch {
    // ignore corrupt legacy data
  }
}

const ACTIONS_PREFS_KEY = '@scriptvault:ai:actions_prefs';

export async function loadActionsPreferences(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIONS_PREFS_KEY);
}

export async function saveActionsPreferences(json: string): Promise<void> {
  await AsyncStorage.setItem(ACTIONS_PREFS_KEY, json);
}

// ── Content Niches & Daily AI Idea Storage ───────────────────────────────────

const NICHES_KEY = '@scriptvault:ai:content_niches';
const ACTIVE_NICHE_KEY = '@scriptvault:ai:active_niche_id';
const DAILY_IDEA_KEY = '@scriptvault:ai:daily_idea';

export async function loadContentNiches(): Promise<ContentNiche[]> {
  try {
    const raw = await AsyncStorage.getItem(NICHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migrate legacy string array to ContentNiche[]
    return parsed.map((item, idx): ContentNiche => {
      if (typeof item === 'string') {
        return {
          id: `niche_migrated_${idx}_${Date.now()}`,
          niche: item,
          title: item,
          description: `Content focused on ${item}. Tailored for the target audience with engaging hooks and culturally relevant trends.`,
          language: 'English',
          captions: [],
        };
      }
      return item as ContentNiche;
    });
  } catch {
    return [];
  }
}

export async function saveContentNiches(niches: ContentNiche[]): Promise<void> {
  await AsyncStorage.setItem(NICHES_KEY, JSON.stringify(niches));
}

export async function loadActiveNicheId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_NICHE_KEY);
  } catch {
    return null;
  }
}

export async function saveActiveNicheId(id: string | null): Promise<void> {
  if (id) {
    await AsyncStorage.setItem(ACTIVE_NICHE_KEY, id);
  } else {
    await AsyncStorage.removeItem(ACTIVE_NICHE_KEY);
  }
}

export async function getActiveNicheContext(): Promise<string> {
  const niches = await loadContentNiches();
  if (niches.length === 0) return '';
  const activeId = await loadActiveNicheId();
  const activeNiche = niches.find(n => n.id === activeId) ?? niches[0];
  return `
---
CRITICAL CONTENT NICHE & TARGET AUDIENCE RULES:
You are communicating with the user for their content niche: "${activeNiche.title}".
Niche Content & Audience Context: "${activeNiche.description}".
Target Audience Language: "${activeNiche.language || 'English'}".
IMPORTANT INSTRUCTION: You MUST tailor all answers, suggestions, edits, captions, hooks, and ideas strictly for this niche audience format, in the target language (${activeNiche.language || 'English'}), using current market trends and language-specific cultural reach/captions (e.g., if language is Tamil, provide high Tamil-reached audience captions, slang, and trend analysis).
---
`;
}

export async function loadDailyIdea(): Promise<DailyIdea | null> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_IDEA_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveDailyIdea(idea: DailyIdea): Promise<void> {
  await AsyncStorage.setItem(DAILY_IDEA_KEY, JSON.stringify(idea));
}


