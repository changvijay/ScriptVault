import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Category } from '@/types';

interface SortedCat {
  cat: Category;
  count: number;
}

interface CategoriesWorkspaceProps {
  sortedCategories: SortedCat[];
  onOpenCreate: () => void;
  onOpenEdit: (cat: Category) => void;
  onDeleteCat?: (cat: Category) => void;
  maxRecommended?: number;
}

export function CategoriesWorkspace({
  sortedCategories,
  onOpenCreate,
  onOpenEdit,
  onDeleteCat,
  maxRecommended = 10,
}: CategoriesWorkspaceProps) {
  const colors = useColors();
  const usedCount = sortedCategories.length;
  const progressRatio = Math.min(usedCount / maxRecommended, 1);

  return (
    <View style={styles.container}>
      {/* Sub header with Add button */}
      <View style={styles.subHeader}>
        <View style={styles.subHeaderLeft}>
          <Text style={[styles.subHeaderTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            Manage Categories
          </Text>
          <Text style={[styles.subHeaderDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            Organize scripts by topic or type
          </Text>
        </View>

        {/* Fixed & Styled + Add Button */}
        <Pressable
          onPress={onOpenCreate}
          accessibilityRole="button"
          accessibilityLabel="Add new category"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: '#F59E0B',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="plus" size={15} color="#0F172A" style={{ fontWeight: '700' }} />
          <Text style={[styles.addBtnText, { color: '#0F172A', fontFamily: 'Inter_700Bold' }]}>
            Add
          </Text>
        </Pressable>
      </View>

      {/* Categories Card List */}
      <View style={styles.listContainer}>
        {sortedCategories.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
              <Feather name="tag" size={22} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              No categories created yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Create custom categories to organize and filter your scripts.
            </Text>
            <Pressable
              onPress={onOpenCreate}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.emptyCta,
                { backgroundColor: '#F59E0B', opacity: pressed ? 0.8 : 1, borderRadius: colors.radius },
              ]}
            >
              <Feather name="plus" size={14} color="#0F172A" />
              <Text style={{ color: '#0F172A', fontFamily: 'Inter_700Bold', fontSize: 13 }}>
                Create category
              </Text>
            </Pressable>
          </View>
        ) : (
          sortedCategories.map(({ cat, count }) => (
            <View
              key={cat.id}
              style={[
                styles.catCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              {/* Category Color Pill on far left */}
              <View style={[styles.catColorBar, { backgroundColor: cat.color }]} />

              {/* Category details */}
              <Pressable
                onPress={() => onOpenEdit(cat)}
                style={styles.catInfoArea}
                accessibilityRole="button"
                accessibilityLabel={`Edit category ${cat.name}`}
              >
                <Text style={[styles.catName, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
                  {cat.name}
                </Text>
                <Text style={[styles.catCount, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  {count} script{count !== 1 ? 's' : ''}
                </Text>
              </Pressable>

              {/* Action buttons (Edit & Delete) */}
              <View style={styles.actionIconGroup}>
                <Pressable
                  onPress={() => onOpenEdit(cat)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${cat.name}`}
                  style={({ pressed }) => [styles.actionIconBtn, { opacity: pressed ? 0.5 : 1 }]}
                >
                  <Feather name="edit-2" size={18} color={colors.foreground} />
                </Pressable>

                {onDeleteCat && (
                  <Pressable
                    onPress={() => onDeleteCat(cat)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${cat.name}`}
                    style={({ pressed }) => [styles.actionIconBtn, { opacity: pressed ? 0.5 : 1 }]}
                  >
                    <Feather name="trash-2" size={18} color={colors.mutedForeground} />
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Usage Progress Bar Card */}
      <View
        style={[
          styles.usageCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: '#F59E0B',
                width: `${Math.max(progressRatio * 100, 4)}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.usageText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
          {usedCount} / {maxRecommended} Categories Used
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  subHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  subHeaderTitle: {
    fontSize: 18,
  },
  subHeaderDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 76,
    elevation: 2,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  addBtnText: {
    fontSize: 14,
  },
  listContainer: {
    gap: 12,
  },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 64,
  },
  catColorBar: {
    width: 5,
    height: '100%',
    minHeight: 36,
    borderRadius: 3,
    marginRight: 14,
  },
  catInfoArea: {
    flex: 1,
    gap: 3,
    justifyContent: 'center',
  },
  catName: {
    fontSize: 16,
  },
  catCount: {
    fontSize: 13,
  },
  actionIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingLeft: 8,
  },
  actionIconBtn: {
    padding: 4,
  },
  emptyCard: {
    padding: 28,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 15,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 6,
  },
  usageCard: {
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  progressBarTrack: {
    height: 6,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  usageText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
