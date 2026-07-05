import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { executeCreate, executeRead, executeUpdate, executeDelete, executeLink, executeSearch } from '../lib/helpers';

// ============================================================
// 6 Generic Tools — Agent sees only these
// ============================================================

export const createTool = defineTool({
  name: 'create',
  description: 'Insert a row into any table (form, matter, motion, graph, memory).',
  input: v.object({
    table: v.picklist(['form', 'matter', 'motion', 'graph', 'memory']),
    scope: v.optional(v.string()),
    type: v.optional(v.string()),
    form: v.optional(v.string()),
    title: v.optional(v.string()),
    value: v.optional(v.number()),
    qty: v.optional(v.number()),
    unit: v.optional(v.string()),
    data: v.optional(v.record(v.string(), v.any())),
    src: v.optional(v.string()),
    rel: v.optional(v.string()),
    tgt: v.optional(v.string()),
    text: v.optional(v.string()),
    embedding: v.optional(v.string()),
    meta: v.optional(v.record(v.string(), v.any())),
    stream: v.optional(v.string()),
    action: v.optional(v.number()),
    phase: v.optional(v.number()),
    delta: v.optional(v.number()),
  }),
  async run({ input }) {
    return executeCreate(input);
  },
});

export const readTool = defineTool({
  name: 'read',
  description: 'Select rows from any table (form, matter, motion, graph, memory). Supports filters by scope, type, id, and JSON fields.',
  input: v.object({
    table: v.picklist(['form', 'matter', 'motion', 'graph', 'memory']),
    id: v.optional(v.string()),
    scope: v.optional(v.string()),
    type: v.optional(v.string()),
    src: v.optional(v.string()),
    rel: v.optional(v.string()),
    tgt: v.optional(v.string()),
    stream: v.optional(v.string()),
    active: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    filters: v.optional(v.array(v.object({ key: v.string(), val: v.any() }))),
  }),
  async run({ input }) {
    return executeRead(input);
  },
});

export const updateTool = defineTool({
  name: 'update',
  description: 'Update rows in any table (form, matter, motion). Provide an id or scope+type to target, and a patch object with fields to change.',
  input: v.object({
    table: v.picklist(['form', 'matter', 'motion']),
    id: v.optional(v.string()),
    scope: v.optional(v.string()),
    type: v.optional(v.string()),
    patch: v.record(v.string(), v.any()),
  }),
  async run({ input }) {
    return executeUpdate(input);
  },
});

export const deleteTool = defineTool({
  name: 'delete',
  description: 'Soft-delete a row by setting active=0. Works on form, matter, and graph tables.',
  input: v.object({
    table: v.picklist(['form', 'matter', 'graph']),
    id: v.optional(v.string()),
    scope: v.optional(v.string()),
    src: v.optional(v.string()),
    rel: v.optional(v.string()),
    tgt: v.optional(v.string()),
  }),
  async run({ input }) {
    return executeDelete(input);
  },
});

export const linkTool = defineTool({
  name: 'link',
  description: 'Create or toggle a relationship edge in the graph table. If the edge exists, toggle its active state.',
  input: v.object({
    src: v.string(),
    rel: v.string(),
    tgt: v.string(),
    active: v.optional(v.boolean()),
  }),
  async run({ input }) {
    return executeLink(input);
  },
});

export const searchTool = defineTool({
  name: 'search',
  description: 'Vector/text search across the memory table. Use for semantic search on marketplace items, motion history, or stored knowledge.',
  input: v.object({
    query: v.string(),
    scope: v.optional(v.string()),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  }),
  async run({ input }) {
    return executeSearch(input);
  },
});

export const allTools = [createTool, readTool, updateTool, deleteTool, linkTool, searchTool];
