/**
 * Real-time WebSocket — single socket per user.
 * All DOs and agent push events through it.
 */

// In-memory store of connected sockets (per Worker instance)
// In production, use Durable Objects or Durable Objects Alarms for cross-instance
const userSockets = new Map<string, Set<WebSocket>>();

/**
 * Register a user's WebSocket connection
 */
export function registerSocket(userId: string, ws: WebSocket): void {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(ws);

  ws.addEventListener('close', () => {
    userSockets.get(userId)?.delete(ws);
    if (userSockets.get(userId)?.size === 0) {
      userSockets.delete(userId);
    }
  });
}

/**
 * Push an event to a user's WebSocket
 */
export function pushToUser(userId: string, event: { type: string; data: any }): boolean {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return false;

  const payload = JSON.stringify(event);
  for (const ws of sockets) {
    try {
      ws.send(payload);
    } catch {
      sockets.delete(ws);
    }
  }
  return true;
}

/**
 * Push motion event to user (called by DOs)
 */
export function pushMotionEvent(
  userId: string,
  motion: {
    stream: string;
    action: number;
    data: any;
    scope?: string;
  }
): boolean {
  return pushToUser(userId, {
    type: 'motion',
    data: motion,
  });
}

/**
 * Push chat message to user
 */
export function pushChatMessage(
  userId: string,
  message: {
    role: 'assistant' | 'system';
    content: string;
    sessionId?: string;
  }
): boolean {
  return pushToUser(userId, {
    type: 'chat',
    data: message,
  });
}

/**
 * Get connected user count (for monitoring)
 */
export function getConnectedCount(): number {
  return userSockets.size;
}

/**
 * Handle WebSocket upgrade for user
 */
export function handleWebSocketUpgrade(
  request: Request,
  userId: string
): Response {
  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];

  registerSocket(userId, server);

  // Send initial connection confirmation
  server.send(JSON.stringify({ type: 'connected', userId }));

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
