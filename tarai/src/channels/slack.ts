import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

export const channelSlack = defineTool({
  name: 'channel_slack',
  description: 'Send message via Slack webhook.',
  input: v.object({
    channel: v.string(),
    text: v.string(),
    webhookUrl: v.optional(v.string()),
  }),
  output: v.object({ sent: v.boolean() }),
  async run({ input, signal }) {
    const webhookUrl = input.webhookUrl || process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      console.log(`[Slack] No webhook configured. Would send to ${input.channel}: ${input.text}`);
      return { sent: false };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: input.channel, text: input.text }),
        signal,
      });

      return { sent: res.ok };
    } catch (e) {
      console.error('[Slack] Send failed:', e);
      return { sent: false };
    }
  },
});
