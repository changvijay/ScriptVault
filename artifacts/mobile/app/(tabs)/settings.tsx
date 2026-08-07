import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/context/DataContext';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { Category } from '@/types';
import { AIProvidersSettings } from '@/components/AIProvidersSettings';
import { ContentNichesSettings } from '@/components/ContentNichesSettings';
import { exportToExcel, validateExcelFile, generateSampleExcel } from '@/services/excelService';

import { ImportExportWorkspace } from '@/components/settings/ImportExportWorkspace';
import { CategoriesWorkspace } from '@/components/settings/CategoriesWorkspace';
import { AboutWorkspace } from '@/components/settings/AboutWorkspace';

export type WorkspaceTab = 'menu' | 'import_export' | 'categories' | 'ai_providers' | 'ai_niches' | 'about' | 'feedback';

const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdH7f8Qt_fRipwKZP5B7W0Ft-T4-Fug6G-dx7eZjVUn6BNwUg/viewform?usp=publish-editor';

interface WorkspaceMenuItem {
  id: WorkspaceTab;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  isExternalLink?: boolean;
}

const WORKSPACE_ITEMS: WorkspaceMenuItem[] = [
  {
    id: 'import_export',
    title: 'Import & Export',
    subtitle: 'Manage your data backups & template.',
    icon: 'repeat',
  },
  {
    id: 'categories',
    title: 'Categories',
    subtitle: 'Organize your workspace.',
    icon: 'grid',
  },
  {
    id: 'ai_providers',
    title: 'AI Providers',
    subtitle: 'Configure external models.',
    icon: 'cpu',
  },
  {
    id: 'ai_niches',
    title: 'AI Content Niches',
    subtitle: 'Specialized generation scopes.',
    icon: 'compass',
  },
  {
    id: 'feedback',
    title: 'Feedback & Support',
    subtitle: 'Share ideas or report issues.',
    icon: 'message-square',
    isExternalLink: true,
  },
  {
    id: 'about',
    title: 'About & System',
    subtitle: 'App overview, privacy, & danger zone.',
    icon: 'info',
  },
];

const PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#10B981', '#14B8A6', '#3B82F6', '#6366F1',
  '#8B5CF6', '#EC4899', '#64748B', '#78716C',
];

const LIGHT_SWATCHES = new Set(['#F59E0B', '#84CC16']);

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const { categories, scripts, goals, createCategory, updateCategory, deleteCategory, importData, exportData } = useData();

  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTab>(isDesktop ? 'import_export' : 'menu');
  const [searchQuery, setSearchQuery] = useState('');

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const busy = exporting || importing || downloadingTemplate;

  const [modalVisible, setModalVisible] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState(PALETTE[0]);
  const [nameTouched, setNameTouched] = useState(false);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

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

  // Filter workspace items by search query
  const filteredWorkspaceItems = useMemo(() => {
    if (!searchQuery.trim()) return WORKSPACE_ITEMS;
    const q = searchQuery.toLowerCase();
    return WORKSPACE_ITEMS.filter(
      item => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const sortedCategories = useMemo(() => {
    return categories
      .map(cat => ({
        cat,
        count: scripts.filter(s => s.categoryIds.includes(cat.id)).length,
      }))
      .sort((a, b) => a.cat.name.localeCompare(b.cat.name));
  }, [categories, scripts]);

  const trimmedName = catName.trim();
  const isDuplicateName =
    trimmedName.length > 0 &&
    categories.some(
      c => c.id !== editCat?.id && c.name.toLowerCase() === trimmedName.toLowerCase(),
    );
  const canSave = trimmedName.length > 0 && !isDuplicateName;

  const openCreate = () => {
    setEditCat(null);
    setCatName('');
    setCatColor(PALETTE[0]);
    setNameTouched(false);
    setModalVisible(true);
    Haptics.selectionAsync();
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setCatName(cat.name);
    setCatColor(cat.color);
    setNameTouched(false);
    setModalVisible(true);
    Haptics.selectionAsync();
  };

  const handleSave = async () => {
    if (!canSave) {
      setNameTouched(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (editCat) {
      await updateCategory(editCat.id, trimmedName, catColor);
    } else {
      await createCategory(trimmedName, catColor);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
  };

  const handleDelete = () => {
    if (!editCat) return;
    handleDeleteCat(editCat);
    setModalVisible(false);
  };

  const handleDeleteCat = (cat: Category) => {
    const affected = scripts.filter(s => s.categoryIds.includes(cat.id)).length;
    const impactLine = affected > 0
      ? `It will be removed from ${affected} script${affected !== 1 ? 's' : ''}. This can't be undone.`
      : `This can't be undone.`;
    Alert.alert(
      'Delete category?',
      `"${cat.name}" will be permanently deleted. ${impactLine}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(cat.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ],
    );
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const fileUri = await generateSampleExcel({ categories, goals });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          UTI: 'org.openxmlformats.spreadsheetml.sheet',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Download Sample Template',
        });
      } else {
        Alert.alert('Sharing unavailable', 'This device can’t share files. Try again from a supported device.');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Couldn’t create template', e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleExport = async () => {
    if (scripts.length === 0 && categories.length === 0 && goals.length === 0) {
      Alert.alert('Nothing to export yet', 'Add some scripts, goals, or categories first.');
      return;
    }
    setExporting(true);
    try {
      const data = exportData();
      const fileUri = exportToExcel(data);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          UTI: 'org.openxmlformats.spreadsheetml.sheet',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Export ScriptVault Data',
        });
      } else {
        Alert.alert('Sharing unavailable', 'This device can’t share files. Try again from a supported device.');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Export failed', e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setImporting(false);
        return;
      }

      const fileUri = result.assets[0].uri;
      const validation = await validateExcelFile(fileUri, scripts, categories, goals);

      if (!validation.valid) {
        const errorList = validation.errors.slice(0, 10).join('\n');
        const more = validation.errors.length > 10 ? `\n...and ${validation.errors.length - 10} more errors` : '';
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          `Found ${validation.errors.length} issue${validation.errors.length !== 1 ? 's' : ''}`,
          `Fix these in your file and try again:\n\n${errorList}${more}`,
        );
        setImporting(false);
        return;
      }

      const { count, warnings } = validation;
      const summary = `${count} script${count !== 1 ? 's' : ''}`;

      const warningText = warnings.length > 0
        ? `\n\nHeads up:\n${warnings.slice(0, 5).join('\n')}${warnings.length > 5 ? `\n...and ${warnings.length - 5} more` : ''}`
        : '';

      Alert.alert(
        `Import ${summary}?`,
        `These will be added alongside your existing data — nothing gets overwritten.${warningText}`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setImporting(false) },
          {
            text: 'Import',
            onPress: async () => {
              try {
                await importData(validation.data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Imported', `${summary} added to your library.`);
              } catch (e: any) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert('Import failed', e.message ?? 'Something went wrong. Please try again.');
              } finally {
                setImporting(false);
              }
            },
          },
        ],
      );
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Import failed', e.message ?? 'Couldn’t read that file. Make sure it’s a .xlsx file.');
      setImporting(false);
    }
  };

  const handleResetApp = async () => {
    try {
      await AsyncStorage.clear();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('App Reset Complete', 'All local data has been erased. Please reload the app to start fresh.');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Reset Failed', e?.message ?? 'Could not clear local storage.');
    }
  };

  const selectWorkspace = (tab: WorkspaceTab) => {
    if (tab === 'feedback') {
      handleOpenFeedback();
      return;
    }
    setActiveWorkspace(tab);
    Haptics.selectionAsync();
  };

  // Title for mobile header when navigating sub-workspaces
  const currentHeaderTitle = useMemo(() => {
    if (isDesktop || activeWorkspace === 'menu') return 'Settings';
    const item = WORKSPACE_ITEMS.find(i => i.id === activeWorkspace);
    return item ? item.title : 'Settings';
  }, [activeWorkspace, isDesktop]);

  // Helper to render workspace detail content
  const renderWorkspaceDetail = () => {
    switch (activeWorkspace) {
      case 'import_export':
        return (
          <View style={styles.workspaceSection}>
            <View style={styles.workspaceHeaderBox}>
              <Text style={[styles.workspaceTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                Import & Export
              </Text>
              <Text style={[styles.workspaceSubTitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Manage your data backups, spreadsheets, and sample templates
              </Text>
            </View>
            <ImportExportWorkspace
              onExport={handleExport}
              onImport={handleImport}
              onDownloadTemplate={handleDownloadTemplate}
              exporting={exporting}
              importing={importing}
              downloadingTemplate={downloadingTemplate}
              busy={busy}
            />
          </View>
        );

      case 'categories':
        return (
          <View style={styles.workspaceSection}>
            <CategoriesWorkspace
              sortedCategories={sortedCategories}
              onOpenCreate={openCreate}
              onOpenEdit={openEdit}
              onDeleteCat={handleDeleteCat}
            />
          </View>
        );

      case 'ai_providers':
        return (
          <View style={styles.workspaceSection}>
            <View style={styles.workspaceHeaderBox}>
              <Text style={[styles.workspaceTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                AI Providers
              </Text>
              <Text style={[styles.workspaceSubTitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Configure external models and API connections
              </Text>
            </View>
            <AIProvidersSettings />
          </View>
        );

      case 'ai_niches':
        return (
          <View style={styles.workspaceSection}>
            <View style={styles.workspaceHeaderBox}>
              <Text style={[styles.workspaceTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                AI Content Niches
              </Text>
              <Text style={[styles.workspaceSubTitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Specialized generation scopes and audience rules
              </Text>
            </View>
            <ContentNichesSettings />
          </View>
        );

      case 'about':
        return (
          <View style={styles.workspaceSection}>
            <View style={styles.workspaceHeaderBox}>
              <Text style={[styles.workspaceTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                About & System
              </Text>
              <Text style={[styles.workspaceSubTitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Data overview, offline storage rules, and app maintenance
              </Text>
            </View>
            <AboutWorkspace
              scriptCount={scripts.length}
              goalCount={goals.length}
              categoryCount={categories.length}
              onResetApp={handleResetApp}
            />
          </View>
        );

      case 'menu':
      default:
        return (
          <View style={styles.menuWorkspaceContainer}>
            <Text style={[styles.menuSectionHeader, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
              WORKSPACES
            </Text>
            <View style={[styles.menuCardGroup, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              {filteredWorkspaceItems.map((item, idx) => (
                <Pressable
                  key={item.id}
                  onPress={() => selectWorkspace(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.title}`}
                  style={({ pressed }) => [
                    styles.menuRow,
                    {
                      borderBottomColor: colors.border,
                      borderBottomWidth: idx < filteredWorkspaceItems.length - 1 ? 1 : 0,
                      backgroundColor: pressed ? colors.muted : 'transparent',
                    },
                  ]}
                >
                  <View style={[styles.menuIconCircle, { backgroundColor: item.isExternalLink ? '#8B5CF6' + '1A' : colors.primary + '18' }]}>
                    <Feather name={item.icon} size={18} color={item.isExternalLink ? '#8B5CF6' : colors.primary} />
                  </View>
                  <View style={styles.menuTextContent}>
                    <Text style={[styles.menuTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.menuSubtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                      {item.subtitle}
                    </Text>
                  </View>
                  <Feather
                    name={item.isExternalLink ? 'external-link' : 'chevron-right'}
                    size={18}
                    color={item.isExternalLink ? '#8B5CF6' : colors.mutedForeground}
                  />
                </Pressable>
              ))}
            </View>

            {/* Quick System Summary Card */}
            <View style={[styles.quickAboutCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <View style={styles.quickAboutHeader}>
                <Feather name="info" size={16} color={colors.primary} />
                <Text style={[styles.quickAboutTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  About ScriptVault
                </Text>
              </View>
              <Text style={[styles.quickAboutText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                Obsidian Prime v2.4.1. Crafted for high-performance AI workflows. All local data is encrypted.
              </Text>
              <View style={styles.quickLinkRow}>
                <Pressable onPress={() => selectWorkspace('about')}>
                  <Text style={[styles.quickLink, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
                    Privacy Policy
                  </Text>
                </Pressable>
                <Text style={{ color: colors.mutedForeground }}>•</Text>
                <Pressable onPress={() => selectWorkspace('about')}>
                  <Text style={[styles.quickLink, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
                    Terms of Service
                  </Text>
                </Pressable>
                <Text style={{ color: colors.mutedForeground }}>•</Text>
                <Pressable onPress={handleOpenFeedback}>
                  <Text style={[styles.quickLink, { color: '#8B5CF6', fontFamily: 'Inter_500Medium' }]}>
                    Feedback Form
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Main Navigation Header */}
      <View
        style={[
          styles.mainHeader,
          {
            paddingTop: topInset + 12,
            borderBottomColor: colors.border,
            borderBottomWidth: activeWorkspace !== 'menu' && !isDesktop ? 1 : 0,
          },
        ]}
      >
        <View style={styles.headerTitleRow}>
          {activeWorkspace !== 'menu' && !isDesktop ? (
            <Pressable
              onPress={() => selectWorkspace('menu')}
              accessibilityRole="button"
              accessibilityLabel="Back to Settings menu"
              hitSlop={8}
              style={({ pressed }) => [
                styles.backBtn,
                { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1, borderRadius: colors.radius },
              ]}
            >
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
          ) : (
            <View style={[styles.headerGearCircle, { backgroundColor: colors.primary + '18' }]}>
              <Feather name="sliders" size={20} color={colors.primary} />
            </View>
          )}

          <Text style={[styles.pageTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold', flex: 1 }]} numberOfLines={1}>
            {currentHeaderTitle}
          </Text>

          {/* Top Header "+ Add" action when viewing Categories workspace on mobile */}
          {activeWorkspace === 'categories' && !isDesktop && (
            <Pressable
              onPress={openCreate}
              accessibilityRole="button"
              accessibilityLabel="Add category"
              hitSlop={6}
              style={({ pressed }) => [
                styles.headerAddBtn,
                { backgroundColor: '#F59E0B', opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="plus" size={14} color="#0F172A" />
              <Text style={{ color: '#0F172A', fontFamily: 'Inter_700Bold', fontSize: 13 }}>
                Add
              </Text>
            </Pressable>
          )}
        </View>

        {/* Global Settings Search Bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.muted,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            placeholder="Search settings..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Body Content Layout */}
      {isDesktop ? (
        // Desktop / Tablet Split Sidebar Workspace View
        <View style={styles.desktopLayout}>
          {/* Left Sidebar Menu */}
          <View style={[styles.sidebar, { borderRightColor: colors.border, borderRightWidth: 1 }]}>
            <Text style={[styles.menuSectionHeader, { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
              WORKSPACES
            </Text>
            {filteredWorkspaceItems.map(item => {
              const isActive = activeWorkspace === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => selectWorkspace(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${item.title} workspace`}
                  style={({ pressed }) => [
                    styles.sidebarItem,
                    {
                      backgroundColor: isActive
                        ? colors.primary + '20'
                        : pressed
                        ? colors.muted
                        : 'transparent',
                      borderColor: isActive ? colors.primary + '50' : 'transparent',
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Feather
                    name={item.icon}
                    size={18}
                    color={item.isExternalLink ? '#8B5CF6' : isActive ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.sidebarItemTitle,
                      {
                        color: item.isExternalLink ? '#8B5CF6' : isActive ? colors.foreground : colors.mutedForeground,
                        fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular',
                        flex: 1,
                      },
                    ]}
                  >
                    {item.title}
                  </Text>
                  {item.isExternalLink && (
                    <Feather name="external-link" size={14} color="#8B5CF6" />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Right Workspace Main Detail Content */}
          <ScrollView
            style={styles.desktopContentArea}
            contentContainerStyle={{
              padding: 24,
              paddingBottom: bottomInset + 80,
            }}
            showsVerticalScrollIndicator={false}
          >
            {renderWorkspaceDetail()}
          </ScrollView>
        </View>
      ) : (
        // Mobile Stack Scroll View
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: bottomInset + 100,
          }}
          showsVerticalScrollIndicator={false}
        >
          {renderWorkspaceDetail()}
        </ScrollView>
      )}

      {/* Category Creation / Editing Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setModalVisible(false)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              {editCat ? 'Edit Category' : 'New Category'}
            </Text>
            <Pressable
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel="Save category"
              hitSlop={8}
            >
              <Text style={{ color: canSave ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }} keyboardShouldPersistTaps="handled">
            {/* Category Name Input */}
            <View style={{ gap: 8 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Name</Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.muted,
                    borderColor: nameTouched && !canSave ? colors.destructive : colors.border,
                    color: colors.foreground,
                    borderRadius: colors.radius,
                    fontFamily: 'Inter_400Regular',
                  },
                ]}
                value={catName}
                onChangeText={setCatName}
                onBlur={() => setNameTouched(true)}
                placeholder="e.g. Tutorials, Vlogs, Tech Startups"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              {nameTouched && isDuplicateName && (
                <Text style={{ color: colors.destructive, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
                  A category named "{trimmedName}" already exists
                </Text>
              )}
              {nameTouched && trimmedName.length === 0 && (
                <Text style={{ color: colors.destructive, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
                  Category name can't be empty
                </Text>
              )}
            </View>

            {/* Color Selector Swatches */}
            <View style={{ gap: 12 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Color</Text>
              <View style={styles.colorGrid}>
                {PALETTE.map(c => (
                  <Pressable
                    key={c}
                    onPress={() => { setCatColor(c); Haptics.selectionAsync(); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose color ${c}`}
                    accessibilityState={{ selected: catColor === c }}
                    hitSlop={4}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      catColor === c && styles.colorSwatchSelected,
                    ]}
                  >
                    {catColor === c && (
                      <Feather name="check" size={16} color={LIGHT_SWATCHES.has(c) ? '#1F2937' : '#FFFFFF'} />
                    )}
                  </Pressable>
                ))}
              </View>
              {/* Preview */}
              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 11 }]}>Preview</Text>
                <View style={[styles.preview, { backgroundColor: catColor + '20', borderColor: catColor + '60', borderRadius: 20 }]}>
                  <View style={[styles.catDot, { backgroundColor: catColor }]} />
                  <Text style={{ color: catColor, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
                    {trimmedName || 'Category name'}
                  </Text>
                </View>
              </View>
            </View>

            {editCat && (
              <Pressable
                onPress={handleDelete}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${editCat.name} category`}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  { borderColor: colors.destructive + '60', borderRadius: colors.radius, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="trash-2" size={16} color={colors.destructive} />
                <Text style={{ color: colors.destructive, fontFamily: 'Inter_500Medium', fontSize: 15 }}>Delete Category</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerGearCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  menuWorkspaceContainer: {
    gap: 16,
  },
  menuSectionHeader: {
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  menuCardGroup: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  menuIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextContent: {
    flex: 1,
    gap: 3,
  },
  menuTitle: {
    fontSize: 16,
  },
  menuSubtitle: {
    fontSize: 13,
  },
  quickAboutCard: {
    padding: 18,
    borderWidth: 1,
    gap: 10,
    marginTop: 8,
  },
  quickAboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickAboutTitle: {
    fontSize: 15,
  },
  quickAboutText: {
    fontSize: 13,
    lineHeight: 19,
  },
  quickLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  quickLink: {
    fontSize: 13,
  },
  workspaceSection: {
    gap: 20,
  },
  workspaceHeaderBox: {
    gap: 4,
  },
  workspaceTitle: {
    fontSize: 24,
  },
  workspaceSubTitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 280,
    padding: 16,
    gap: 6,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  sidebarItemTitle: {
    fontSize: 14,
  },
  desktopContentArea: {
    flex: 1,
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
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputField: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  catDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
  },
});