import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AIProviderKey,
  AIAction,
  AISettings,
  AIProviderConfigEntry,
  StoredAIProviderConfigEntry,
} from '@/services/ai/types';
import { getProvider } from '@/services/ai/providers';
import { SYSTEM_PROMPTS } from '@/services/ai/prompts';
import {
  getApiKey,
  setApiKey,
  loadSettings,
  saveSettings,
  migrateLegacyStorage,
} from '@/services/ai/storage';

const LEGACY_STORAGE_KEY = '@scriptvault:ai';

const DEFAULT_SETTINGS: AISettings = {
  providers: {},
  activeProvider: null,
};

const ALL_KEYS: AIProviderKey[] = ['gemini', 'claude', 'groq', 'openrouter'];

// ── Context shape ────────────────────────────────────────────────────────────

interface AIContextValue {
  settings: AISettings;
  loading: boolean;
  configuredProviders: AIProviderKey[];
  hasAI: boolean;
  activeProvider: AIProviderKey | null;
  setActiveProvider: (key: AIProviderKey) => Promise<void>;
  saveProvider: (
    key: AIProviderKey,
    apiKey: string,
    enabled: boolean,
    selectedModel?: string,
  ) => Promise<void>;
  testProvider: (key: AIProviderKey, apiKey: string) => Promise<void>;
  runAction: (action: AIAction, content: string) => Promise<string>;
}

const AIContext = createContext<AIContextValue | null>(null);

async function loadAllSettings(): Promise<AISettings> {
  const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacyRaw) await migrateLegacyStorage(legacyRaw);

  const raw = await loadSettings();
  let stored: {
    providers: Partial<Record<AIProviderKey, StoredAIProviderConfigEntry>>;
    activeProvider: AIProviderKey | null;
  } = { providers: {}, activeProvider: null };

  if (raw) {
    try {
      stored = JSON.parse(raw);
    } catch {
      // keep defaults
    }
  }

  const providers: AISettings['providers'] = {};
  for (const key of ALL_KEYS) {
    const cfg = stored.providers[key];
    const apiKey = (await getApiKey(key)) ?? '';
    if (cfg || apiKey) {
      providers[key] = {
        apiKey,
        enabled: cfg?.enabled ?? false,
        selectedModel: cfg?.selectedModel ?? getProvider(key).meta.defaultModel,
      };
    }
  }

  let activeProvider = stored.activeProvider;
  if (activeProvider) {
    const active = providers[activeProvider];
    if (!active?.enabled || !active.apiKey.trim()) activeProvider = null;
  }

  return { providers, activeProvider };
}

async function persistSettings(settings: AISettings): Promise<void> {
  const storedProviders: Partial<Record<AIProviderKey, StoredAIProviderConfigEntry>> = {};
  for (const [key, cfg] of Object.entries(settings.providers) as [
    AIProviderKey,
    AIProviderConfigEntry,
  ][]) {
    await setApiKey(key, cfg.apiKey);
    storedProviders[key] = { enabled: cfg.enabled, selectedModel: cfg.selectedModel };
  }
  await saveSettings(
    JSON.stringify({ providers: storedProviders, activeProvider: settings.activeProvider }),
  );
}

// ── Provider component ───────────────────────────────────────────────────────

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllSettings()
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(async (next: AISettings) => {
    setSettings(next);
    await persistSettings(next);
  }, []);

  const saveProvider = useCallback(
    async (
      key: AIProviderKey,
      apiKey: string,
      enabled: boolean,
      selectedModel?: string,
    ) => {
      const existing: AIProviderConfigEntry = settings.providers[key] ?? {
        apiKey: '',
        enabled: false,
        selectedModel: getProvider(key).meta.defaultModel,
      };
      const updated: AIProviderConfigEntry = {
        apiKey: apiKey.trim(),
        enabled,
        selectedModel: selectedModel ?? existing.selectedModel,
      };
      const next: AISettings = {
        ...settings,
        providers: { ...settings.providers, [key]: updated },
        activeProvider: (() => {
          if (settings.activeProvider === key && (!enabled || !apiKey.trim())) {
            const fallback = ALL_KEYS.find(k => {
              if (k === key) return false;
              const c = settings.providers[k];
              return c?.enabled && c.apiKey.trim();
            });
            return fallback ?? null;
          }
          if (settings.activeProvider === null && enabled && apiKey.trim()) return key;
          return settings.activeProvider;
        })(),
      };
      await persist(next);
    },
    [settings, persist],
  );

  const setActiveProvider = useCallback(
    async (key: AIProviderKey) => {
      await persist({ ...settings, activeProvider: key });
    },
    [settings, persist],
  );

  const testProvider = useCallback(async (key: AIProviderKey, apiKey: string) => {
    await getProvider(key).test(apiKey.trim());
  }, []);

  const runAction = useCallback(
    async (action: AIAction, content: string): Promise<string> => {
      if (!content.trim()) throw new Error('Script content is empty.');
      const key = settings.activeProvider;
      if (!key) throw new Error('No AI provider selected.');
      const cfg = settings.providers[key];
      if (!cfg?.apiKey.trim()) throw new Error('API key is not configured.');
      if (!cfg.enabled) throw new Error('This AI provider is disabled.');

      const provider = getProvider(key);
      return provider.generate(cfg.apiKey, cfg.selectedModel, SYSTEM_PROMPTS[action], content);
    },
    [settings],
  );

  const configuredProviders: AIProviderKey[] = ALL_KEYS.filter(k => {
    const c = settings.providers[k];
    return c && c.enabled && c.apiKey.trim().length > 0;
  });

  const hasAI = configuredProviders.length > 0;

  return (
    <AIContext.Provider
      value={{
        settings,
        loading,
        configuredProviders,
        hasAI,
        activeProvider: settings.activeProvider,
        setActiveProvider,
        saveProvider,
        testProvider,
        runAction,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI(): AIContextValue {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used inside <AIProvider>');
  return ctx;
}
