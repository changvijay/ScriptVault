import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AIProviderKey } from './types';

const SETTINGS_KEY = '@scriptvault:ai:settings';
const KEY_PREFIX = '@scriptvault:ai:key:';

function secureKey(provider: AIProviderKey): string {
  return `${KEY_PREFIX}${provider}`;
}

/** Read an API key from secure storage (native) or AsyncStorage (web fallback). */
export async function getApiKey(provider: AIProviderKey): Promise<string | null> {
  const key = secureKey(provider);
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

/** Persist an API key securely. Pass empty string to delete. */
export async function setApiKey(provider: AIProviderKey, apiKey: string): Promise<void> {
  const key = secureKey(provider);
  const trimmed = apiKey.trim();

  if (Platform.OS === 'web') {
    if (trimmed) await AsyncStorage.setItem(key, trimmed);
    else await AsyncStorage.removeItem(key);
    return;
  }

  if (trimmed) await SecureStore.setItemAsync(key, trimmed);
  else await SecureStore.deleteItemAsync(key);
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
