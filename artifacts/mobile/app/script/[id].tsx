import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData, generateId } from '@/context/DataContext';
import { CategoryBadge } from '@/components/CategoryBadge';
import { DatePickerModal } from '@/components/DatePickerModal';
import { Script, ScriptStatus, VoiceNote, VideoNote, Category } from '@/types';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
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

  // UI state
  const [saving, setSaving] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [catPickerVisible, setCatPickerVisible] = useState(false);

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
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

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
      };
      if (isNew) {
        await createScript(data);
      } else if (existing) {
        await updateScript(existing.id, data);
      }
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
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteScript(existing.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          router.back();
        },
      },
    ]);
  };

  const toggleCategory = (catId: string) => {
    setSelectedCats(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId],
    );
    Haptics.selectionAsync();
  };

  // --- Audio recording ---
  const requestMic = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    setMicPermission(status === 'granted' ? 'granted' : 'denied');
    return status === 'granted';
  };

  const startRecording = async () => {
    const ok = micPermission === 'granted' || (await requestMic());
    if (!ok) {
      Alert.alert('Microphone needed', 'Please grant microphone permission to record voice notes.');
      return;
    }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      const status = await recording.getStatusAsync();
      if (uri) {
        const dir = FileSystem.documentDirectory + 'voice_notes/';
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const dest = dir + `voice_${Date.now()}.m4a`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        const note: VoiceNote = {
          id: generateId(),
          uri: dest,
          duration: status.isLoaded ? status.durationMillis ?? 0 : 0,
          createdAt: new Date().toISOString(),
        };
        setVoiceNotes(prev => [...prev, note]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save recording.');
    }
    setRecording(null);
    setIsRecording(false);
  };

  const playVoiceNote = async (note: VoiceNote) => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      if (playingId === note.id) {
        setPlayingId(null);
        return;
      }
    }
    setPlayingId(note.id);
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: note.uri });
      soundRef.current = sound;
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(s => {
        if (s.isLoaded && s.didJustFinish) {
          setPlayingId(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (e) {
      setPlayingId(null);
      Alert.alert('Error', 'Could not play this recording.');
    }
  };

  const deleteVoiceNote = (noteId: string) => {
    Alert.alert('Delete Recording', 'Remove this voice note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setVoiceNotes(prev => prev.filter(n => n.id !== noteId)),
      },
    ]);
  };

  // --- Video picking ---
  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your media library to attach videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const dir = FileSystem.documentDirectory + 'video_notes/';
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const ext = asset.uri.split('.').pop() ?? 'mp4';
      const dest = dir + `video_${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: asset.uri, to: dest });
      const note: VideoNote = {
        id: generateId(),
        uri: dest,
        createdAt: new Date().toISOString(),
      };
      setVideoNotes(prev => [...prev, note]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const deleteVideoNote = (noteId: string) => {
    Alert.alert('Remove Video', 'Remove this video note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setVideoNotes(prev => prev.filter(n => n.id !== noteId)),
      },
    ]);
  };

  const statusColor = (s: ScriptStatus) =>
    s === 'completed' ? colors.completed : s === 'in_progress' ? colors.inProgress : colors.notStarted;

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
        contentContainerStyle={{ paddingBottom: bottomInset + 40, gap: 0 }}
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
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: active ? sc + '20' : colors.muted,
                      borderColor: active ? sc : colors.border,
                      borderRadius: 20,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      {
                        color: active ? sc : colors.mutedForeground,
                        fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
                      },
                    ]}
                  >
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
              {categories
                .filter(c => selectedCats.includes(c.id))
                .map(cat => (
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
                      style={[
                        styles.catOption,
                        {
                          backgroundColor: selected ? cat.color + '15' : colors.muted,
                          borderColor: selected ? cat.color : colors.border,
                          borderRadius: 10,
                        },
                      ]}
                    >
                      <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                      <Text style={[styles.catOptionText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>
                        {cat.name}
                      </Text>
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
              <Text style={[{ color: deadline ? colors.foreground : colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 15 }]}>
                {deadline ? formatDeadline(deadline.toISOString()) : 'No deadline set'}
              </Text>
            </Pressable>
            {deadline && (
              <Pressable
                onPress={() => setDeadline(null)}
                style={[styles.clearBtn, { backgroundColor: colors.muted }]}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Voice Notes */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
            Voice Notes ({voiceNotes.length})
          </Text>
          {voiceNotes.map(note => (
            <View
              key={note.id}
              style={[styles.mediaItem, { backgroundColor: colors.muted, borderRadius: 10, borderColor: colors.border }]}
            >
              <Pressable
                onPress={() => playVoiceNote(note)}
                style={[styles.playBtn, { backgroundColor: playingId === note.id ? colors.primary : colors.card, borderRadius: 22 }]}
              >
                <Feather
                  name={playingId === note.id ? 'square' : 'play'}
                  size={16}
                  color={playingId === note.id ? colors.primaryForeground : colors.foreground}
                />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }]}>
                  Voice Recording
                </Text>
                <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }]}>
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
            style={[
              styles.recordBtn,
              {
                backgroundColor: isRecording ? colors.destructive : colors.primary,
                borderRadius: 12,
              },
            ]}
          >
            <Feather name={isRecording ? 'square' : 'mic'} size={18} color="#FFFFFF" />
            <Text style={[styles.recordBtnText, { fontFamily: 'Inter_600SemiBold' }]}>
              {isRecording ? 'Stop Recording' : 'Record Voice Note'}
            </Text>
          </Pressable>
          {Platform.OS === 'web' && (
            <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center' }]}>
              Audio recording works on iOS/Android devices
            </Text>
          )}
        </View>

        {/* Video Notes */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
            Video Notes ({videoNotes.length})
          </Text>
          {videoNotes.map(note => (
            <View
              key={note.id}
              style={[styles.mediaItem, { backgroundColor: colors.muted, borderRadius: 10, borderColor: colors.border }]}
            >
              <View style={[styles.videoThumb, { backgroundColor: colors.card, borderRadius: 8 }]}>
                <Feather name="video" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }]}>
                  Video Note
                </Text>
                <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }]}>
                  {new Date(note.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Pressable onPress={() => deleteVideoNote(note.id)}>
                <Feather name="trash-2" size={17} color={colors.destructive} />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={pickVideo}
            style={[styles.recordBtn, { backgroundColor: colors.secondary, borderRadius: 12, borderWidth: 1, borderColor: colors.border }]}
          >
            <Feather name="video" size={18} color={colors.foreground} />
            <Text style={[styles.recordBtnText, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              Attach Video from Library
            </Text>
          </Pressable>
        </View>

        {/* Delete */}
        {!isNew && (
          <View style={[styles.section, { borderBottomColor: 'transparent' }]}>
            <Pressable
              onPress={handleDelete}
              style={[styles.deleteBtn, { borderColor: colors.destructive + '60', borderRadius: colors.radius }]}
            >
              <Feather name="trash-2" size={16} color={colors.destructive} />
              <Text style={[{ color: colors.destructive, fontFamily: 'Inter_500Medium', fontSize: 15 }]}>
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
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 13 },
  catBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
  },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catOptionText: { flex: 1, fontSize: 15 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  clearBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  mediaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  playBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoThumb: {
    width: 52,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 13,
  },
  recordBtnText: {
    fontSize: 15,
    color: '#FFFFFF',
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
