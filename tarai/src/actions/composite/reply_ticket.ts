import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolAppendMotion } from '@/tools/core/append_motion';
import { actionNotify } from '@/actions/core/notify';

export const actionReplyTicket = defineAction({
  name: 'action_reply_ticket',
  description: 'Reply to a support ticket and notify the customer.',
  input: v.object({
    ticketId: v.string(),
    reply: v.pipe(v.string(), v.minLength(1)),
    scope: v.string(),
  }),
  output: v.object({ replied: v.boolean() }),
  async run({ harness, input, log }) {
    log.info(`Replying to ticket ${input.ticketId}`);

    await harness.tools.call(toolAppendMotion, {
      stream: input.ticketId, action: 99993,
      data: { event: 'ticket_reply', reply: input.reply },
      scope: input.scope,
    });

    await harness.actions.call(actionNotify, {
      to: input.ticketId, channel: 'email', template: 'ticket-reply',
      data: { reply: input.reply }, scope: input.scope,
    });

    return { replied: true };
  },
});
