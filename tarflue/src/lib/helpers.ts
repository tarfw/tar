/**
 * Helper functions for calling tools and actions directly.
 * Flue tools are LLM-facing (defineTool). For internal use in actions,
 * we call the underlying implementation functions directly.
 */

import { create, read, update, del, link, search } from './tools';
import { getPreparedDbForScope } from './db';

// Tool wrappers (same API as defineTool .run())
export async function createMatter(input: any) { return create(input); }
export async function getMatter(input: any) { return read({ ...input, limit: 1 }); }
export async function listMatters(input: any) { return read(input); }
export async function updateMatter(input: any) { return update(input); }
export async function linkGraph(input: any) { return link(input); }
export async function searchMemory(input: any) { return search(input); }

export async function appendMotion(input: {
  stream: string; action: number; phase?: number; delta?: number;
  client_ref?: string; data?: Record<string, any>; scope?: string;
}) {
  const db = await getPreparedDbForScope(input.scope || null);
  const nextSeqRes = await db.get('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?', [input.stream]);
  const seq = Number(nextSeqRes?.next ?? 1);
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO motion (stream, seq, action, phase, delta, client_ref, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.stream, seq, input.action, input.phase ?? null, input.delta ?? null, input.client_ref || null, JSON.stringify(input.data || {}), now]
  );
  return { stream: input.stream, seq };
}

export async function setAttr(input: {
  matterId: string; key: string; val?: string; num?: number; ref?: string; scope?: string;
}) {
  const db = await getPreparedDbForScope(input.scope || null);
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO attr (matter, key, val, num, ref, time) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(matter, key) DO UPDATE SET val=excluded.val, num=excluded.num, ref=excluded.ref, time=excluded.time`,
    [input.matterId, input.key, input.val ?? null, input.num ?? null, input.ref ?? null, now]
  );
  return { matter: input.matterId, key: input.key, status: 'set' };
}

export async function readMotions(input: { scope?: string; stream: string; seq_from?: number; seq_to?: number; limit?: number }) {
  return read({ table: 'motion', scope: input.scope, stream: input.stream, seq_from: input.seq_from, seq_to: input.seq_to, limit: input.limit ?? 50 });
}

export async function traverseGraph(input: { scope: string; src?: string; rel?: string; tgt?: string; depth?: number; limit?: number }) {
  return read({ table: 'graph', scope: input.scope, graph_filter: { src: input.src, rel: input.rel, tgt: input.tgt }, depth: input.depth, limit: input.limit ?? 50 });
}

export async function readForm(input: { scope: string; id?: string; type?: string; active?: boolean; limit?: number }) {
  return read({ table: 'form', scope: input.scope, id: input.id, type: input.type, active: input.active, limit: input.limit ?? 50 });
}

export async function storeMemory(input: {
  id: string; chunk?: number; matter?: string; text: string; embedding: string;
  meta?: Record<string, any>; scope?: string;
}) {
  const db = await getPreparedDbForScope(input.scope || null);
  const chunk = input.chunk ?? 0;
  await db.run(
    `INSERT OR REPLACE INTO memory (id, chunk, matter, text, embedding, meta) VALUES (?, ?, ?, ?, vector32(?), ?)`,
    [input.id, chunk, input.matter ?? null, input.text, input.embedding, JSON.stringify(input.meta || {})]
  );
  return { id: input.id, chunk, status: 'stored' };
}
