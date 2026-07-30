import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { AIProviderKey } from '@/services/ai/types';

interface GuideStep {
  step: number;
  title: string;
  desc: string;
}

interface ProviderGuide {
  key: AIProviderKey;
  name: string;
  badge: string;
  badgeColor: string;
  url: string;
  steps: GuideStep[];
}

const PROVIDER_GUIDES: ProviderGuide[] = [
  {
    key: 'gemini',
    name: 'Google Gemini',
    badge: 'Recommended • Free Tier Available',
    badgeColor: '#10B981',
    url: 'aistudio.google.com/app/apikey',
    steps: [
      {
        step: 1,
        title: 'Open Google AI Studio',
        desc: 'Visit aistudio.google.com/app/apikey in your web browser.',
      },
      {
        step: 2,
        title: 'Sign in with your Google Account',
        desc: 'You can use any free personal Gmail or Google Workspace account.',
      },
      {
        step: 3,
        title: 'Click "Create API key"',
        desc: 'Look for the blue "Create API key" button at the top of the API keys dashboard.',
      },
      {
        step: 4,
        title: 'Select a Project',
        desc: 'Choose an existing Google Cloud project or select the option to create a key in a new project.',
      },
      {
        step: 5,
        title: 'Copy & Paste into ScriptVault',
        desc: 'Copy your generated key (starts with AIzaSy...) and paste it into the Google Gemini settings in ScriptVault.',
      },
    ],
  },
  {
    key: 'claude',
    name: 'Anthropic Claude',
    badge: 'High Intelligence • Pro Writing',
    badgeColor: '#D97706',
    url: 'console.anthropic.com',
    steps: [
      {
        step: 1,
        title: 'Go to Anthropic Console',
        desc: 'Visit console.anthropic.com in your web browser.',
      },
      {
        step: 2,
        title: 'Create an Account or Log in',
        desc: 'Sign up for a developer account or sign in with your email.',
      },
      {
        step: 3,
        title: 'Navigate to API Keys',
        desc: 'In the left sidebar or settings menu, select "API Keys".',
      },
      {
        step: 4,
        title: 'Click "Create Key"',
        desc: 'Give your key a descriptive name like "ScriptVault App" and confirm creation.',
      },
      {
        step: 5,
        title: 'Copy & Paste into ScriptVault',
        desc: 'Copy the secret key (starts with sk-ant-...) immediately and paste it into ScriptVault.',
      },
    ],
  },
  {
    key: 'groq',
    name: 'Groq',
    badge: 'Ultra-Fast Inference • Free Tier',
    badgeColor: '#F59E0B',
    url: 'console.groq.com/keys',
    steps: [
      {
        step: 1,
        title: 'Open Groq Cloud Console',
        desc: 'Go to console.groq.com/keys in your web browser.',
      },
      {
        step: 2,
        title: 'Sign in to your Account',
        desc: 'Log in using your Google account, GitHub, or email address.',
      },
      {
        step: 3,
        title: 'Click "Create API Key"',
        desc: 'Click the "Create API Key" button and assign a label to your key.',
      },
      {
        step: 4,
        title: 'Copy your new Key',
        desc: 'Copy the key (starts with gsk_...) before closing the popup.',
      },
      {
        step: 5,
        title: 'Paste into ScriptVault',
        desc: 'Return to ScriptVault and paste the key into the Groq provider settings.',
      },
    ],
  },
  {
    key: 'openrouter',
    name: 'OpenRouter',
    badge: 'Access All LLMs (GPT-4, Llama, etc.)',
    badgeColor: '#6366F1',
    url: 'openrouter.ai/keys',
    steps: [
      {
        step: 1,
        title: 'Visit OpenRouter API Keys',
        desc: 'Navigate to openrouter.ai/keys in your web browser.',
      },
      {
        step: 2,
        title: 'Sign in or Sign up',
        desc: 'Log into your OpenRouter account or create a free account.',
      },
      {
        step: 3,
        title: 'Create a new Key',
        desc: 'Click "Create Key", name it "ScriptVault", and optionally set a usage limit.',
      },
      {
        step: 4,
        title: 'Copy your OpenRouter Key',
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

  const currentGuide =
    PROVIDER_GUIDES.find(g => g.key === selectedKey) ?? PROVIDER_GUIDES[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <View style={styles.headerTitleRow}>
            <Feather name="help-circle" size={20} color={colors.primary} />
            <Text
              style={[
                styles.title,
                { color: colors.foreground, fontFamily: 'Inter_700Bold' },
              ]}
            >
              How to Get an API Key
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Provider Tabs */}
        <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
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
                  onPress={() => {
                    setSelectedKey(guide.key);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.tabChip,
                    {
                      backgroundColor: active
                        ? colors.primary + '18'
                        : colors.muted,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: active
                          ? colors.primary
                          : colors.mutedForeground,
                        fontFamily: active
                          ? 'Inter_600SemiBold'
                          : 'Inter_500Medium',
                      },
                    ]}
                  >
                    {guide.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Step by Step Content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Provider Overview Header Card */}
          <View
            style={[
              styles.overviewCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={styles.overviewTop}>
              <Text
                style={[
                  styles.providerName,
                  { color: colors.foreground, fontFamily: 'Inter_700Bold' },
                ]}
              >
                {currentGuide.name}
              </Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: currentGuide.badgeColor + '18' },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: currentGuide.badgeColor,
                      fontFamily: 'Inter_600SemiBold',
                    },
                  ]}
                >
                  {currentGuide.badge}
                </Text>
              </View>
            </View>

            {/* Website URL box */}
            <View
              style={[
                styles.urlBox,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="globe" size={16} color={colors.primary} />
              <Text
                style={[
                  styles.urlText,
                  {
                    color: colors.foreground,
                    fontFamily: 'Inter_600SemiBold',
                  },
                ]}
              >
                {currentGuide.url}
              </Text>
            </View>
          </View>

          {/* Steps heading */}
          <Text
            style={[
              styles.stepsHeading,
              { color: colors.foreground, fontFamily: 'Inter_700Bold' },
            ]}
          >
            Step-by-Step Process
          </Text>

          {/* Step Cards */}
          <View style={styles.stepsList}>
            {currentGuide.steps.map(s => (
              <View
                key={s.step}
                style={[
                  styles.stepCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <View
                  style={[
                    styles.stepNumberCircle,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepNumberText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: 'Inter_700Bold',
                      },
                    ]}
                  >
                    {s.step}
                  </Text>
                </View>

                <View style={styles.stepContent}>
                  <Text
                    style={[
                      styles.stepTitle,
                      {
                        color: colors.foreground,
                        fontFamily: 'Inter_600SemiBold',
                      },
                    ]}
                  >
                    {s.title}
                  </Text>
                  <Text
                    style={[
                      styles.stepDesc,
                      {
                        color: colors.mutedForeground,
                        fontFamily: 'Inter_400Regular',
                      },
                    ]}
                  >
                    {s.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Footer close button */}
          <Pressable
            onPress={onClose}
            style={[
              styles.doneBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text
              style={[
                styles.doneBtnText,
                {
                  color: colors.primaryForeground,
                  fontFamily: 'Inter_600SemiBold',
                },
              ]}
            >
              Got it, Close Guide
            </Text>
          </Pressable>
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
  },
  closeBtn: {
    padding: 4,
  },
  tabsRow: {
    borderBottomWidth: 1,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  overviewCard: {
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerName: {
    fontSize: 18,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
  },
  urlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  urlText: {
    fontSize: 13,
  },
  stepsHeading: {
    fontSize: 16,
    marginTop: 4,
  },
  stepsList: {
    gap: 10,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  stepNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 15,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  doneBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  doneBtnText: {
    fontSize: 15,
  },
});
