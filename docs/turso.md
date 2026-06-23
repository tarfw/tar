# Turso React Native — Complete LLM Reference

> Package: `@tursodatabase/sync-react-native`
> Latest: 0.6.1 | License: MIT
> Source: npm, docs.turso.tech, turso.tech/blog

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Installation](#3-installation)
4. [Quick Start](#4-quick-start)
5. [Core Concepts](#5-core-concepts)
6. [Database Methods API](#6-database-methods-api)
7. [Sync API](#7-sync-api)
8. [Transactions](#8-transactions)
9. [Prepared Statements](#9-prepared-statements)
10. [Encryption](#10-encryption)
11. [Offline-First Pattern](#11-offline-first-pattern)
12. [Turso Cloud Setup](#12-turso-cloud-setup)
13. [Turso Sync Engine](#13-turso-sync-engine)
14. [TypeScript SDK Reference](#14-typescript-sdk-reference)
15. [Vector Search & AI](#15-vector-search--ai)
16. [Drizzle ORM Integration](#16-drizzle-orm-integration)
17. [Local Development](#17-local-development)
18. [Troubleshooting](#18-troubleshooting)
19. [Code Examples](#19-code-examples)
20. [Migration Guide](#20-migration-guide)

---

## 1. Overview

`@tursodatabase/sync-react-native` is the **official React Native binding** for Turso — a SQLite-compatible edge database built on libSQL. Unlike the web/Node SDKs that use separate packages for database and sync, this is a **single package** that delivers both:

- **Local embedded database** — Runs entirely on device, no cloud connection required. SQLite-compatible with enhancements: checksums, concurrent writes (MVCC), materialized views.
- **Cloud sync** — Bidirectional sync with Turso Cloud via push/pull operations. Build offline-first apps that seamlessly sync when connected.

### Key Features

| Feature | Description |
|---------|-------------|
| **Local Embedded DB** | Fast, reliable SQLite-compatible database running on device |
| **Bidirectional Sync** | Push local changes to Turso Cloud, pull remote changes locally |
| **Offline Writes** | Write to local database even when offline, sync when connected |
| **Concurrent Writes** | MVCC-based concurrent write support |
| **Checksums** | Data integrity verification out of the box |
| **Encryption** | Encrypt data at rest with industry-standard ciphers (aes256gcm) |
| **Vector & Full-Text Search** | On-device semantic search for AI applications |
| **Thin JSI Bridge** | Native layer is thin; business logic in TypeScript |

### When to Use This Package

| Use Case | Package |
|----------|---------|
| React Native mobile app (local + sync) | `@tursodatabase/sync-react-native` ✅ |
| React Native local-only database | `@tursodatabase/sync-react-native` (without url/authToken) |
| Node.js server | `@tursodatabase/database` or `@tursodatabase/sync` |
| Serverless / Edge | `@tursodatabase/serverless` |
| ORM integration (Prisma) | `@libsql/client` |
| ORM integration (Drizzle) | `@tursodatabase/database` (beta) |

---

## 2. Architecture

### Thin JSI, Smart TypeScript

The sync engine core is abstracted from platform-specific network APIs. The React Native bindings follow this approach:

```
┌─────────────────────────────────┐
│       TypeScript Layer          │
│  (async network IO, SDK API)    │
├─────────────────────────────────┤
│       Thin JSI Bridge           │
│  (platform bridge to SDK-KIT)   │
├─────────────────────────────────┤
│    Native Database Engine       │
│  (Turso DB / libSQL)            │
│  (query execution, sync, MVCC)  │
└─────────────────────────────────┘
```

**Advantages:**
- **Easier debugging** — Most issues can be traced in TypeScript
- **Better testability** — Business logic can be unit tested without native builds
- **Faster iteration** — TypeScript changes don't require rebuilding native code

---

## 3. Installation

### Requirements
- React Native 0.76+ with **New Architecture** enabled
- iOS minimum deployment target: 13.0
- Android minimum SDK: 21+

### Install

```bash
npm install @tursodatabase/sync-react-native
```

### iOS Setup

```bash
cd ios && pod install
```

### Android Setup

Ensure `minSdkVersion 21+` in `android/build.gradle`:

```gradle
android {
    defaultConfig {
        minSdkVersion 21
        // ...
    }
}
```

---

## 4. Quick Start

### With Turso Cloud Sync

```typescript
import { Database, getDbPath } from '@tursodatabase/sync-react-native';

// Get platform-specific writable path
const dbPath = getDbPath('myapp.db');

// Create database with sync
const db = new Database({
  path: dbPath,
  url: 'libsql://your-db.turso.io',
  authToken: 'your-auth-token',
});

// Connect (bootstraps from remote if empty)
await db.connect();

// Query local replica (fast)
const users = await db.all('SELECT * FROM users');

// Make local changes
await db.run('INSERT INTO users (name) VALUES (?)', ['Alice']);

// Sync with remote
await db.push(); // Push local changes
await db.pull(); // Pull remote changes

// Close when done
await db.close();
```

### Local-Only Database (No Cloud)

```typescript
import { Database, getDbPath } from '@tursodatabase/sync-react-native';

const db = new Database({ path: getDbPath('local.db') });
await db.connect();

await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  )
`);

await db.run('INSERT INTO users (name) VALUES (?)', ['Bob']);

const user = await db.get('SELECT * FROM users WHERE id = ?', [1]);
console.log(user); // { id: 1, name: 'Bob' }

await db.close();
```

### Using `connect()` Helper (Blog Style)

```typescript
import { connect } from '@tursodatabase/sync-react-native';

const db = await connect({ path: 'myapp.db' });

await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  )
`);

const insert = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
await insert.run(['Alice', 'alice@example.com']);

const select = db.prepare('SELECT * FROM users');
console.log(await select.all());

db.close();
```

---

## 5. Core Concepts

### Local-First Architecture

All reads and writes happen against the **local database file** — fast, offline-capable. You control when to sync with explicit `push()` and `pull()` calls.

```
App → Local SQLite File (reads/writes)
  ↕
push() → Turso Cloud
pull() ← Turso Cloud
```

### Bootstrap

On the first run, the local database is **automatically bootstrapped** from the remote. The remote must be reachable during the initial connect.

To skip bootstrapping (start empty):
```typescript
const db = new Database({
  path: getDbPath('local.db'),
  url: 'libsql://your-db.turso.io',
  authToken: 'your-auth-token',
  bootstrapIfEmpty: false, // Don't bootstrap on first run
});
```

### Conflict Resolution

Push uses **"last push wins"** strategy — the most recent push overwrites conflicts at the row level. Logical SQL statements are sent (not raw bytes).

### Read-Your-Writes

After a successful `push()`, the local replica can immediately see the new data without needing to call `pull()`.

---

## 6. Database Methods API

### Core Query Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `connect()` | `await db.connect()` | Open/bootstrap the database |
| `exec(sql)` | `await db.exec(sql)` | Execute SQL with no results (DDL, DML) |
| `run(sql, params?)` | `await db.run(sql, ['val'])` | Execute SQL, return `{ changes, lastInsertRowid }` |
| `get(sql, params?)` | `await db.get(sql, [id])` | Query single row |
| `all(sql, params?)` | `await db.all(sql)` | Query all rows |
| `prepare(sql)` | `db.prepare(sql)` | Create prepared statement |
| `close()` | `await db.close()` | Close database connection |

### `exec(sql)` — Execute Without Results

Best for DDL (CREATE, ALTER, DROP) and bulk DML (INSERT, UPDATE, DELETE) when you don't need return values:

```typescript
await db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0
  )
`);
```

### `run(sql, params?)` — Execute With Row Info

Returns metadata about the operation:

```typescript
const result = await db.run(
  'INSERT INTO todos (title) VALUES (?)',
  ['Buy milk']
);
console.log(result.changes);        // 1
console.log(result.lastInsertRowid); // 1
```

### `get(sql, params?)` — Single Row

```typescript
const todo = await db.get('SELECT * FROM todos WHERE id = ?', [1]);
console.log(todo); // { id: 1, title: 'Buy milk', completed: 0 }
```

### `all(sql, params?)` — Multiple Rows

```typescript
const todos = await db.all('SELECT * FROM todos WHERE completed = ?', [0]);
console.log(todos); // [{ id: 1, title: 'Buy milk', completed: 0 }, ...]
```

---

## 7. Sync API

### Available When `url` Is Provided

| Method | Signature | Description |
|--------|-----------|-------------|
| `push()` | `await db.push()` | Push local changes to remote |
| `pull()` | `await db.pull()` | Pull remote changes to local. Returns `boolean` (changed?) |
| `sync()` | `await db.sync()` | Push then pull (convenience) |
| `stats()` | `await db.stats()` | Get sync statistics |

### Push — Send Local Changes to Cloud

```typescript
// Make changes locally
await db.run('INSERT INTO todos (title) VALUES (?)', ['New task']);
await db.run('UPDATE todos SET completed = 1 WHERE id = ?', [1]);

// Push to cloud
await db.push();
```

### Pull — Fetch Remote Changes

```typescript
const changed = await db.pull();
if (changed) {
  console.log('New data received from cloud');
  // Re-query local database to get fresh data
  const todos = await db.all('SELECT * FROM todos');
  // Update UI...
}
```

### Push + Pull (Sync)

```typescript
await db.sync(); // Equivalent to push() then pull()
```

### Stats — Monitor Sync State

```typescript
const stats = await db.stats();
console.log({
  cdcOperations: stats.cdcOperations,       // Change data capture operations
  mainWalSize: stats.mainWalSize,            // Main WAL size in bytes
  revertWalSize: stats.revertWalSize,        // Revert WAL size
  networkReceivedBytes: stats.networkReceivedBytes, // Bytes received from remote
  networkSentBytes: stats.networkSentBytes,   // Bytes sent to remote
  lastPullUnixTime: stats.lastPullUnixTime,  // Last pull timestamp
  lastPushUnixTime: stats.lastPushUnixTime,  // Last push timestamp
  revision: stats.revision,                   // Current sync revision
});
```

### Checkpoint — Compact Local WAL

```typescript
// Compact the local WAL to bound disk usage while preserving sync state
await db.checkpoint();
```

---

## 8. Transactions

### Callback Transactions (Recommended for React Native)

```typescript
await db.transaction(async () => {
  await db.run('INSERT INTO users (name) VALUES (?)', ['Alice']);
  await db.run('INSERT INTO users (name) VALUES (?)', ['Bob']);
  // Commits on success, rolls back on error
});
```

### Error Handling in Transactions

```typescript
try {
  await db.transaction(async () => {
    await db.run('UPDATE accounts SET balance = balance - ? WHERE id = ?', [100, 1]);
    await db.run('UPDATE accounts SET balance = balance + ? WHERE id = ?', [100, 2]);
  });
  console.log('Transfer complete');
} catch (e) {
  console.error('Transaction failed, rolled back:', e);
}
```

---

## 9. Prepared Statements

### Create and Reuse

```typescript
const insertStmt = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
await insertStmt.run(['Alice', 'alice@example.com']);
await insertStmt.run(['Bob', 'bob@example.com']);
```

### Parameter Binding

```typescript
// Positional placeholders (?)
const stmt = db.prepare('SELECT * FROM users WHERE age > ? AND city = ?');
const results = await stmt.all([18, 'New York']);

// Single parameter
const user = await db.get('SELECT * FROM users WHERE id = ?', [42]);
```

---

## 10. Encryption

### Encrypted Database (at rest)

Encrypt local database files using AES-256-GCM:

```typescript
import { Database, getDbPath } from '@tursodatabase/sync-react-native';

const db = new Database({
  path: getDbPath('encrypted.db'),
  url: 'libsql://your-db.turso.io',
  authToken: 'your-auth-token',
  remoteEncryption: {
    cipher: 'aes256gcm',
    key: 'base64-encoded-encryption-key',
  },
});

await db.connect();
```

### Supported Ciphers

| Cipher | Description |
|--------|-------------|
| `aes256gcm` | AES-256 in Galois/Counter Mode (recommended) |
| `aes128gcm` | AES-128 in Galois/Counter Mode |
| `aegis256` | AEGIS-256 |
| `aegis256x2` | AEGIS-256x2 |
| `aegis128l` | AEGIS-128L |
| `aegis128x2` | AEGIS-128x2 |
| `aegis128x4` | AEGIS-128x4 |

### Important Notes

- Encrypted databases **cannot be read as standard SQLite databases**
- You must use the Turso Database engine to open encrypted databases
- Turso Cloud databases can also be encrypted with bring-your-own-key (BYOK)

---

## 11. Offline-First Pattern

### Full Offline-First Implementation

```typescript
import { Database, getDbPath } from '@tursodatabase/sync-react-native';

// Initialize with bootstrapIfEmpty: false to start offline
const db = new Database({
  path: getDbPath('app.db'),
  url: 'libsql://your-db.turso.io',
  authToken: 'your-auth-token',
  bootstrapIfEmpty: false, // Don't require remote on first launch
});

await db.connect();

// On app launch — pull latest state if online
async function syncOnLaunch() {
  try {
    await db.pull();
    console.log('Synced with cloud on launch');
  } catch (e) {
    console.log('Offline — using local data');
  }
}

// Write locally (works offline!)
async function addTask(title: string) {
  await db.run('INSERT INTO tasks (title) VALUES (?)', [title]);
}

// Sync when connection is available
async function syncWhenOnline() {
  try {
    await db.push();
    console.log('Local changes pushed to cloud');
  } catch (e) {
    // No connectivity — changes safe in local file
    console.log('Will sync on next push() call');
  }
}

// Sync strategy: pull on app open, push on app close or timer
async function fullSync() {
  try {
    await db.pull();
    await db.push();
  } catch (e) {
    console.log('Sync failed, will retry later');
  }
}
```

### Connectivity-Based Sync Pattern

```typescript
import NetInfo from '@react-native-community/netinfo';

function setupConnectivitySync(db: Database) {
  NetInfo.addEventListener(state => {
    if (state.isConnected) {
      // Sync when coming back online
      db.sync().catch(e => console.warn('Sync failed:', e));
    }
  });
}
```

---

## 12. Turso Cloud Setup

### Step 1: Install Turso CLI

```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

### Step 2: Authenticate

```bash
turso auth login
```

### Step 3: Create Database

```bash
turso db create my-app-db
```

### Step 4: Get Database URL

```bash
turso db show my-app-db --url
# Output: libsql://my-app-db-yourorg.turso.io
```

### Step 5: Create Auth Token

```bash
turso db tokens create my-app-db
# Output: eyJhbGciOi...
```

### Step 6: Set Environment Variables

```bash
# .env
TURSO_DATABASE_URL=libsql://my-app-db-yourorg.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

### Step 7: Create Tables

```bash
turso db shell my-app-db
```

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT,
  content TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 13. Turso Sync Engine

### How Sync Works

```
Local Device                    Turso Cloud
┌─────────────┐                ┌─────────────┐
│ Local SQLite │ ←── pull() ── │   Primary    │
│   File       │ ── push() ──→ │   Database   │
└─────────────┘                └─────────────┘
     ↕                              ↕
  Offline writes              Conflict resolution
  Local reads                 (last push wins)
```

### Push — Send Local Changes

Under the hood, **logical SQL statements** are sent (not raw bytes). On conflict, the strategy is **"last push wins"**.

```typescript
await db.push();
```

### Pull — Fetch Remote Changes

```typescript
const changed = await db.pull();
// changed: boolean — true if anything was applied locally
```

**Optional: Long polling** — configure server to wait before replying to pull:

```typescript
const db = new Database({
  path: getDbPath('app.db'),
  url: 'libsql://your-db.turso.io',
  authToken: 'your-auth-token',
  longPollTimeoutMs: 10_000, // Server waits up to 10s for changes
});
```

### Sync (Push + Pull)

```typescript
await db.sync(); // push() then pull()
```

### Checkpoint — Manage Disk Usage

```typescript
// Compact local WAL, preserve sync state
await db.checkpoint();
```

### Bandwidth Optimization

- Turso Sync uses **logical CDC** (change data capture) — only the changed data is transferred
- This is significantly more efficient than page-level replication used by Embedded Replicas
- One frame = 4KB on disk page frame

---

## 14. TypeScript SDK Reference

### Package Comparison

| Package | Use Case | Engine | Concurrent Writes | Sync |
|---------|----------|--------|-------------------|------|
| `@tursodatabase/database` | Local / Embedded | Turso DB (rewrite) | Yes (MVCC) | — |
| `@tursodatabase/sync` | Local + Cloud Sync | Turso DB (rewrite) | Yes (MVCC) | push/pull |
| `@tursodatabase/sync-react-native` | React Native (local + sync) | Turso DB (native) | Yes (MVCC) | push/pull |
| `@tursodatabase/serverless` | Remote (servers, edge) | Turso DB | Planned | — |
| `@libsql/client` | ORM support (Prisma) | libSQL (SQLite fork) | Not supported | Embedded Replicas |

### `@tursodatabase/database` (Node.js/Desktop)

```typescript
import { connect } from '@tursodatabase/database';

const db = await connect('app.db');

// In-memory
const db = await connect(':memory:');

// With encryption
const db = await connect('encrypted.db', {
  encryption: {
    cipher: 'aegis256',
    hexkey: 'b1bbfda4f589dc9daaf004fe21111e00dc00c98237102f5c7002a5669fc76327',
  },
});
```

### `@tursodatabase/sync` (Node.js with Sync)

```typescript
import { connect } from '@tursodatabase/sync';

const db = await connect({
  path: './app.db',
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// First run auto-bootstraps from remote
await db.push();
const changed = await db.pull();
await db.checkpoint();
```

### `@tursodatabase/serverless` (Remote Only)

```typescript
import { connect } from '@tursodatabase/serverless';

const conn = connect({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const stmt = await conn.prepare('SELECT * FROM users');
const rows = await stmt.all();
```

### `@libsql/client` (ORM/Prisma)

```typescript
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await client.execute('SELECT * FROM users');

// Embedded Replicas with @libsql/client
const client = createClient({
  url: 'file:local.db',
  syncUrl: 'libsql://mydb-myorg.turso.io',
  authToken: '...',
});

// Periodic sync
const client = createClient({
  url: 'file:local.db',
  syncUrl: 'libsql://mydb-myorg.turso.io',
  syncInterval: 60, // Auto-sync every 60 seconds
  authToken: '...',
});

await client.sync(); // Manual sync
```

---

## 15. Vector Search & AI

### Vector Search in SQLite

Turso supports vector search via the `sqlite-vec` extension, enabling on-device semantic search for AI applications.

```sql
-- Enable the extension
CREATE VIRTUAL TABLE vec0 USING vec0(
  product_embedding float[384]
);

-- Insert vectors
INSERT INTO vec0(rowid, product_embedding)
VALUES (1, vec_float32('[0.1, 0.2, ...]'));

-- Query by similarity
SELECT rowid, distance
FROM vec0
WHERE product_embedding MATCH ? -- query vector
ORDER BY distance
LIMIT 5;
```

### React Native AI + Turso Pattern

```typescript
import { Database, getDbPath } from '@tursodatabase/sync-react-native';
import { useTextEmbeddings } from 'react-native-executorch';

// Local database with vector search
const db = new Database({ path: getDbPath('ai.db') });
await db.connect();

// Create vector table
await db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS documents
  USING vec0(
    embedding float[384],
    content TEXT
  )
`);

// Generate embedding and store
async function indexDocument(content: string) {
  const embedding = await generateEmbedding(content);
  await db.run(
    'INSERT INTO documents (embedding, content) VALUES (?, ?)',
    [JSON.stringify(embedding), content]
  );
}

// Semantic search
async function search(query: string, limit = 5) {
  const queryEmbedding = await generateEmbedding(query);
  return db.all(
    'SELECT content, distance FROM documents WHERE embedding MATCH ? ORDER BY distance LIMIT ?',
    [JSON.stringify(queryEmbedding), limit]
  );
}
```

---

## 16. Drizzle ORM Integration

### Setup

```bash
npm install drizzle-orm
npm install -D drizzle-kit
```

### Schema Definition

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').unique(),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  title: text('title').notNull(),
  content: text('content'),
});
```

### Using with @libsql/client

```typescript
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

// Query with Drizzle
const allUsers = await db.select().from(users);
const userPosts = await db.select().from(posts).where(eq(posts.userId, 1));
```

### Using with Turso Sync React Native

```typescript
// Note: Direct Drizzle integration with sync-react-native is not yet supported.
// Use the sync-react-native Database API directly for queries,
// or wrap Drizzle's driver adapter pattern.
//
// For React Native, use the Database methods directly:
const users = await db.all('SELECT * FROM users');
```

---

## 17. Local Development

### Option 1: SQLite File (Simplest)

```typescript
import { createClient } from '@libsql/client';

const client = createClient({
  url: 'file:local.db',
});

// No authToken needed for local file
```

### Option 2: Turso CLI (Full Feature Parity)

```bash
turso dev
# Starts local libSQL server at http://127.0.0.1:8080
```

```typescript
import { createClient } from '@libsql/client';

const client = createClient({
  url: 'http://127.0.0.1:8080',
});
```

Persist data between restarts:
```bash
turso dev --db-file local.db
```

### Option 3: Direct Turso Cloud (Uses Quota)

```typescript
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
```

### Connect a GUI Tool

During development, connect to your database using:

| Tool | Platform |
|------|----------|
| Beekeeper Studio | macOS, Linux, Windows |
| Outerbase | Browser-based |
| TablePlus | macOS, Windows, Linux |
| Dataflare | macOS, Windows, Linux |
| DBeaver | macOS, Windows, Linux |

### Database Dump & Restore

```bash
# Dump production database
turso db shell your-database .dump > dump.sql

# Create local SQLite file
cat dump.sql | sqlite3 local.db

# Use in development
turso db shell your-database < dump.sql
```

---

## 18. Troubleshooting

### Common Issues

#### "Bootstrap failed"
- Remote database must be reachable on first `connect()`
- Set `bootstrapIfEmpty: false` to start offline
- Or call `pull()` manually after establishing connectivity

#### iOS build errors after install
```bash
cd ios && pod install --repo-update
```

#### Android minSdkVersion error
```gradle
// android/build.gradle
android {
    defaultConfig {
        minSdkVersion 21  // Must be 21+
    }
}
```

#### "New Architecture" not enabled
Ensure `newArchEnabled=true` in `android/gradle.properties`:
```properties
newArchEnabled=true
```

#### Sync returns false but data is missing
- Check `stats()` — look at `lastPullUnixTime` and `revision`
- Ensure `push()` succeeded before pulling
- Verify auth token is not expired

#### Local database corruption
- Never open the local SQLite file externally while sync is running
- Use `checkpoint()` periodically to manage WAL size
- If corrupted, delete local file and let it re-bootstrap

---

## 19. Code Examples

### Example 1: Task Manager App

```typescript
import { Database, getDbPath } from '@tursodatabase/sync-react-native';

const DB_PATH = getDbPath('tasks.db');

class TaskManager {
  private db: Database;

  constructor() {
    this.db = new Database({
      path: DB_PATH,
      url: 'libsql://tasks-db.turso.io',
      authToken: 'your-auth-token',
    });
  }

  async init() {
    await this.db.connect();
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }

  async addTask(title: string) {
    const result = await this.db.run(
      'INSERT INTO tasks (title) VALUES (?)',
      [title]
    );
    await this.db.push();
    return result.lastInsertRowid;
  }

  async toggleTask(id: number) {
    await this.db.run(
      'UPDATE tasks SET completed = NOT completed WHERE id = ?',
      [id]
    );
    await this.db.push();
  }

  async getTasks() {
    await this.db.pull(); // Always fresh
    return this.db.all('SELECT * FROM tasks ORDER BY created_at DESC');
  }

  async getPendingCount() {
    return this.db.get(
      'SELECT COUNT(*) as count FROM tasks WHERE completed = 0'
    );
  }

  async cleanup() {
    await this.db.close();
  }
}

// Usage
const manager = new TaskManager();
await manager.init();
await manager.addTask('Buy groceries');
const tasks = await manager.getTasks();
console.log(tasks);
await manager.cleanup();
```

### Example 2: User Profile Sync

```typescript
import { Database, getDbPath } from '@tursodatabase/sync-react-native';
import NetInfo from '@react-native-community/netinfo';

class UserSync {
  private db: Database;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(authToken: string) {
    this.db = new Database({
      path: getDbPath('user-profile.db'),
      url: 'libsql://profiles.turso.io',
      authToken,
    });
  }

  async init() {
    await this.db.connect();
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS profile (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        avatar_url TEXT,
        preferences TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Auto-sync every 30 seconds when online
    this.syncInterval = setInterval(async () => {
      const net = await NetInfo.fetch();
      if (net.isConnected) {
        await this.sync();
      }
    }, 30000);
  }

  async sync() {
    try {
      await this.db.sync();
    } catch (e) {
      console.warn('Sync failed, will retry:', e);
    }
  }

  async updateProfile(id: string, data: { name?: string; email?: string }) {
    if (data.name) {
      await this.db.run('UPDATE profile SET name = ? WHERE id = ?', [data.name, id]);
    }
    if (data.email) {
      await this.db.run('UPDATE profile SET email = ? WHERE id = ?', [data.email, id]);
    }
    await this.db.run("UPDATE profile SET updated_at = datetime('now') WHERE id = ?", [id]);
    await this.db.push();
  }

  async getProfile(id: string) {
    await this.db.pull();
    return this.db.get('SELECT * FROM profile WHERE id = ?', [id]);
  }

  destroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.db.close();
  }
}
```

### Example 3: Offline Notes App

```typescript
import { Database, getDbPath } from '@tursodatabase/sync-react-native';

const db = new Database({
  path: getDbPath('notes.db'),
  url: 'libsql://notes.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN!,
  bootstrapIfEmpty: false, // Start offline, pull later
});

await db.connect();

// Create schema
await db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    body TEXT,
    tags TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

// Always works — reads/writes to local file
async function createNote(title: string, body: string, tags: string[] = []) {
  const result = await db.run(
    'INSERT INTO notes (title, body, tags) VALUES (?, ?, ?)',
    [title, body, tags.join(',')]
  );
  return result.lastInsertRowid;
}

async function searchNotes(query: string) {
  return db.all(
    'SELECT * FROM notes WHERE title LIKE ? OR body LIKE ?',
    [`%${query}%`, `%${query}%`]
  );
}

async function syncNotes() {
  try {
    await db.sync(); // push + pull
    return true;
  } catch {
    return false; // Offline, changes saved locally
  }
}

// Initial sync on app launch
try {
  await db.pull();
} catch {
  // No connectivity, that's fine
}
```

### Example 4: Encrypted Local-Only Database

```typescript
import { Database, getDbPath } from '@tursodatabase/sync-react-native';
import * as Keychain from 'react-native-keychain';

// Store encryption key securely
const db = new Database({
  path: getDbPath('secure-data.db'),
  remoteEncryption: {
    cipher: 'aes256gcm',
    key: await Keychain.getGenericPassword({ service: 'db-encryption' })
      .then(c => c?.password || ''),
  },
});

await db.connect();

// Sensitive data stored encrypted at rest
await db.exec(`
  CREATE TABLE IF NOT EXISTS secrets (
    id INTEGER PRIMARY KEY,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

await db.run('INSERT INTO secrets (label, value) VALUES (?, ?)', [
  'API_KEY',
  'sk-xxxx',
]);

const secrets = await db.all('SELECT * FROM secrets');
await db.close();
```

---

## 20. Migration Guide

### From `@libsql/client` to `@tursodatabase/sync-react-native`

#### Before (libsql/client)

```typescript
import { createClient } from '@libsql/client';

const client = createClient({
  url: 'file:local.db',
  syncUrl: 'libsql://mydb.turso.io',
  authToken: '...',
});

await client.execute('INSERT INTO users (name) VALUES (?)', ['Alice']);
await client.sync();
```

#### After (sync-react-native)

```typescript
import { Database, getDbPath } from '@tursodatabase/sync-react-native';

const db = new Database({
  path: getDbPath('local.db'),
  url: 'libsql://mydb.turso.io',
  authToken: '...',
});

await db.connect();
await db.run('INSERT INTO users (name) VALUES (?)', ['Alice']);
await db.push(); // Explicit push (was implicit in sync())
```

### Key Differences

| Aspect | `@libsql/client` | `@tursodatabase/sync-react-native` |
|--------|-------------------|-------------------------------------|
| Sync trigger | `sync()` (auto) | `push()` / `pull()` (manual) |
| Conflict resolution | Embedded replica sync | Logical CDC, last-push-wins |
| Bandwidth | Page-level replication | Logical statements (more efficient) |
| Write path | Writes sent to cloud primary | Writes to local file first |
| Offline writes | Requires `offline: true` | Always local-first |
| Query API | `execute()` / `batch()` | `exec()` / `run()` / `get()` / `all()` |
| Prepared statements | Via `execute()` | `prepare()` → `.run()` / `.all()` / `.get()` |
| Path helper | None | `getDbPath()` for platform paths |
| Encryption | `encryptionKey` | `remoteEncryption` |

### From Raw SQLite

```typescript
// Before: react-native-sqlite-storage
import SQLite from 'react-native-sqlite-storage';
const db = SQLite.openDatabase({ name: 'mydb.db' });
db.transaction(tx => {
  tx.executeSql('SELECT * FROM users', [], (_, { rows }) => {
    console.log(rows);
  });
});

// After: sync-react-native
import { Database, getDbPath } from '@tursodatabase/sync-react-native';
const db = new Database({ path: getDbPath('mydb.db') });
await db.connect();
const users = await db.all('SELECT * FROM users');
console.log(users);
```

---

## Appendix A: Complete API Surface

### `Database` Constructor Options

```typescript
interface DatabaseOptions {
  path: string;                      // Local file path (use getDbPath())
  url?: string;                      // Turso Cloud URL (libsql://...)
  authToken?: string;                // Turso Cloud auth token
  bootstrapIfEmpty?: boolean;        // Bootstrap from remote on first run (default: true)
  longPollTimeoutMs?: number;        // Server wait time for pull (ms)
  remoteEncryption?: {               // Encrypt at rest
    cipher: string;                  // e.g., 'aes256gcm'
    key: string;                     // Base64-encoded encryption key
  };
}
```

### `connect()` Helper Options

```typescript
interface ConnectOptions {
  path: string;
  url?: string;
  authToken?: string;
}
```

### Return Types

```typescript
// run() result
interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

// stats() result
interface SyncStats {
  cdcOperations: number;
  mainWalSize: number;
  revertWalSize: number;
  networkReceivedBytes: number;
  networkSentBytes: number;
  lastPullUnixTime: number;
  lastPushUnixTime: number;
  revision: number;
}
```

---

## Appendix B: Turso Cloud Quick Reference

```bash
# Install CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Create database
turso db create <name>

# List databases
turso db list

# Get URL
turso db show <name> --url

# Create token
turso db tokens create <name>

# Shell (interactive)
turso db shell <name>

# Dump
turso db shell <name> .dump > dump.sql

# Import
cat dump.sql | turso db shell <name>

# Delete
turso db destroy <name>

# Groups
turso db group create <group-name>
turso db create <name> --group <group-name>
turso db replicate <name> <region>
```

---

*Generated from: npmjs.com, docs.turso.tech, turso.tech/blog*
*Package version: 0.6.1*
*Last updated: June 2026*
