# What is an agent?

An agent is: **a large language model (LLM) running inside a harness.**

The model is the part you're already familiar with. The **harness** is what the LLM uses to navigate the world and complete tasks.

## What is a harness?

A language model does just one thing: takes text in and produces text out. On its own it can't remember anything, run code, read a file, or change anything in the world. It's **a brain in a jar** — extraordinary at reasoning, with no memory, no hands, and no senses.

Each piece of the harness exists to give the agent new abilities:

- **Filesystem** — so the agent can keep its work
- **Tools** — so the agent can act, not just describe
- **Sandbox** — so actions run safely
- **Context** — so the agent stays sharp across long work
- **Subagents** — so the agent can do more than one thing at a time

## Creating an agent

```typescript
import { defineAgent } from '@flue/runtime';
import { local } from '@flue/runtime/node';

export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  instructions,   // who the agent is and how it works
  tools,          // what it can do
  skills,         // expertise it can load on demand
  sandbox: local(), // where it runs, safely
}));
```

## Going headless

Flue is deliberately **headless** — there's no CLI or developer-facing product experience. A Flue agent is programmable: you assemble and drive it in code, choosing its model, instructions, tools, skills, and environment, then operating it through an API instead of a chat app.

## The sandbox

The sandbox is the filesystem and command-execution boundary available to the agent. Flue provides a lightweight virtual sandbox — an in-memory filesystem and shell — so an agent has a usable environment with no setup.
