# Why Flue?

Flue is the TypeScript framework for building autonomous AI agents and the workflows around them. Flue is best-known for giving any model the same harness-driven architecture used by Claude Code and other coding agents: sessions, tools, skills, instructions, filesystem access, and a secure sandbox to work in.

## Features

- **Agents**: Autonomous agents that keep context across conversations and events
- **Workflows**: Structured automations from a clear input to a finished result
- **Sandboxes**: A secure environment where agents act and run code
- **CLI**: Develop locally, run applications or jobs, and build them for deployment
- **Subagents**: Delegate specialized tasks to the right expert
- **Tools**: Typed actions for calling APIs and changing data
- **Skills**: Reusable expertise agents load on demand
- **MCP Servers**: Connect tools and services over the open MCP ecosystem
- **Observability**: Export telemetry with OpenTelemetry, Braintrust, Sentry, or your own observer
- **Channels**: Receive verified provider events and connect them to agents or application code

## Design Principles

### Harness-first
A model pointed at a harness, not a script. Instead of scripting an agent's steps, you fill its harness with context: instructions, tools, skills, sessions, files, resources, MCP server connections, etc. Then you point a model at it and tell it to go solve the task.

### Open by default
Open models, sandboxes, and deploys — no lock-in:
- Open models: Connect to any supported LLM provider
- Open sandboxes: Connect to a remote provider, or use the built-in virtual sandbox
- Open deploys: Build your agent for Node.js, Cloudflare, GitHub, GitLab, etc.

### AI-first
Built to be used with your coding agent. Flue is designed to be used by the developer alongside a coding agent like Claude Code or Codex. Setup, scaffolding, and several workflows are designed around handing a prompt to your coding agent and letting it do the work.
