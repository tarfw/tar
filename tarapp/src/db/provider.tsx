import { ReactNode, useMemo, useState, useEffect, createContext, useContext } from 'react';
import { getUserDb, subscribeDb } from '@/lib/db';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Database } from '@tursodatabase/sync-react-native';

const queryClient = new QueryClient();
const DbContext = createContext<Database | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(() => getUserDb());

  useEffect(() => {
    // Whenever dbConnections changes or switchUser/initUserSync updates, update the state
    const unsubscribe = subscribeDb(() => {
      setDb(getUserDb());
    });
    return unsubscribe;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <DbContext.Provider value={db}>
        {children}
      </DbContext.Provider>
    </QueryClientProvider>
  );
}

interface CompatDb {
  getAllAsync<T = any>(query: string, ...params: any[]): Promise<T[]>;
  getFirstAsync<T = any>(query: string, ...params: any[]): Promise<T | null>;
  runAsync(query: string, ...params: any[]): Promise<void>;
}

export function useDb(): CompatDb {
  const db = useContext(DbContext) || getUserDb();
  return useMemo(() => ({
    async getAllAsync<T = any>(query: string, ...params: any[]): Promise<T[]> {
      try {
        const result = await db.all(query, params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
        return result as T[];
      } catch (e) {
        console.warn('[DB] getAllAsync error:', e);
        return [];
      }
    },
    async getFirstAsync<T = any>(query: string, ...params: any[]): Promise<T | null> {
      try {
        const result = await db.all(query, params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
        return (result?.[0] as T) || null;
      } catch (e) {
        console.warn('[DB] getFirstAsync error:', e);
        return null;
      }
    },
    async runAsync(query: string, ...params: any[]): Promise<void> {
      try {
        await db.run(query, params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
      } catch (e) {
        console.warn('[DB] runAsync error:', e);
      }
    },
  }), [db]);
}
