import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
  Linking,
  Share,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData, generateId } from '@/context/DataContext';
import { CategoryBadge } from '@/components/CategoryBadge';
import { DatePickerModal } from '@/components/DatePickerModal';
import { AIAssistant } from '@/components/AIAssistant';
import { Script, ScriptStatus, VoiceNote, VideoNote, AttachedFile, AttachedFileType } from '@/types';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio, Video, ResizeMode } from 'expo-av';
import { File, Directory, Paths } from 'expo-file-system';
import JSZip from 'jszip';
import { getAllProviderMeta } from '@/services/ai/providers';
import { AIProviderKey } from '@/services/ai/types';
import { useAI } from '@/context/AIContext';

const STATUS_OPTIONS: { value: ScriptStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function ProviderDropdown() {
  const colors = useColors();
  const { configuredProviders, activeProvider, setActiveProvider, settings } = useAI();
  const allMeta = getAllProviderMeta();
  const [open, setOpen] = useState(false);

  if (configuredProviders.length === 0) return null;

  const activeMeta = activeProvider ? allMeta.find(m => m.key === activeProvider) : null;
  const activeCfg = activeProvider ? settings.providers[activeProvider] : null;
  const activeModelLabel = activeMeta && activeCfg
    ? activeMeta.models.find(m => m.id === activeCfg.selectedModel)?.label ?? activeCfg.selectedModel
    : '';

  const handleSelect = (key: AIProviderKey) => {
    setActiveProvider(key);
    setOpen(false);
    Haptics.selectionAsync();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.dropdownBtnCompact, { backgroundColor: colors.muted, borderColor: colors.border }]}
      >
        {activeMeta && <View style={[styles.providerDot, { backgroundColor: activeMeta.color }]} />}
        <Text style={[styles.dropdownValueCompact, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>
          {activeModelLabel || activeMeta?.displayName || 'Select provider'}
        </Text>
        <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownOverlay} onPress={() => setOpen(false)}>
          <View style={[styles.dropdownSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dropdownSheetTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', borderBottomColor: colors.border }]}>
              AI Provider
            </Text>
            {configuredProviders.map(key => {
              const meta = allMeta.find(m => m.key === key)!;
              const cfg = settings.providers[key];
              const modelLabel = meta.models.find(m => m.id === cfg?.selectedModel)?.label ?? cfg?.selectedModel;
              const active = activeProvider === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => handleSelect(key)}
                  style={[
                    styles.dropdownOption,
                    {
                      backgroundColor: active ? meta.color + '15' : 'transparent',
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.providerDot, { backgroundColor: meta.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dropdownOptionName, { color: colors.foreground, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                      {modelLabel}
                    </Text>
                    <Text style={[styles.dropdownOptionSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                      {meta.displayName}
                    </Text>
                  </View>
                  {active && <Feather name="check" size={16} color={meta.color} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}


function formatDeadline(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: AttachedFileType): React.ComponentProps<typeof Feather>['name'] {
  if (type === 'image') return 'image';
  if (type === 'video') return 'film';
  return 'music';
}

// ─── Add-file type picker modal ─────────────────────────────────────────────
function AddFileModal({
  visible,
  colors,
  onClose,
  onPick,
}: {
  visible: boolean;
  colors: ReturnType<typeof useColors>;
  onClose: () => void;
  onPick: (type: AttachedFileType) => void;
}) {
  const OPTIONS: { type: AttachedFileType; icon: React.ComponentProps<typeof Feather>['name']; label: string; sub: string }[] = [
    { type: 'image', icon: 'image', label: 'Image', sub: 'JPG, PNG, GIF, WEBP…' },
    { type: 'video', icon: 'film', label: 'Video', sub: 'MP4, MOV, AVI…' },
    { type: 'audio', icon: 'music', label: 'Audio', sub: 'MP3, M4A, WAV, AAC…' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            Add Attachment
          </Text>
          <Text style={[styles.modalSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            Choose the type of file to attach
          </Text>
          {OPTIONS.map(opt => (
            <Pressable
              key={opt.type}
              onPress={() => { onClose(); onPick(opt.type); Haptics.selectionAsync(); }}
              style={[styles.typeRow, { borderColor: colors.border }]}
            >
              <View style={[styles.typeIconBox, { backgroundColor: colors.primary + '18' }]}>
                <Feather name={opt.icon} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeLabel, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.typeSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  {opt.sub}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
          <Pressable onPress={onClose} style={[styles.cancelBtn, { backgroundColor: colors.muted, borderRadius: 12 }]}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ScriptEditorScreen() {
  const { id, prefillDate } = useLocalSearchParams<{ id: string; prefillDate?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { scripts, categories, goals, createScript, updateScript, deleteScript, updateGoal } = useData();

  const isNew = id === 'new';
  const existing = isNew ? null : scripts.find(s => s.id === id) ?? null;

  // Form state
  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [status, setStatus] = useState<ScriptStatus>(existing?.status ?? 'not_started');
  const [selectedCats, setSelectedCats] = useState<string[]>(existing?.categoryIds ?? []);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(existing?.goalId ?? null);
  const [deadline, setDeadline] = useState<Date | null>(
    existing?.deadline
      ? new Date(existing.deadline)
      : prefillDate ? new Date(prefillDate) : null,
  );
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>(existing?.voiceNotes ?? []);
  const [videoNotes, setVideoNotes] = useState<VideoNote[]>(existing?.videoNotes ?? []);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>(existing?.attachedFiles ?? []);

  // UI state
  const [saving, setSaving] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [catPickerVisible, setCatPickerVisible] = useState(false);
  const [goalPickerVisible, setGoalPickerVisible] = useState(false);
  const [addFileVisible, setAddFileVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<AttachedFile | null>(null);

  // Audio recording
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    Audio.getPermissionsAsync().then(({ status }) => {
      setMicPermission(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
    });
    return () => { soundRef.current?.unloadAsync(); };
  }, []);

  const getDaysLeft = (d: Date) => {
    const diff = Math.ceil((d.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a title for this script.');
      return;
    }
    setSaving(true);
    try {
      const deadlineStr = deadline ? deadline.toISOString().split('T')[0] : null;
      const data: Partial<Script> = {
        title: title.trim(),
        notes,
        reference,
        status,
        categoryIds: selectedCats,
        goalId: selectedGoalId || undefined,
        deadline: deadlineStr,
        voiceNotes,
        videoNotes,
        attachedFiles,
      };

      const oldGoalId = existing?.goalId;
      if (oldGoalId !== selectedGoalId) {
        if (oldGoalId) {
          const oldGoal = goals.find(g => g.id === oldGoalId);
          if (oldGoal) {
            const newProgress = Math.max(0, oldGoal.currentProgress - 1);
            await updateGoal(oldGoalId, {
              currentProgress: newProgress,
              completed: newProgress >= oldGoal.targetValue
            });
          }
        }
        if (selectedGoalId) {
          const newGoal = goals.find(g => g.id === selectedGoalId);
          if (newGoal) {
            const newProgress = newGoal.currentProgress + 1;
            await updateGoal(selectedGoalId, {
              currentProgress: newProgress,
              completed: newProgress >= newGoal.targetValue
            });
          }
        }
      }

      if (isNew) await createScript(data);
      else if (existing) await updateScript(existing.id, data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert('Delete Script', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteScript(existing.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          router.back();
        },
      },
    ]);
  };

  const toggleCategory = (catId: string) => {
    setSelectedCats(prev => prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]);
    Haptics.selectionAsync();
  };

  // ── Audio recording ───────────────────────────────────────────────────────
  const requestMic = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    setMicPermission(status === 'granted' ? 'granted' : 'denied');
    return status === 'granted';
  };

  const startRecording = async () => {
    const ok = micPermission === 'granted' || (await requestMic());
    if (!ok) { Alert.alert('Microphone needed', 'Please grant microphone permission.'); return; }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { Alert.alert('Error', 'Could not start recording.'); }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      const recStatus = await recording.getStatusAsync();
      if (uri) {
        const dir = new Directory(Paths.document, 'voice_notes');
        if (!dir.exists) {
          await dir.create();
        }
        const destFile = new File(dir, `voice_${Date.now()}.m4a`);
        const dest = destFile.uri;
        await new File(uri).copy(destFile);
        setVoiceNotes(prev => [...prev, {
          id: generateId(), uri: dest,
          duration: recStatus.durationMillis ?? 0,
          createdAt: new Date().toISOString(),
        }]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch { Alert.alert('Error', 'Could not save recording.'); }
    setRecording(null);
    setIsRecording(false);
  };

  const playVoiceNote = async (note: VoiceNote) => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      if (playingId === note.id) { setPlayingId(null); return; }
    }
    setPlayingId(note.id);
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: note.uri });
      soundRef.current = sound;
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(s => {
        if (s.isLoaded && s.didJustFinish) { setPlayingId(null); sound.unloadAsync(); soundRef.current = null; }
      });
    } catch { setPlayingId(null); Alert.alert('Error', 'Could not play this recording.'); }
  };

  const deleteVoiceNote = (noteId: string) => {
    Alert.alert('Delete Recording', 'Remove this voice note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setVoiceNotes(prev => prev.filter(n => n.id !== noteId)) },
    ]);
  };

  // ── Play attached audio file ──────────────────────────────────────────────
  const playAttachedAudio = async (file: AttachedFile) => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      if (playingId === file.id) { setPlayingId(null); return; }
    }
    setPlayingId(file.id);
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: file.uri });
      soundRef.current = sound;
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(s => {
        if (s.isLoaded && s.didJustFinish) { setPlayingId(null); sound.unloadAsync(); soundRef.current = null; }
      });
    } catch { setPlayingId(null); Alert.alert('Error', 'Could not play this file.'); }
  };

  // ── File picking ──────────────────────────────────────────────────────────
  const handlePickFile = async (type: AttachedFileType) => {
    try {
      if (type === 'image') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your media library.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          quality: 0.85,
        });
        if (!result.canceled) {
          const dir = new Directory(Paths.document, 'attachments');
          if (!dir.exists) {
            await dir.create();
          }
          const newFiles: AttachedFile[] = [];
          for (const asset of result.assets) {
            const ext = asset.uri.split('.').pop() ?? 'jpg';
            const destFile = new File(dir, `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`);
            const dest = destFile.uri;
            await new File(asset.uri).copy(destFile);
            newFiles.push({
              id: generateId(),
              uri: dest,
              name: asset.fileName ?? `Image.${ext}`,
              type: 'image',
              mimeType: asset.mimeType ?? 'image/jpeg',
              size: asset.fileSize,
              createdAt: new Date().toISOString(),
            });
          }
          setAttachedFiles(prev => [...prev, ...newFiles]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else if (type === 'video') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your media library.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
          allowsMultipleSelection: true,
          quality: 1,
        });
        if (!result.canceled) {
          const dir = new Directory(Paths.document, 'attachments');
          if (!dir.exists) {
            await dir.create();
          }
          const newFiles: AttachedFile[] = [];
          for (const asset of result.assets) {
            const ext = asset.uri.split('.').pop() ?? 'mp4';
            const destFile = new File(dir, `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`);
            const dest = destFile.uri;
            await new File(asset.uri).copy(destFile);
            newFiles.push({
              id: generateId(),
              uri: dest,
              name: asset.fileName ?? `Video.${ext}`,
              type: 'video',
              mimeType: asset.mimeType ?? 'video/mp4',
              size: asset.fileSize,
              createdAt: new Date().toISOString(),
            });
          }
          setAttachedFiles(prev => [...prev, ...newFiles]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        // Audio via document picker
        const result = await DocumentPicker.getDocumentAsync({
          type: ['audio/*'],
          multiple: true,
          copyToCacheDirectory: true,
        });
        if (!result.canceled) {
          const dir = new Directory(Paths.document, 'attachments');
          if (!dir.exists) {
            await dir.create();
          }
          const newFiles: AttachedFile[] = [];
          for (const asset of result.assets) {
            const ext = asset.name.split('.').pop() ?? 'mp3';
            const destFile = new File(dir, `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`);
            const dest = destFile.uri;
            await new File(asset.uri).copy(destFile);
            newFiles.push({
              id: generateId(),
              uri: dest,
              name: asset.name,
              type: 'audio',
              mimeType: asset.mimeType ?? 'audio/*',
              size: asset.size,
              createdAt: new Date().toISOString(),
            });
          }
          setAttachedFiles(prev => [...prev, ...newFiles]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Could not attach the file. Please try again.');
    }
  };

  const deleteAttachedFile = (fileId: string) => {
    Alert.alert('Remove File', 'Remove this attachment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setAttachedFiles(prev => prev.filter(f => f.id !== fileId)) },
    ]);
  };

  const statusColor = (s: ScriptStatus) =>
    s === 'completed' ? colors.completed : s === 'in_progress' ? colors.inProgress : colors.notStarted;

  // ── Group attachments by type for display ─────────────────────────────────
  const imageFiles = attachedFiles.filter(f => f.type === 'image');
  const videoFiles = attachedFiles.filter(f => f.type === 'video');
  const audioFiles = attachedFiles.filter(f => f.type === 'audio');

  const [isZipping, setIsZipping] = useState(false);

  const generateZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < attachedFiles.length; i++) {
        const f = attachedFiles[i];
        const srcFile = new File(f.uri);
        const base64 = await srcFile.base64();

        let ext = '.bin';
        const extMatch = f.name?.match(/\.[0-9a-z]+$/i);
        if (extMatch) {
          ext = extMatch[0];
        } else if (f.type === 'image') ext = '.jpg';
        else if (f.type === 'video') ext = '.mp4';
        else if (f.type === 'audio') ext = '.m4a';

        const filename = f.name || `attachment_${i + 1}${ext}`;
        zip.file(filename, base64, { base64: true });
      }

      const zipBase64 = await zip.generateAsync({ type: 'base64' });
      const safeTitle = (title || 'Attachments').replace(/[^a-z0-9]/gi, '_');
      const zipFile = new File(Paths.cache, `ScriptVault_${safeTitle}.zip`);

      // Decode base64 to Uint8Array and write
      const binaryStr = atob(zipBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      zipFile.write(bytes);

      setIsZipping(false);
      return zipFile.uri;
    } catch (e) {
      setIsZipping(false);
      console.error('Zip generation error:', e);
      Alert.alert('Error', 'Failed to generate zip file');
      return null;
    }
  };

  const handleDownloadAll = async () => {
    if (attachedFiles.length === 0) return;
    const zipPath = await generateZip();
    if (!zipPath) return;

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(zipPath, { UTI: 'public.zip-archive', dialogTitle: 'Save Zip File' });
    } else {
      Alert.alert('Error', 'Sharing/Saving is not available on this device.');
    }
  };

  const handleShareAll = async () => {
    if (attachedFiles.length === 0) {
      Alert.alert('No files', 'There are no files to share.');
      return;
    }

    const zipPath = await generateZip();
    if (!zipPath) return;

    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(zipPath, { UTI: 'public.zip-archive', dialogTitle: 'Share Attachments' });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (err) {
      console.log('Share error:', err);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: isNew ? 'New Script' : 'Edit Script',
          headerStyle: { backgroundColor: colors.background } as any,
          headerTitleStyle: { color: colors.foreground, fontFamily: 'Inter_600SemiBold' } as any,
          headerTintColor: colors.primary,
          headerRight: () => (
            <Pressable onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 16, marginRight: 4 }}>
                  Save
                </Text>
              )}
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: bottomInset + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <TextInput
            style={[styles.titleInput, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Script title"
            placeholderTextColor={colors.mutedForeground}
            multiline
          />
        </View>

        {/* Status */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Status</Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map(opt => {
              const active = status === opt.value;
              const sc = statusColor(opt.value);
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => { setStatus(opt.value); Haptics.selectionAsync(); }}
                  style={[styles.statusChip, { backgroundColor: active ? sc + '20' : colors.muted, borderColor: active ? sc : colors.border, borderRadius: 20 }]}
                >
                  <Text style={[styles.statusChipText, { color: active ? sc : colors.mutedForeground, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Notes</Text>
          <TextInput
            style={[styles.notesInput, { color: colors.foreground, fontFamily: 'Inter_400Regular', backgroundColor: colors.muted, borderRadius: colors.radius }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Write your script notes here…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* AI Assistant */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
              AI Assistant
            </Text>
            <ProviderDropdown />
          </View>
          <AIAssistant
            scriptContent={notes}
            onAccept={result => {
              setNotes(result);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          />
        </View>

        {/* Reference */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Reference</Text>
            {!!reference.trim() && (
              <Pressable
                onPress={() => {
                  let url = reference.trim();
                  if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                  }
                  Linking.openURL(url).catch(() => { });
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}
              >
                <Feather name="external-link" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 13 }}>Open Link</Text>
              </Pressable>
            )}
          </View>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Inter_400Regular', backgroundColor: colors.muted, borderRadius: colors.radius }]}
            value={reference}
            onChangeText={setReference}
            placeholder="Source, link, or reference…"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        {/* Categories & Linked Goal */}
        <View style={[styles.section, { borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'flex-start', gap: 20 }]}>

          {/* Categories */}
          <View style={{ flex: 1, gap: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Categories</Text>
              <Pressable onPress={() => setCatPickerVisible(!catPickerVisible)}>
                <Feather name={catPickerVisible ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {selectedCats.length > 0 && (
              <View style={styles.catBadges}>
                {categories.filter(c => selectedCats.includes(c.id)).map(cat => (
                  <CategoryBadge key={cat.id} name={cat.name} color={cat.color} />
                ))}
              </View>
            )}
            {catPickerVisible && (
              <View style={{ gap: 8, marginTop: 4 }}>
                {categories.length === 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
                    No categories yet
                  </Text>
                ) : (
                  categories.map(cat => {
                    const selected = selectedCats.includes(cat.id);
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => toggleCategory(cat.id)}
                        style={[styles.catOption, { backgroundColor: selected ? cat.color + '15' : colors.muted, borderColor: selected ? cat.color : colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, gap: 6 }]}
                      >
                        <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                        <Text style={[styles.catOptionText, { color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13 }]} numberOfLines={1}>{cat.name}</Text>
                        {selected && <Feather name="check" size={14} color={cat.color} />}
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </View>

          {/* Linked Goal */}
          <View style={{ flex: 1, gap: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Linked Goal</Text>
              <Pressable onPress={() => setGoalPickerVisible(!goalPickerVisible)}>
                <Feather name={goalPickerVisible ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {selectedGoalId && (
              <View>
                {goals.filter(g => g.id === selectedGoalId).map(goal => (
                  <View key={goal.id} style={[styles.catOption, { backgroundColor: colors.primary + '15', borderColor: colors.primary, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, gap: 6 }]}>
                    <Feather name="target" size={12} color={colors.primary} />
                    <Text style={[styles.catOptionText, { color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 13 }]} numberOfLines={1}>{goal.title}</Text>
                    <Pressable onPress={() => setSelectedGoalId(null)}>
                      <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            {goalPickerVisible && (
              <View style={{ gap: 8, marginTop: 4 }}>
                {goals.length === 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
                    No goals available
                  </Text>
                ) : (
                  goals.map(goal => {
                    const selected = selectedGoalId === goal.id;
                    return (
                      <Pressable
                        key={goal.id}
                        onPress={() => {
                          setSelectedGoalId(goal.id);
                          setGoalPickerVisible(false);
                        }}
                        style={[styles.catOption, { backgroundColor: selected ? colors.primary + '15' : colors.muted, borderColor: selected ? colors.primary : colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, gap: 6 }]}
                      >
                        <Feather name="target" size={12} color={selected ? colors.primary : colors.mutedForeground} />
                        <Text style={[styles.catOptionText, { color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13 }]} numberOfLines={1}>
                          {goal.title}
                        </Text>
                        {selected && <Feather name="check" size={14} color={colors.primary} />}
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </View>

        </View>

        {/* Deadline */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Deadline</Text>
          <View style={styles.rowBetween}>
            <Pressable
              onPress={() => setDatePickerVisible(true)}
              style={[
                styles.dateBtn,
                {
                  backgroundColor: deadline ? colors.primary + '15' : colors.muted,
                  borderColor: deadline ? colors.primary : 'transparent',
                  borderWidth: 1,
                  borderRadius: 12,
                  flex: 1,
                  height: 52
                }
              ]}
            >
              <Feather name="calendar" size={16} color={deadline ? colors.primary : colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: deadline ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 15 }}>
                  {deadline ? formatDeadline(deadline.toISOString()) : 'Set a deadline'}
                </Text>
                {deadline && (
                  <Text style={{ color: colors.primary, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 }}>
                    {getDaysLeft(deadline)}
                  </Text>
                )}
              </View>
            </Pressable>
            {deadline && (
              <Pressable onPress={() => setDeadline(null)} style={[styles.clearBtn, { backgroundColor: colors.primary + '15' }]}>
                <Feather name="x" size={16} color={colors.primary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── ATTACHMENTS ─────────────────────────────────────────────── */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                Attachments ({attachedFiles.length})
              </Text>
              {attachedFiles.length > 0 && (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
                  {imageFiles.length} img · {videoFiles.length} vid · {audioFiles.length} audio
                </Text>
              )}
            </View>
            {attachedFiles.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={handleDownloadAll} disabled={isZipping} style={[styles.actionIconBtn, { backgroundColor: colors.muted, opacity: isZipping ? 0.5 : 1 }]}>
                  {isZipping ? <ActivityIndicator size="small" color={colors.foreground} /> : <Feather name="download" size={15} color={colors.foreground} />}
                </Pressable>
                <Pressable onPress={handleShareAll} disabled={isZipping} style={[styles.actionIconBtn, { backgroundColor: colors.muted, opacity: isZipping ? 0.5 : 1 }]}>
                  {isZipping ? <ActivityIndicator size="small" color={colors.foreground} /> : <Feather name="share" size={15} color={colors.foreground} />}
                </Pressable>
              </View>
            )}
          </View>

          {/* Image grid */}
          {imageFiles.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={[styles.subLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                <Feather name="image" size={11} /> Images
              </Text>
              <View style={styles.imageGrid}>
                {imageFiles.map(file => (
                  <View key={file.id} style={[styles.imageTile, { borderRadius: 10, overflow: 'hidden', borderColor: colors.border }]}>
                    <Pressable style={{ flex: 1 }} onPress={() => setPreviewFile(file)}>
                      <Image source={{ uri: file.uri }} style={styles.imageTileImg} resizeMode="cover" />
                      {file.name ? (
                        <View style={styles.imageTileFooter}>
                          <Text style={styles.imageTileName} numberOfLines={1}>{file.name}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                    <Pressable
                      onPress={() => deleteAttachedFile(file.id)}
                      style={[styles.imageTileDelete, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
                    >
                      <Feather name="x" size={13} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Video list */}
          {videoFiles.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={[styles.subLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                <Feather name="film" size={11} /> Videos
              </Text>
              {videoFiles.map(file => (
                <Pressable key={file.id} onPress={() => setPreviewFile(file)} style={[styles.fileRow, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: 10 }]}>
                  <View style={[styles.fileIconBox, { backgroundColor: colors.primary + '18' }]}>
                    <Feather name="film" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fileName, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>{file.name}</Text>
                    <Text style={[styles.fileMeta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                      {formatFileSize(file.size)}{file.size ? ' · ' : ''}{new Date(file.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Pressable onPress={() => deleteAttachedFile(file.id)}>
                    <Feather name="trash-2" size={17} color={colors.destructive} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}

          {/* Audio list */}
          {audioFiles.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={[styles.subLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                <Feather name="music" size={11} /> Audio
              </Text>
              {audioFiles.map(file => (
                <View key={file.id} style={[styles.fileRow, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: 10 }]}>
                  <Pressable
                    onPress={() => playAttachedAudio(file)}
                    style={[styles.playBtn, { backgroundColor: playingId === file.id ? colors.primary : colors.card, borderRadius: 22 }]}
                  >
                    <Feather
                      name={playingId === file.id ? 'square' : 'play'}
                      size={15}
                      color={playingId === file.id ? colors.primaryForeground : colors.foreground}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fileName, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]} numberOfLines={1}>{file.name}</Text>
                    <Text style={[styles.fileMeta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                      {formatFileSize(file.size)}{file.size ? ' · ' : ''}{new Date(file.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Pressable onPress={() => deleteAttachedFile(file.id)}>
                    <Feather name="trash-2" size={17} color={colors.destructive} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Empty state */}
          {attachedFiles.length === 0 && (
            <View style={[styles.attachEmpty, { backgroundColor: colors.muted, borderRadius: 12, borderColor: colors.border }]}>
              <Feather name="paperclip" size={28} color={colors.mutedForeground} />
              <Text style={[styles.attachEmptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                No attachments yet
              </Text>
            </View>
          )}

          {/* Add button */}
          <Pressable
            onPress={() => setAddFileVisible(true)}
            style={[styles.addFileBtn, { backgroundColor: colors.primary, borderRadius: 12 }]}
          >
            <Feather name="paperclip" size={17} color="#fff" />
            <Text style={[styles.addFileBtnText, { fontFamily: 'Inter_600SemiBold' }]}>
              Add Files
            </Text>
          </Pressable>
        </View>

        {/* Voice Notes */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
            Voice Notes ({voiceNotes.length})
          </Text>
          {voiceNotes.map(note => (
            <View key={note.id} style={[styles.fileRow, { backgroundColor: colors.muted, borderRadius: 10, borderColor: colors.border }]}>
              <Pressable
                onPress={() => playVoiceNote(note)}
                style={[styles.playBtn, { backgroundColor: playingId === note.id ? colors.primary : colors.card, borderRadius: 22 }]}
              >
                <Feather
                  name={playingId === note.id ? 'square' : 'play'}
                  size={15}
                  color={playingId === note.id ? colors.primaryForeground : colors.foreground}
                />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fileName, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>Voice Recording</Text>
                <Text style={[styles.fileMeta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  {formatDuration(note.duration)} · {new Date(note.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Pressable onPress={() => deleteVoiceNote(note.id)}>
                <Feather name="trash-2" size={17} color={colors.destructive} />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={isRecording ? stopRecording : startRecording}
            style={[styles.addFileBtn, { backgroundColor: isRecording ? colors.destructive : colors.secondary, borderRadius: 12, borderWidth: isRecording ? 0 : 1, borderColor: colors.border }]}
          >
            <Feather name={isRecording ? 'square' : 'mic'} size={17} color={isRecording ? '#fff' : colors.foreground} />
            <Text style={[styles.addFileBtnText, { color: isRecording ? '#fff' : colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {isRecording ? 'Stop Recording' : 'Record Voice Note'}
            </Text>
          </Pressable>
          {Platform.OS === 'web' && (
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center' }}>
              Audio recording works on iOS/Android devices
            </Text>
          )}
        </View>

        {/* Delete */}
        {!isNew && (
          <View style={[styles.section, { borderBottomColor: 'transparent' }]}>
            <Pressable
              onPress={handleDelete}
              style={[styles.deleteBtn, { borderColor: colors.destructive + '60', borderRadius: colors.radius }]}
            >
              <Feather name="trash-2" size={16} color={colors.destructive} />
              <Text style={{ color: colors.destructive, fontFamily: 'Inter_500Medium', fontSize: 15 }}>
                Delete Script
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <DatePickerModal
        visible={datePickerVisible}
        date={deadline}
        minDate={new Date()}
        onConfirm={d => { setDeadline(d); setDatePickerVisible(false); }}
        onClose={() => setDatePickerVisible(false)}
      />

      <AddFileModal
        visible={addFileVisible}
        colors={colors}
        onClose={() => setAddFileVisible(false)}
        onPick={handlePickFile}
      />

      {/* File Preview Modal */}
      <Modal
        visible={!!previewFile}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPreviewFile(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <Pressable
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }}
            onPress={() => setPreviewFile(null)}
          >
            <Feather name="x" size={28} color="#fff" />
          </Pressable>
          {previewFile?.type === 'image' && (
            <Image
              source={{ uri: previewFile.uri }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          )}
          {previewFile?.type === 'video' && (
            <Video
              source={{ uri: previewFile.uri }}
              style={{ width: '100%', height: '80%' }}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              shouldPlay
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({

  dropdownBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  dropdownValueCompact: {
    fontSize: 12,
    maxWidth: 120
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dropdownSheet: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownSheetTitle: {
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownOptionName: { fontSize: 15 },
  dropdownOptionSub: { fontSize: 12, marginTop: 2 },
  providerDot: { width: 8, height: 8, borderRadius: 4 },




  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 10,
  },
  fieldLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  subLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  titleInput: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 33,
    minHeight: 40,
  },
  notesInput: {
    fontSize: 15,
    lineHeight: 23,
    padding: 14,
    minHeight: 120,
  },
  textInput: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusChip: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
  statusChipText: { fontSize: 13 },
  catBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catOptionText: { flex: 1, fontSize: 15 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },

  // Image grid
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageTile: { width: 100, height: 100, borderWidth: 1, position: 'relative' },
  imageTileImg: { width: '100%', height: '100%' },
  imageTileDelete: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  imageTileFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 5, paddingVertical: 3,
  },
  imageTileName: { color: '#fff', fontSize: 9, fontFamily: 'Inter_400Regular' },

  // File rows (video + audio)
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1 },
  fileIconBox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  fileName: { fontSize: 14 },
  fileMeta: { fontSize: 12, marginTop: 2 },

  // Play button
  playBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Empty state
  attachEmpty: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 28, borderWidth: 1, borderStyle: 'dashed',
  },
  attachEmptyText: { fontSize: 14 },

  // Add file button
  addFileBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13,
  },
  addFileBtnText: { fontSize: 15, color: '#fff' },

  actionIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderWidth: 1 },

  // Add-file modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12, gap: 4 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, marginBottom: 2 },
  modalSub: { fontSize: 13, marginBottom: 10 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1 },
  typeIconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 16 },
  typeSub: { fontSize: 12, marginTop: 2 },
  cancelBtn: { marginTop: 10, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15 },
});
