import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolCreateMatter } from '@/tools/core/create_matter';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';
import { actionNotify } from '@/actions/core/notify';

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
  async run({ harness, input, log }) {
    log.info(`Creating ticket: ${input.title}`);

    const ticketId = `ticket_${Date.now()}`;
    await harness.tools.call(toolCreateMatter, {
      table: 'matter', scope: input.scope, type: 'ticket',
      title: input.title, data: { description: input.description, priority: input.priority },
    });

    await harness.tools.call(toolSetAttr, { matterId: ticketId, key: 'status', val: 'open', scope: input.scope });
    await harness.tools.call(toolSetAttr, { matterId: ticketId, key: 'priority', val: input.priority || 'medium', scope: input.scope });

    await harness.tools.call(toolAppendMotion, {
      stream: ticketId, action: 99993,
      data: { event: 'ticket_created', title: input.title, priority: input.priority },
      scope: input.scope,
    });

    await harness.actions.call(actionNotify, {
      to: 'support-team', channel: 'slack', template: 'ticket-created',
      data: { ticketId, title: input.title }, scope: input.scope,
    });

    return { ticketId };
  },
});
