# Tar Automation Architecture (Edge + Webhooks)

_Massive Multi-Tenant Task Execution via Cloudflare Edge, Turso Native Triggers, and Self-Hosted AI._

---

Instead of running a heavy node-cron polling system that crashes under scale, Tar Commerce AI utilizes a serverless event-driven architecture. The system relies entirely on **Cloudflare Durable Objects** for precise time-based scheduling, **Turso Native Webhooks** for instant event reactions, and an **Omnichannel Worker** to handle chat interfaces like Telegram and WhatsApp.

---

## 1. The Global Architecture Flow

```text
                        [ Merchant / Employee ]
                                  |
                      Telegram / WhatsApp / Slack
                                  |
                                  v
+-----------------------------------------------------------------------+
|                       Cloudflare Worker (API Gateway)                 |
|  - Acts as universal webhook receiver.                                |
|  - Validates Role-Based Access Control (RBAC) via Telegram Topic IDs. |
+------+--------------------------+------------------------------+------+
       |                          |                              |
       v                          v                              v
+---------------+         +---------------+              +---------------+
| Self-Hosted   |         | Turso (LibSQL)|              | Cloudflare    |
| AI Model      |         | Database      |              | Durable       |
| (Liquid 1.6B) |         | (Bare Metal)  |              | Objects (DO)  |
+-------+-------+         +-------+-------+              +-------+-------+
        |                         |                              |
        | Translates text to JSON | Native AFTER INSERT / UPDATE | Holds Alarms for delayed
        | Does OCR, Summaries     | Trigger fires HTTP Webhook   | Scheduled Tasks
        +------------+------------+-------+----------------------+-------+
                     |                    |                      |
                     v                    v                      v
             +------------------------------------------------------+
             |             Cloudflare Worker (Outbound)             |
             +------------------------+-----------------------------+
                                      |
                                      v
                               [ Telegram ]
                            "Milk is out of stock!"
```

---

## 2. Omnichannel Integration & Team Management

Tar acts as an agnostic "brain." It treats Telegram Forums, WhatsApp Groups, and Slack Channels as the primary UI for Merchants.

### Topic-Based Security (No Passwords)

Role-Based Access Control (RBAC) is enforced by tying database permissions to specific chat rooms (e.g., Telegram Topic IDs).

1.  **Dynamic Binding:** Merchant binds a Topic ID (e.g., `Thread 45`) to `#inventory`.
2.  **AI Intent Parsing:** When a user types _"Update milk stock to 0"_, the self-hosted AI securely translates the natural language to JSON: `{intent: "update_stock", item: "milk"}`.
3.  **Strict Validation:** The Cloudflare Worker checks the database: _"Is Thread 45 allowed to perform `update_stock`?"_ If yes, the database updates. If no, the Worker blocks it.

_(Note: If integrating WhatsApp Web via Baileys, a lightweight Node.js microservice runs alongside the Turso database to bridge the WhatsApp WebSocket to the Cloudflare HTTP Worker)._

---

## 3. The Two Types of Tasks

### Type A: Instant / Event-Driven (Turso Webhooks)

**Use Case:** Send an alert the exact millisecond an order is paid.

1. Order is inserted into Turso.
2. Turso native `AFTER UPDATE` trigger instantly fires an HTTP webhook to the Cloudflare Worker.
3. Worker translates the payload and pushes the alert to Telegram/WhatsApp.
   _Cost:_ Ultra-low ($0.03 per 100k invocations). No polling required.

```sql
-- Example Turso Native Webhook Trigger
CREATE TRIGGER notify_paid_order
AFTER UPDATE ON nodes
WHEN NEW.status = 'paid' AND OLD.status != 'paid'
BEGIN
  SELECT lib_http_post('https://alert-worker.tar.workers.dev', json_object(
    'merchant_id', NEW.tenant_id,
    'order_id', NEW.id
  ));
END;
```

### Type B: Time-Delayed / Scheduled Tasks (Cloudflare DO Alarms)

**Use Case:** "Check for abandoned carts older than 3 hours."

1. When the cart is created, Cloudflare schedules a **Durable Object Alarm** for 3 hours in the future.
2. Cloudflare manages the timer memory perfectly.
3. In 3 hours, the DO wakes up, checks Turso to see if the cart is still unpaid, and triggers the "Nudge" AI generation if needed.
   _Cost:_ Highly efficient ($1.35 per 1,000,000 alarm lifecycles). Solves the "Thundering Herd" problem instantly through global edge distribution.

---

## 4. Cost Scalability

By avoiding heavy SaaS taxes and utilizing Edge + Bare Metal:

| Component          | Architecture Choice                         | Cost (Per User / Mo) |
| :----------------- | :------------------------------------------ | :------------------- |
| **Logic & Timers** | Cloudflare Workers & Durable Objects        | **~$1.20 INR**       |
| **Database**       | Self-Hosted Turso/LibSQL on NVMe            | **~$0.20 INR**       |
| **Intelligence**   | Dedicated Rent GPU (e.g. RTX 4090) or Modal | **~$0.56 INR**       |
| **Channels**       | Telegram Bot API / Slack / Baileys          | **~$0.00 INR**       |

**Total estimated infrastructure cost per power user (100+ tasks/day): < ₹ 3.00 INR / month.**
