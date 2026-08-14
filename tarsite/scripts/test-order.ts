/**
 * Test Order Pipeline against live Cloudflare Edge
 */

async function main() {
  console.log('📦 1. Sending Test Order to https://tar2.tarai.space/api/order...');
  const orderRes = await fetch('https://tar2.tarai.space/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      item: 'Planhat Enterprise Suite',
      name: 'Sarah Connor',
      price: 499,
      subdomain: 'tar2',
    }),
  });

  const orderData = await orderRes.json();
  console.log('✅ Order Response:', orderData);

  console.log('\n📬 2. Reading Inbox from taragent for scope w:tar2...');
  const inboxRes = await fetch('https://taragent.tar-54d.workers.dev/tools/read', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': 'guest',
    },
    body: JSON.stringify({
      table: 'inbox',
      scope: 'w:tar2',
    }),
  });

  const inboxData = await inboxRes.json();
  console.log('✅ Inbox Results in Turso:');
  console.log(JSON.stringify(inboxData, null, 2));
}

main().catch(console.error);
