// Preload script exposing typed IPC APIs to renderer
import { contextBridge, ipcRenderer } from 'electron';

export interface Task {
  id: string;
  title: string;
  status: 'OPEN' | 'WAITING' | 'BLOCKED' | 'DONE' | 'ARCHIVED';
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  created_at: number;
  last_touched_at: number;
  archived_at: number | null;
  delete_after_at: number | null;
  pinned_summary: string;
  idleAge: number;
  daysOld: number;
  attachmentCount: number;
  imageCount: number;
  fileCount: number;
  lastEntryAt: number | null;
  latestEntryContent: string | null;
  latestEntryType: 'NOTE' | 'IMAGE' | 'FILE' | 'STATUS' | 'GAMIFY' | null;
  latestEntryDate: number | null;
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

export interface DataUpdatedPayload {
  reason: string;
  taskId?: string;
}

// Verify we're in the right context
if (typeof window === 'undefined') {
  console.error('Preload script: window is undefined');
}

const electronAPI = {
  getTasks: (): Promise<Task[]> => ipcRenderer.invoke('getTasks'),
  getTaskById: (id: string): Promise<TaskDetail | null> => ipcRenderer.invoke('getTaskById', id),
  createTask: (payload: { title: string; priority: string }): Promise<Task> => 
    ipcRenderer.invoke('createTask', payload),
  updateTask: (payload: {
    id: string;
    title?: string;
    status?: string;
    priority?: string;
    pinned_summary?: string;
    updateTouched?: boolean;
  }): Promise<Task> => ipcRenderer.invoke('updateTask', payload),
  addTimelineEntry: (payload: {
    taskId: string;
    type: 'NOTE' | 'IMAGE' | 'FILE' | 'STATUS' | 'GAMIFY';
    content: string;
    updateTouched?: boolean;
  }): Promise<TimelineEntry> => ipcRenderer.invoke('addTimelineEntry', payload),
  attachFile: (taskId: string, filePath: string): Promise<string> => 
    ipcRenderer.invoke('attachFile', taskId, filePath),
  pasteImage: (taskId: string, imageBuffer: Uint8Array): Promise<string> => 
    ipcRenderer.invoke('pasteImage', taskId, Buffer.from(imageBuffer)),
  searchTasks: (query: string): Promise<Task[]> => ipcRenderer.invoke('searchTasks', query),
  getGamification: (): Promise<Gamification | null> => ipcRenderer.invoke('getGamification'),
  getAttachmentPath: (relativePath: string): Promise<string> => ipcRenderer.invoke('getAttachmentPath', relativePath),
  checkNecromancerBonus: (taskId: string): Promise<number> => ipcRenderer.invoke('checkNecromancerBonus', taskId),
  openAttachment: (relativePath: string): Promise<void> => ipcRenderer.invoke('openAttachment', relativePath),
  revealAttachment: (relativePath: string): Promise<void> => ipcRenderer.invoke('revealAttachment', relativePath),
  copyAttachmentPath: (relativePath: string): Promise<void> => ipcRenderer.invoke('copyAttachmentPath', relativePath),
  showFilePicker: (): Promise<string[]> => ipcRenderer.invoke('showFilePicker'),
  getImageDataUrl: (relativePath: string): Promise<string | null> => ipcRenderer.invoke('getImageDataUrl', relativePath),
  deleteTask: (taskId: string): Promise<boolean> => ipcRenderer.invoke('deleteTask', taskId),
  onDataUpdated: (callback: (payload?: DataUpdatedPayload) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, payload?: DataUpdatedPayload) => callback(payload);
    ipcRenderer.on('data-updated', subscription);
    return () => ipcRenderer.removeListener('data-updated', subscription);
  },
};

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  console.log('Preload script: electronAPI exposed successfully');
} catch (error) {
  console.error('Preload script error:', error);
}

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
