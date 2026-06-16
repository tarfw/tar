# Marketing & Campaigns Flow — End to End

How push notifications, SMS, referrals, and forms work in TAR.

---

## Overview

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Merchant │───▶│ Campaign │───▶│  Push/SMS │───▶│ Customer │
│  (App)   │    │   (DO)   │    │  (Worker) │    │  (App)   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Part A: Push Notifications

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Push Notification Flow                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Merchant │───▶│  Worker  │───▶│   FCM    │              │
│  │  (App)   │    │ /push    │    │ (Google) │              │
│  └──────────┘    └──────────┘    └────┬─────┘              │
│                                       │                     │
│                                       ▼                     │
│                                ┌──────────┐                │
│                                │ Customer │                │
│                                │   Phone  │                │
│                                └──────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 1: Create Push Campaign

```sql
-- From Storefront DO (s:store_101)
INSERT INTO matter (id, type, data)
VALUES ('campaign_push_001', 'campaign', '{
  "name": "Summer Sale",
  "type": "push",
  "title": "🔥 50% Off Sneakers!",
  "body": "Limited time offer. Shop now!",
  "image": "https://...",
  "deep_link": "/store/101/product/sneakers",
  "target": {
    "type": "segment",
    "criteria": {"last_purchase_days": 30}
  },
  "schedule": "2026-06-20T10:00:00Z"
}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('campaign_push_001', 1, 601, 601);  -- PUSH_SENT (scheduled)
```

### Step 2: Worker Sends Push

```javascript
// Worker /api/push
export async function handlePush(request, env) {
  const campaign = await request.json();
  
  // Get target users from Storefront DO
  const storeDO = await env.SYNC_DO.get(env.SYNC_DO.idFromName(campaign.scope));
  const users = await storeDO.fetch('/users/segment', {
    method: 'POST',
    body: JSON.stringify(campaign.target.criteria)
  });
  
  // Send via FCM
  const results = await Promise.all(users.map(user => 
    fetch('https://fcm.googleapis.com/v1/projects/my-project/messages:send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          token: user.fcm_token,
          notification: {
            title: campaign.title,
            body: campaign.body,
            image: campaign.image
          },
          data: {
            deep_link: campaign.deep_link
          }
        }
      })
    })
  ));
  
  // Log results to Storefront DO
  await storeDO.fetch('/motion', {
    method: 'POST',
    body: JSON.stringify({
      stream: campaign.id,
      action: 601,
      data: { sent: results.length, timestamp: Date.now() }
    })
  });
}
```

### Step 3: Track Delivery

```sql
-- From Storefront DO (s:store_101)
INSERT INTO motion (stream, seq, action, data)
VALUES ('campaign_push_001', 2, 601, '{
  "delivered": 8500,
  "opened": 3200,
  "clicked": 890,
  "timestamp": "2026-06-20T10:05:00Z"
}');
-- PUSH_SENT (delivery report)
```

---

## Part B: SMS Campaigns

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SMS Campaign Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Merchant │───▶│  Worker  │───▶│ Twilio / │              │
│  │  (App)   │    │ /sms     │    │ MSG91    │              │
│  └──────────┘    └──────────┘    └────┬─────┘              │
│                                       │                     │
│                                       ▼                     │
│                                ┌──────────┐                │
│                                │ Customer │                │
│                                │  Phone   │                │
│                                └──────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 4: Create SMS Campaign

```sql
-- From Storefront DO (s:store_101)
INSERT INTO matter (id, type, data)
VALUES ('campaign_sms_001', 'campaign', '{
  "name": "Flash Sale Alert",
  "type": "sms",
  "message": "TAR Store: 30% off all items today! Use code FLASH30. Shop: tarai.space/store/101",
  "target": {
    "type": "segment",
    "criteria": {"phone_verified": true}
  },
  "schedule": "2026-06-20T09:00:00Z"
}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('campaign_sms_001', 1, 602, 602);  -- SMS_SENT (scheduled)
```

### Step 5: Worker Sends SMS

```javascript
// Worker /api/sms
export async function handleSMS(request, env) {
  const campaign = await request.json();
  
  // Get target users
  const storeDO = await env.SYNC_DO.get(env.SYNC_DO.idFromName(campaign.scope));
  const users = await storeDO.fetch('/users/segment', {
    method: 'POST',
    body: JSON.stringify(campaign.target.criteria)
  });
  
  // Send via Twilio/MSG91
  const results = await Promise.all(users.map(user => 
    fetch('https://api.twilio.com/2010-04-01/Accounts/xxx/Messages.json', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${env.TWILIO_SID}:${env.TWILIO_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: user.phone,
        From: env.TWILIO_PHONE,
        Body: campaign.message
      })
    })
  ));
  
  // Log results
  await storeDO.fetch('/motion', {
    method: 'POST',
    body: JSON.stringify({
      stream: campaign.id,
      action: 602,
      data: { sent: results.length, timestamp: Date.now() }
    })
  });
}
```

---

## Part C: Referral Program

### Step 6: Create Referral

```sql
-- From Storefront DO (s:store_101)
INSERT INTO matter (id, type, data)
VALUES ('referral_cust_123', 'referral', '{
  "referrer": "cust_priya_123",
  "code": "PRIYA2026",
  "reward_referrer": 100,
  "reward_referred": 50,
  "max_uses": 10,
  "used_count": 0
}');
```

### Step 7: Share Referral

```sql
INSERT INTO motion (stream, seq, action, data)
VALUES ('referral_cust_123', 1, 603, '{
  "channel": "whatsapp",
  "message": "Join TAR Store and get ₹50 off! Use my code: PRIYA2026"
}');
-- REFERRAL
```

### Step 8: Referral Used

```sql
-- New customer uses referral code
INSERT INTO motion (stream, seq, action, data)
VALUES ('referral_cust_123', 2, 603, '{
  "referred": "cust_new_456",
  "reward_given": 50,
  "order": "order_789"
}');
-- REFERRAL

-- Update referral count
UPDATE matter SET data = json_set(data, '$.used_count', 1) 
WHERE id = 'referral_cust_123';
```

---

## Part D: Web Forms

### Step 9: Create Form

```sql
-- From Storefront DO (s:store_101)
INSERT INTO form (id, type, title, data)
VALUES ('form_feedback_001', 'form', 'Customer Feedback', '{
  "fields": [
    {"name": "name", "type": "text", "required": true},
    {"name": "email", "type": "email", "required": true},
    {"name": "rating", "type": "rating", "required": true},
    {"name": "feedback", "type": "textarea", "required": false}
  ],
  "submit_action": "create_lead"
}');
```

### Step 10: Submit Form

```sql
-- From Storefront DO (s:store_101)
INSERT INTO matter (id, form, type, data)
VALUES ('submission_001', 'form_feedback_001', 'form_task', '{
  "values": {
    "name": "Priya",
    "email": "priya@email.com",
    "rating": 5,
    "feedback": "Great store!"
  },
  "submitted_by": "cust_priya_123"
}');

INSERT INTO motion (stream, seq, action, data)
VALUES ('submission_001', 1, 604, '{
  "form": "form_feedback_001",
  "timestamp": "2026-06-20T14:30:00Z"
}');
-- FORM_SUBMIT
```

---

## Marketing Campaign Types

| Type | Opcode | Channel | Best For |
|------|--------|---------|----------|
| Push | 601 | FCM/APNs | Urgent offers, flash sales |
| SMS | 602 | Twilio/MSG91 | OTP, transactional, broad reach |
| Referral | 603 | WhatsApp/SMS | Viral growth |
| Form | 604 | Web/App | Surveys, feedback, lead capture |

---

## Push vs SMS Comparison

| Feature | Push Notification | SMS |
|---------|-------------------|-----|
| Cost | Free (FCM) | ₹0.20-0.50 per SMS |
| Delivery | Instant | Instant |
| Open rate | 10-15% | 95%+ |
| Rich content | Yes (images, buttons) | No (text only) |
| Requires app | Yes | No |
| Offline | Queue until online | Delivered immediately |
| Best for | Engaged users | All users |

---

## Recommended Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Marketing Funnel                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                │
│  │  Push   │───▶│   SMS   │───▶│Referral │                │
│  │ (cheap) │    │ (reach) │    │ (viral) │                │
│  └────┬────┘    └────┬────┘    └────┬────┘                │
│       │              │              │                       │
│       ▼              ▼              ▼                       │
│  ┌─────────────────────────────────────────┐               │
│  │           Conversion Tracking            │               │
│  │  - Push: deep_link → product page        │               │
│  │  - SMS: coupon code → checkout           │               │
│  │  - Referral: code → new customer         │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete Timeline

| # | Event | Opcode | Written To | Strategy |
|---|-------|--------|------------|----------|
| 1 | Push scheduled | 601 | s:store_101 | Append |
| 2 | Push delivered | 601 | s:store_101 | Append |
| 3 | SMS scheduled | 602 | s:store_101 | Append |
| 4 | SMS delivered | 602 | s:store_101 | Append |
| 5 | Referral created | 603 | s:store_101 | Append |
| 6 | Referral shared | 603 | s:store_101 | Append |
| 7 | Referral used | 603 | s:store_101 | Append |
| 8 | Form created | — | s:store_101 | form |
| 9 | Form submitted | 604 | s:store_101 | Append |
