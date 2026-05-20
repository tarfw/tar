If you are building AI Agents that operate on these Turso tables, you absolutely need a robust Hybrid Sync Architecture. Relying purely on intervals (polling) is considered an anti-pattern for agents because it either drains battery/locks the DB (if polling too fast) or creates a frustrating lag (if polling too slow, like 30s).

Here is the "Right Way" to architect a local-first mobile app alongside cloud-based AI Agents:

1. The Mobile Client Pattern (I just implemented part of this)
   The mobile app should only initiate syncing when it logically makes sense, rather than blindly looping.

Mutation-Driven Pushes: When the user creates a new Matter or Motion, the app writes to local SQLite instantly, closes the UI, and then fires db.push() in the background. (This is what we fixed today).
AppState-Driven Pulls: I just updated your \_layout.tsx to listen to React Native's AppState. Now, whenever the user minimizes the app and opens it again (comes to the foreground), it immediately triggers a db.pull(). This guarantees they see what the Agent did while they were away.
Fallback Polling: We keep the 30-second interval only as a lightweight fallback in case they leave the app open on their desk. 2. The Cloud Agent Pattern (For your AI Agents)
When your AI Agent runs in the cloud (e.g., via Cloudflare Workers or a Node.js backend) and writes data directly to your remote Turso database, the mobile app doesn't automatically know it happened unless it polls. To bridge this gap for true real-time, you need Event-Driven Notifications.

How to implement it:

Agent Writes to Turso: Your AI Agent executes a SQL query on the remote Turso DB.
Agent Emits a Ping: Immediately after the SQL succeeds, the Agent sends a lightweight "Ping" to the mobile app. You can do this via:
WebSockets / Server-Sent Events (SSE): If the app is open, maintain a lightweight WebSocket connection (e.g., using Cloudflare Durable Objects or Pusher). The ping just says { "event": "db_updated" }.
Silent Push Notifications: If the app is backgrounded, send a silent FCM/APNs push notification.
Mobile App Reacts: When the React Native app receives that ping, it executes await db.pull().
Why this is the "Right Way"
Zero DB Locking: Your local SQLite database is completely free for lightning-fast user interactions. It only locks for a few milliseconds precisely when new data actually exists.
Instant UI: The AI Agent's actions appear on the user's screen in real-time.
Battery & Bandwidth Efficient: You are no longer making useless network requests to Turso every 3 seconds just to find out nothing changed.
I have already updated your \_layout.tsx to include the AppState listener for foreground syncing. When you start building the AI Agents, you just need to drop in a WebSocket listener in that same file to trigger db.pull() on command!
