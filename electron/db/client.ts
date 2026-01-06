// Database client singleton using better-sqlite3
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as schema from './schema';

let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteDb: Database.Database | null = null;

export function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const userDataPath = app.getPath('userData');
  const dbDir = join(userDataPath, 'taskvault');
  
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = join(dbDir, 'taskvault.db');
  sqliteDb = new Database(dbPath);
  
  // Enable foreign keys
  sqliteDb.pragma('foreign_keys = ON');

  dbInstance = drizzle(sqliteDb, { schema });

  // Run migrations (if migrations folder exists)
  try {
    migrate(dbInstance, { migrationsFolder: join(__dirname, 'migrations') });
  } catch (error) {
    // Migrations folder might not exist yet, that's okay
    console.log('Migrations skipped (folder may not exist)');
  }

  return dbInstance;
}

async function migrateTaskStatuses() {
  if (!sqliteDb) return;
  
  // Check if table exists
  const tableExists = sqliteDb.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'
  `).get() as { name: string } | undefined;
  
  if (!tableExists) {
    return; // Table doesn't exist yet, will be created with new schema
  }
  
  // Check if migration is needed by looking for tasks with invalid statuses
  const validStatuses = ['OPEN', 'WAITING', 'BLOCKED', 'DONE', 'ARCHIVED'];
  try {
    const invalidStatusTasks = sqliteDb.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE status NOT IN (${validStatuses.map(() => '?').join(',')})
    `).get(...validStatuses) as { count: number };
    
    if (invalidStatusTasks.count === 0) {
      // No invalid statuses found, migration not needed
      return;
    }
  } catch (error) {
    // If query fails (e.g., table structure issue), proceed with migration
    console.log('Status check failed, proceeding with migration:', error);
  }
  
  console.log('Migrating task statuses to support WAITING and BLOCKED...');
  
  // Disable foreign keys temporarily
  sqliteDb.pragma('foreign_keys = OFF');
  
  try {
    // Create new table with updated schema
    sqliteDb.exec(`
      CREATE TABLE tasks_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        priority TEXT NOT NULL DEFAULT 'NORMAL',
        created_at INTEGER NOT NULL,
        last_touched_at INTEGER NOT NULL,
        archived_at INTEGER,
        delete_after_at INTEGER,
        pinned_summary TEXT NOT NULL DEFAULT ''
      );
    `);
    
    // Copy all data from old table
    sqliteDb.exec(`
      INSERT INTO tasks_new 
      SELECT * FROM tasks;
    `);
    
    // Map any invalid statuses to OPEN
    sqliteDb.exec(`
      UPDATE tasks_new 
      SET status = 'OPEN' 
      WHERE status NOT IN ('OPEN', 'WAITING', 'BLOCKED', 'DONE', 'ARCHIVED');
    `);
    
    // Drop old table
    sqliteDb.exec(`DROP TABLE tasks;`);
    
    // Rename new table
    sqliteDb.exec(`ALTER TABLE tasks_new RENAME TO tasks;`);
    
    // Recreate indexes
    sqliteDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_last_touched ON tasks(last_touched_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    `);
    
    console.log('Task status migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    // Re-enable foreign keys
    sqliteDb.pragma('foreign_keys = ON');
  }
}

export async function initDatabase() {
  const db = getDatabase();
  
  // Run status migration before creating tables
  await migrateTaskStatuses();
  
  // Create tables if they don't exist (fallback if migrations fail)
  sqliteDb!.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      created_at INTEGER NOT NULL,
      last_touched_at INTEGER NOT NULL,
      archived_at INTEGER,
      delete_after_at INTEGER,
      pinned_summary TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS timeline_entries (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gamification (
      key TEXT PRIMARY KEY,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      streak INTEGER NOT NULL DEFAULT 0,
      last_active_date INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_timeline_task_id ON timeline_entries(task_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_type ON timeline_entries(type);
    CREATE INDEX IF NOT EXISTS idx_timeline_created_at ON timeline_entries(created_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_last_touched ON tasks(last_touched_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  `);

  // Initialize gamification if not exists
  const { getGamification } = await import('./queries');
  const stats = await getGamification();
  if (!stats) {
    sqliteDb!.exec(`
      INSERT OR IGNORE INTO gamification (key, xp, level, streak, last_active_date)
      VALUES ('user_stats', 0, 1, 0, 0);
    `);
  }
}

export function closeDatabase() {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
    dbInstance = null;
  }
}