/**
 * AIProvidersSettings — settings section for configuring AI providers.
 * Drop this inside the settings screen's ScrollView.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAI } from '@/context/AIContext';
import { AIProviderKey } from '@/services/ai/types';
import { getAllProviderMeta } from '@/services/ai/providers';
import * as Haptics from 'expo-haptics';

const ALL_METAS = getAllProviderMeta();

// Status indicator
function StatusBadge({ status }: { status: 'connected' | 'not_configured' | 'disabled' }) {
  const colors = useColors();
  const config = {
    connected:      { color: '#10B981', label: 'Connected'    },
    not_configured: { color: colors.mutedForeground, label: 'Not configured' },
    disabled:       { color: colors.mutedForeground, label: 'Disabled'       },
  }[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.color + '18' }]}>
      <View style={[styles.statusDot, { backgroundColor: config.color }]} />
      <Text style={[styles.statusText, { color: config.color, fontFamily: 'Inter_500Medium' }]}>
        {config.label}
      </Text>
    </View>
  );
}

// ── Config modal ─────────────────────────────────────────────────────────────
function ProviderConfigModal({
  providerKey,
  onClose,
}: {
  providerKey: AIProviderKey;
  onClose: () => void;
}) {
  const colors = useColors();
  const { settings, saveProvider, testProvider } = useAI();
  const meta = ALL_METAS.find(m => m.key === providerKey)!;
  const existing = settings.providers[providerKey];

  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [selectedModel, setSelectedModel] = useState(
    existing?.selectedModel ?? meta.defaultModel,
  );
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [testError, setTestError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleTest = async () => {
    if (!apiKey.trim()) {
      Alert.alert('API Key required', 'Please enter an API key before testing.');
      return;
    }
    setTesting(true);
    setTestStatus('idle');
    setTestError('');
    try {
      await testProvider(providerKey, apiKey);
      setTestStatus('ok');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setTestStatus('fail');
      setTestError(e?.message ?? 'Connection failed.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const keyChanged = apiKey.trim() !== (existing?.apiKey ?? '').trim();
    if (apiKey.trim() && keyChanged && testStatus !== 'ok') {
      Alert.alert(
        'Validate API Key',
        'Please test the connection successfully before saving.',
      );
      return;
    }
    setSaving(true);
    try {
      await saveProvider(providerKey, apiKey, enabled, selectedModel);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert('Error', 'Could not save provider settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.modalProviderDot, { backgroundColor: meta.color }]} />
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              {meta.displayName}
            </Text>
          </View>
          <Pressable onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Enable toggle */}
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                Enable Provider
              </Text>
              <Text style={[styles.fieldSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Use {meta.displayName} for AI actions
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.border, true: meta.color + '80' }}
              thumbColor={enabled ? meta.color : colors.mutedForeground}
            />
          </View>

          {/* API Key */}
          <View style={{ gap: 8 }}>
            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              API Key
            </Text>
            <View
              style={[styles.keyInputWrap, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}
            >
              <TextInput
                style={[styles.keyInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                value={apiKey}
                onChangeText={v => { setApiKey(v); setTestStatus('idle'); }}
                placeholder="Paste your API key here…"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable onPress={() => setShowKey(s => !s)} hitSlop={8}>
                <Feather name={showKey ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Test button + status */}
            <View style={[styles.row, { gap: 10 }]}>
              <Pressable
                onPress={handleTest}
                disabled={testing || !apiKey.trim()}
                style={[
                  styles.testBtn,
                  {
                    backgroundColor: testing ? colors.muted : meta.color + '18',
                    borderColor: meta.color + '60',
                    borderRadius: 10,
                    opacity: !apiKey.trim() ? 0.5 : 1,
                  },
                ]}
              >
                {testing ? (
                  <ActivityIndicator size="small" color={meta.color} />
                ) : (
                  <Feather name="zap" size={15} color={meta.color} />
                )}
                <Text style={[styles.testBtnText, { color: meta.color, fontFamily: 'Inter_600SemiBold' }]}>
                  {testing ? 'Testing…' : 'Test Connection'}
                </Text>
              </Pressable>

              {testStatus === 'ok' && (
                <View style={[styles.row, { gap: 4 }]}>
                  <Feather name="check-circle" size={16} color="#10B981" />
                  <Text style={{ color: '#10B981', fontFamily: 'Inter_500Medium', fontSize: 13 }}>
                    Connected
                  </Text>
                </View>
              )}
              {testStatus === 'fail' && (
                <Feather name="x-circle" size={16} color="#EF4444" />
              )}
            </View>

            {testStatus === 'fail' && testError ? (
              <Text style={[styles.testError, { color: '#EF4444', fontFamily: 'Inter_400Regular' }]}>
                {testError}
              </Text>
            ) : null}
          </View>

          {/* Model selector */}
          <View style={{ gap: 8 }}>
            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              Model
            </Text>
            <View style={{ gap: 8 }}>
              {meta.models.map(model => {
                const active = selectedModel === model.id;
                return (
                  <Pressable
                    key={model.id}
                    onPress={() => { setSelectedModel(model.id); Haptics.selectionAsync(); }}
                    style={[
                      styles.modelChip,
                      {
                        backgroundColor: active ? meta.color + '18' : colors.muted,
                        borderColor: active ? meta.color : colors.border,
                        borderRadius: 10,
                      },
                    ]}
                  >
                    <View style={[styles.radioOuter, { borderColor: active ? meta.color : colors.border }]}>
                      {active && <View style={[styles.radioInner, { backgroundColor: meta.color }]} />}
                    </View>
                    <Text style={[styles.modelLabel, { color: colors.foreground, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                      {model.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Where to get key hint */}
          <View style={[styles.hintBox, { backgroundColor: colors.muted, borderRadius: 10, borderColor: colors.border }]}>
            <Feather name="info" size={15} color={colors.mutedForeground} />
            <Text style={[styles.hintText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {providerKey === 'gemini'
                ? 'Get your API key at aistudio.google.com/app/apikey'
                : providerKey === 'claude'
                ? 'Get your API key at console.anthropic.com'
                : providerKey === 'groq'
                ? 'Get your API key at console.groq.com/keys'
                : 'Get your API key at openrouter.ai/keys'}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main section component ───────────────────────────────────────────────────
export function AIProvidersSettings() {
  const colors = useColors();
  const { settings, configuredProviders, activeProvider, setActiveProvider } = useAI();
  const [configuringKey, setConfiguringKey] = useState<AIProviderKey | null>(null);

  return (
    <View style={{ gap: 12 }}>
      {/* Section header */}
      <View style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
          AI Providers
        </Text>
        {configuredProviders.length > 0 && (
          <View style={[styles.statusBadge, { backgroundColor: '#10B981' + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.statusText, { color: '#10B981', fontFamily: 'Inter_500Medium' }]}>
              {configuredProviders.length} active
            </Text>
          </View>
        )}
      </View>

      {/* Provider list card */}
      <View
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginHorizontal: 16, padding: 0, overflow: 'hidden' }]}
      >
        {ALL_METAS.map((meta, idx) => {
          const cfg = settings.providers[meta.key];
          const isConnected = !!(cfg?.apiKey?.trim() && cfg.enabled);
          const isDisabled = !!(cfg?.apiKey?.trim() && !cfg.enabled);
          const status = isConnected ? 'connected' : isDisabled ? 'disabled' : 'not_configured';
          const isActive = activeProvider === meta.key;

          return (
            <Pressable
              key={meta.key}
              onPress={() => setConfiguringKey(meta.key)}
              style={({ pressed }) => [
                styles.providerRow2,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: idx < ALL_METAS.length - 1 ? 1 : 0,
                  backgroundColor: pressed ? colors.muted : colors.card,
                },
              ]}
            >
              {/* Color strip */}
              <View style={[styles.colorStrip, { backgroundColor: meta.color }]} />

              {/* Content */}
              <View style={{ flex: 1, gap: 4 }}>
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <Text style={[styles.providerName, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                    {meta.displayName}
                  </Text>
                  <StatusBadge status={status} />
                </View>
                {isConnected && cfg?.selectedModel && (
                  <Text style={[styles.modelLine, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                    {meta.models.find(m => m.id === cfg.selectedModel)?.label ?? cfg.selectedModel}
                    {isActive ? ' · Active' : ''}
                  </Text>
                )}
              </View>

              {/* Set as active button (only when connected + not already active) */}
              {isConnected && !isActive && configuredProviders.length > 1 && (
                <Pressable
                  onPress={e => {
                    e.stopPropagation?.();
                    setActiveProvider(meta.key);
                    Haptics.selectionAsync();
                  }}
                  style={[styles.setActiveBtn, { backgroundColor: meta.color + '18', borderColor: meta.color + '50' }]}
                >
                  <Text style={[styles.setActiveBtnText, { color: meta.color, fontFamily: 'Inter_500Medium' }]}>
                    Use
                  </Text>
                </Pressable>
              )}

              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          );
        })}
      </View>

      {/* Active provider selector (shown when 2+ connected) */}
      {configuredProviders.length > 1 && (
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={[styles.activePNote, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            Tap "Use" next to any connected provider to set it as the active one for AI actions.
          </Text>
        </View>
      )}

      {/* Config modal */}
      {configuringKey !== null && (
        <ProviderConfigModal
          providerKey={configuringKey}
          onClose={() => setConfiguringKey(null)}
        />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 17, fontWeight: '600' },

  card: { borderWidth: 1 },

  providerRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingRight: 16,
  },
  colorStrip: { width: 4, alignSelf: 'stretch' },
  providerName: { fontSize: 15 },
  modelLine: { fontSize: 12 },

  row: { flexDirection: 'row', alignItems: 'center' },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12 },

  setActiveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  setActiveBtnText: { fontSize: 12 },

  activePNote: { fontSize: 12, lineHeight: 18 },

  // Config modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18 },
  modalProviderDot: { width: 12, height: 12, borderRadius: 6 },

  fieldLabel: { fontSize: 15 },
  fieldSub: { fontSize: 13, marginTop: 2 },

  keyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 8,
  },
  keyInput: { flex: 1, fontSize: 15 },

  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  testBtnText: { fontSize: 14 },
  testError: { fontSize: 13, lineHeight: 19 },

  modelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 9, height: 9, borderRadius: 5 },
  modelLabel: { fontSize: 14 },

  hintBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderWidth: 1,
  },
  hintText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
