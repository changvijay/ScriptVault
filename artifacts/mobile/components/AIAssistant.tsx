/**
 * AIAssistant — shows action buttons inside the script editor.
 * Supports default actions, saving custom prompts as new buttons,
 * hold-and-swipe reordering of buttons, and a Manage Actions modal.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  PanResponder,
  Animated,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  AIAction,
  AIActionsPreferences,
  SavedCustomPrompt,
} from '@/services/ai/types';
import { ACTION_META } from '@/services/ai/prompts';
import { useAI } from '@/context/AIContext';
import {
  loadActionsPreferences,
  saveActionsPreferences,
} from '@/services/ai/storage';
import * as Haptics from 'expo-haptics';

const ALL_DEFAULT_ACTIONS: AIAction[] = [
  'trend_idea',
  'enhance',
  'hooks',
  'grammar',
  'cta',
  'tone',
  'shorten',
  'expand',
];

const DEFAULT_PREFS: AIActionsPreferences = {
  order: ALL_DEFAULT_ACTIONS,
  hidden: [],
  customPrompts: [],
};

const EMOJI_PALETTE = ['✨', '⚡️', '🚀', '🔥', '💡', '🎯', '🎨', '📝', '🌐', '💬'];

export interface ActionButtonMeta {
  id: string;
  isCustom: boolean;
  emoji: string;
  label: string;
  description?: string;
  prompt?: string;
}

interface Props {
  scriptContent: string;
  onAccept: (result: string) => void;
}

// ── Draggable button with hold and swipe to sort ─────────────────────────────
function DraggableActionButton({
  button,
  index,
  totalCount,
  onPress,
  onSwap,
}: {
  button: ActionButtonMeta;
  index: number;
  totalCount: number;
  onPress: () => void;
  onSwap: (fromIndex: number, toIndex: number) => void;
}) {
  const colors = useColors();
  const [dragging, setDragging] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const lastSwapTime = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15,
      onPanResponderGrant: () => {
        setDragging(true);
        Animated.spring(scaleAnim, {
          toValue: 1.08,
          useNativeDriver: true,
        }).start();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      onPanResponderMove: (_, g) => {
        const now = Date.now();
        if (now - lastSwapTime.current < 350) return;

        if (g.dx > 40 && index < totalCount - 1) {
          lastSwapTime.current = now;
          onSwap(index, index + 1);
          Haptics.selectionAsync();
        } else if (g.dx < -40 && index > 0) {
          lastSwapTime.current = now;
          onSwap(index, index - 1);
          Haptics.selectionAsync();
        }
      },
      onPanResponderRelease: (_, g) => {
        setDragging(false);
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
        if (Math.abs(g.dx) < 10 && Math.abs(g.dy) < 10) {
          onPress();
        }
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      style={{ transform: [{ scale: scaleAnim }] }}
      {...panResponder.panHandlers}
    >
      <Pressable
        onPress={onPress}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }}
        style={({ pressed }) => [
          styles.actionBtn,
          {
            backgroundColor: dragging
              ? colors.primary + '25'
              : pressed
              ? colors.primary + '18'
              : colors.muted,
            borderColor: dragging
              ? colors.primary
              : pressed
              ? colors.primary + '60'
              : colors.border,
            borderRadius: 12,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.actionLabel,
            { color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
          ]}
          numberOfLines={1}
        >
          {button.emoji} {button.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Save Custom Prompt Modal ─────────────────────────────────────────────────
function SavePromptModal({
  visible,
  initialPrompt,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialPrompt: string;
  onClose: () => void;
  onSave: (label: string, emoji: string, prompt: string) => void;
}) {
  const colors = useColors();
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_PALETTE[0]);
  const [promptText, setPromptText] = useState('');

  useEffect(() => {
    if (visible) {
      const clean = initialPrompt.trim();
      setPromptText(clean);
      setLabel(clean.slice(0, 20) || 'Custom Action');
      setEmoji(EMOJI_PALETTE[0]);
    }
  }, [visible, initialPrompt]);

  const handleSave = () => {
    if (!promptText.trim()) return;
    onSave(
      label.trim() || 'Custom Action',
      emoji,
      promptText.trim(),
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Text
            style={[
              styles.modalTitle,
              { color: colors.foreground, fontFamily: 'Inter_700Bold' },
            ]}
          >
            Save Custom Prompt
          </Text>
          <Pressable onPress={handleSave} disabled={!promptText.trim()}>
            <Text
              style={{
                color: promptText.trim() ? colors.primary : colors.mutedForeground,
                fontFamily: 'Inter_600SemiBold',
                fontSize: 16,
              }}
            >
              Save
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          {/* Emoji selector */}
          <View style={{ gap: 10 }}>
            <Text
              style={[
                styles.fieldLabel,
                { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
              ]}
            >
              Choose Icon Emoji
            </Text>
            <View style={styles.emojiGrid}>
              {EMOJI_PALETTE.map(e => (
                <Pressable
                  key={e}
                  onPress={() => {
                    setEmoji(e);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.emojiSwatch,
                    {
                      backgroundColor:
                        emoji === e ? colors.primary + '25' : colors.muted,
                      borderColor: emoji === e ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Button label */}
          <View style={{ gap: 8 }}>
            <Text
              style={[
                styles.fieldLabel,
                { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
              ]}
            >
              Button Label
            </Text>
            <TextInput
              style={[
                styles.inputField,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  color: colors.foreground,
                  fontFamily: 'Inter_400Regular',
                },
              ]}
              placeholder="e.g. Translate to Spanish"
              placeholderTextColor={colors.mutedForeground}
              value={label}
              onChangeText={setLabel}
            />
          </View>

          {/* Prompt text */}
          <View style={{ gap: 8 }}>
            <Text
              style={[
                styles.fieldLabel,
                { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
              ]}
            >
              Instruction Prompt
            </Text>
            <TextInput
              style={[
                styles.inputField,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  color: colors.foreground,
                  fontFamily: 'Inter_400Regular',
                  minHeight: 100,
                  textAlignVertical: 'top',
                },
              ]}
              multiline
              placeholder="Enter your AI instruction prompt..."
              placeholderTextColor={colors.mutedForeground}
              value={promptText}
              onChangeText={setPromptText}
            />
          </View>

          {/* Preview */}
          <View
            style={[
              styles.previewBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 12,
                fontFamily: 'Inter_500Medium',
              }}
            >
              Preview Button:
            </Text>
            <View
              style={[
                styles.actionBtn,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  alignSelf: 'flex-start',
                  borderRadius: 12,
                  marginTop: 6,
                },
              ]}
            >
              <Text
                style={[
                  styles.actionLabel,
                  { color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
                ]}
              >
                {emoji} {label || 'Custom Action'}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Manage Actions Modal ─────────────────────────────────────────────────────
function ManageActionsModal({
  visible,
  allButtons,
  prefs,
  onClose,
  onUpdatePrefs,
}: {
  visible: boolean;
  allButtons: ActionButtonMeta[];
  prefs: AIActionsPreferences;
  onClose: () => void;
  onUpdatePrefs: (next: AIActionsPreferences) => void;
}) {
  const colors = useColors();

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const order = allButtons.map(b => b.id);
    const tmp = order[index - 1];
    order[index - 1] = order[index];
    order[index] = tmp;
    Haptics.selectionAsync();
    onUpdatePrefs({ ...prefs, order });
  };

  const handleMoveDown = (index: number) => {
    if (index >= allButtons.length - 1) return;
    const order = allButtons.map(b => b.id);
    const tmp = order[index + 1];
    order[index + 1] = order[index];
    order[index] = tmp;
    Haptics.selectionAsync();
    onUpdatePrefs({ ...prefs, order });
  };

  const handleToggleHide = (id: string) => {
    const hidden = prefs.hidden.includes(id)
      ? prefs.hidden.filter(h => h !== id)
      : [...prefs.hidden, id];
    Haptics.selectionAsync();
    onUpdatePrefs({ ...prefs, hidden });
  };

  const handleDeleteCustom = (id: string) => {
    Alert.alert(
      'Delete Custom Prompt',
      'Are you sure you want to delete this custom action button?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const customPrompts = prefs.customPrompts.filter(c => c.id !== id);
            const order = prefs.order.filter(o => o !== id);
            const hidden = prefs.hidden.filter(h => h !== id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onUpdatePrefs({ order, hidden, customPrompts });
          },
        },
      ],
    );
  };

  const handleResetDefault = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onUpdatePrefs({
      ...prefs,
      order: ALL_DEFAULT_ACTIONS,
      hidden: [],
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Text
            style={[
              styles.modalTitle,
              { color: colors.foreground, fontFamily: 'Inter_700Bold' },
            ]}
          >
            Manage AI Actions
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text
              style={{
                color: colors.primary,
                fontFamily: 'Inter_600SemiBold',
                fontSize: 16,
              }}
            >
              Done
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            Reorder buttons, hide unused actions, or delete saved custom prompts.
            You can also hold and swipe buttons left/right in the editor bar.
          </Text>

          {allButtons.map((btn, index) => {
            const isHidden = prefs.hidden.includes(btn.id);
            return (
              <View
                key={btn.id}
                style={[
                  styles.manageRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: isHidden ? 0.6 : 1,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Text style={{ fontSize: 18 }}>{btn.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text
                        style={[
                          styles.manageRowLabel,
                          { color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
                        ]}
                        numberOfLines={1}
                      >
                        {btn.label}
                      </Text>
                      <View
                        style={[
                          styles.tagBadge,
                          {
                            backgroundColor: btn.isCustom
                              ? colors.primary + '20'
                              : colors.muted,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            color: btn.isCustom ? colors.primary : colors.mutedForeground,
                            fontFamily: 'Inter_600SemiBold',
                          }}
                        >
                          {btn.isCustom ? 'Custom' : 'Default'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Control buttons */}
                <View style={styles.manageRowBtns}>
                  <Pressable
                    onPress={() => handleMoveUp(index)}
                    disabled={index === 0}
                    style={[
                      styles.iconBtn,
                      { opacity: index === 0 ? 0.25 : 1 },
                    ]}
                  >
                    <Feather name="arrow-up" size={16} color={colors.foreground} />
                  </Pressable>

                  <Pressable
                    onPress={() => handleMoveDown(index)}
                    disabled={index === allButtons.length - 1}
                    style={[
                      styles.iconBtn,
                      { opacity: index === allButtons.length - 1 ? 0.25 : 1 },
                    ]}
                  >
                    <Feather name="arrow-down" size={16} color={colors.foreground} />
                  </Pressable>

                  <Pressable
                    onPress={() => handleToggleHide(btn.id)}
                    style={styles.iconBtn}
                  >
                    <Feather
                      name={isHidden ? 'eye-off' : 'eye'}
                      size={16}
                      color={isHidden ? colors.mutedForeground : colors.foreground}
                    />
                  </Pressable>

                  {btn.isCustom && (
                    <Pressable
                      onPress={() => handleDeleteCustom(btn.id)}
                      style={styles.iconBtn}
                    >
                      <Feather
                        name="trash-2"
                        size={16}
                        color={colors.destructive}
                      />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}

          <Pressable
            onPress={handleResetDefault}
            style={[
              styles.resetBtn,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <Feather name="rotate-ccw" size={15} color={colors.mutedForeground} />
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
              }}
            >
              Reset to Default Order
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Result preview modal ─────────────────────────────────────────────────────
function ResultModal({
  visible,
  activeButton,
  result,
  loading,
  error,
  onAccept,
  onDiscard,
  onRegenerate,
}: {
  visible: boolean;
  activeButton: ActionButtonMeta | null;
  result: string;
  loading: boolean;
  error: string | null;
  onAccept: () => void;
  onDiscard: () => void;
  onRegenerate: () => void;
}) {
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDiscard}
    >
      <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onDiscard} hitSlop={10}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Text
            style={[
              styles.modalTitle,
              { color: colors.foreground, fontFamily: 'Inter_700Bold' },
            ]}
          >
            {activeButton
              ? `${activeButton.emoji} ${activeButton.label}`
              : '✨ AI Result'}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={[
                styles.loadingText,
                { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
              ]}
            >
              Generating…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorWrap}>
            <Feather name="alert-circle" size={40} color={colors.destructive} />
            <Text
              style={[
                styles.errorTitle,
                { color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
              ]}
            >
              Something went wrong
            </Text>
            <Text
              style={[
                styles.errorMsg,
                { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
              ]}
            >
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
              style={[
                styles.resultText,
                {
                  color: colors.foreground,
                  fontFamily: 'Inter_400Regular',
                  lineHeight: 24,
                },
              ]}
            >
              {result}
            </Text>
          </ScrollView>
        )}

        {/* Actions */}
        <View
          style={[
            styles.modalFooter,
            { borderTopColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          {error ? (
            <>
              <Pressable
                onPress={onRegenerate}
                style={[
                  styles.footerBtn,
                  { backgroundColor: colors.primary, flex: 1 },
                ]}
              >
                <Feather
                  name="refresh-cw"
                  size={16}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.footerBtnText,
                    {
                      color: colors.primaryForeground,
                      fontFamily: 'Inter_600SemiBold',
                    },
                  ]}
                >
                  Try Again
                </Text>
              </Pressable>
              <Pressable
                onPress={onDiscard}
                style={[
                  styles.footerBtn,
                  { backgroundColor: colors.muted, flex: 1 },
                ]}
              >
                <Text
                  style={[
                    styles.footerBtnText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: 'Inter_500Medium',
                    },
                  ]}
                >
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
                <Feather
                  name="refresh-cw"
                  size={15}
                  color={loading ? colors.mutedForeground : colors.foreground}
                />
                <Text
                  style={[
                    styles.footerBtnText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: 'Inter_500Medium',
                    },
                  ]}
                >
                  Regenerate
                </Text>
              </Pressable>
              <Pressable
                onPress={onDiscard}
                style={[styles.footerBtn, { backgroundColor: colors.muted }]}
              >
                <Text
                  style={[
                    styles.footerBtnText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: 'Inter_500Medium',
                    },
                  ]}
                >
                  ❌ Discard
                </Text>
              </Pressable>
              <Pressable
                onPress={onAccept}
                disabled={loading || !result}
                style={[
                  styles.footerBtn,
                  { backgroundColor: colors.primary, flex: 1 },
                ]}
              >
                <Feather
                  name="check"
                  size={16}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.footerBtnText,
                    {
                      color: colors.primaryForeground,
                      fontFamily: 'Inter_600SemiBold',
                    },
                  ]}
                >
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

  const [prefs, setPrefs] = useState<AIActionsPreferences>(DEFAULT_PREFS);
  const [activeButton, setActiveButton] = useState<ActionButtonMeta | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [manageModalVisible, setManageModalVisible] = useState(false);

  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    loadActionsPreferences().then(raw => {
      if (raw) {
        try {
          const parsed: AIActionsPreferences = JSON.parse(raw);
          const existingOrder = parsed.order ?? ALL_DEFAULT_ACTIONS;
          const orderWithTrend = existingOrder.includes('trend_idea')
            ? existingOrder
            : ['trend_idea', ...existingOrder];
          setPrefs({
            order: orderWithTrend,
            hidden: parsed.hidden ?? [],
            customPrompts: parsed.customPrompts ?? [],
          });
        } catch {
          // keep defaults
        }
      }
    });
  }, []);

  const updatePrefs = useCallback(async (next: AIActionsPreferences) => {
    setPrefs(next);
    await saveActionsPreferences(JSON.stringify(next));
  }, []);

  const getUnifiedButtons = (p: AIActionsPreferences): ActionButtonMeta[] => {
    const map: Record<string, ActionButtonMeta> = {};

    ALL_DEFAULT_ACTIONS.forEach(k => {
      const meta = ACTION_META[k];
      map[k] = {
        id: k,
        isCustom: false,
        emoji: meta.emoji,
        label: meta.label,
        description: meta.description,
      };
    });

    p.customPrompts.forEach(cp => {
      map[cp.id] = {
        id: cp.id,
        isCustom: true,
        emoji: cp.emoji,
        label: cp.label,
        prompt: cp.prompt,
        description: cp.prompt,
      };
    });

    const ordered: ActionButtonMeta[] = [];
    const visited = new Set<string>();

    p.order.forEach(id => {
      if (map[id]) {
        ordered.push(map[id]);
        visited.add(id);
      }
    });

    Object.keys(map).forEach(id => {
      if (!visited.has(id)) {
        ordered.push(map[id]);
      }
    });

    return ordered;
  };

  const allButtons = getUnifiedButtons(prefs);
  const visibleButtons = allButtons.filter(b => !prefs.hidden.includes(b.id));

  const handleSwapVisible = (fromIndex: number, toIndex: number) => {
    const b1 = visibleButtons[fromIndex];
    const b2 = visibleButtons[toIndex];
    if (!b1 || !b2) return;

    const fullOrder = allButtons.map(b => b.id);
    const idx1 = fullOrder.indexOf(b1.id);
    const idx2 = fullOrder.indexOf(b2.id);

    if (idx1 !== -1 && idx2 !== -1) {
      const tmp = fullOrder[idx1];
      fullOrder[idx1] = fullOrder[idx2];
      fullOrder[idx2] = tmp;
      updatePrefs({ ...prefs, order: fullOrder });
    }
  };

  const executeButtonAction = async (button: ActionButtonMeta) => {
    setActiveButton(button);
    setResult('');
    setError(null);
    setLoading(true);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let text: string;
      if (button.isCustom && button.prompt) {
        text = await runCustomAction(button.prompt, scriptContent);
      } else {
        text = await runAction(button.id as AIAction, scriptContent);
      }
      setResult(text);
    } catch (e: any) {
      setError(e?.message ?? 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const runCustomText = async (prompt: string) => {
    setActiveButton({
      id: 'temp_custom',
      isCustom: true,
      emoji: '✨',
      label: 'Custom Prompt',
      prompt,
    });
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

  const handleSavePrompt = (label: string, emoji: string, prompt: string) => {
    const newId = 'custom_' + Date.now();
    const newPrompt: SavedCustomPrompt = {
      id: newId,
      label,
      emoji,
      prompt,
    };
    const nextPrompts = [...prefs.customPrompts, newPrompt];
    const nextOrder = [...prefs.order, newId];
    updatePrefs({ ...prefs, customPrompts: nextPrompts, order: nextOrder });
    setCustomInput('');
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
    if (activeButton) {
      if (activeButton.id === 'temp_custom' && activeButton.prompt) {
        runCustomText(activeButton.prompt);
      } else {
        executeButtonAction(activeButton);
      }
    }
  };

  if (!hasAI) {
    return (
      <View
        style={[
          styles.emptyWrap,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        <Feather name="cpu" size={28} color={colors.mutedForeground} />
        <Text
          style={[
            styles.emptyTitle,
            { color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
          ]}
        >
          AI Assistant
        </Text>
        <Text
          style={[
            styles.emptyText,
            { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
          ]}
        >
          Configure an AI provider in Settings → AI Providers to unlock script
          enhancement actions.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {/* Action buttons scroll with hold and swipe to sort */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionsScroll}
      >
        {visibleButtons.map((button, index) => (
          <DraggableActionButton
            key={button.id}
            button={button}
            index={index}
            totalCount={visibleButtons.length}
            onPress={() => executeButtonAction(button)}
            onSwap={handleSwapVisible}
          />
        ))}

        {/* Manage Action button icon */}
        <Pressable
          onPress={() => {
            setManageModalVisible(true);
            Haptics.selectionAsync();
          }}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.manageBtn,
            {
              backgroundColor: pressed ? colors.primary + '18' : colors.card,
              borderColor: pressed ? colors.primary + '60' : colors.border,
              borderRadius: 12,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Feather name="sliders" size={14} color={colors.foreground} />
          <Text
            style={[
              styles.actionLabel,
              { color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
            ]}
          >
            Manage
          </Text>
        </Pressable>
      </ScrollView>

      {/* Custom prompt input + Save Prompt bookmark button */}
      <View
        style={[
          styles.customInputWrap,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TextInput
          style={[
            styles.customInput,
            { color: colors.foreground, fontFamily: 'Inter_400Regular' },
          ]}
          placeholder="Ask AI to do something else..."
          placeholderTextColor={colors.mutedForeground}
          value={customInput}
          onChangeText={setCustomInput}
          onSubmitEditing={() => {
            if (customInput.trim()) {
              runCustomText(customInput.trim());
            }
          }}
          returnKeyType="send"
        />

        {/* Save button icon */}
        <Pressable
          style={[
            styles.saveBookmarkBtn,
            {
              backgroundColor: customInput.trim()
                ? colors.primary + '20'
                : 'transparent',
              borderColor: customInput.trim() ? colors.primary : 'transparent',
            },
          ]}
          disabled={!customInput.trim()}
          onPress={() => {
            if (customInput.trim()) {
              setSaveModalVisible(true);
              Haptics.selectionAsync();
            }
          }}
        >
          <Feather
            name="bookmark"
            size={16}
            color={customInput.trim() ? colors.primary : colors.mutedForeground}
          />
        </Pressable>

        {/* Send button icon */}
        <Pressable
          style={[
            styles.customSendBtn,
            {
              backgroundColor: customInput.trim()
                ? colors.primary
                : colors.muted,
            },
          ]}
          disabled={!customInput.trim()}
          onPress={() => {
            if (customInput.trim()) {
              runCustomText(customInput.trim());
            }
          }}
        >
          <Feather
            name="arrow-up"
            size={16}
            color={
              customInput.trim()
                ? colors.primaryForeground
                : colors.mutedForeground
            }
          />
        </Pressable>
      </View>

      {/* Save prompt modal */}
      <SavePromptModal
        visible={saveModalVisible}
        initialPrompt={customInput}
        onClose={() => setSaveModalVisible(false)}
        onSave={handleSavePrompt}
      />

      {/* Manage actions modal */}
      <ManageActionsModal
        visible={manageModalVisible}
        allButtons={allButtons}
        prefs={prefs}
        onClose={() => setManageModalVisible(false)}
        onUpdatePrefs={updatePrefs}
      />

      {/* Result modal */}
      <ResultModal
        visible={modalVisible}
        activeButton={activeButton}
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

  actionsScroll: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 6,
  },
  manageBtn: {
    paddingHorizontal: 12,
  },
  actionLabel: { fontSize: 12 },

  customInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 6,
    gap: 6,
  },
  customInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  saveBookmarkBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modals shared
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
  fieldLabel: { fontSize: 14 },
  inputField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emojiSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },

  // Manage Actions modal rows
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  manageRowLabel: { fontSize: 15 },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  manageRowBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },

  // Result modal
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
