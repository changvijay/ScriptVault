/**
 * AIAssistant — shows action buttons inside the script editor.
 * Handles the full workflow: select action → loading → preview → accept/discard/regenerate.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAI } from '@/context/AIContext';
import { AIAction, AIProviderKey } from '@/services/ai/types';
import { ACTION_META } from '@/services/ai/prompts';
import { getAllProviderMeta } from '@/services/ai/providers';
import * as Haptics from 'expo-haptics';

const ALL_ACTIONS: AIAction[] = [
  'enhance', 'hooks', 'grammar', 'cta', 'tone', 'shorten', 'expand',
];

interface Props {
  scriptContent: string;
  onAccept: (result: string) => void;
}

// ── Provider / model dropdown ────────────────────────────────────────────────
function ProviderDropdown() {
  const colors = useColors();
  const { configuredProviders, activeProvider, setActiveProvider, settings } = useAI();
  const allMeta = getAllProviderMeta();
  const [open, setOpen] = useState(false);

  if (configuredProviders.length === 0) return null;

  const activeMeta = activeProvider ? allMeta.find(m => m.key === activeProvider) : null;
  const activeCfg = activeProvider ? settings.providers[activeProvider] : null;
  const activeModelLabel = activeMeta && activeCfg
    ? activeMeta.models.find(m => m.id === activeCfg.selectedModel)?.label ?? activeCfg.selectedModel
    : '';

  const handleSelect = (key: AIProviderKey) => {
    setActiveProvider(key);
    setOpen(false);
    Haptics.selectionAsync();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.dropdownBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.dropdownLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
            AI Provider
          </Text>
          <View style={styles.dropdownValueRow}>
            {activeMeta && <View style={[styles.providerDot, { backgroundColor: activeMeta.color }]} />}
            <Text style={[styles.dropdownValue, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {activeModelLabel || activeMeta?.displayName || 'Select provider'}
            </Text>
          </View>
        </View>
        <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownOverlay} onPress={() => setOpen(false)}>
          <View style={[styles.dropdownSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dropdownSheetTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', borderBottomColor: colors.border }]}>
              AI Provider
            </Text>
            {configuredProviders.map(key => {
              const meta = allMeta.find(m => m.key === key)!;
              const cfg = settings.providers[key];
              const modelLabel = meta.models.find(m => m.id === cfg?.selectedModel)?.label ?? cfg?.selectedModel;
              const active = activeProvider === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => handleSelect(key)}
                  style={[
                    styles.dropdownOption,
                    {
                      backgroundColor: active ? meta.color + '15' : 'transparent',
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.providerDot, { backgroundColor: meta.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dropdownOptionName, { color: colors.foreground, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                      {modelLabel}
                    </Text>
                    <Text style={[styles.dropdownOptionSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                      {meta.displayName}
                    </Text>
                  </View>
                  {active && <Feather name="check" size={16} color={meta.color} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Result preview modal ─────────────────────────────────────────────────────
function ResultModal({
  visible,
  actionKey,
  result,
  loading,
  error,
  onAccept,
  onDiscard,
  onRegenerate,
}: {
  visible: boolean;
  actionKey: AIAction | null;
  result: string;
  loading: boolean;
  error: string | null;
  onAccept: () => void;
  onDiscard: () => void;
  onRegenerate: () => void;
}) {
  const colors = useColors();
  const meta = actionKey ? ACTION_META[actionKey] : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDiscard}>
      <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onDiscard} hitSlop={10}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            {meta ? `${meta.emoji} ${meta.label}` : 'AI Result'}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Generating…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorWrap}>
            <Feather name="alert-circle" size={40} color={colors.destructive} />
            <Text style={[styles.errorTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              Something went wrong
            </Text>
            <Text style={[styles.errorMsg, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {error}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              selectable
              style={[styles.resultText, { color: colors.foreground, fontFamily: 'Inter_400Regular', lineHeight: 24 }]}
            >
              {result}
            </Text>
          </ScrollView>
        )}

        {/* Actions */}
        <View style={[styles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {error ? (
            <>
              <Pressable
                onPress={onRegenerate}
                style={[styles.footerBtn, { backgroundColor: colors.primary, flex: 1 }]}
              >
                <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
                <Text style={[styles.footerBtnText, { color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }]}>
                  Try Again
                </Text>
              </Pressable>
              <Pressable
                onPress={onDiscard}
                style={[styles.footerBtn, { backgroundColor: colors.muted, flex: 1 }]}
              >
                <Text style={[styles.footerBtnText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                  Discard
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={onRegenerate}
                disabled={loading}
                style={[styles.footerBtn, { backgroundColor: colors.muted }]}
              >
                <Feather name="refresh-cw" size={15} color={loading ? colors.mutedForeground : colors.foreground} />
                <Text style={[styles.footerBtnText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                  Regenerate
                </Text>
              </Pressable>
              <Pressable
                onPress={onDiscard}
                style={[styles.footerBtn, { backgroundColor: colors.muted }]}
              >
                <Text style={[styles.footerBtnText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                  ❌ Discard
                </Text>
              </Pressable>
              <Pressable
                onPress={onAccept}
                disabled={loading || !result}
                style={[styles.footerBtn, { backgroundColor: colors.primary, flex: 1 }]}
              >
                <Feather name="check" size={16} color={colors.primaryForeground} />
                <Text style={[styles.footerBtnText, { color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }]}>
                  Accept & Save
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function AIAssistant({ scriptContent, onAccept }: Props) {
  const colors = useColors();
  const { hasAI, runAction } = useAI();

  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: AIAction) => {
    setActiveAction(action);
    setResult('');
    setError(null);
    setLoading(true);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const text = await runAction(action, scriptContent);
      setResult(text);
    } catch (e: any) {
      setError(e?.message ?? 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    onAccept(result);
    setModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDiscard = () => {
    setModalVisible(false);
    Haptics.selectionAsync();
  };

  const handleRegenerate = () => {
    if (activeAction) run(activeAction);
  };

  // Not configured
  if (!hasAI) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Feather name="cpu" size={28} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
          AI Assistant
        </Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          Configure an AI provider in Settings → AI Providers to unlock script enhancement actions.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {/* Provider dropdown */}
      <ProviderDropdown />

      {/* Action buttons grid */}
      <View style={styles.actionsGrid}>
        {ALL_ACTIONS.map(action => {
          const meta = ACTION_META[action];
          return (
            <Pressable
              key={action}
              onPress={() => run(action)}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: pressed ? colors.primary + '18' : colors.muted,
                  borderColor: pressed ? colors.primary + '60' : colors.border,
                  borderRadius: 12,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text style={styles.actionEmoji}>{meta.emoji}</Text>
              <Text
                style={[styles.actionLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}
                numberOfLines={1}
              >
                {meta.label}
              </Text>
              <Text
                style={[styles.actionDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}
                numberOfLines={2}
              >
                {meta.description}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Result modal */}
      <ResultModal
        visible={modalVisible}
        actionKey={activeAction}
        result={result}
        loading={loading}
        error={error}
        onAccept={handleAccept}
        onDiscard={handleDiscard}
        onRegenerate={handleRegenerate}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Not-configured empty state
  emptyWrap: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 16, marginTop: 4 },
  emptyText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },

  // Provider dropdown
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  dropdownLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  dropdownValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  dropdownValue: { fontSize: 15 },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dropdownSheet: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownSheetTitle: {
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownOptionName: { fontSize: 15 },
  dropdownOptionSub: { fontSize: 12, marginTop: 2 },
  providerDot: { width: 8, height: 8, borderRadius: 4 },

  // Actions grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionBtn: {
    width: '47%',
    padding: 14,
    gap: 4,
    borderWidth: 1,
  },
  actionEmoji: { fontSize: 22 },
  actionLabel: { fontSize: 14 },
  actionDesc: { fontSize: 11, lineHeight: 16 },

  // Result modal
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: { fontSize: 15 },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorTitle: { fontSize: 18, textAlign: 'center' },
  errorMsg: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  resultText: { fontSize: 15 },
  modalFooter: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
  },
  footerBtnText: { fontSize: 14 },
});
