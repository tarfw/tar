# 📇 CRM User Guide & Documentation

Welcome to the **Contact-First CRM**. Designed for maximum clarity and speed, our CRM eliminates complex lead conversion steps and operates like Pipedrive—simple, uncluttered, and efficient.

---

## 🏛️ Architecture & Relationship Hierarchy

**Yes! One Contact can have MULTIPLE Deals over time** (1-to-Many Relationship).

```
                            ┌─────────────────────────────────┐
                            │    Contact / Person Detail      │
                            │      (e.g., Rae 2 / Contact)    │
                            └────────────────┬────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             ┌───────────────────┐                       ┌───────────────────┐
             │ Deal 1 ($12,000)  │                       │  Deal 2 ($5,000)  │
             │ Stage: Demo       │                       │ Stage: Negotiating│
             └─────────┬─────────┘                       └─────────┬─────────┘
                       │                                           │
                       ▼                                           ▼
             [Opens Deal 1 Modal]                        [Opens Deal 2 Modal]
```

---

## 📱 Navigation & Screen Flow (As shown in Screenshot)

1. **Directory Screen**:
   - You tap on a **Contact** (e.g. `Rae 2`).
2. **Contact Details Screen** *(Your Screenshot)*:
   - Displays Contact profile (Name, Phone, Email, Role).
   - Contains a **Deals Section** listing **all active & past deals** linked to this specific contact (`graph(src=deal_id, rel='customer', tgt=contact_id)`).
   - Has a **`+ Add Deal`** button to quickly open a new deal for this person.
3. **Deal Details Screen**:
   - Tapping any deal in the contact's deal list opens the **Deal Details Modal**.
   - Here you can update deal value, change pipeline stage, log call notes, or complete the deal!

---

## 🔑 The 3 Core Entities

| Entity | System Type | ID Prefix | Description | Example Attributes |
| :--- | :--- | :--- | :--- | :--- |
| **People** | `customer` | `cus...` | Individual contacts, customers, or prospects. | Name, Phone, Email, Role |
| **Companies** | `company` | `com...` | Businesses or organizational accounts. | Industry, Revenue, Website, Employees |
| **Deals** | `deal` | `dea...` | Sales opportunities linked to contacts/companies. | Stage, Deal Value, Close Date |

---

## 🚀 How It Works (Contact-First Workflow)

### 1️⃣ Step 1: Add a Contact (Person or Company)
When you meet a prospect, receive an inquiry, or partner with a business, create them directly as a **Contact** or **Company**.
- **Action**: `action_add_contact` / `action_add_company`
- *No "Lead" stage required—everyone is stored cleanly in your address book.*

### 2️⃣ Step 2: Open a Deal Under a Contact
When a business opportunity arises:
- **Action**: `action_add_deal`
- Select or tag the existing **Contact** or **Company**.
- **Blank Title & Value**: Opened clean (`Title = ""`, `Value = ""`) so you can fill in details without deleting pre-filled placeholders.
- **Flexible Stage Picker**: By default, new deals start at **`New Inquiry`**, but you can pick any stage at creation time.

#### 💡 Real-World Use Cases for Selecting Stage at Creation Time:
1. **Off-Platform Deals / Pre-Existing Conversations**: You already sent a quote/proposal via WhatsApp or Phone before logging it. Select **`Proposal`** directly during creation.
2. **Fast-Track / Inbound Closures**: A client calls ready to close immediately. Select **`Negotiation`** or **`Closed Won`** in a single step to skip preliminary stages.
3. **Batch Logging / Migration**: When logging historical deals from the week, pick each deal's current stage (e.g. *Qualified*, *Closed Won*) directly during creation.

### 3️⃣ Step 3: Advance the Pipeline & Log Activities
Track progress visually on your Kanban status board or from the Contact Details screen:
- Move deals between stages (`action_update_deal_stage`).
- Log calls, meetings, or notes (`action_log_activity`).

---

## 🎯 Vertical Pipeline Examples

Our pipeline automatically adapts its stages to your business vertical:

| Vertical | Pipeline Stages |
| :--- | :--- |
| **Solar & Contracting** | Inquiry ➔ Site Audit ➔ Design & Quote ➔ Contract Signed ➔ Installed 🎉 |
| **Real Estate** | New Prospect ➔ Property Tour ➔ Offer Made ➔ Agreement Sent ➔ Closed Deal 🎉 |
| **Salon / Clinic** | Slot Requested ➔ Consultation ➔ Service Delivered ➔ Paid & Complete 🎉 |
| **SaaS / B2B Agency** | Discovery Call ➔ Demo ➔ Proposal ➔ Negotiation ➔ Closed Won 🎉 |

---

## 💾 Technical Storage & DB Rules

```
+-------------------------------------------------------------------------------+
| 1. matter     -> Primary SQLite row (status, basic fields, numeric value)      |
| 2. motion     -> Historical event log (stage updates, logged activities)      |
| 3. graph      -> Direct relationship links (src=deal_id, rel=customer, tgt=cus_id)|
| 4. S3 Payload -> Rich attachments, contract PDFs, extended notes             |
+-------------------------------------------------------------------------------+
```

- **Clean Status Ownership**: Entity state lives in `matter.status` (`active`, `completed`, `cancelled`, `archived`).
- **No Duplication**: Relationships are linked via `graph` (`graph.rel = 'customer'`) rather than duplicating customer data inside deal records.
- **Fast Card Views**: Fast listing via flat primitives in SQLite; full rich notes lazy-load from S3 when viewing deal details.
