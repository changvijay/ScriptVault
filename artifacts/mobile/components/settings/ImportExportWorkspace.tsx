import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface ImportExportWorkspaceProps {
  onExport: () => void;
  onImport: () => void;
  onDownloadTemplate: () => void;
  exporting: boolean;
  importing: boolean;
  downloadingTemplate: boolean;
  busy: boolean;
}

export function ImportExportWorkspace({
  onExport,
  onImport,
  onDownloadTemplate,
  exporting,
  importing,
  downloadingTemplate,
  busy,
}: ImportExportWorkspaceProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      {/* Description Card */}
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
        <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
          Backup & Restore Data
        </Text>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          Export your complete library of scripts, categories, and goals to Microsoft Excel format (.xlsx) or restore data from a backup spreadsheet.
        </Text>

        {/* Action Grid */}
        <View style={styles.actionGrid}>
          {/* Import Button */}
          <Pressable
            onPress={onImport}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Import data from Excel"
            style={({ pressed }) => [
              styles.actionBox,
              {
                backgroundColor: pressed ? colors.primary + '15' : colors.muted,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: busy && !importing ? 0.5 : 1,
              },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '1A' }]}>
              {importing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="upload" size={22} color={colors.primary} />
              )}
            </View>
            <Text style={[styles.actionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {importing ? 'Importing…' : 'Import'}
            </Text>
            <Text style={[styles.actionSubtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Load scripts from .xlsx
            </Text>
          </Pressable>

          {/* Export Button */}
          <Pressable
            onPress={onExport}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Export data to Excel"
            style={({ pressed }) => [
              styles.actionBox,
              {
                backgroundColor: pressed ? colors.primary + '15' : colors.muted,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: busy && !exporting ? 0.5 : 1,
              },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '1A' }]}>
              {exporting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="download" size={22} color={colors.primary} />
              )}
            </View>
            <Text style={[styles.actionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {exporting ? 'Exporting…' : 'Export'}
            </Text>
            <Text style={[styles.actionSubtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Save backup to .xlsx
            </Text>
          </Pressable>
        </View>

        {/* Sample Template Box */}
        <View style={[styles.templateBox, { borderTopColor: colors.border }]}>
          <View style={styles.templateTextRow}>
            <Feather name="file-text" size={18} color="#8B5CF6" />
            <Text style={[styles.templateTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              Sample Template
            </Text>
          </View>
          <Text style={[styles.templateDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            Use the ready-made sample template with dropdowns for Status, Categories & Goals, and date pickers for accurate formatting before importing. Supported formats: .csv, .xlsx.
          </Text>

          <Pressable
            onPress={onDownloadTemplate}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Download sample import template"
            style={({ pressed }) => [
              styles.templateBtn,
              {
                backgroundColor: pressed ? '#8B5CF6' + '25' : '#8B5CF6' + '15',
                borderColor: '#8B5CF6' + '40',
                borderRadius: colors.radius,
                opacity: busy && !downloadingTemplate ? 0.5 : 1,
              },
            ]}
          >
            {downloadingTemplate ? (
              <ActivityIndicator size="small" color="#8B5CF6" />
            ) : (
              <Feather name="download-cloud" size={16} color="#8B5CF6" />
            )}
            <Text style={{ color: '#8B5CF6', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
              {downloadingTemplate ? 'Preparing Template…' : 'Download Sample Template'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Overwrite Warning Card */}
      <View
        style={[
          styles.card,
          styles.warningCard,
          {
            backgroundColor: '#F59E0B' + '0F',
            borderColor: '#F59E0B' + '35',
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.warningHeader}>
          <View style={[styles.warningIconCircle, { backgroundColor: '#F59E0B' + '25' }]}>
            <Feather name="info" size={18} color="#F59E0B" />
          </View>
          <Text style={[styles.warningTitle, { color: '#F59E0B', fontFamily: 'Inter_600SemiBold' }]}>
            Data Overwrite Warning
          </Text>
        </View>
        <Text style={[styles.warningText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          Importing data with existing IDs will safely add entries alongside your current library without overwriting existing scripts. Please ensure you have exported a backup before proceeding with large batch imports.
        </Text>
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
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionBox: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 15,
  },
  actionSubtitle: {
    fontSize: 11,
    textAlign: 'center',
  },
  templateBox: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 6,
    gap: 10,
  },
  templateTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templateTitle: {
    fontSize: 15,
  },
  templateDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  warningCard: {
    padding: 16,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  warningIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningTitle: {
    fontSize: 15,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
