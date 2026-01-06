// Database query functions with business logic
import { eq, desc, and, or, like, sql } from 'drizzle-orm';
import { getDatabase } from './client';
import { tasks, timelineEntries, gamification } from './schema';
import { v4 as uuidv4 } from 'uuid';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { deleteAttachment } from '../file-handler';

export interface TaskWithIdleAge {
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
}

export interface TaskWithMeta extends TaskWithIdleAge {
  latestEntryContent: string | null;
  latestEntryType: 'NOTE' | 'IMAGE' | 'FILE' | 'STATUS' | 'GAMIFY' | null;
  latestEntryDate: number | null;
}

export async function getTasks(): Promise<TaskWithMeta[]> {
  const db = getDatabase();
  const now = Date.now();
  
  // Use LEFT JOIN with GROUP BY to efficiently count attachments and get last entry time in a single query
  // Use correlated subqueries for latest entry metadata (efficient, doesn't load full timeline)
  const tasksWithCounts = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      created_at: tasks.created_at,
      last_touched_at: tasks.last_touched_at,
      archived_at: tasks.archived_at,
      delete_after_at: tasks.delete_after_at,
      pinned_summary: tasks.pinned_summary,
      attachmentCount: sql<number>`COUNT(CASE WHEN ${timelineEntries.type} IN ('IMAGE', 'FILE') THEN 1 END)`.as('attachmentCount'),
      imageCount: sql<number>`COUNT(CASE WHEN ${timelineEntries.type} = 'IMAGE' THEN 1 END)`.as('imageCount'),
      fileCount: sql<number>`COUNT(CASE WHEN ${timelineEntries.type} = 'FILE' THEN 1 END)`.as('fileCount'),
      lastEntryAt: sql<number | null>`MAX(${timelineEntries.created_at})`.as('lastEntryAt'),
      latestEntryContent: sql<string | null>`(
        SELECT content FROM ${timelineEntries} 
        WHERE ${timelineEntries.task_id} = ${tasks.id} 
        ORDER BY ${timelineEntries.created_at} DESC 
        LIMIT 1
      )`.as('latestEntryContent'),
      latestEntryType: sql<'NOTE' | 'IMAGE' | 'FILE' | 'STATUS' | 'GAMIFY' | null>`(
        SELECT type FROM ${timelineEntries} 
        WHERE ${timelineEntries.task_id} = ${tasks.id} 
        ORDER BY ${timelineEntries.created_at} DESC 
        LIMIT 1
      )`.as('latestEntryType'),
      latestEntryDate: sql<number | null>`(
        SELECT created_at FROM ${timelineEntries} 
        WHERE ${timelineEntries.task_id} = ${tasks.id} 
        ORDER BY ${timelineEntries.created_at} DESC 
        LIMIT 1
      )`.as('latestEntryDate'),
    })
    .from(tasks)
    .leftJoin(timelineEntries, eq(tasks.id, timelineEntries.task_id))
    .groupBy(tasks.id);

  type TaskWithCounts = typeof tasksWithCounts[0];
  const tasksWithMetadata: TaskWithMeta[] = tasksWithCounts.map((task: TaskWithCounts) => {
    const idleAge = Math.floor((now - task.last_touched_at) / 86400000);
    const daysOld = Math.floor((now - task.created_at) / 86400000);
    
    return {
      ...task,
      idleAge,
      daysOld,
      attachmentCount: task.attachmentCount || 0,
      imageCount: task.imageCount || 0,
      fileCount: task.fileCount || 0,
      lastEntryAt: task.lastEntryAt || null,
      latestEntryContent: task.latestEntryContent || null,
      latestEntryType: task.latestEntryType || null,
      latestEntryDate: task.latestEntryDate || null,
    };
  });

  // Sort: Priority DESC (HIGH first), then Idle Age DESC
  const priorityOrder: Record<'HIGH' | 'NORMAL' | 'LOW', number> = { HIGH: 3, NORMAL: 2, LOW: 1 };
  tasksWithMetadata.sort((a: TaskWithMeta, b: TaskWithMeta) => {
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
  
  const validStatuses = ['OPEN', 'WAITING', 'BLOCKED', 'DONE', 'ARCHIVED'];
  const validPriorities = ['LOW', 'NORMAL', 'HIGH'];
  
  if (payload.title !== undefined) {
    updateData.title = payload.title;
    // Title change is meaningful, update touched if not explicitly set
    if (payload.updateTouched === undefined) {
      updateData.last_touched_at = Date.now();
    }
  }
  if (payload.status !== undefined) {
    // Validate status
    if (!validStatuses.includes(payload.status)) {
      throw new Error(`Invalid status: ${payload.status}. Must be one of: ${validStatuses.join(', ')}`);
    }
    updateData.status = payload.status as 'OPEN' | 'WAITING' | 'BLOCKED' | 'DONE' | 'ARCHIVED';
    if (payload.status === 'ARCHIVED') {
      const now = Date.now();
      updateData.archived_at = now;
      updateData.delete_after_at = now + (30 * 24 * 60 * 60 * 1000);
    }
    // Status change is meaningful, update touched if not explicitly set
    if (payload.updateTouched === undefined) {
      updateData.last_touched_at = Date.now();
    }
  }
  if (payload.priority !== undefined) {
    // Validate priority
    if (!validPriorities.includes(payload.priority)) {
      throw new Error(`Invalid priority: ${payload.priority}. Must be one of: ${validPriorities.join(', ')}`);
    }
    updateData.priority = payload.priority as 'LOW' | 'NORMAL' | 'HIGH';
    // Priority change is meaningful, update touched if not explicitly set
    if (payload.updateTouched === undefined) {
      updateData.last_touched_at = Date.now();
    }
  }
  if (payload.pinned_summary !== undefined) {
    updateData.pinned_summary = payload.pinned_summary;
    // Pinned summary change is meaningful, update touched if not explicitly set
    if (payload.updateTouched === undefined) {
      updateData.last_touched_at = Date.now();
    }
  }
  // Explicit updateTouched flag overrides automatic behavior
  if (payload.updateTouched === true) {
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

export async function updateTimelineEntry(entryId: string, content: string) {
  const db = getDatabase();
  await db
    .update(timelineEntries)
    .set({ content })
    .where(eq(timelineEntries.id, entryId));
  
  const updated = await db
    .select()
    .from(timelineEntries)
    .where(eq(timelineEntries.id, entryId))
    .limit(1);
  
  return updated[0] || null;
}

export async function deleteTimelineEntry(entryId: string) {
  const db = getDatabase();
  const entry = await db
    .select()
    .from(timelineEntries)
    .where(eq(timelineEntries.id, entryId))
    .limit(1);
  
  if (entry.length === 0) {
    return false;
  }
  
  const timelineEntry = entry[0];
  
  // Delete physical file if entry is an IMAGE or FILE
  if (timelineEntry.type === 'IMAGE' || timelineEntry.type === 'FILE') {
    try {
      await deleteAttachment(timelineEntry.content);
    } catch (error) {
      // Log error but continue with database deletion
      // File might already be deleted or locked, but we still want to remove the DB entry
      console.error(`Failed to delete attachment file for entry ${entryId}:`, error);
    }
  }
  
  await db.delete(timelineEntries).where(eq(timelineEntries.id, entryId));
  return true;
}

export async function searchTasks(query: string): Promise<TaskWithMeta[]> {
  const db = getDatabase();
  const now = Date.now();
  
  const searchPattern = `%${query}%`;
  const queryLower = query.toLowerCase();
  
  // Search in task titles
  const titleMatchingTasks = await db
    .select()
    .from(tasks)
    .where(like(tasks.title, searchPattern));
  
  type TaskRow = typeof titleMatchingTasks[0];
  const matchingTaskIds = new Set<string>(titleMatchingTasks.map((t: TaskRow) => t.id));
  
  // Search in timeline notes using EXISTS subquery (scalable, doesn't load all entries)
  const noteMatchingTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      sql`EXISTS (
        SELECT 1 FROM ${timelineEntries} 
        WHERE ${timelineEntries.task_id} = ${tasks.id} 
        AND ${timelineEntries.type} = 'NOTE' 
        AND LOWER(${timelineEntries.content}) LIKE ${`%${queryLower}%`}
      )`
    );
  type TaskIdRow = { id: string };
  noteMatchingTasks.forEach((t: TaskIdRow) => matchingTaskIds.add(t.id));
  
  // Search in attachment filenames using EXISTS subquery
  const attachmentMatchingTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      sql`EXISTS (
        SELECT 1 FROM ${timelineEntries} 
        WHERE ${timelineEntries.task_id} = ${tasks.id} 
        AND ${timelineEntries.type} IN ('IMAGE', 'FILE')
        AND LOWER(${timelineEntries.content}) LIKE ${`%${queryLower}%`}
      )`
    );
  attachmentMatchingTasks.forEach((t: TaskIdRow) => matchingTaskIds.add(t.id));

  if (matchingTaskIds.size === 0) {
    return [];
  }

  // Use LEFT JOIN with GROUP BY to efficiently count attachments and get last entry time
  // Use correlated subqueries for latest entry metadata
  const tasksWithCounts = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      created_at: tasks.created_at,
      last_touched_at: tasks.last_touched_at,
      archived_at: tasks.archived_at,
      delete_after_at: tasks.delete_after_at,
      pinned_summary: tasks.pinned_summary,
      attachmentCount: sql<number>`COUNT(CASE WHEN ${timelineEntries.type} IN ('IMAGE', 'FILE') THEN 1 END)`.as('attachmentCount'),
      imageCount: sql<number>`COUNT(CASE WHEN ${timelineEntries.type} = 'IMAGE' THEN 1 END)`.as('imageCount'),
      fileCount: sql<number>`COUNT(CASE WHEN ${timelineEntries.type} = 'FILE' THEN 1 END)`.as('fileCount'),
      lastEntryAt: sql<number | null>`MAX(${timelineEntries.created_at})`.as('lastEntryAt'),
      latestEntryContent: sql<string | null>`(
        SELECT content FROM ${timelineEntries} 
        WHERE ${timelineEntries.task_id} = ${tasks.id} 
        ORDER BY ${timelineEntries.created_at} DESC 
        LIMIT 1
      )`.as('latestEntryContent'),
      latestEntryType: sql<'NOTE' | 'IMAGE' | 'FILE' | 'STATUS' | 'GAMIFY' | null>`(
        SELECT type FROM ${timelineEntries} 
        WHERE ${timelineEntries.task_id} = ${tasks.id} 
        ORDER BY ${timelineEntries.created_at} DESC 
        LIMIT 1
      )`.as('latestEntryType'),
      latestEntryDate: sql<number | null>`(
        SELECT created_at FROM ${timelineEntries} 
        WHERE ${timelineEntries.task_id} = ${tasks.id} 
        ORDER BY ${timelineEntries.created_at} DESC 
        LIMIT 1
      )`.as('latestEntryDate'),
    })
    .from(tasks)
    .leftJoin(timelineEntries, eq(tasks.id, timelineEntries.task_id))
    .where(or(...Array.from(matchingTaskIds).map((id: string) => eq(tasks.id, id))))
    .groupBy(tasks.id);

  type TaskWithCountsSearch = typeof tasksWithCounts[0];
  const tasksWithMetadata: TaskWithMeta[] = tasksWithCounts.map((task: TaskWithCountsSearch) => {
    const idleAge = Math.floor((now - task.last_touched_at) / 86400000);
    const daysOld = Math.floor((now - task.created_at) / 86400000);
    
    return {
      ...task,
      idleAge,
      daysOld,
      attachmentCount: task.attachmentCount || 0,
      imageCount: task.imageCount || 0,
      fileCount: task.fileCount || 0,
      lastEntryAt: task.lastEntryAt || null,
      latestEntryContent: task.latestEntryContent || null,
      latestEntryType: task.latestEntryType || null,
      latestEntryDate: task.latestEntryDate || null,
    };
  });

  const priorityOrder: Record<'HIGH' | 'NORMAL' | 'LOW', number> = { HIGH: 3, NORMAL: 2, LOW: 1 };
  tasksWithMetadata.sort((a: TaskWithMeta, b: TaskWithMeta) => {
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

export async function deleteTask(taskId: string): Promise<{ success: boolean; wasIncomplete?: boolean }> {
  const db = getDatabase();
  
  // Get task to verify it exists and check status
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (task.length === 0) {
    return { success: false };
  }

  const wasIncomplete = task[0].status !== 'DONE';

  // Delete timeline entries (cascade should handle this, but explicit is safer)
  await db.delete(timelineEntries).where(eq(timelineEntries.task_id, taskId));
  
  // Delete task
  await db.delete(tasks).where(eq(tasks.id, taskId));
  
  // Delete attachment folder
  const userDataPath = app.getPath('userData');
  const taskAttachmentsDir = join(userDataPath, 'taskvault', 'attachments', taskId);
  try {
    if (existsSync(taskAttachmentsDir)) {
      rmSync(taskAttachmentsDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`Failed to delete attachments for task ${taskId}:`, error);
  }
  
  return { success: true, wasIncomplete };
}
