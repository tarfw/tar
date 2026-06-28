import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { createMatter, getMatter, listMatters, updateMatter, appendMotion, readMotions, linkGraph, traverseGraph, setAttr, searchMemory, storeMemory, readForm } from '../lib/helpers';

export const createMatterTool = defineTool({
  name: 'create_matter',
  description: 'Create a new entity (matter) in the database. Use for leads, orders, products, tasks, etc.',
  input: v.object({
    table: v.picklist(['form', 'matter']),
    scope: v.string(),
    type: v.string(),
    title: v.optional(v.string()),
    value: v.optional(v.number()),
    data: v.optional(v.record(v.string(), v.any())),
  }),
  async run({ input }) {
    return createMatter(input);
  },
});

export const getMatterTool = defineTool({
  name: 'get_matter',
  description: 'Read a single entity by ID from form or matter table.',
  input: v.object({
    table: v.string(),
    id: v.string(),
  }),
  async run({ input }) {
    return getMatter(input);
  },
});

export const listMattersTool = defineTool({
  name: 'list_matters',
  description: 'List entities from form or matter table with optional filters.',
  input: v.object({
    table: v.string(),
    scope: v.optional(v.string()),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  }),
  async run({ input }) {
    return listMatters(input);
  },
});

export const updateMatterTool = defineTool({
  name: 'update_matter',
  description: 'Update an existing entity in form or matter table.',
  input: v.object({
    table: v.string(),
    id: v.string(),
    scope: v.string(),
    patch: v.record(v.string(), v.any()),
  }),
  async run({ input }) {
    return updateMatter(input);
  },
});

export const appendMotionTool = defineTool({
  name: 'append_motion',
  description: 'Log an event to the motion table (audit trail).',
  input: v.object({
    stream: v.string(),
    action: v.number(),
    data: v.optional(v.record(v.string(), v.any())),
    scope: v.optional(v.string()),
  }),
  async run({ input }) {
    return appendMotion(input);
  },
});

export const readMotionsTool = defineTool({
  name: 'read_motions',
  description: 'Read event history from the motion table.',
  input: v.object({
    stream: v.string(),
    scope: v.optional(v.string()),
    limit: v.optional(v.number()),
  }),
  async run({ input }) {
    return readMotions(input);
  },
});

export const linkGraphTool = defineTool({
  name: 'link_graph',
  description: 'Create a relationship between two entities in the graph table.',
  input: v.object({
    src: v.string(),
    rel: v.string(),
    tgt: v.string(),
    scope: v.string(),
  }),
  async run({ input }) {
    return linkGraph(input);
  },
});

export const traverseGraphTool = defineTool({
  name: 'traverse_graph',
  description: 'Find relationships by traversing the graph table.',
  input: v.object({
    scope: v.string(),
    src: v.optional(v.string()),
    rel: v.optional(v.string()),
    tgt: v.optional(v.string()),
  }),
  async run({ input }) {
    return traverseGraph(input);
  },
});

export const setAttrTool = defineTool({
  name: 'set_attr',
  description: 'Set a hot field on a matter (indexed for fast lookups).',
  input: v.object({
    matterId: v.string(),
    key: v.string(),
    val: v.optional(v.string()),
    num: v.optional(v.number()),
    scope: v.optional(v.string()),
  }),
  async run({ input }) {
    return setAttr(input);
  },
});

export const searchMemoryTool = defineTool({
  name: 'search_memory',
  description: 'Search for entities using vector similarity or text matching.',
  input: v.object({
    query: v.string(),
    scope: v.optional(v.string()),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  }),
  async run({ input }) {
    return searchMemory(input);
  },
});

export const storeMemoryTool = defineTool({
  name: 'store_memory',
  description: 'Store a text chunk with embedding for semantic search.',
  input: v.object({
    id: v.string(),
    matter: v.optional(v.string()),
    text: v.string(),
    embedding: v.string(),
    meta: v.optional(v.record(v.string(), v.any())),
    scope: v.optional(v.string()),
  }),
  async run({ input }) {
    return storeMemory(input);
  },
});

export const readFormTool = defineTool({
  name: 'read_form',
  description: 'Read configuration from the form table.',
  input: v.object({
    scope: v.string(),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  }),
  async run({ input }) {
    return readForm(input);
  },
});

export const allTools = [
  createMatterTool,
  getMatterTool,
  listMattersTool,
  updateMatterTool,
  appendMotionTool,
  readMotionsTool,
  linkGraphTool,
  traverseGraphTool,
  setAttrTool,
  searchMemoryTool,
  storeMemoryTool,
  readFormTool,
];
