import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

export const channelEmail = defineTool({
  name: 'channel_email',
  description: 'Send email via SendGrid or Resend provider.',
  input: v.object({
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    from: v.optional(v.string()),
  }),
  output: v.object({ sent: v.boolean(), messageId: v.optional(v.string()) }),
  async run({ input, signal }) {
    const apiKey = process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY;
    const from = input.from || process.env.EMAIL_FROM || 'noreply@tarai.space';

    if (!apiKey) {
      console.log(`[Email] No API key configured. Would send to ${input.to}: ${input.subject}`);
      return { sent: false };
    }

    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: input.to }] }],
          from: { email: from },
          subject: input.subject,
          content: [{ type: 'text/plain', value: input.body }],
        }),
        signal,
      });

      return { sent: res.ok, messageId: res.headers.get('x-message-id') || undefined };
    } catch (e) {
      console.error('[Email] Send failed:', e);
      return { sent: false };
    }
  },
});
