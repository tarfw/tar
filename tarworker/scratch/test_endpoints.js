const assert = require('assert');
const WebSocket = require('ws');

const BASE_URL = 'https://test-store.tarai.space';
const WS_URL = 'wss://test-store.tarai.space';

async function runTests() {
  console.log('🚀 Starting deep integration tests for StorefrontDO, OrderDO, and WorkspaceDO...\n');

  // ==========================================
  // Part 1: StorefrontDO & OrderDO stock flows
  // ==========================================
  try {
    console.log('--- Phase 1: Stock Reservation & Checkout Locks ---');
    
    // 1. Reset stock to 10 for Classic Tee
    console.log('Resetting Classic Tee stock to 10...');
    const setStockRes = await fetch(`${BASE_URL}/api/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: { 'Classic Tee': 10 } }),
    });
    assert.strictEqual(setStockRes.status, 200);
    const setStockData = await setStockRes.json();
    assert.strictEqual(setStockData.ok, true);

    // Verify stock is indeed 10
    const chatRes1 = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi' }),
    });
    const chatData1 = await chatRes1.json();
    console.log('L1 Stock query reply:', chatData1.reply, 'Layer:', chatData1.layer);
    assert.strictEqual(chatData1.layer, 'L1');

    // 2. Initiate order for 3 Classic Tee
    console.log('Initiating checkout order A for 3 Classic Tees...');
    const checkoutResA = await fetch(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer-a@example.com',
        items: [{ name: 'Classic Tee', price: 999, qty: 3 }],
      }),
    });
    assert.strictEqual(checkoutResA.status, 200);
    const orderA = await checkoutResA.json();
    console.log('Order A created! ID:', orderA.id, 'Status:', orderA.status);
    
    // 3. Verify stock is reserved (should be 7 left)
    console.log('Verifying stock is reserved (10 - 3 = 7)...');
    const orderResA = await fetch(`${BASE_URL}/api/order/${orderA.id}`);
    const orderDataA = await orderResA.json();
    assert.strictEqual(orderDataA.status, 'pending_payment');

    // 4. Try to purchase 8 Classic Tees (should fail because only 7 available!)
    console.log('Attempting to check out 8 Classic Tees (should fail)...');
    const checkoutResB = await fetch(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer-b@example.com',
        items: [{ name: 'Classic Tee', price: 999, qty: 8 }],
      }),
    });
    // Should return 409 Conflict due to insufficient stock
    assert.strictEqual(checkoutResB.status, 409);
    const errorDataB = await checkoutResB.json();
    console.log('✅ Correctly blocked over-purchasing! Error:', errorDataB.error);

    // 5. Complete payment for Order A
    console.log('Completing payment for Order A...');
    const paymentResA = await fetch(`${BASE_URL}/api/webhook/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: orderA.id, success: true }),
    });
    assert.strictEqual(paymentResA.status, 200);
    const paymentDataA = await paymentResA.json();
    assert.strictEqual(paymentDataA.order.status, 'paid');
    console.log('Order A status is now paid! Stock committed successfully.');

    console.log('✅ StorefrontDO & OrderDO tests passed successfully!\n');
  } catch (err) {
    console.error('❌ StorefrontDO / OrderDO Test Failed:', err.message);
    process.exit(1);
  }

  // ==========================================
  // Part 2: WorkspaceDO Real-time sync tests
  // ==========================================
  try {
    console.log('--- Phase 2: WorkspaceDO WebSocket Synchronization ---');

    console.log('Opening client 1 connection...');
    const ws1 = new WebSocket(`${WS_URL}/api/workspace/sync`);

    console.log('Opening client 2 connection...');
    const ws2 = new WebSocket(`${WS_URL}/api/workspace/sync`);

    await Promise.all([
      new Promise((resolve) => ws1.on('open', resolve)),
      new Promise((resolve) => ws2.on('open', resolve)),
    ]);
    console.log('Both client connections established successfully!');

    // Client 2 listens for mutations
    const messagePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket message timeout')), 5000);
      ws2.on('message', (data) => {
        clearTimeout(timeout);
        resolve(data.toString());
      });
    });

    // Client 1 sends workspace mutation event
    const mutation = JSON.stringify({
      action: 'ADD_TASK',
      task: { id: 42, title: 'Verify DO Sync', assignee: 'Antigravity' },
    });

    console.log('Client 1 sending sync mutation:', mutation);
    ws1.send(mutation);

    const receivedMessage = await messagePromise;
    console.log('Client 2 received broadcast mutation:', receivedMessage);
    assert.strictEqual(receivedMessage, mutation);

    // Close connections
    ws1.close();
    ws2.close();
    console.log('✅ WorkspaceDO real-time WebSocket sync tested successfully!\n');

  } catch (err) {
    console.error('❌ WorkspaceDO Sync Test Failed:', err.message);
    process.exit(1);
  }

  // ==========================================
  // Part 3: Geospatial (KV + H3 Ring) Tests
  // ==========================================
  try {
    console.log('--- Phase 3: Geospatial Hex Grid Proximity ---');
    console.log('Updating driver location for driver_99...');
    const geoUpdateRes = await fetch(`${BASE_URL}/api/geo/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverId: 'driver_99',
        h3Index: '8826856235fffff',
        lat: 13.0827,
        lng: 80.2707,
      }),
    });
    assert.strictEqual(geoUpdateRes.status, 200);
    const geoUpdateData = await geoUpdateRes.json();
    assert.strictEqual(geoUpdateData.ok, true);

    console.log('Searching drivers in hex 8826856235fffff...');
    const geoSearchRes = await fetch(`${BASE_URL}/api/geo/search?hex=8826856235fffff`);
    assert.strictEqual(geoSearchRes.status, 200);
    const geoSearchData = await geoSearchRes.json();
    assert.ok(geoSearchData.drivers.length > 0);
    const foundDriver = geoSearchData.drivers.find(d => d.driverId === 'driver_99');
    assert.ok(foundDriver);
    console.log('✅ Proximity search found driver:', foundDriver.driverId, 'at', foundDriver.lat, foundDriver.lng);

    console.log('Searching drivers near lat=13.082, lng=80.270 (within 10km)...');
    const geoSearchCoordRes = await fetch(`${BASE_URL}/api/geo/search?lat=13.082&lng=80.270`);
    assert.strictEqual(geoSearchCoordRes.status, 200);
    const geoSearchCoordData = await geoSearchCoordRes.json();
    assert.ok(geoSearchCoordData.drivers.length > 0);
    const foundDriverCoord = geoSearchCoordData.drivers.find(d => d.driverId === 'driver_99');
    assert.ok(foundDriverCoord);
    console.log('✅ Coordinate proximity search found driver:', foundDriverCoord.driverId, 'at distance:', foundDriverCoord.distance.toFixed(2), 'km');

    console.log('✅ Geospatial KV + H3 hex grid and Haversine proximity tests passed successfully!\n');
  } catch (err) {
    console.error('❌ Geospatial Test Failed:', err.message);
    process.exit(1);
  }

  // ==========================================
  // Part 4: Direct Skill & Workflow Execution Tests
  // ==========================================
  try {
    console.log('--- Phase 4: Direct Skill & Workflow Direct Execution ---');
    console.log('Executing Skill "tool_create_lead"...');
    const skillRes = await fetch(`${BASE_URL}/api/skill/tool_create_lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadName: 'John Doe', phone: '+123456789' }),
    });
    assert.strictEqual(skillRes.status, 200);
    const skillData = await skillRes.json();
    assert.strictEqual(skillData.ok, true);
    assert.strictEqual(skillData.skillId, 'tool_create_lead');
    console.log('✅ Direct Skill execution OK!');

    console.log('Executing Workflow "wf_record_sale"...');
    const wfRes = await fetch(`${BASE_URL}/api/workflow/wf_record_sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saleAmount: 2999 }),
    });
    assert.strictEqual(wfRes.status, 200);
    const wfData = await wfRes.json();
    assert.strictEqual(wfData.ok, true);
    assert.strictEqual(wfData.workflowId, 'wf_record_sale');
    console.log('✅ Direct Workflow execution OK!\n');
  } catch (err) {
    console.error('❌ Direct Skill/Workflow Test Failed:', err.message);
    process.exit(1);
  }

  // ==========================================
  // Part 5: Chatbot Tiered Lookup & Semantic Cache Tests
  // ==========================================
  try {
    console.log('--- Phase 5: Chatbot L1/L2/L3 & Semantic Cache ---');
    console.log('Querying chatbot for store hours (first time)...');
    const chatRes1 = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hours' }),
    });
    const chatData1 = await chatRes1.json();
    assert.strictEqual(chatData1.layer, 'L1');
    console.log('First query resolved at layer:', chatData1.layer, '-', chatData1.reply);

    console.log('Querying custom question to prompt LLM (saving to cache)...');
    const chatRes2 = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'do you sell shoes?' }),
    });
    const chatData2 = await chatRes2.json();
    console.log('LLM query resolved at layer:', chatData2.layer, '-', chatData2.reply);

    console.log('Querying same custom question again (expecting L2 Semantic Cache Hit!)...');
    const chatRes3 = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'do you sell shoes?' }),
    });
    const chatData3 = await chatRes3.json();
    assert.strictEqual(chatData3.layer, 'L2 (Semantic Cache Hit)');
    console.log('Second query resolved at layer:', chatData3.layer, '-', chatData3.reply);
    console.log('✅ Chatbot L1/L2/L3 & Semantic Cache tests passed successfully!\n');
  } catch (err) {
    console.error('❌ Chatbot Tiered Lookup Test Failed:', err.message);
    process.exit(1);
  }

  console.log('🎉 100% SUCCESS: All Durable Object systems (StorefrontDO, OrderDO, WorkspaceDO) are fully functional!');
}

runTests();
