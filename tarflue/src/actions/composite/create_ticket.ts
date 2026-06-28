import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { createMatter, setAttr, appendMotion, readForm } from '@/lib/helpers';

export const actionCreateTicket = defineAction({
  name: 'action_create_ticket',
  description: 'Log a support or service ticket with notification.',
  input: v.object({
    title: v.pipe(v.string(), v.minLength(1)),
    description: v.optional(v.string()),
    priority: v.optional(v.picklist(['low', 'medium', 'high', 'urgent'])),
    scope: v.string(),
  }),
  output: v.object({ ticketId: v.string() }),
  async run({ input, log }) {
    log.info(`Creating ticket: ${input.title}`);

    const ticketId = `ticket_${Date.now()}`;
    await createMatter({
      table: 'matter', scope: input.scope, type: 'ticket',
      title: input.title, data: { description: input.description, priority: input.priority },
    });

    await setAttr({ matterId: ticketId, key: 'status', val: 'open', scope: input.scope });
    await setAttr({ matterId: ticketId, key: 'priority', val: input.priority || 'medium', scope: input.scope });

    await appendMotion({
      stream: ticketId, action: 99993,
      data: { event: 'ticket_created', title: input.title, priority: input.priority },
      scope: input.scope,
    });

    // actionNotify inlined
    const channelResult = await readForm({ scope: input.scope, type: 'channel' });
    const channelConfig = channelResult.rows.find(
      (r: any) => r.id === 'slack' || r.data?.provider === 'slack'
    );
    if (channelConfig) {
      log.info(`Found channel config for slack, would send via provider`);
    }
    await appendMotion({
      stream: 'support-team', action: 99993,
      data: { event: 'notification', channel: 'slack', template: 'ticket-created', ticketId, title: input.title },
      scope: input.scope,
    });

    return { ticketId };
  },
});
