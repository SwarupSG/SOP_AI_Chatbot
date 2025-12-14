import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

const sqlite = new Database('sop-ai.db');

// Schema definitions
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // hashed
  name: text('name').notNull(),
  role: text('role').notNull().default('user'), // 'user' or 'admin'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const unansweredQuestions = sqliteTable('unanswered_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  question: text('question').notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  status: text('status').notNull().default('pending'), // 'pending', 'answered'
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const recentQuestions = sqliteTable('recent_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  confidence: integer('confidence').notNull(), // 0-100
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const indexedSOPs = sqliteTable('indexed_sops', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceFile: text('source_file').notNull(),
  category: text('category'),
  entryCount: integer('entry_count').notNull().default(0),
  lastIndexed: integer('last_indexed', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const predefinedQuestions = sqliteTable('predefined_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceFile: text('source_file').notNull(),
  question: text('question').notNull(),
  category: text('category'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const db = drizzle(sqlite);

