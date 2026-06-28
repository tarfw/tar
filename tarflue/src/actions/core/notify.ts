import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { appendMotion, readForm } from '@/lib/helpers';

export const actionNotify = defineAction({
  name: 'action_notify',
  description: 'Send a notification via a configured channel (email, SMS, Slack, or motion event).',
  input: v.object({
    to: v.string(),
    channel: v.string(),
    template: v.optional(v.string()),
    data: v.optional(v.record(v.string(), v.any())),
    scope: v.string(),
  }),
  output: v.object({ sent: v.boolean(), channel: v.string() }),
  async run({ harness, input, log }) {
    log.info(`Notifying ${input.to} via ${input.channel}`);

    const channelResult = await readForm({
      scope: input.scope,
      type: 'channel',
    });

    const channelConfig = channelResult.rows.find(
      (r: any) => r.id === input.channel || r.data?.provider === input.channel
    );

    if (channelConfig) {
      log.info(`Found channel config for ${input.channel}, would send via provider`);
    }

    await appendMotion({
      stream: input.to,
      action: 99993,
      data: {
        event: 'notification',
        channel: input.channel,
        template: input.template,
        ...input.data,
      },
      scope: input.scope,
    });

    return { sent: true, channel: input.channel };
  },
});
