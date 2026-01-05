// Main process entry point for TaskVault Electron application
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/client';
import { 
  getTasks, 
  getTaskById, 
  createTask, 
  updateTask, 
  addTimelineEntry,
  searchTasks,
  cleanupExpiredTasks
} from './db/queries';
import { processFileAttachment, processImagePaste, getAttachmentAbsolutePath } from './file-handler';
import { updateGamification, checkNecromancerBonus } from './gamification';

let mainWindow: BrowserWindow | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  // Use absolute path for preload script
  const preloadPath = join(__dirname, 'preload.js');
  
  // Verify preload file exists
  if (!existsSync(preloadPath)) {
    console.error('Preload script not found at:', preloadPath);
    console.error('__dirname is:', __dirname);
    console.error('Current working directory:', process.cwd());
  } else {
    console.log('Preload script found at:', preloadPath);
  }
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    backgroundColor: '#1a1a1a',
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('Preload error:', preloadPath, error);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await initDatabase();
  createWindow();
  await cleanupExpiredTasks();
  
  // Schedule cleanup every 24 hours
  cleanupInterval = setInterval(async () => {
    await cleanupExpiredTasks();
  }, 24 * 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('getTasks', async () => {
  return getTasks();
});

ipcMain.handle('getTaskById', async (_event, id: string) => {
  return getTaskById(id);
});

ipcMain.handle('createTask', async (_event, payload: { title: string; priority: string }) => {
  const task = await createTask(payload);
  await updateGamification('create_task');
  return task;
});

ipcMain.handle('updateTask', async (_event, payload: {
  id: string;
  title?: string;
  status?: string;
  priority?: string;
  pinned_summary?: string;
  updateTouched?: boolean;
}) => {
  const task = await updateTask(payload);
  if (payload.status === 'DONE') {
    await updateGamification('complete_task');
  }
  return task;
});

ipcMain.handle('addTimelineEntry', async (_event, payload: {
  taskId: string;
  type: 'NOTE' | 'IMAGE' | 'FILE' | 'STATUS' | 'GAMIFY';
  content: string;
  updateTouched?: boolean;
}) => {
  const entry = await addTimelineEntry(payload);
  if (payload.updateTouched !== false) {
    await updateTask({ id: payload.taskId, updateTouched: true });
  }
  
  if (payload.type === 'NOTE' || payload.type === 'FILE' || payload.type === 'IMAGE') {
    await updateGamification('add_content');
  }
  
  return entry;
});

ipcMain.handle('attachFile', async (_event, taskId: string, filePath: string) => {
  const relativePath = await processFileAttachment(taskId, filePath);
  await addTimelineEntry({
    taskId,
    type: 'FILE',
    content: relativePath,
    updateTouched: true,
  });
  await updateGamification('add_content');
  return relativePath;
});

ipcMain.handle('pasteImage', async (_event, taskId: string, imageBuffer: Uint8Array) => {
  const buffer = Buffer.from(imageBuffer);
  const relativePath = await processImagePaste(taskId, buffer);
  await addTimelineEntry({
    taskId,
    type: 'IMAGE',
    content: relativePath,
    updateTouched: true,
  });
  await updateGamification('add_content');
  return relativePath;
});

ipcMain.handle('searchTasks', async (_event, query: string) => {
  return searchTasks(query);
});

ipcMain.handle('getGamification', async () => {
  const { getGamification } = await import('./db/queries');
  return getGamification();
});

ipcMain.handle('getAttachmentPath', async (_event, relativePath: string) => {
  return getAttachmentAbsolutePath(relativePath);
});

ipcMain.handle('checkNecromancerBonus', async (_event, taskId: string) => {
  return checkNecromancerBonus(taskId);
});
