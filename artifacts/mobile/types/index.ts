export type ScriptStatus = 'not_started' | 'in_progress' | 'completed';

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface VoiceNote {
  id: string;
  uri: string;
  duration: number; // ms
  createdAt: string;
}

export interface VideoNote {
  id: string;
  uri: string;
  createdAt: string;
}

export type AttachedFileType = 'image' | 'video' | 'audio';

export interface AttachedFile {
  id: string;
  uri: string;
  name: string;
  type: AttachedFileType;
  mimeType?: string;
  size?: number;
  createdAt: string;
}

export interface Script {
  id: string;
  title: string;
  notes: string;
  reference: string;
  status: ScriptStatus;
  categoryIds: string[];
  deadline: string | null; // YYYY-MM-DD
  voiceNotes: VoiceNote[];
  videoNotes: VideoNote[];
  attachedFiles: AttachedFile[];
  createdAt: string;
  modifiedAt: string;
}

export interface Goal {
  id: string;
  title: string;
  targetValue: number;
  currentProgress: number;
  deadline: string | null;
  completed: boolean;
  createdAt: string;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null; // YYYY-MM-DD
  createdAt: string;
}
