import { ReactNode, useMemo } from 'react';
import { getUserDb } from '@/lib/db';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export function DbProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

interface CompatDb {
  getAllAsync<T = any>(query: string, ...params: any[]): Promise<T[]>;
  getFirstAsync<T = any>(query: string, ...params: any[]): Promise<T | null>;
  runAsync(query: string, ...params: any[]): Promise<void>;
}

export function useDb(): CompatDb {
  const db = getUserDb();
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
