import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { appendMotion, readForm } from '@/lib/helpers';

export const actionReplyTicket = defineAction({
  name: 'action_reply_ticket',
  description: 'Reply to a support ticket and notify the customer.',
  input: v.object({
    ticketId: v.string(),
    reply: v.pipe(v.string(), v.minLength(1)),
    scope: v.string(),
  }),
  output: v.object({ replied: v.boolean() }),
  async run({ input, log }) {
    log.info(`Replying to ticket ${input.ticketId}`);

    await appendMotion({
      stream: input.ticketId, action: 99993,
      data: { event: 'ticket_reply', reply: input.reply },
      scope: input.scope,
    });

    // actionNotify inlined
    const channelResult = await readForm({ scope: input.scope, type: 'channel' });
    const channelConfig = channelResult.rows.find(
      (r: any) => r.id === 'email' || r.data?.provider === 'email'
    );
    if (channelConfig) {
      log.info(`Found channel config for email, would send via provider`);
    }
    await appendMotion({
      stream: input.ticketId, action: 99993,
      data: { event: 'notification', channel: 'email', template: 'ticket-reply', reply: input.reply },
      scope: input.scope,
    });

    return { replied: true };
  },
});
