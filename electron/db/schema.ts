// Database schema definitions using Drizzle ORM
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  status: text('status', { enum: ['OPEN', 'WAITING', 'BLOCKED', 'DONE', 'ARCHIVED'] }).notNull().default('OPEN'),
  priority: text('priority', { enum: ['LOW', 'NORMAL', 'HIGH'] }).notNull().default('NORMAL'),
  created_at: integer('created_at').notNull(),
  last_touched_at: integer('last_touched_at').notNull(),
  archived_at: integer('archived_at'),
  delete_after_at: integer('delete_after_at'),
  pinned_summary: text('pinned_summary').notNull().default(''),
});

export const timelineEntries = sqliteTable('timeline_entries', {
  id: text('id').primaryKey(),
  task_id: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['NOTE', 'IMAGE', 'FILE', 'STATUS', 'GAMIFY'] }).notNull(),
  content: text('content').notNull(),
  created_at: integer('created_at').notNull(),
});

export const gamification = sqliteTable('gamification', {
  key: text('key').primaryKey(),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  streak: integer('streak').notNull().default(0),
  last_active_date: integer('last_active_date').notNull().default(0),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TimelineEntry = typeof timelineEntries.$inferSelect;
export type NewTimelineEntry = typeof timelineEntries.$inferInsert;
export type Gamification = typeof gamification.$inferSelect;
