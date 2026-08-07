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

const COMMON_LANGUAGES = [
  'Tamil',
  'English',
  'Malayalam',
  'Kannada',
  'Telugu',
  'Hindi'
];

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
  const [descriptionInput, setDescriptionInput] = useState('');

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
    setDescriptionInput('');
    setModalVisible(true);
    Haptics.selectionAsync();
  };

  const openEditModal = (item: ContentNiche) => {
    setEditingId(item.id);
    setTitleInput(item.title);
    setLanguageInput(item.language || 'English');
    setDescriptionInput(item.description || '');
    setModalVisible(true);
    Haptics.selectionAsync();
  };

  const handleSaveNiche = async () => {
    if (!titleInput.trim()) {
      Alert.alert('Title Required', 'Please enter a title for this niche.');
      return;
    }
    const cleanTitle = titleInput.trim();
    const cleanDesc =
      descriptionInput.trim() ||
      `Content focused on ${cleanTitle}. Tailored for the target audience with engaging hooks and culturally relevant trends.`;
    const cleanLang = languageInput.trim() || 'English';

    let next: ContentNiche[];
    if (editingId) {
      next = niches.map(n =>
        n.id === editingId
          ? {
            ...n,
            title: cleanTitle,
            niche: cleanTitle,
            description: cleanDesc,
            language: cleanLang,
          }
          : n,
      );
    } else {
      const newNiche: ContentNiche = {
        id: `niche_${Date.now()}`,
        niche: cleanTitle,
        title: cleanTitle,
        description: cleanDesc,
        language: cleanLang,
        captions: [],
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
    const target = niches.find(n => n.id === id);
    Alert.alert(
      'Delete Niche?',
      `"${target?.title ?? 'This niche'}" will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const next = niches.filter(n => n.id !== id);
            setNiches(next);
            await saveContentNiches(next);
            if (activeId === id) {
              const nextActive = next.length > 0 ? next[0].id : null;
              setActiveId(nextActive);
              await saveActiveNicheId(nextActive);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ],
    );
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
      language: targetNiche ? targetNiche.language : 'English',
      title: '',
      description: '',
      accepted: false,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Daily Trend Idea Ready ✨',
      targetNiche
        ? `Ready to generate a viral trend idea for "${targetNiche.title}" (${targetNiche.language}). Open scripts now?`
        : 'Your previous daily idea was reset. Open scripts to generate a new trend concept?',
      [
        { text: 'Stay Here', style: 'cancel' },
        {
          text: 'Open scripts →',
          onPress: () => router.push('/scripts'),
        },
      ],
    );
  };

  const handleRestoreDefaults = async () => {
    const defaultNiches: ContentNiche[] = [
      {
        id: `niche_${Date.now()}_1`,
        niche: '🚀 Tech & AI Reviews (Tamil)',
        title: '🚀 Tech & AI Reviews (Tamil)',
        language: 'Tamil',
        description:
          'We create Tamil tech reviews targeted at young professionals and students in Tamil Nadu. Use engaging Tamil slang, cultural references, and high-retention hooks.',
        captions: ['#TamilTech', '#AIGadgets'],
      },
      {
        id: `niche_${Date.now()}_2`,
        niche: '💰 Personal Finance & Wealth',
        title: '💰 Personal Finance & Wealth',
        language: 'English',
        description:
          'Actionable money-saving and investing tips for Gen Z and Millennials. Crisp, energetic tone with clear data takeaways.',
        captions: ['#FinanceTips', '#WealthBuilding'],
      },
      {
        id: `niche_${Date.now()}_3`,
        niche: '🧠 Productivity & Study Hacks',
        title: '🧠 Productivity & Study Hacks',
        language: 'Hindi',
        description:
          'Study and productivity routines tailored for Indian students and professionals. Energetic Hindi narration with viral captions.',
        captions: ['#StudyHacks', '#Productivity'],
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
    <View style={styles.container}>
      {/* Overview Header Card */}
      <View
        style={[
          styles.mainCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: '#F59E0B' + '20' }]}>
            <Feather name="compass" size={20} color="#F59E0B" />
          </View>
          <View style={styles.headerTitleGroup}>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              Audience Niches & Scopes
            </Text>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Guides AI tone of voice, language rules, and daily trend recommendations.
            </Text>
          </View>
        </View>

        {/* Action Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <Text style={[styles.sectionCountText, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              Saved Niches ({niches.length})
            </Text>
          </View>

          <View style={styles.toolbarRight}>
            {niches.length === 0 && (
              <Pressable
                onPress={handleRestoreDefaults}
                style={({ pressed }) => [
                  styles.presetBtn,
                  { borderColor: '#F59E0B' + '50', opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="download-cloud" size={13} color="#F59E0B" />
                <Text style={[styles.presetBtnText, { color: '#F59E0B', fontFamily: 'Inter_600SemiBold' }]}>
                  Load Defaults
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={openAddModal}
              accessibilityRole="button"
              accessibilityLabel="Add new AI niche"
              style={({ pressed }) => [
                styles.addNicheBtn,
                { backgroundColor: '#F59E0B', opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="plus" size={14} color="#0F172A" />
              <Text style={[styles.addNicheBtnText, { color: '#0F172A', fontFamily: 'Inter_700Bold' }]}>
                Add Niche
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Niche List / Empty View */}
        {niches.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.background }]}>
              <Feather name="compass" size={22} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              No Audience Niches Created
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Define custom audience rules (e.g. Tamil reach, Gen Z finance) so AI models generate tailored scripts and daily trend ideas automatically.
            </Text>
            <Pressable
              onPress={handleRestoreDefaults}
              style={({ pressed }) => [
                styles.emptyCta,
                { backgroundColor: '#F59E0B', borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="zap" size={14} color="#0F172A" />
              <Text style={{ color: '#0F172A', fontFamily: 'Inter_700Bold', fontSize: 13 }}>
                Load Example Niches
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.nicheList}>
            {niches.map(niche => {
              const isActive = activeId === niche.id;
              return (
                <View
                  key={niche.id}
                  style={[
                    styles.nicheCard,
                    {
                      backgroundColor: isActive ? '#F59E0B' + '12' : colors.card,
                      borderColor: isActive ? '#F59E0B' : colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  {/* Top Niche Header */}
                  <View style={styles.nicheHeaderRow}>
                    <View style={styles.nicheTitleWrap}>
                      <Text style={[styles.nicheTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
                        {niche.title}
                      </Text>
                      {isActive && (
                        <View style={[styles.activePill, { backgroundColor: '#F59E0B' + '25', borderColor: '#F59E0B' + '60' }]}>
                          <View style={[styles.activeDot, { backgroundColor: '#F59E0B' }]} />
                          <Text style={[styles.activePillText, { color: '#F59E0B', fontFamily: 'Inter_600SemiBold' }]}>
                            Active Niche
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Language Badge */}
                    <View style={[styles.langBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Text style={[styles.langText, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
                        🌐 {niche.language || 'English'}
                      </Text>
                    </View>
                  </View>

                  {/* Niche Description */}
                  {niche.description ? (
                    <Text style={[styles.nicheDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]} numberOfLines={3}>
                      {niche.description}
                    </Text>
                  ) : null}

                  {/* Card Action Controls */}
                  <View style={[styles.nicheFooter, { borderTopColor: colors.border }]}>
                    <Pressable
                      onPress={() => handleSetActive(niche.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Set ${niche.title} as active`}
                      style={({ pressed }) => [
                        styles.setActiveBtn,
                        {
                          backgroundColor: isActive ? '#F59E0B' : colors.muted,
                          opacity: pressed ? 0.8 : 1,
                          borderRadius: colors.radius,
                        },
                      ]}
                    >
                      <Feather
                        name={isActive ? 'check-circle' : 'circle'}
                        size={14}
                        color={isActive ? '#0F172A' : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.setActiveBtnText,
                          {
                            color: isActive ? '#0F172A' : colors.foreground,
                            fontFamily: isActive ? 'Inter_700Bold' : 'Inter_500Medium',
                          },
                        ]}
                      >
                        {isActive ? 'Active Scope' : 'Set Active'}
                      </Text>
                    </Pressable>

                    <View style={styles.footerRightIcons}>
                      <Pressable
                        onPress={() => handleGenerateIdeaNow(niche)}
                        accessibilityRole="button"
                        accessibilityLabel="Generate trend idea for niche"
                        style={({ pressed }) => [
                          styles.iconBtn,
                          { backgroundColor: colors.muted, opacity: pressed ? 0.6 : 1, borderRadius: colors.radius },
                        ]}
                      >
                        <Feather name="zap" size={15} color="#F59E0B" />
                      </Pressable>

                      <Pressable
                        onPress={() => openEditModal(niche)}
                        accessibilityRole="button"
                        accessibilityLabel="Edit niche"
                        style={({ pressed }) => [
                          styles.iconBtn,
                          { backgroundColor: colors.muted, opacity: pressed ? 0.6 : 1, borderRadius: colors.radius },
                        ]}
                      >
                        <Feather name="edit-2" size={15} color={colors.foreground} />
                      </Pressable>

                      <Pressable
                        onPress={() => handleRemoveNiche(niche.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Delete niche"
                        style={({ pressed }) => [
                          styles.iconBtn,
                          { backgroundColor: colors.muted, opacity: pressed ? 0.6 : 1, borderRadius: colors.radius },
                        ]}
                      >
                        <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Modal for Add / Edit Niche */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setModalVisible(false)} accessibilityRole="button" accessibilityLabel="Close modal" hitSlop={8}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              {editingId ? 'Edit Audience Niche' : 'New Audience Niche'}
            </Text>
            <Pressable onPress={handleSaveNiche} accessibilityRole="button" accessibilityLabel="Save niche" hitSlop={8}>
              <Text style={{ color: titleInput.trim() ? '#F59E0B' : colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 16 }}>
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
            {/* Title Input */}
            <View style={styles.formGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                Niche Title
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    color: colors.foreground,
                    borderRadius: colors.radius,
                    fontFamily: 'Inter_400Regular',
                  },
                ]}
                placeholder="e.g. 🚀 Tech & AI Reviews (Tamil)"
                placeholderTextColor={colors.mutedForeground}
                value={titleInput}
                onChangeText={setTitleInput}
                autoFocus
              />
            </View>

            {/* Language Quick Selector Chips */}
            <View style={styles.formGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                Target Language
              </Text>
              <View style={styles.chipGrid}>
                {COMMON_LANGUAGES.map(lang => {
                  const isSelected = languageInput === lang;
                  return (
                    <Pressable
                      key={lang}
                      onPress={() => {
                        setLanguageInput(lang);
                        Haptics.selectionAsync();
                      }}
                      style={({ pressed }) => [
                        styles.langChip,
                        {
                          backgroundColor: isSelected ? '#F59E0B' : colors.muted,
                          borderColor: isSelected ? '#F59E0B' : colors.border,
                          opacity: pressed ? 0.8 : 1,
                          borderRadius: colors.radius,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.langChipText,
                          {
                            color: isSelected ? '#0F172A' : colors.foreground,
                            fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_500Medium',
                          },
                        ]}
                      >
                        {lang}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Description / Audience Format Input */}
            <View style={styles.formGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                Audience Rules & Scope
              </Text>
              <TextInput
                style={[
                  styles.textAreaInput,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    color: colors.foreground,
                    borderRadius: colors.radius,
                    fontFamily: 'Inter_400Regular',
                  },
                ]}
                placeholder="Describe your target audience demographics, preferred tone, slang, hashtags, and high-retention hook style..."
                placeholderTextColor={colors.mutedForeground}
                value={descriptionInput}
                onChangeText={setDescriptionInput}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  mainCard: {
    padding: 20,
    borderWidth: 1,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 18,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  toolbarLeft: {
    flex: 1,
  },
  sectionCountText: {
    fontSize: 15,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 16,
  },
  presetBtnText: {
    fontSize: 12,
  },
  addNicheBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  addNicheBtnText: {
    fontSize: 13,
  },
  emptyBox: {
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 6,
  },
  nicheList: {
    gap: 12,
  },
  nicheCard: {
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  nicheHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  nicheTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  nicheTitle: {
    fontSize: 15,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activePillText: {
    fontSize: 11,
  },
  langBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 14,
  },
  langText: {
    fontSize: 12,
  },
  nicheDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  nicheFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 2,
  },
  setActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  setActiveBtnText: {
    fontSize: 12,
  },
  footerRightIcons: {
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
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
  },
  formGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  langChipText: {
    fontSize: 13,
  },
  textAreaInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    borderWidth: 1,
    minHeight: 110,
  },
});
