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
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const STATUS_OPTIONS: { value: ScriptStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { scripts, categories, createScript, updateScript, deleteScript } = useData();

  const isNew = id === 'new';
  const existing = isNew ? null : scripts.find(s => s.id === id) ?? null;

  // Form state
  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [status, setStatus] = useState<ScriptStatus>(existing?.status ?? 'not_started');
  const [selectedCats, setSelectedCats] = useState<string[]>(existing?.categoryIds ?? []);
  const [deadline, setDeadline] = useState<Date | null>(
    existing?.deadline ? new Date(existing.deadline) : null,
  );
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>(existing?.voiceNotes ?? []);
  const [videoNotes, setVideoNotes] = useState<VideoNote[]>(existing?.videoNotes ?? []);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>(existing?.attachedFiles ?? []);

  // UI state
  const [saving, setSaving] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [catPickerVisible, setCatPickerVisible] = useState(false);
  const [addFileVisible, setAddFileVisible] = useState(false);

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
        deadline: deadlineStr,
        voiceNotes,
        videoNotes,
        attachedFiles,
      };
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
        const dir = FileSystem.documentDirectory + 'voice_notes/';
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const dest = dir + `voice_${Date.now()}.m4a`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        setVoiceNotes(prev => [...prev, {
          id: generateId(), uri: dest,
          duration: recStatus.isLoaded ? recStatus.durationMillis ?? 0 : 0,
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
          const dir = FileSystem.documentDirectory + 'attachments/';
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          const newFiles: AttachedFile[] = [];
          for (const asset of result.assets) {
            const ext = asset.uri.split('.').pop() ?? 'jpg';
            const dest = dir + `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;
            await FileSystem.copyAsync({ from: asset.uri, to: dest });
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
          const dir = FileSystem.documentDirectory + 'attachments/';
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          const newFiles: AttachedFile[] = [];
          for (const asset of result.assets) {
            const ext = asset.uri.split('.').pop() ?? 'mp4';
            const dest = dir + `vid_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;
            await FileSystem.copyAsync({ from: asset.uri, to: dest });
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
          const dir = FileSystem.documentDirectory + 'attachments/';
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          const newFiles: AttachedFile[] = [];
          for (const asset of result.assets) {
            const ext = asset.name.split('.').pop() ?? 'mp3';
            const dest = dir + `aud_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;
            await FileSystem.copyAsync({ from: asset.uri, to: dest });
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
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
            AI Assistant
          </Text>
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
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Reference</Text>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Inter_400Regular', backgroundColor: colors.muted, borderRadius: colors.radius }]}
            value={reference}
            onChangeText={setReference}
            placeholder="Source, link, or reference…"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        {/* Categories */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
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
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>
                  No categories yet — add them in Settings
                </Text>
              ) : (
                categories.map(cat => {
                  const selected = selectedCats.includes(cat.id);
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => toggleCategory(cat.id)}
                      style={[styles.catOption, { backgroundColor: selected ? cat.color + '15' : colors.muted, borderColor: selected ? cat.color : colors.border, borderRadius: 10 }]}
                    >
                      <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                      <Text style={[styles.catOptionText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>{cat.name}</Text>
                      {selected && <Feather name="check" size={16} color={cat.color} />}
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        </View>

        {/* Deadline */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>Deadline</Text>
          <View style={styles.rowBetween}>
            <Pressable
              onPress={() => setDatePickerVisible(true)}
              style={[styles.dateBtn, { backgroundColor: colors.muted, borderRadius: 10, flex: 1 }]}
            >
              <Feather name="calendar" size={15} color={deadline ? colors.primary : colors.mutedForeground} />
              <Text style={{ color: deadline ? colors.foreground : colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 15 }}>
                {deadline ? formatDeadline(deadline.toISOString()) : 'No deadline set'}
              </Text>
            </Pressable>
            {deadline && (
              <Pressable onPress={() => setDeadline(null)} style={[styles.clearBtn, { backgroundColor: colors.muted }]}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── ATTACHMENTS ─────────────────────────────────────────────── */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
              Attachments ({attachedFiles.length})
            </Text>
            {attachedFiles.length > 0 && (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
                {imageFiles.length} img · {videoFiles.length} vid · {audioFiles.length} audio
              </Text>
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
                    <Image source={{ uri: file.uri }} style={styles.imageTileImg} resizeMode="cover" />
                    <Pressable
                      onPress={() => deleteAttachedFile(file.id)}
                      style={[styles.imageTileDelete, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
                    >
                      <Feather name="x" size={13} color="#fff" />
                    </Pressable>
                    {file.name ? (
                      <View style={styles.imageTileFooter}>
                        <Text style={styles.imageTileName} numberOfLines={1}>{file.name}</Text>
                      </View>
                    ) : null}
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
                <View key={file.id} style={[styles.fileRow, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: 10 }]}>
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
                </View>
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
        onConfirm={d => { setDeadline(d); setDatePickerVisible(false); }}
        onClose={() => setDatePickerVisible(false)}
      />

      <AddFileModal
        visible={addFileVisible}
        colors={colors}
        onClose={() => setAddFileVisible(false)}
        onPick={handlePickFile}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
