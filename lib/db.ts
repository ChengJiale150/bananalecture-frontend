import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'main.db');
const db: DatabaseType = new Database(dbPath);

// Enable foreign keys and WAL mode for better performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function initDb() {
  const createProjectsTable = `
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'admin',
      name TEXT,
      messages TEXT, -- JSON
      video_path TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
  `;

  const createPlansTable = `
    CREATE TABLE IF NOT EXISTS ppt_plans (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT,
      title TEXT,
      description TEXT,
      content TEXT,
      idx INTEGER,
      image_path TEXT,
      audio_path TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `;

  const createDialoguesTable = `
    CREATE TABLE IF NOT EXISTS dialogues (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      role TEXT,
      content TEXT,
      emotion TEXT,
      speed TEXT,
      idx INTEGER,
      audio_path TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY (plan_id) REFERENCES ppt_plans(id) ON DELETE CASCADE
    );
  `;

  // Add indexes for performance
  const createProjectIndex = `CREATE INDEX IF NOT EXISTS idx_ppt_plans_project_id ON ppt_plans(project_id);`;
  const createPlanIndex = `CREATE INDEX IF NOT EXISTS idx_dialogues_plan_id ON dialogues(plan_id);`;

  db.exec(createProjectsTable);
  db.exec(createPlansTable);
  db.exec(createDialoguesTable);
  db.exec(createProjectIndex);
  db.exec(createPlanIndex);
}

// Initialize on import (or can be called explicitly)
initDb();

export default db;
