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
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { AIAction } from '@/services/ai/types';
import { ACTION_META } from '@/services/ai/prompts';
import { useAI } from '@/context/AIContext';

import * as Haptics from 'expo-haptics';

const ALL_ACTIONS: AIAction[] = [
  'enhance', 'hooks', 'grammar', 'cta', 'tone', 'shorten', 'expand',
];

interface Props {
  scriptContent: string;
  onAccept: (result: string) => void;
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
  const { hasAI, runAction, runCustomAction } = useAI();

  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [activeCustomPrompt, setActiveCustomPrompt] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');

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

  const runCustom = async (prompt: string) => {
    setActiveAction(null);
    setActiveCustomPrompt(prompt);
    setResult('');
    setError(null);
    setLoading(true);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const text = await runCustomAction(prompt, scriptContent);
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
    setCustomInput('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDiscard = () => {
    setModalVisible(false);
    Haptics.selectionAsync();
  };

  const handleRegenerate = () => {
    if (activeAction) run(activeAction);
    else if (activeCustomPrompt) runCustom(activeCustomPrompt);
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

      {/* Action buttons scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionsScroll}
      >
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
              <Text
                style={[styles.actionLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}
                numberOfLines={1}
              >
                {meta.emoji} {meta.label}
              </Text>

            </Pressable>
          );
        })}
      </ScrollView>

      {/* Custom prompt input */}
      <View style={[styles.customInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[styles.customInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
          placeholder="Ask AI to do something else..."
          placeholderTextColor={colors.mutedForeground}
          value={customInput}
          onChangeText={setCustomInput}
          onSubmitEditing={() => {
            if (customInput.trim()) {
              runCustom(customInput.trim());
            }
          }}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.customSendBtn, { backgroundColor: customInput.trim() ? colors.primary : colors.muted }]}
          disabled={!customInput.trim()}
          onPress={() => {
            if (customInput.trim()) {
              runCustom(customInput.trim());
            }
          }}
        >
          <Feather name="arrow-up" size={16} color={customInput.trim() ? colors.primaryForeground : colors.mutedForeground} />
        </Pressable>
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



  // Actions scroll
  actionsScroll: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  actionEmoji: { fontSize: 22 },
  actionLabel: { fontSize: 12 },

  // Custom prompt input
  customInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 6,
    gap: 8,
  },
  customInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  customSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
