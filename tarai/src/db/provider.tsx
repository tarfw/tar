import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { ReactNode } from 'react';
import { migrateDb } from './schema';
import { seedDb } from './seed';

async function onInit(db: SQLiteDatabase) {
  await migrateDb(db);
  await seedDb(db);
}

export function DbProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName="tar.db" onInit={onInit}>
      {children}
    </SQLiteProvider>
  );
}

export { useSQLiteContext as useDb };
