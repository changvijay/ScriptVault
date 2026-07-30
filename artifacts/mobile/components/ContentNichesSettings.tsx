import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAI } from '@/context/AIContext';
import {
  loadContentNiches,
  saveContentNiches,
  loadActiveNicheId,
  saveActiveNicheId,
  saveDailyIdea,
} from '@/services/ai/storage';
import { ContentNiche } from '@/services/ai/types';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

const COMMON_LANGUAGES = ['Tamil', 'English', 'Hindi', 'Spanish', 'French', 'Arabic'];

export function ContentNichesSettings() {
  const colors = useColors();
  const { hasAI } = useAI();
  const [niches, setNiches] = useState<ContentNiche[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Modal State for Add/Edit Niche
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [languageInput, setLanguageInput] = useState('Tamil');
  const [contentInput, setContentInput] = useState('');

  useEffect(() => {
    loadContentNiches().then(data => {
      setNiches(data);
    });
    loadActiveNicheId().then(id => {
      setActiveId(id);
    });
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setTitleInput('');
    setLanguageInput('Tamil');
    setContentInput('');
    setModalVisible(true);
    Haptics.selectionAsync();
  };

  const openEditModal = (item: ContentNiche) => {
    setEditingId(item.id);
    setTitleInput(item.title);
    setLanguageInput(item.language || 'English');
    setContentInput(item.content);
    setModalVisible(true);
    Haptics.selectionAsync();
  };

  const handleSaveNiche = async () => {
    if (!titleInput.trim()) {
      Alert.alert('Title Required', 'Please enter a title for this niche.');
      return;
    }
    const cleanTitle = titleInput.trim();
    const cleanContent =
      contentInput.trim() ||
      `Content focused on ${cleanTitle}. Tailored for the target audience with engaging hooks and culturally relevant trends.`;
    const cleanLang = languageInput.trim() || 'English';

    let next: ContentNiche[];
    if (editingId) {
      next = niches.map(n =>
        n.id === editingId
          ? {
            ...n,
            title: cleanTitle,
            content: cleanContent,
            language: cleanLang,
          }
          : n,
      );
    } else {
      const newNiche: ContentNiche = {
        id: `niche_${Date.now()}`,
        title: cleanTitle,
        content: cleanContent,
        language: cleanLang,
      };
      next = [...niches, newNiche];
      if (!activeId && next.length === 1) {
        setActiveId(newNiche.id);
        await saveActiveNicheId(newNiche.id);
      }
    }

    setNiches(next);
    await saveContentNiches(next);
    setModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemoveNiche = async (id: string) => {
    const next = niches.filter(n => n.id !== id);
    setNiches(next);
    await saveContentNiches(next);
    if (activeId === id) {
      const nextActive = next.length > 0 ? next[0].id : null;
      setActiveId(nextActive);
      await saveActiveNicheId(nextActive);
    }
    Haptics.selectionAsync();
  };

  const handleSetActive = async (id: string) => {
    setActiveId(id);
    await saveActiveNicheId(id);
    Haptics.selectionAsync();
  };

  const handleGenerateIdeaNow = async (targetNiche?: ContentNiche) => {
    await saveDailyIdea({
      date: '',
      niche: targetNiche ? targetNiche.title : '',
      title: '',
      description: '',
      accepted: false,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Daily Trend Idea Ready ✨',
      targetNiche
        ? `Ready to generate a viral trend idea for "${targetNiche.title}" (${targetNiche.language}). Open Dashboard now?`
        : 'Your previous daily idea was cleared. Open Dashboard now to generate and view your new trend concept?',
      [
        { text: 'Stay Here', style: 'cancel' },
        {
          text: 'Open Dashboard →',
          onPress: () => router.push('/'),
        },
      ],
    );
  };

  const handleRestoreDefaults = async () => {
    const defaultNiches: ContentNiche[] = [
      {
        id: `niche_${Date.now()}_1`,
        title: '🚀 Tech & AI Reviews (Tamil)',
        language: 'Tamil',
        content:
          'We create Tamil tech reviews targeted at young professionals and students in Tamil Nadu. Use engaging Tamil slang, cultural references, and high-retention hooks.',
      },
      {
        id: `niche_${Date.now()}_2`,
        title: '💰 Personal Finance & Wealth',
        language: 'English',
        content:
          'Actionable money-saving and investing tips for Gen Z and Millennials. Crisp, energetic tone with clear data takeaways.',
      },
      {
        id: `niche_${Date.now()}_3`,
        title: '🧠 Productivity & Study Hacks',
        language: 'Hindi',
        content:
          'Study and productivity routines tailored for Indian students and professionals. Energetic Hindi narration with viral captions.',
      },
    ];
    setNiches(defaultNiches);
    if (defaultNiches.length > 0) {
      setActiveId(defaultNiches[0].id);
      await saveActiveNicheId(defaultNiches[0].id);
    }
    await saveContentNiches(defaultNiches);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (!hasAI) {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          marginHorizontal: 16,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: colors.primary + '20' },
            ]}
          >
            <Feather name="compass" size={18} color={colors.primary} />
          </View>
          <View style={{ gap: 2 }}>
            <Text
              style={[
                styles.title,
                { color: colors.foreground, fontFamily: 'Inter_700Bold' },
              ]}
            >
              AI Content Niches & Audience
            </Text>
            <Text
              style={[
                styles.subtitleSmall,
                {
                  color: colors.mutedForeground,
                  fontFamily: 'Inter_400Regular',
                },
              ]}
            >
              Informs AI conversations & daily trend ideas
            </Text>
          </View>
        </View>
      </View>

      <Text
        style={[
          styles.subtitle,
          { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
        ]}
      >
        Each niche stores elaborated audience rules & languages (e.g. Tamil reach & captions). AI uses your active niche for all script edits and daily trend ideas.
      </Text>

      {/* ── Active Saved Niches List ── */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
            ]}
          >
            Your Saved Niches ({niches.length})
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {niches.length === 0 && (
              <Pressable
                onPress={handleRestoreDefaults}
                style={styles.resetTextBtn}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: 'Inter_500Medium',
                    fontSize: 12,
                  }}
                >
                  + Add Defaults
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={openAddModal}
              style={[
                styles.addNicheBtn,
                { backgroundColor: colors.primary },
              ]}
            >
              <Feather name="plus" size={15} color={colors.primaryForeground} />
              <Text
                style={[
                  styles.addNicheBtnText,
                  {
                    color: colors.primaryForeground,
                    fontFamily: 'Inter_600SemiBold',
                  },
                ]}
              >
                Add Niche
              </Text>
            </Pressable>
          </View>
        </View>

        {niches.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <Feather name="info" size={16} color={colors.mutedForeground} />
            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.mutedForeground,
                  fontFamily: 'Inter_400Regular',
                },
              ]}
            >
              No niches saved yet. Add a niche with elaborated audience format or load default examples!
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {niches.map(niche => {
              const isActive = activeId === niche.id;
              return (
                <View
                  key={niche.id}
                  style={[
                    styles.nicheCard,
                    {
                      backgroundColor: isActive
                        ? colors.primary + '12'
                        : colors.muted + '80',
                      borderColor: isActive
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                >
                  <View style={styles.nicheTopRow}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text
                          style={[
                            styles.nicheTitleText,
                            {
                              color: colors.foreground,
                              fontFamily: 'Inter_600SemiBold',
                            },
                          ]}
                        >
                          {niche.title}
                        </Text>
                        <View
                          style={[
                            styles.langBadge,
                            {
                              backgroundColor: colors.primary + '20',
                              borderColor: colors.primary + '40',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.langText,
                              {
                                color: colors.primary,
                                fontFamily: 'Inter_600SemiBold',
                              },
                            ]}
                          >
                            🌐 {niche.language || 'English'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Card Actions Row */}
                  <View style={styles.nicheBottomRow}>
                    <Pressable
                      onPress={() => handleSetActive(niche.id)}
                      style={[
                        styles.activeToggle,
                        {
                          backgroundColor: isActive
                            ? colors.primary
                            : 'transparent',
                          borderColor: isActive
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    >
                      <Feather
                        name={isActive ? 'check' : 'circle'}
                        size={13}
                        color={isActive ? '#FFFFFF' : colors.mutedForeground}
                      />
                      <Text
                        style={{
                          color: isActive
                            ? '#FFFFFF'
                            : colors.mutedForeground,
                          fontFamily: 'Inter_600SemiBold',
                          fontSize: 12,
                        }}
                      >
                        {isActive ? 'Active for AAA' : 'Set Active'}
                      </Text>
                    </Pressable>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        onPress={() => openEditModal(niche)}
                        style={[
                          styles.iconActionBtn,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Feather
                          name="edit-2"
                          size={13}
                          color={colors.foreground}
                        />
                      </Pressable>

                      <Pressable
                        onPress={() => handleRemoveNiche(niche.id)}
                        style={[
                          styles.iconActionBtn,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Feather
                          name="trash-2"
                          size={13}
                          color={colors.mutedForeground}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ── Test & Generate Action Button ── */}
      {/* {niches.length > 0 && (
        <Pressable
          onPress={() => handleGenerateIdeaNow()}
          style={[
            styles.refreshBtn,
            {
              backgroundColor: colors.primary + '18',
              borderColor: colors.primary + '50',
            },
          ]}
        >
          <Feather name="zap" size={15} color={colors.primary} />
          <Text
            style={[
              styles.refreshText,
              { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
            ]}
          > 
            ✨ Generate Dashboard Trend Idea Now
          </Text>
          <Feather name="chevron-right" size={15} color={colors.primary} />
        </Pressable>
      )} */}

      {/* ── Add / Edit Niche Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: colors.foreground, fontFamily: 'Inter_700Bold' },
                ]}
              >
                {editingId ? 'Edit Content Niche' : 'Add Content Niche'}
              </Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={8}
              >
                <Feather
                  name="x"
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ gap: 16 }}
            >
              {/* Title Field */}
              <View style={styles.fieldGroup}>
                <Text
                  style={[
                    styles.fieldLabel,
                    {
                      color: colors.foreground,
                      fontFamily: 'Inter_600SemiBold',
                    },
                  ]}
                >
                  Niche Title *
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="e.g. Tech & AI Reviews in Tamil"
                  placeholderTextColor={colors.mutedForeground}
                  value={titleInput}
                  onChangeText={setTitleInput}
                />
              </View>

              {/* Language Field */}
              <View style={styles.fieldGroup}>
                <Text
                  style={[
                    styles.fieldLabel,
                    {
                      color: colors.foreground,
                      fontFamily: 'Inter_600SemiBold',
                    },
                  ]}
                >
                  Target Language (e.g. Tamil, English)
                </Text>
                <View style={styles.langChipsRow}>
                  {COMMON_LANGUAGES.map(lang => {
                    const isSelected =
                      languageInput.toLowerCase() === lang.toLowerCase();
                    return (
                      <Pressable
                        key={lang}
                        onPress={() => setLanguageInput(lang)}
                        style={[
                          styles.langChip,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : colors.muted,
                            borderColor: isSelected
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isSelected
                              ? '#FFFFFF'
                              : colors.foreground,
                            fontFamily: 'Inter_500Medium',
                            fontSize: 12,
                          }}
                        >
                          {lang}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                      color: colors.foreground,
                      marginTop: 6,
                    },
                  ]}
                  placeholder="Or type language..."
                  placeholderTextColor={colors.mutedForeground}
                  value={languageInput}
                  onChangeText={setLanguageInput}
                />
              </View>

              {/* Elaborated Content Field */}
              <View style={styles.fieldGroup}>
                <Text
                  style={[
                    styles.fieldLabel,
                    {
                      color: colors.foreground,
                      fontFamily: 'Inter_600SemiBold',
                    },
                  ]}
                >
                  Elaborated Audience & Content Format *
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.mutedForeground,
                    marginBottom: 4,
                  }}
                >
                  Explain your target audience, tone, culture, and slang (e.g. Tamil young professionals, trendy hooks & captions).
                </Text>
                <TextInput
                  style={[
                    styles.modalTextArea,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="We create Tamil tech reviews targeted at young professionals and students in Tamil Nadu. Use engaging Tamil slang, cultural references, and trendy hooks..."
                  placeholderTextColor={colors.mutedForeground}
                  value={contentInput}
                  onChangeText={setContentInput}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={[
                  styles.modalCancelBtn,
                  { borderColor: colors.border },
                ]}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: 'Inter_500Medium',
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveNiche}
                style={[
                  styles.modalSaveBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontFamily: 'Inter_600SemiBold',
                  }}
                >
                  Save Niche
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderWidth: 1,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
  },
  subtitleSmall: {
    fontSize: 12,
  },
  addNicheBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addNicheBtnText: {
    fontSize: 13,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  sectionWrap: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 14,
  },
  resetTextBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 13,
    flex: 1,
  },
  nicheCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  nicheTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  nicheTitleText: {
    fontSize: 15,
  },
  langBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  langText: {
    fontSize: 11,
  },
  nicheContentText: {
    fontSize: 13,
    lineHeight: 18,
  },
  nicheBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testTrendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  refreshText: {
    fontSize: 13,
    flex: 1,
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
  },
  langChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalTextArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 90,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
