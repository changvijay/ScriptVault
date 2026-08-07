import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdH7f8Qt_fRipwKZP5B7W0Ft-T4-Fug6G-dx7eZjVUn6BNwUg/viewform?usp=publish-editor';

interface AboutWorkspaceProps {
  scriptCount: number;
  goalCount: number;
  categoryCount: number;
  onResetApp: () => void;
}

export function AboutWorkspace({
  scriptCount,
  goalCount,
  categoryCount,
  onResetApp,
}: AboutWorkspaceProps) {
  const colors = useColors();

  const handleOpenFeedback = async () => {
    try {
      if (Platform.OS === 'web') {
        window.open(FEEDBACK_URL, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(FEEDBACK_URL);
      }
    } catch (_) {
      Linking.openURL(FEEDBACK_URL);
    }
  };

  const handleConfirmReset = () => {
    Alert.alert(
      'Reset App & Clear Data?',
      'This will permanently delete all stored scripts, goals, to-dos, categories, and AI settings from your device. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset App Data',
          style: 'destructive',
          onPress: onResetApp,
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Stats overview card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
          Data Overview
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>{scriptCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Script{scriptCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>{goalCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Goal{goalCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>{categoryCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Categor{categoryCount !== 1 ? 'ies' : 'y'}
            </Text>
          </View>
        </View>
      </View>

      {/* Share Feedback Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.aboutHeader}>
          <View style={[styles.infoIconCircle, { backgroundColor: '#8B5CF6' + '20' }]}>
            <Feather name="message-square" size={18} color="#8B5CF6" />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            Feedback & Ideas
          </Text>
        </View>
        <Text style={[styles.aboutText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          Have ideas, feature requests, or bug reports? We would love to hear from you. Help us build the ultimate scriptwriting workspace.
        </Text>
        <Pressable
          onPress={handleOpenFeedback}
          accessibilityRole="button"
          accessibilityLabel="Open feedback form"
          style={({ pressed }) => [
            styles.feedbackBtn,
            {
              backgroundColor: pressed ? '#8B5CF6' + '25' : '#8B5CF6' + '15',
              borderColor: '#8B5CF6' + '40',
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name="message-circle" size={16} color="#8B5CF6" />
          <Text style={[styles.feedbackBtnText, { color: '#8B5CF6', fontFamily: 'Inter_600SemiBold' }]}>
            Share Feedback Form
          </Text>
          <Feather name="external-link" size={14} color="#8B5CF6" />
        </Pressable>
      </View>

      {/* About Application Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.aboutHeader}>
          <View style={[styles.infoIconCircle, { backgroundColor: colors.primary + '1A' }]}>
            <Feather name="info" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            About ScriptVault
          </Text>
        </View>

        <Text style={[styles.aboutText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          Obsidian Prime v2.4.1. ScriptVault is a fully offline script and note management app crafted for high-performance AI workflows. All your data is encrypted and stored locally on your device — no cloud sync or account registration required.
        </Text>

        <View style={styles.linkRow}>
          <Pressable
            accessibilityRole="link"
            onPress={() => Alert.alert('Privacy Policy', 'All data stays on your local device. No personal data or scripts are collected or transmitted to external servers.')}
          >
            <Text style={[styles.linkText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
              Privacy Policy
            </Text>
          </Pressable>
          <Text style={{ color: colors.mutedForeground }}>•</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => Alert.alert('Terms of Service', 'ScriptVault is provided as-is for offline script composition and AI model integration.')}
          >
            <Text style={[styles.linkText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
              Terms of Service
            </Text>
          </Pressable>
          <Text style={{ color: colors.mutedForeground }}>•</Text>
          <Pressable
            accessibilityRole="link"
            onPress={handleOpenFeedback}
          >
            <Text style={[styles.linkText, { color: '#8B5CF6', fontFamily: 'Inter_500Medium' }]}>
              Feedback Form
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.versionText, { color: colors.mutedForeground + '90', fontFamily: 'Inter_400Regular' }]}>
          Version 1.0.0 (Build 2401)
        </Text>
      </View>

      {/* Danger Zone Card */}
      <View
        style={[
          styles.card,
          styles.dangerCard,
          {
            backgroundColor: '#EF4444' + '0C',
            borderColor: '#EF4444' + '35',
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.dangerRow}>
          <View style={styles.dangerTextGroup}>
            <Text style={[styles.dangerTitle, { color: '#EF4444', fontFamily: 'Inter_600SemiBold' }]}>
              Danger Zone
            </Text>
            <Text style={[styles.dangerSubtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Permanently erase all local scripts, categories, goals, and settings.
            </Text>
          </View>
          <Pressable
            onPress={handleConfirmReset}
            accessibilityRole="button"
            accessibilityLabel="Reset App"
            style={({ pressed }) => [
              styles.resetBtn,
              {
                borderColor: '#EF4444' + '60',
                backgroundColor: pressed ? '#EF4444' + '25' : 'transparent',
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text style={[styles.resetBtnText, { color: '#EF4444', fontFamily: 'Inter_600SemiBold' }]}>
              Reset App
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  card: {
    padding: 20,
    borderWidth: 1,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  statNum: {
    fontSize: 26,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 38,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutText: {
    fontSize: 13,
    lineHeight: 20,
  },
  feedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginTop: 2,
  },
  feedbackBtnText: {
    fontSize: 14,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  linkText: {
    fontSize: 13,
  },
  versionText: {
    fontSize: 11,
    marginTop: 2,
  },
  dangerCard: {
    padding: 18,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dangerTextGroup: {
    flex: 1,
    gap: 4,
  },
  dangerTitle: {
    fontSize: 15,
  },
  dangerSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  resetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  resetBtnText: {
    fontSize: 13,
  },
});
