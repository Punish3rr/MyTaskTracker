// Type declarations for Electron API exposed via preload script
export interface Task {
  id: string;
  title: string;
  status: 'OPEN' | 'DONE' | 'ARCHIVED';
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  created_at: number;
  last_touched_at: number;
  archived_at: number | null;
  delete_after_at: number | null;
  pinned_summary: string;
  idleAge: number;
  attachmentCount: number;
  imageCount: number;
  fileCount: number;
}

export interface TimelineEntry {
  id: string;
  task_id: string;
  type: 'NOTE' | 'IMAGE' | 'FILE' | 'STATUS' | 'GAMIFY';
  content: string;
  created_at: number;
}

export interface TaskDetail {
  task: Task;
  timeline: TimelineEntry[];
}

export interface Gamification {
  key: string;
  xp: number;
  level: number;
  streak: number;
  last_active_date: number;
}

declare global {
  interface Window {
    electronAPI: {
      getTasks: () => Promise<Task[]>;
      getTaskById: (id: string) => Promise<TaskDetail | null>;
      createTask: (payload: { title: string; priority: string }) => Promise<Task>;
      updateTask: (payload: {
        id: string;
        title?: string;
        status?: string;
        priority?: string;
        pinned_summary?: string;
        updateTouched?: boolean;
      }) => Promise<Task>;
      addTimelineEntry: (payload: {
        taskId: string;
        type: 'NOTE' | 'IMAGE' | 'FILE' | 'STATUS' | 'GAMIFY';
        content: string;
        updateTouched?: boolean;
      }) => Promise<TimelineEntry>;
      attachFile: (taskId: string, filePath: string) => Promise<string>;
      pasteImage: (taskId: string, imageBuffer: Uint8Array) => Promise<string>;
      searchTasks: (query: string) => Promise<Task[]>;
      getGamification: () => Promise<Gamification | null>;
      getAttachmentPath: (relativePath: string) => Promise<string>;
      checkNecromancerBonus: (taskId: string) => Promise<number>;
      openAttachment: (relativePath: string) => Promise<void>;
      revealAttachment: (relativePath: string) => Promise<void>;
      copyAttachmentPath: (relativePath: string) => Promise<void>;
      showFilePicker: () => Promise<string[]>;
      getImageDataUrl: (relativePath: string) => Promise<string | null>;
    };
  }
}
