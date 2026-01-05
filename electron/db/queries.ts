// Database query functions with business logic
import { eq, desc, and, or, like, sql } from 'drizzle-orm';
import { getDatabase } from './client';
import { tasks, timelineEntries, gamification } from './schema';
import { v4 as uuidv4 } from 'uuid';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

export interface TaskWithIdleAge {
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

export async function getTasks(): Promise<TaskWithIdleAge[]> {
  const db = getDatabase();
  const now = Date.now();
  
  const allTasks = await db.select().from(tasks);
  const allEntries = await db.select().from(timelineEntries);
  
  const tasksWithMetadata = allTasks.map(task => {
    const taskEntries = allEntries.filter(e => e.task_id === task.id);
    const attachmentEntries = taskEntries.filter(e => 
      e.type === 'IMAGE' || e.type === 'FILE'
    );
    const imageEntries = attachmentEntries.filter(e => e.type === 'IMAGE');
    const fileEntries = attachmentEntries.filter(e => e.type === 'FILE');
    
    const idleAge = Math.floor((now - task.last_touched_at) / 86400000);
    
    return {
      ...task,
      idleAge,
      attachmentCount: attachmentEntries.length,
      imageCount: imageEntries.length,
      fileCount: fileEntries.length,
    };
  });

  // Sort: Priority DESC (HIGH first), then Idle Age DESC
  const priorityOrder = { HIGH: 3, NORMAL: 2, LOW: 1 };
  tasksWithMetadata.sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.idleAge - a.idleAge;
  });

  return tasksWithMetadata;
}

export async function getTaskById(id: string) {
  const db = getDatabase();
  const taskResults = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  
  if (taskResults.length === 0) {
    return null;
  }

  const entries = await db
    .select()
    .from(timelineEntries)
    .where(eq(timelineEntries.task_id, id))
    .orderBy(timelineEntries.created_at);

  return {
    task: taskResults[0],
    timeline: entries,
  };
}

export async function createTask(payload: { title: string; priority: string }) {
  const db = getDatabase();
  const now = Date.now();
  
  const newTask = {
    id: uuidv4(),
    title: payload.title,
    status: 'OPEN' as const,
    priority: payload.priority as 'LOW' | 'NORMAL' | 'HIGH',
    created_at: now,
    last_touched_at: now,
    pinned_summary: '',
  };

  await db.insert(tasks).values(newTask);
  return newTask;
}

export async function updateTask(payload: {
  id: string;
  title?: string;
  status?: string;
  priority?: string;
  pinned_summary?: string;
  updateTouched?: boolean;
}) {
  const db = getDatabase();
  const updateData: Partial<typeof tasks.$inferInsert> = {};
  
  if (payload.title !== undefined) updateData.title = payload.title;
  if (payload.status !== undefined) {
    updateData.status = payload.status as 'OPEN' | 'DONE' | 'ARCHIVED';
    if (payload.status === 'ARCHIVED') {
      const now = Date.now();
      updateData.archived_at = now;
      updateData.delete_after_at = now + (30 * 24 * 60 * 60 * 1000);
    }
  }
  if (payload.priority !== undefined) {
    updateData.priority = payload.priority as 'LOW' | 'NORMAL' | 'HIGH';
  }
  if (payload.pinned_summary !== undefined) {
    updateData.pinned_summary = payload.pinned_summary;
  }
  if (payload.updateTouched) {
    updateData.last_touched_at = Date.now();
  }

  await db.update(tasks).set(updateData).where(eq(tasks.id, payload.id));
  
  const updated = await db.select().from(tasks).where(eq(tasks.id, payload.id)).limit(1);
  return updated[0];
}

export async function addTimelineEntry(payload: {
  taskId: string;
  type: 'NOTE' | 'IMAGE' | 'FILE' | 'STATUS' | 'GAMIFY';
  content: string;
  updateTouched?: boolean;
}) {
  const db = getDatabase();
  const now = Date.now();
  
  const entry = {
    id: uuidv4(),
    task_id: payload.taskId,
    type: payload.type,
    content: payload.content,
    created_at: now,
  };

  await db.insert(timelineEntries).values(entry);

  if (payload.updateTouched !== false) {
    await updateTask({ id: payload.taskId, updateTouched: true });
  }

  return entry;
}

export async function searchTasks(query: string): Promise<TaskWithIdleAge[]> {
  const db = getDatabase();
  const now = Date.now();
  
  const searchPattern = `%${query}%`;
  const matchingTasks = await db
    .select()
    .from(tasks)
    .where(like(tasks.title, searchPattern));

  const allEntries = await db.select().from(timelineEntries);
  const matchingTaskIds = new Set(matchingTasks.map(t => t.id));
  
  // Also search in timeline notes and attachment filenames
  const queryLower = query.toLowerCase();
  const matchingEntries = allEntries.filter(e => {
    if (e.type === 'NOTE') {
      return e.content.toLowerCase().includes(queryLower);
    }
    if (e.type === 'IMAGE' || e.type === 'FILE') {
      // Extract filename from relative path
      const filename = e.content.split('/').pop() || e.content;
      return filename.toLowerCase().includes(queryLower);
    }
    return false;
  });
  matchingEntries.forEach(e => matchingTaskIds.add(e.task_id));

  const allMatchingTasks = await db
    .select()
    .from(tasks)
    .where(
      or(...Array.from(matchingTaskIds).map(id => eq(tasks.id, id)))
    );

  const tasksWithMetadata = allMatchingTasks.map(task => {
    const taskEntries = allEntries.filter(e => e.task_id === task.id);
    const attachmentEntries = taskEntries.filter(e => 
      e.type === 'IMAGE' || e.type === 'FILE'
    );
    const imageEntries = attachmentEntries.filter(e => e.type === 'IMAGE');
    const fileEntries = attachmentEntries.filter(e => e.type === 'FILE');
    
    const idleAge = Math.floor((now - task.last_touched_at) / 86400000);
    
    return {
      ...task,
      idleAge,
      attachmentCount: attachmentEntries.length,
      imageCount: imageEntries.length,
      fileCount: fileEntries.length,
    };
  });

  const priorityOrder = { HIGH: 3, NORMAL: 2, LOW: 1 };
  tasksWithMetadata.sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.idleAge - a.idleAge;
  });

  return tasksWithMetadata;
}

export async function getGamification() {
  const db = getDatabase();
  const stats = await db
    .select()
    .from(gamification)
    .where(eq(gamification.key, 'user_stats'))
    .limit(1);
  
  return stats[0] || null;
}

export async function updateGamificationStats(payload: {
  xp?: number;
  level?: number;
  streak?: number;
  last_active_date?: number;
}) {
  const db = getDatabase();
  await db.update(gamification)
    .set(payload)
    .where(eq(gamification.key, 'user_stats'));
}

export async function cleanupExpiredTasks() {
  const db = getDatabase();
  const now = Date.now();
  
  const expiredTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.status, 'ARCHIVED'),
        sql`delete_after_at IS NOT NULL AND delete_after_at <= ${now}`
      )
    );

  const userDataPath = app.getPath('userData');
  const attachmentsDir = join(userDataPath, 'taskvault', 'attachments');

  for (const task of expiredTasks) {
    // Delete timeline entries (cascade should handle this, but explicit is safer)
    await db.delete(timelineEntries).where(eq(timelineEntries.task_id, task.id));
    
    // Delete task
    await db.delete(tasks).where(eq(tasks.id, task.id));
    
    // Delete attachment folder
    const taskAttachmentsDir = join(attachmentsDir, task.id);
    try {
      if (existsSync(taskAttachmentsDir)) {
        rmSync(taskAttachmentsDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Failed to delete attachments for task ${task.id}:`, error);
    }
  }
}
