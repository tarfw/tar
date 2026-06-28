import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

export const channelSms = defineTool({
  name: 'channel_sms',
  description: 'Send SMS via Twilio provider.',
  input: v.object({
    to: v.string(),
    body: v.string(),
  }),
  output: v.object({ sent: v.boolean(), sid: v.optional(v.string()) }),
  async run({ input, signal }) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !from) {
      console.log(`[SMS] No Twilio config. Would send to ${input.to}: ${input.body}`);
      return { sent: false };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
        body: new URLSearchParams({ To: input.to, From: from, Body: input.body }).toString(),
        signal,
      });

      const data = await res.json() as any;
      return { sent: res.ok, sid: data.sid };
    } catch (e) {
      console.error('[SMS] Send failed:', e);
      return { sent: false };
    }
  },
});
