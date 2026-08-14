const token = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJnaWQiOiI5YmY5YjQxNS01M2E5LTRjMzAtYTRhNy05YTI3OTgyMmQ3ODIiLCJpYXQiOjE3ODQyNzQ2NzAsImtpZCI6IkJTZW00RU92aGIyNlMxOFVqOWtuVWJpblg5TDdOdC1Tb0EtNmZIVGZzaDQiLCJyaWQiOiIyMzg5NDgzZC0xNTc5LTQ0ODItYmFjYy1iODdjMzgxYTZmMjkifQ.ccN6j2p__CtSHcEltX3JG842Kb8UW4xtU4tTY7SQiXmpyoII6XplitPsntG9CH3PF7F6LQfxDt6njLGEkDq7DA';
const url = 'https://ws-tar2-tarapp.aws-eu-west-1.turso.io';

async function test() {
  const eventId = `ev_${Date.now()}`;
  const nowUnix = Math.floor(Date.now() / 1000);
  const scope = 'w:tar2';

  const pipelineRequests = [
    {
      type: 'execute',
      stmt: {
        sql: 'INSERT INTO inbox (id, scope, type, title, status, ref, data, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [
          { type: 'text', value: eventId },
          { type: 'text', value: scope },
          { type: 'text', value: 'order' },
          { type: 'text', value: 'New Order #1001 — Planhat Enterprise (Sarah Connor)' },
          { type: 'text', value: 'open' },
          { type: 'text', value: 'ord_1001' },
          { type: 'text', value: JSON.stringify({ item: 'Planhat Enterprise', price: 499 }) },
          { type: 'integer', value: String(nowUnix) },
        ],
      },
    },
    {
      type: 'execute',
      stmt: {
        sql: 'SELECT * FROM inbox WHERE scope = ?',
        args: [{ type: 'text', value: scope }],
      },
    },
    { type: 'close' },
  ];

  console.log('Sending pipeline request...');
  const res = await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests: pipelineRequests }),
  });

  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

test().catch(console.error);
