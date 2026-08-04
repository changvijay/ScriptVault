import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Linking,
  Easing,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { AIProviderKey } from '@/services/ai/types';

interface GuideStep {
  step: number;
  title: string;
  desc: string;
}

interface ProviderGuide {
  key: AIProviderKey;
  name: string;
  shortName: string;
  icon: keyof typeof Feather.glyphMap;
  badge: string;
  badgeColor: string;
  accentColor: string;
  url: string;
  displayUrl: string;
  estimatedMinutes: number;
  steps: GuideStep[];
}

const PROVIDER_GUIDES: ProviderGuide[] = [
  {
    key: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    icon: 'star',
    badge: 'Recommended · Free tier',
    badgeColor: '#10B981',
    accentColor: '#10B981',
    url: 'https://aistudio.google.com/app/apikey',
    displayUrl: 'aistudio.google.com/app/apikey',
    estimatedMinutes: 2,
    steps: [
      {
        step: 1,
        title: 'Open Google AI Studio',
        desc: 'Visit aistudio.google.com/app/apikey in your web browser.',
      },
      {
        step: 2,
        title: 'Sign in with Google',
        desc: 'You can use any free personal Gmail or Google Workspace account.',
      },
      {
        step: 3,
        title: 'Create API key',
        desc: 'Look for the blue "Create API key" button at the top of the dashboard.',
      },
      {
        step: 4,
        title: 'Select a project',
        desc: 'Choose an existing Cloud project or select the option to create a new one.',
      },
      {
        step: 5,
        title: 'Paste into ScriptVault',
        desc: 'Copy your generated key (AIzaSy...) and paste it into your settings.',
      },
    ],
  },
  {
    key: 'claude',
    name: 'Anthropic Claude',
    shortName: 'Claude',
    icon: 'cpu',
    badge: 'High intelligence',
    badgeColor: '#D97706',
    accentColor: '#D97706',
    url: 'https://console.anthropic.com',
    displayUrl: 'console.anthropic.com',
    estimatedMinutes: 3,
    steps: [
      {
        step: 1,
        title: 'Go to Anthropic Console',
        desc: 'Visit console.anthropic.com in your web browser.',
      },
      {
        step: 2,
        title: 'Log in to your account',
        desc: 'Sign up for a developer account or sign in with your email.',
      },
      {
        step: 3,
        title: 'Navigate to API keys',
        desc: 'In the left sidebar or settings menu, select "API Keys".',
      },
      {
        step: 4,
        title: 'Generate new key',
        desc: 'Give your key a descriptive name like "ScriptVault App" and create.',
      },
      {
        step: 5,
        title: 'Paste into ScriptVault',
        desc: 'Copy the secret key (sk-ant-...) immediately and paste it into ScriptVault.',
      },
    ],
  },
  {
    key: 'groq',
    name: 'Groq',
    shortName: 'Groq',
    icon: 'zap',
    badge: 'Ultra-fast inference',
    badgeColor: '#F59E0B',
    accentColor: '#F59E0B',
    url: 'https://console.groq.com/keys',
    displayUrl: 'console.groq.com/keys',
    estimatedMinutes: 2,
    steps: [
      {
        step: 1,
        title: 'Open Groq Cloud Console',
        desc: 'Go to console.groq.com/keys in your web browser.',
      },
      {
        step: 2,
        title: 'Sign in securely',
        desc: 'Log in using your Google account, GitHub, or email address.',
      },
      {
        step: 3,
        title: 'Create API key',
        desc: 'Click the "Create API Key" button and assign a label to your key.',
      },
      {
        step: 4,
        title: 'Copy your key',
        desc: 'Copy the key (starts with gsk_...) before closing the popup.',
      },
      {
        step: 5,
        title: 'Paste into ScriptVault',
        desc: 'Return to ScriptVault and paste the key into the provider settings.',
      },
    ],
  },
  {
    key: 'openrouter',
    name: 'OpenRouter',
    shortName: 'OpenRouter',
    icon: 'shuffle',
    badge: 'Access all LLMs',
    badgeColor: '#6366F1',
    accentColor: '#6366F1',
    url: 'https://openrouter.ai/keys',
    displayUrl: 'openrouter.ai/keys',
    estimatedMinutes: 2,
    steps: [
      {
        step: 1,
        title: 'Visit OpenRouter API keys',
        desc: 'Navigate to openrouter.ai/keys in your web browser.',
      },
      {
        step: 2,
        title: 'Authenticate',
        desc: 'Log into your OpenRouter account or create a free account.',
      },
      {
        step: 3,
        title: 'Create a new key',
        desc: 'Click "Create Key", name it "ScriptVault", and optionally set a limit.',
      },
      {
        step: 4,
        title: 'Secure your key',
        desc: 'Copy the secret key string (starts with sk-or-v1-...).',
      },
      {
        step: 5,
        title: 'Paste into ScriptVault',
        desc: 'Paste it into the OpenRouter provider settings inside ScriptVault.',
      },
    ],
  },
];

export interface APIKeyGuideModalProps {
  visible: boolean;
  initialProvider?: AIProviderKey;
  onClose: () => void;
}

export function APIKeyGuideModal({
  visible,
  initialProvider = 'gemini',
  onClose,
}: APIKeyGuideModalProps) {
  const colors = useColors();
  const [selectedKey, setSelectedKey] = useState<AIProviderKey>(initialProvider);
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslate = useRef(new Animated.Value(0)).current;
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentGuide =
    PROVIDER_GUIDES.find(g => g.key === selectedKey) ?? PROVIDER_GUIDES[0];

  const switchProvider = (key: AIProviderKey) => {
    if (key === selectedKey) return;
    Haptics.selectionAsync();
    setCopied(false);
    setLinkError(false);

    // Quick cross-fade + slide so switching providers feels responsive,
    // not like the screen just jumped.
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 90,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslate, {
        toValue: 6,
        duration: 90,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedKey(key);
      contentTranslate.setValue(-6);
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslate, {
          toValue: 0,
          duration: 160,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(currentGuide.displayUrl);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    copyTimeout.current = setTimeout(() => setCopied(false), 1800);
  };

  const handleOpenLink = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLinkError(false);
    try {
      // canOpenURL can false-negative on some Android configs unless the
      // https scheme is declared under <queries> in AndroidManifest.xml
      // (RN/Expo does this automatically for managed workflow), so we
      // still attempt openURL even if the check is inconclusive.
      const supported = await Linking.canOpenURL(currentGuide.url);
      if (supported === false) {
        setLinkError(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      await Linking.openURL(currentGuide.url);
    } catch (err) {
      console.warn('Failed to open URL:', currentGuide.url, err);
      setLinkError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.iconWrapper, { backgroundColor: colors.primary + '15' }]}>
              <Feather name="key" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                API Configuration
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Connect a provider to power ScriptVault
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={15}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={[styles.closeBtnText, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
              Done
            </Text>
          </Pressable>
        </View>

        {/* Provider Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScroll}
          >
            {PROVIDER_GUIDES.map(guide => {
              const active = selectedKey === guide.key;
              return (
                <Pressable
                  key={guide.key}
                  onPress={() => switchProvider(guide.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${guide.name} setup guide`}
                  style={({ pressed }) => [
                    styles.tabChip,
                    {
                      backgroundColor: active ? colors.foreground : colors.card,
                      borderColor: active ? colors.foreground : colors.border + '50',
                      shadowColor: active ? colors.foreground : '#000',
                      shadowOpacity: active ? 0.15 : 0.03,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    },
                  ]}
                >
                  <Feather
                    name={guide.icon}
                    size={13}
                    color={active ? colors.background : guide.accentColor}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: active ? colors.background : colors.mutedForeground,
                        fontFamily: active ? 'Inter_600SemiBold' : 'Inter_500Medium',
                      },
                    ]}
                  >
                    {guide.shortName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslate }],
            }}
          >
            {/* Overview Card */}
            <View style={[styles.overviewCard, { backgroundColor: colors.card, borderColor: colors.border + '30' }]}>
              <View style={styles.overviewTop}>
                <View style={[styles.providerIconLarge, { backgroundColor: currentGuide.accentColor + '15' }]}>
                  <Feather name={currentGuide.icon} size={20} color={currentGuide.accentColor} />
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={[styles.providerName, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                    {currentGuide.name}
                  </Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: currentGuide.badgeColor + '15', borderColor: currentGuide.badgeColor + '30' }]}>
                      <Text style={[styles.badgeText, { color: currentGuide.badgeColor, fontFamily: 'Inter_600SemiBold' }]}>
                        {currentGuide.badge}
                      </Text>
                    </View>
                    <View style={[styles.timeBadge, { borderColor: colors.border + '50' }]}>
                      <Feather name="clock" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.timeBadgeText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                        ~{currentGuide.estimatedMinutes} min
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border + '40' }]} />

              {/* Link Row */}
              <Text style={[styles.labelSmall, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
                PROVIDER PORTAL
              </Text>
              <View style={styles.urlActionsRow}>
                <Pressable
                  onPress={handleOpenLink}
                  style={({ pressed }) => [
                    styles.urlBox,
                    { backgroundColor: colors.background, borderColor: colors.border + '60' },
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${currentGuide.displayUrl}`}
                >
                  <Feather name="link" size={16} color={colors.mutedForeground} />
                  <Text
                    style={[styles.urlText, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}
                    numberOfLines={1}
                  >
                    {currentGuide.displayUrl}
                  </Text>
                  <Feather name="arrow-up-right" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />
                </Pressable>

                <Pressable
                  onPress={handleCopy}
                  style={({ pressed }) => [
                    styles.copyBtn,
                    {
                      backgroundColor: copied ? '#10B981' + '15' : colors.background,
                      borderColor: copied ? '#10B981' + '40' : colors.border + '60',
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Copy portal link"
                >
                  <Feather
                    name={copied ? 'check' : 'copy'}
                    size={16}
                    color={copied ? '#10B981' : colors.mutedForeground}
                  />
                </Pressable>
              </View>
              {linkError && (
                <View style={styles.linkErrorRow}>
                  <Feather name="alert-circle" size={12} color="#DC2626" />
                  <Text style={[styles.linkErrorText, { color: '#DC2626', fontFamily: 'Inter_500Medium' }]}>
                    Couldn't open automatically — tap copy and paste it into your browser.
                  </Text>
                </View>
              )}
            </View>

            {/* Setup Timeline */}
            <View style={styles.stepsSection}>
              <View style={styles.stepsHeaderRow}>
                <Text style={[styles.labelSmall, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
                  SETUP INSTRUCTIONS
                </Text>
                <Text style={[styles.stepsCount, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                  {currentGuide.steps.length} steps
                </Text>
              </View>

              <View style={styles.stepsList}>
                {currentGuide.steps.map((s, index) => {
                  const isLast = index === currentGuide.steps.length - 1;
                  const isFinal = isLast; // final step is always "paste into ScriptVault"
                  return (
                    <View key={s.step} style={styles.stepRow}>
                      {/* Timeline Column */}
                      <View style={styles.timelineCol}>
                        <View
                          style={[
                            styles.stepDot,
                            {
                              backgroundColor: isFinal ? currentGuide.accentColor : colors.foreground,
                            },
                          ]}
                        >
                          {isFinal ? (
                            <Feather name="check" size={13} color="#FFFFFF" />
                          ) : (
                            <Text style={[styles.stepDotText, { color: colors.background, fontFamily: 'Inter_700Bold' }]}>
                              {s.step}
                            </Text>
                          )}
                        </View>
                        {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.border + '60' }]} />}
                      </View>

                      {/* Content Column */}
                      <View
                        style={[
                          styles.stepContentCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: isFinal ? currentGuide.accentColor + '30' : colors.border + '30',
                          },
                        ]}
                      >
                        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                          {s.title}
                        </Text>
                        <Text style={[styles.stepDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                          {s.desc}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Reassurance footnote */}
            <View style={styles.privacyNote}>
              <Feather name="lock" size={13} color={colors.mutedForeground} />
              <Text style={[styles.privacyNoteText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Your key is stored securely on this device and never leaves it except to call {currentGuide.name}.
              </Text>
            </View>
          </Animated.View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border + '40', backgroundColor: colors.background }]}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            style={({ pressed }) => [
              styles.doneBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="I'm ready, close this guide"
          >
            <Text style={[styles.doneBtnText, { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' }]}>
              I'm Ready
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 19,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    marginRight: -8,
  },
  closeBtnText: {
    fontSize: 15,
  },
  tabsContainer: {
    marginBottom: 4,
  },
  tabsScroll: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 18,
  },
  overviewCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  overviewTop: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  providerIconLarge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    fontSize: 18,
    letterSpacing: -0.4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  timeBadgeText: {
    fontSize: 11.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  labelSmall: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  urlActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  urlBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  urlText: {
    fontSize: 13.5,
    flexShrink: 1,
  },
  copyBtn: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  linkErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  linkErrorText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  stepsSection: {
    gap: 12,
  },
  stepsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  stepsCount: {
    fontSize: 12,
  },
  stepsList: {
    gap: 0,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  timelineCol: {
    alignItems: 'center',
    width: 24,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepDotText: {
    fontSize: 12,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 3,
    borderRadius: 1,
  },
  stepContentCard: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 3,
  },
  stepTitle: {
    fontSize: 14.5,
    letterSpacing: -0.2,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  privacyNoteText: {
    fontSize: 12.5,
    lineHeight: 18,
    flex: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24, // Accommodates safe area gracefully if not explicitly handled
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  doneBtnText: {
    fontSize: 16,
    letterSpacing: 0.2,
  },
});