// Type definitions for Electron API exposed via preload script
import type { Task, TaskDetail, TimelineEntry, Gamification, DataUpdatedPayload } from '../electron/preload';

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
      updateTimelineEntry: (entryId: string, content: string) => Promise<TimelineEntry | null>;
      deleteTimelineEntry: (entryId: string) => Promise<boolean>;
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
      deleteTask: (taskId: string) => Promise<boolean>;
      onDataUpdated: (callback: (payload?: DataUpdatedPayload) => void) => () => void;
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
      windowIsMaximized: () => Promise<boolean>;
      onWindowMaximizedChanged: (callback: (isMaximized: boolean) => void) => () => void;
    };
  }
}
