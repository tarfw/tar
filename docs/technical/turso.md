# Turso Mobile Architecture

This document outlines the architecture and integration of Turso using `@tursodatabase/sync-react-native`.

## Overview
Turso provides native React Native bindings through the `@tursodatabase/sync-react-native` package. This package delivers an embedded database and optional sync with Turso Cloud in a single package.

### Key Capabilities
- **Local Embedded Database**: A fast, reliable database running entirely on-device, completely offline. It goes beyond standard SQLite with support for features like checksums, concurrent writes, and materialized views.
- **Bidirectional Sync with Turso Cloud**: Create a database in Turso Cloud and connect your local database to it by providing a URL and authentication token. You can execute `pull` and `push` operations to create offline-first apps that seamlessly sync when re-connected.

### Advanced Turso Features
- **Concurrent Writes**: Better write performance on device.
- **Checksums & Encryption**: Built-in data integrity and industry-standard cipher encryption at rest.
- **Vector Search**: Power local AI applications with on-device semantic search using `F32_BLOB(384)`.

## Implementation Details

The Sync React Native binding architecture features a **Thin JSI (JavaScript Interface) layer** and **Smart TypeScript**:
- The core engine is abstracted. The native layer acts as a thin bridge to Turso SDK-KIT.
- Async network I/O and SDK API logic live in TypeScript, resulting in easier debugging and faster iterations.

### Connecting to the Database

You can connect to a local-only database, or a remote-synced database:

```typescript
import { Database, getDbPath } from "@tursodatabase/sync-react-native";

// Creating a synced database instance
const db = new Database({
  path: getDbPath("tar.db"),
  url: "libsql://<your-db>.turso.io",
  authToken: "<your-token>",
});

await db.connect();
```

### Executing Queries

The database can execute standard queries (`get`, `all`, `run`) and raw SQL scripts (`exec`).

**Important Note on `exec`:**
The `exec(sql: string)` method natively handles executing multiple SQL statements separated by semicolons. You should pass the entire SQL schema to `db.exec(SCHEMA_SQL)` directly instead of splitting the string manually by `;`. Splitting strings manually can cause syntax errors (e.g., `unexpected token ')' at offset 0`) due to stripping required semicolons and misinterpreting parsed string boundaries.

### Syncing
- `await db.pull()`: Pulls remote changes to the local database.
- `await db.push()`: Pushes local changes to the remote database.

## Common Issues & Troubleshooting
1. **`[Error: unexpected token ')' at offset 0]` during initialization**: This occurs if you attempt to manually `.split(";")` your SQL schema string and pass it statement-by-statement into `db.exec()`. Because `db.exec()` processes strings expecting properly terminated SQL, manual splitting breaks the internal tokenizer `prepareFirst()`. The fix is to pass the whole schema string to `exec()`.
