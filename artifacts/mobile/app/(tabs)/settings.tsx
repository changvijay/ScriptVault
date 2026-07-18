import React, { useState } from 'react';
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
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/context/DataContext';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Category } from '@/types';

const PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#10B981', '#14B8A6', '#3B82F6', '#6366F1',
  '#8B5CF6', '#EC4899', '#64748B', '#78716C',
];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { categories, scripts, goals, createCategory, updateCategory, deleteCategory } = useData();

  const [modalVisible, setModalVisible] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState(PALETTE[0]);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const openCreate = () => {
    setEditCat(null);
    setCatName('');
    setCatColor(PALETTE[0]);
    setModalVisible(true);
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setCatName(cat.name);
    setCatColor(cat.color);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!catName.trim()) return;
    if (editCat) {
      await updateCategory(editCat.id, catName.trim(), catColor);
    } else {
      await createCategory(catName.trim(), catColor);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
  };

  const handleDelete = () => {
    if (!editCat) return;
    Alert.alert(
      'Delete Category',
      `Delete "${editCat.name}"? It will be removed from all scripts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(editCat.id);
            setModalVisible(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topInset + 12,
          paddingBottom: bottomInset + 100,
          gap: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold', paddingHorizontal: 20 }]}>
          Settings
        </Text>

        {/* Stats overview */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginHorizontal: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            Data Overview
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>{scripts.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Scripts</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>{goals.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Goals</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>{categories.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Categories</Text>
            </View>
          </View>
        </View>

        {/* Categories */}
        <View style={{ gap: 12 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              Categories
            </Text>
            <Pressable
              onPress={openCreate}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={14} color={colors.primaryForeground} />
              <Text style={[styles.addBtnText, { color: colors.primaryForeground, fontFamily: 'Inter_500Medium' }]}>
                Add
              </Text>
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginHorizontal: 16, padding: 0, overflow: 'hidden' }]}>
            {categories.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>
                  No categories yet
                </Text>
              </View>
            ) : (
              categories.map((cat, idx) => {
                const scriptCount = scripts.filter(s => s.categoryIds.includes(cat.id)).length;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => openEdit(cat)}
                    style={({ pressed }) => [
                      styles.catRow,
                      {
                        borderBottomColor: colors.border,
                        borderBottomWidth: idx < categories.length - 1 ? 1 : 0,
                        backgroundColor: pressed ? colors.muted : colors.card,
                      },
                    ]}
                  >
                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                    <Text style={[styles.catName, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
                      {cat.name}
                    </Text>
                    <Text style={[styles.catCount, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                      {scriptCount} script{scriptCount !== 1 ? 's' : ''}
                    </Text>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </Pressable>
                );
              })
            )}
          </View>
        </View>

        {/* About */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginHorizontal: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            About
          </Text>
          <Text style={[styles.aboutText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            ScriptVault is a fully offline script and note management app. All your data is stored locally on your device — no cloud, no sync, no accounts needed.
          </Text>
          <Text style={[styles.version, { color: colors.mutedForeground + '80', fontFamily: 'Inter_400Regular' }]}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Category Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setModalVisible(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              {editCat ? 'Edit Category' : 'New Category'}
            </Text>
            <Pressable onPress={handleSave}>
              <Text style={{ color: catName.trim() ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
            {/* Name */}
            <View style={{ gap: 8 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Name</Text>
              <TextInput
                style={[styles.inputField, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, fontFamily: 'Inter_400Regular' }]}
                value={catName}
                onChangeText={setCatName}
                placeholder="Category name"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
              />
            </View>

            {/* Color */}
            <View style={{ gap: 12 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Color</Text>
              <View style={styles.colorGrid}>
                {PALETTE.map(c => (
                  <Pressable
                    key={c}
                    onPress={() => { setCatColor(c); Haptics.selectionAsync(); }}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      catColor === c && styles.colorSwatchSelected,
                    ]}
                  >
                    {catColor === c && <Feather name="check" size={16} color="#FFFFFF" />}
                  </Pressable>
                ))}
              </View>
              {/* Preview */}
              <View style={[styles.preview, { backgroundColor: catColor + '20', borderColor: catColor + '60', borderRadius: 20 }]}>
                <View style={[styles.catDot, { backgroundColor: catColor }]} />
                <Text style={{ color: catColor, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
                  {catName || 'Preview'}
                </Text>
              </View>
            </View>

            {editCat && (
              <Pressable onPress={handleDelete} style={[styles.deleteBtn, { borderColor: colors.destructive + '60', borderRadius: colors.radius }]}>
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
  container: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  sectionTitle: { fontSize: 17, fontWeight: '600' },
  card: { padding: 16, borderWidth: 1, gap: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statNum: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 12 },
  divider: { width: 1, height: 40 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addBtnText: { fontSize: 13 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  catDot: { width: 12, height: 12, borderRadius: 6 },
  catName: { flex: 1, fontSize: 15 },
  catCount: { fontSize: 13 },
  aboutText: { fontSize: 14, lineHeight: 21 },
  version: { fontSize: 12 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  fieldLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
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
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
  },
});
