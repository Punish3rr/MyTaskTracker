// Main process entry point for TaskVault Electron application
import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import { EventEmitter } from 'events';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { initDatabase, getDatabase } from './db/client';
import { 
  getTasks, 
  getTaskById, 
  createTask, 
  updateTask, 
  addTimelineEntry,
  updateTimelineEntry,
  deleteTimelineEntry,
  searchTasks,
  cleanupExpiredTasks,
  deleteTask
} from './db/queries';
import { timelineEntries } from './db/schema';
import { eq } from 'drizzle-orm';
import { processFileAttachment, processImagePaste, getAttachmentAbsolutePath, openAttachment, revealAttachment, copyAttachmentPath } from './file-handler';
import { updateGamification, checkNecromancerBonus } from './gamification';

let mainWindow: BrowserWindow | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Centralized EventEmitter for data updates
const dataUpdateEmitter = new EventEmitter();

// Helper function to emit data-updated event to renderer
function emitDataUpdated(payload?: { reason: string; taskId?: string }) {
  // Emit on EventEmitter for internal listeners (if needed)
  dataUpdateEmitter.emit('data-updated', payload);
  
  // Broadcast to all renderer windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('data-updated', payload);
  }
}

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
    backgroundColor: '#111827',
    frame: process.platform === 'win32' ? false : true,
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, __dirname is in app.asar/dist-electron/electron
    // We need to go up to app.asar and then into dist
    const htmlPath = join(__dirname, '../../dist/index.html');
    console.log('Loading HTML from:', htmlPath);
    mainWindow.loadFile(htmlPath);
  }

  // Fix Windows menu visibility - hide native menu bar on Windows when using custom title bar
  if (process.platform === 'win32') {
    mainWindow.setMenuBarVisibility(false);
  } else {
    mainWindow.setAutoHideMenuBar(false);
    mainWindow.setMenuBarVisibility(true);
  }

  // Create application menu
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Task',
          accelerator: 'Ctrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-new-task');
          },
        },
        {
          label: 'Search',
          accelerator: 'Ctrl+F',
          click: () => {
            mainWindow?.webContents.send('menu-search');
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Ctrl+R',
          click: () => {
            mainWindow?.reload();
          },
        },
        {
          label: 'Toggle DevTools',
          accelerator: 'Ctrl+Shift+I',
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About TaskVault',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About TaskVault',
              message: 'TaskVault 1.0.0',
              detail: 'Offline-first personal operational memory system',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Add maximize/unmaximize event listeners for custom title bar
  if (process.platform === 'win32') {
    mainWindow.on('maximize', () => {
      mainWindow?.webContents.send('window-maximized-changed', true);
    });
    mainWindow.on('unmaximize', () => {
      mainWindow?.webContents.send('window-maximized-changed', false);
    });
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
  emitDataUpdated({ reason: 'task_created', taskId: task.id });
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
  // Check for necromancer bonus when pinned_summary is updated (context update)
  if (payload.pinned_summary !== undefined && payload.updateTouched) {
    await checkNecromancerBonus(payload.id);
  }
  emitDataUpdated({ reason: 'task_updated', taskId: payload.id });
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
    // Check for necromancer bonus when task is touched (context update)
    await checkNecromancerBonus(payload.taskId);
  }
  
  if (payload.type === 'NOTE' || payload.type === 'FILE' || payload.type === 'IMAGE') {
    await updateGamification('add_content');
  }
  
  emitDataUpdated({ reason: 'timeline_entry_added', taskId: payload.taskId });
  return entry;
});

ipcMain.handle('updateTimelineEntry', async (_event, entryId: string, content: string) => {
  const entry = await updateTimelineEntry(entryId, content);
  if (entry) {
    // Update task's touched time when a timeline entry is edited (context update)
    await updateTask({ id: entry.task_id, updateTouched: true });
    await checkNecromancerBonus(entry.task_id);
    emitDataUpdated({ reason: 'timeline_entry_updated', taskId: entry.task_id });
  }
  return entry;
});

ipcMain.handle('deleteTimelineEntry', async (_event, entryId: string) => {
  // Get entry first to know which task it belongs to
  const db = getDatabase();
  const entry = await db
    .select()
    .from(timelineEntries)
    .where(eq(timelineEntries.id, entryId))
    .limit(1);
  
  if (entry.length === 0) {
    return false;
  }
  
  const taskId = entry[0].task_id;
  const success = await deleteTimelineEntry(entryId);
  
  if (success) {
    // Update task's touched time when a timeline entry is deleted (context update)
    await updateTask({ id: taskId, updateTouched: true });
    await checkNecromancerBonus(taskId);
    emitDataUpdated({ reason: 'timeline_entry_deleted', taskId });
  }
  
  return success;
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
  await checkNecromancerBonus(taskId);
  emitDataUpdated({ reason: 'file_attached', taskId });
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
  await checkNecromancerBonus(taskId);
  emitDataUpdated({ reason: 'image_pasted', taskId });
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

// checkNecromancerBonus is now automatically called in handlers, but keep for backward compatibility
ipcMain.handle('checkNecromancerBonus', async (_event, taskId: string) => {
  return checkNecromancerBonus(taskId);
});

ipcMain.handle('showFilePicker', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('openAttachment', async (_event, relativePath: string) => {
  await openAttachment(relativePath);
});

ipcMain.handle('revealAttachment', async (_event, relativePath: string) => {
  await revealAttachment(relativePath);
});

ipcMain.handle('copyAttachmentPath', async (_event, relativePath: string) => {
  await copyAttachmentPath(relativePath);
});

ipcMain.handle('deleteTask', async (_event, taskId: string) => {
  const result = await deleteTask(taskId);
  if (result.success) {
    // If task was incomplete, subtract XP
    if (result.wasIncomplete) {
      await updateGamification('delete_incomplete_task');
    }
    emitDataUpdated({ reason: 'task_deleted', taskId });
  }
  return result.success;
});

// Get image as data URL (base64) for secure loading
ipcMain.handle('getImageDataUrl', async (_event, relativePath: string) => {
  const absolutePath = getAttachmentAbsolutePath(relativePath);
  if (existsSync(absolutePath)) {
    try {
      const imageBuffer = readFileSync(absolutePath);
      const base64 = imageBuffer.toString('base64');
      const ext = relativePath.split('.').pop()?.toLowerCase() || 'png';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Failed to read image:', error);
      return null;
    }
  }
  return null;
});

// Window control IPC handlers for custom title bar
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});