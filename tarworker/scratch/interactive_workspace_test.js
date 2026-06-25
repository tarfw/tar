const WebSocket = require('ws');
const readline = require('readline');

const WS_URL = 'wss://test-store.tarai.space/api/workspace/sync';

console.log(`连接中: ${WS_URL}...`);
const ws = new WebSocket(WS_URL);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

ws.on('open', () => {
  console.log('\n🔌 Connected to WorkspaceDO Real-time Sync Server!');
  console.log('----------------------------------------------------');
  console.log('👉 Any message you type here will broadcast to all other clients.');
  console.log('👉 Any actions from other clients will appear here in real-time.\n');
  
  promptUser();
});

ws.on('message', (data) => {
  // Move cursor to start of line, clear line, print message, and prompt again
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  console.log(`📥 Received Broadcast: ${data.toString()}`);
  promptUser();
});

ws.on('close', () => {
  console.log('\n❌ Disconnected from sync server.');
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('\n❌ Connection Error:', err.message);
  process.exit(1);
});

function promptUser() {
  rl.question('Enter message to broadcast: ', (input) => {
    if (input.trim()) {
      ws.send(input);
    }
    promptUser();
  });
}
