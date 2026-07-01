# Agent API Reference

The agent API is exported from `@flue/runtime`.

## Imports

```typescript
import {
  FlueError, ResultUnavailableError,
  ToolInputValidationError, ToolLegacyDefinitionError,
  ToolOutputSerializationError, ToolOutputValidationError,
  bash, connectMcpServer, defineAgent, defineAgentProfile,
  defineTool, dispatch,
  type AgentInitializerContext, type AgentDispatchRequest,
  type AgentProfile, type AgentRuntimeConfig, type BashFactory,
  type CallHandle, type CompactionConfig, type AgentDefinition,
  type DispatchReceipt, type FileStat, type FlueFs,
  type FlueHarness, type FlueLogger, type FlueSession,
  type FlueSessions, type McpServerConnection, type McpServerOptions,
  type NamedAgentDispatchRequest, type PromptImage, type PromptModel,
  type PromptOptions, type PromptResponse, type PromptResultResponse,
  type PromptUsage, type SandboxFactory, type ShellOptions,
  type ShellResult, type Skill, type SkillOptions,
  type SkillReference, type TaskOptions, type ThinkingLevel,
  type ToolContext, type ToolDefinition, type ToolInput,
  type ToolInputSchema, type ToolOutput, type ToolOutputSchema,
  type ToolValidationIssue,
} from '@flue/runtime';
```

## defineAgentProfile(...)

```typescript
function defineAgentProfile(profile: AgentProfile): AgentProfile;
```

### AgentProfile

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Profile name. Required for session.task() |
| `description` | `string` | Human-readable description |
| `model` | `string \| false` | Default model specifier |
| `instructions` | `string` | Instructions prepended to workspace context |
| `skills` | `Skill[]` | Registered skills |
| `tools` | `ToolDefinition[]` | Custom model-callable tools |
| `actions` | `ActionDefinition[]` | Reusable Actions |
| `subagents` | `AgentProfile[]` | Named profiles for delegated tasks |
| `thinkingLevel` | `ThinkingLevel` | Default reasoning effort |
| `compaction` | `false \| CompactionConfig` | Conversation compaction config |
| `durability` | `DurabilityConfig` | Durability config (rejected on subagents) |

### DurabilityConfig

| Field | Type | Default | Description |
|---|---|---|---|
| `maxAttempts` | `number` | 10 | Max total attempts before terminalized |
| `timeoutMs` | `number` | 3600000 | Max wall-clock ms for one submission |

### CompactionConfig

| Field | Type | Default | Description |
|---|---|---|---|
| `reserveTokens` | `number` | model-aware (max 20000) | Token headroom before compaction |
| `keepRecentTokens` | `number` | 8000 | Recent tokens preserved unsummarized |
| `model` | `string` | session model | Model for compaction summaries |

## defineTool(...)

```typescript
function defineTool<TInput, TOutput>(options: {
  name: string;
  description: string;
  input?: TInput;
  output?: TOutput;
  run: (context: { input: ...; signal: AbortSignal }) => ...;
}): ToolDefinition<TInput, TOutput>;
```

## connectMcpServer(...)

```typescript
function connectMcpServer(name: string, options: McpServerOptions): Promise<McpServerConnection>;
```

### McpServerConnection

```typescript
interface McpServerConnection {
  name: string;
  tools: ToolDefinition[];
  close(): Promise<void>;
}
```

## defineAgent(...)

```typescript
function defineAgent<TEnv = Record<string, any>>(
  initialize: (context: AgentInitializerContext<TEnv>) => AgentRuntimeConfig | Promise<AgentRuntimeConfig>,
): AgentDefinition<TEnv>;
```

### AgentRuntimeConfig

| Field | Type | Description |
|---|---|---|
| `model` | `string \| false` | Default model specifier |
| `instructions` | `string` | Instructions |
| `skills` | `Skill[]` | Registered skills |
| `tools` | `ToolDefinition[]` | Custom tools |
| `actions` | `ActionDefinition[]` | Reusable Actions |
| `subagents` | `AgentProfile[]` | Named profiles for delegation |
| `thinkingLevel` | `ThinkingLevel` | Reasoning effort |
| `compaction` | `false \| CompactionConfig` | Compaction config |
| `durability` | `DurabilityConfig` | Durability config |
| `cwd` | `string` | Working directory |
| `sandbox` | `SandboxFactory` | Sandbox factory |

## dispatch(...)

```typescript
function dispatch(agent: AgentDefinition, request: AgentDispatchRequest): Promise<DispatchReceipt>;
function dispatch(request: NamedAgentDispatchRequest): Promise<DispatchReceipt>;
```

### DispatchReceipt

```typescript
interface DispatchReceipt {
  dispatchId: string;
  acceptedAt: string;
}
```

## FlueHarness

```typescript
interface FlueHarness {
  readonly name: string;
  session(name?: string): Promise<FlueSession>;
  readonly sessions: FlueSessions;
  shell(command: string, options?: ShellOptions): CallHandle<ShellResult>;
  readonly fs: FlueFs;
}
```

## FlueSession

```typescript
interface FlueSession {
  readonly name: string;
  prompt(text: string, options?: PromptOptions): CallHandle<PromptResponse>;
  skill(skill: SkillReference | string, options?: SkillOptions): CallHandle<PromptResponse>;
  task(text: string, options?: TaskOptions): CallHandle<PromptResponse>;
  shell(command: string, options?: ShellOptions): CallHandle<ShellResult>;
  readonly fs: FlueFs;
  compact(): Promise<void>;
  delete(): Promise<void>;
}
```

### PromptOptions

| Field | Type | Description |
|---|---|---|
| `result` | Valibot schema | Require validated structured data |
| `tools` | `ToolDefinition[]` | Additional tools for this operation |
| `model` | `string` | Model specifier override |
| `thinkingLevel` | `ThinkingLevel` | Reasoning-effort override |
| `signal` | `AbortSignal` | Cancel this operation |
| `images` | `PromptImage[]` | Images for vision models |

### PromptResponse

```typescript
interface PromptResponse {
  text: string;
  usage: PromptUsage;
  model: PromptModel;
}
```

## FlueFs

```typescript
interface FlueFs {
  readFile(path: string): Promise<string>;
  readFileBuffer(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  stat(path: string): Promise<FileStat>;
  readdir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
}
```

### FileStat

```typescript
interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink?: boolean;
  size?: number;
  mtime?: Date;
}
```

## CallHandle

```typescript
interface CallHandle<T> extends Promise<T> {
  readonly signal: AbortSignal;
  abort(reason?: unknown): void;
}
```
