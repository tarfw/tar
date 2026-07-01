# React

`@flue/react` turns Flue's durable event streams into live React state.

## Setup

```bash
pnpm add @flue/react @flue/sdk
```

```tsx
import { FlueProvider } from '@flue/react';
import { createFlueClient } from '@flue/sdk';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

const client = createFlueClient({ baseUrl: '/api' });

createRoot(document.getElementById('root')!).render(
  <FlueProvider client={client}>
    <App />
  </FlueProvider>,
);
```

## Build an agent conversation

```tsx
import { useFlueAgent } from '@flue/react';
import { useState } from 'react';

export function Chat({ conversationId }: { conversationId: string }) {
  const [input, setInput] = useState('');
  const agent = useFlueAgent({ name: 'support-assistant', id: conversationId });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message) return;
    setInput('');
    await agent.sendMessage(message);
  }

  return (
    <section>
      <div aria-live="polite">
        {agent.messages.map((message) => (
          <article key={message.id}>
            <strong>{message.role}</strong>
            {message.parts.map((part) =>
              part.type === 'text' ? <p key={part.text}>{part.text}</p> : null
            )}
          </article>
        ))}
      </div>
      <form onSubmit={submit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button disabled={!input.trim()} type="submit">Send</button>
      </form>
    </section>
  );
}
```

## Observe a workflow run

```tsx
import { useFlueClient, useFlueWorkflow } from '@flue/react';

export function Report() {
  const flue = useFlueClient();
  const [runId, setRunId] = useState<string>();
  const run = useFlueWorkflow({ runId });

  async function generate() {
    const invocation = await flue.workflows.invoke('weekly-report', {
      input: { week: 'current' },
    });
    setRunId(invocation.runId);
  }

  return (
    <section>
      <button onClick={generate}>Generate report</button>
      <p>{run.status}</p>
    </section>
  );
}
```
