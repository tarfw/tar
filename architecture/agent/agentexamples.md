# TAR Commerce System: Agent Examples

This document extends the technical blueprints established in `agentplan.md` to demonstrate how the TAR system behaves in practical, real-world business vertical scenarios, specifically focusing on interactions via group chats (Slack, Telegram, WhatsApp) and direct natural language.

---

## Example 1: Ride-Hailing & Taxi Dispatch

**The Scenario:** A local taxi firm uses the TAR system to manage dispatch and driver assignments without needing a dedicated operator console.

### 🚕 The "Live Dispatch" Group Chat (WhatsApp/Telegram)

- **Driver (in group):** _"I just finished the Airport drop-off. I'm empty at Terminal 2."_
  - **Worker:** Parses message, calls Turso DB to update Driver State = `AVAILABLE`.
  - **Workflow:** Triggers location update based on 'Terminal 2'.
  - **DO (AgentBrain):** Sends WhatsApp confirmation to driver: _"Copy that. Marking you as available at Airport T2."_
- **Customer (Direct WhatsApp):** _"I need a ride from the Marriott Downtown to the Airport right now."_
  - **Worker & LLM:** Worker receives webhook. LLM transpiles intent: `create_ride(pickup: "Marriott Downtown", dropoff: "Airport", ASAP: true)`.
  - **Workflow:** Executes driver assignment logic. Queries Turso for available drivers near Downtown.
  - **DO (AgentBrain):** Dispatches ride offer to Driver B's app via WebSocket.
- **Driver B (Direct App Interaction):** Taps "Accept Ride".
  - **DO (AgentBrain):** Updates ride Status = `ACCEPTED`. Broadcasts driver location via WebSocket back to the Customer's app/WhatsApp link.
  - **Group Chat Alert (Automated):** _"Driver B is en-route to Marriott Downtown for an Airport run."_

---

## Example 2: Food Management & Dark Kitchen Operations

**The Scenario:** A delivery-only dark kitchen uses the TAR system to manage multiple food brands out of one location, using Slack to orchestrate the chaos.

### 🍳 The "Expo Line" Group Chat (Slack)

- **Manager (Slack):** _"@TarBot We are getting crushed on Burger King orders right now. Pause all UberEats incoming for 15 minutes."_
  - **Worker & LLM:** Deciphers intent: `update_platform_status(platform: "ubereats", status: "paused", duration: "15m", brand: "burger_king")`.
  - **Turso DB:** Status updated.
  - **Workflow:** Schedules a job to automatically unpause in 15 minutes.
  - **Slack Response:** _"🛑 Burger King paused on UberEats for 15 minutes. A resume task has been scheduled."_
- **Inventory Automation (Automated Trigger):** The DB registers the last box of fries was used.
  - **DO (AgentBrain):** Notices the inventory metric dropped below threshold.
  - **Slack Response (Automated Alert):** _"🚨 Fryer Station alert: We just hit 86 threshold on 3/8th French Fries. I am removing fries as an option from all active digital menus immediately."_

---

## Example 3: Customer Relationship Management (CRM)

**The Scenario:** A high-end real estate agency uses the TAR system to classify leads and route them to the correct agents based on WhatsApp inquiries.

### 🏢 The "Lead Router" Group Chat (Telegram)

- **Prospective Buyer (WhatsApp):** _"Hi, I'm looking for a 3-bedroom apartment in South Beach. My budget is around $2 million. We want to buy within the next 3 months."_
  - **Worker & LLM:** Receives webhook. Uses Groq to extract structured data: `create_lead(type: "buy", location: "South Beach", bedrooms: 3, budget: 2000000, timeframe: "3 months", urgency: "high")`.
  - **Workflow:** Runs routing logic. Determines which agent specializes in $2M+ South Beach condos.
  - **DO / Routing:** Assigns to 'Agent Sarah'.
- **Telegram Notification (To Sales Team Group):**
  - _"🔥 **Hot Lead (South Beach)**: Budget $2M, 3 Beds. Timeframe: 3 months. Assigned to @Sarah."_
- **Agent Sarah (Telegram):** _"@TarBot pull up the last 3 properties we showed in that building."_
  - **Worker & LLM:** Interprets query, searches Turso DB trace history for properties in the South Beach context.
  - **Telegram Response:** _"Here are the last 3 properties shown in that area matching a $2M budget: [...list]"_
