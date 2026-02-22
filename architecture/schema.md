# The Universal Schema

Unified architecture across Public and Private instances.

- **Public DB:** `nodes`, `points`
- **Private DB:** `nodes`, `points`, `events`

---

## 1. Table Relationships

| From     | To       | Relationship                                    |
| :------- | :------- | :---------------------------------------------- |
| `nodes`  | `points` | A node has many points (stock, price, location) |
| `nodes`  | `events` | A node undergoes many events (private DB only)  |
| `points` | `events` | An event can reference a specific point         |

---

## 2. Table: `nodes`

Present in both **Public** and **Private** DB.
Permanent entities: products, collections, services, users, actors, locations.

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  workspaceId TEXT,
  parentId TEXT,
  nodeType TEXT,
  title TEXT,
  embedding BLOB,
  createdAt TEXT,
  payload TEXT
);
```

| Column        | Type | Key | Description                            |
| :------------ | :--- | :-- | :------------------------------------- |
| `id`          | TEXT | PK  | Unique ID                              |
| `workspaceId` | TEXT |     | Workspace (tenant) identifier          |
| `parentId`    | TEXT |     | Hierarchical links                     |
| `nodeType`    | TEXT |     | Categorization type                    |
| `title`       | TEXT |     | Human-readable name                    |
| `embedding`   | BLOB |     | Vector embedding for semantic search   |
| `createdAt`   | TEXT |     | Creation timestamp                     |
| `payload`     | TEXT |     | JSON for all dynamic/custom attributes |

---

## 3. Table: `points`

Present in both **Public** and **Private** DB.
Dynamic state cache. Handles stock, pricing, live GPS, availability, etc.

```sql
CREATE TABLE points (
  id TEXT PRIMARY KEY,
  nodeId TEXT,
  workspaceId TEXT,
  qty INTEGER,
  price REAL,
  currency TEXT,
  availability TEXT,
  locationText TEXT,
  lat REAL,
  lng REAL,
  openNow BOOLEAN,
  validFrom TEXT,
  validTo TEXT,
  payload TEXT
);
```

| Column         | Type    | Key | Description                   |
| :------------- | :------ | :-- | :---------------------------- |
| `id`           | TEXT    | PK  | Unique ID                     |
| `nodeId`       | TEXT    |     | Associated node ID            |
| `workspaceId`  | TEXT    |     | Workspace (tenant) identifier |
| `qty`          | INTEGER |     | Quantity / Stock count        |
| `price`        | REAL    |     | Price value                   |
| `currency`     | TEXT    |     | Currency code (e.g. USD)      |
| `availability` | TEXT    |     | Availability summary          |
| `locationText` | TEXT    |     | Human-readable location       |
| `lat`          | REAL    |     | Live GPS latitude             |
| `lng`          | REAL    |     | Live GPS longitude            |
| `openNow`      | BOOLEAN |     | True if currently open/active |
| `validFrom`    | TEXT    |     | Validity start timestamp      |
| `validTo`      | TEXT    |     | Validity end timestamp        |
| `payload`      | TEXT    |     | JSON for extra attributes     |

---

## 4. Table: `events`

Present in **Private DB** only.
The universal event-sourced ledger. Immutable, append-only.

```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  streamId TEXT,
  opcode INTEGER,
  nodeId TEXT,
  pointId TEXT,
  delta REAL,
  payload TEXT,
  ts TIMESTAMPTZ
);
```

| Column     | Type        | Key | Description                                 |
| :--------- | :---------- | :-- | :------------------------------------------ |
| `id`       | TEXT        | PK  | Unique event ID                             |
| `streamId` | TEXT        |     | Which business stream this event belongs to |
| `opcode`   | INTEGER     |     | Defines exactly what happened               |
| `nodeId`   | TEXT        |     | Target node affected                        |
| `pointId`  | TEXT        |     | Target point affected                       |
| `delta`    | REAL        |     | Quantitative change                         |
| `payload`  | TEXT        |     | JSON parameters specific to this event      |
| `ts`       | TIMESTAMPTZ |     | Event timestamp                             |

---

## 5. The Universal Opcode Map

Integer-based opcodes for blindingly fast `events` indexing.

### Opcode Categories

| Range | Category                        |
| :---- | :------------------------------ |
| 1xx   | 🧱 Stock                        |
| 2xx   | 🧾 Invoice / Billing            |
| 3xx   | 🧑‍💼 Tasks / Workflow             |
| 4xx   | 💰 Accounts / Ledger            |
| 5xx   | 🚚 Orders / Delivery            |
| 6xx   | 🚕 Transport / Booking / Rental |
| 7xx   | 🏛 Tax / Government             |
| 8xx   | 🧠 Memory / AI                  |
| 9xx   | 🔐 Identity / ACL               |

### Full Opcode Reference

**🧱 Stock (1xx)**
| Code | Name | Description |
| ---: | :--- | :--- |
| 101 | STOCKIN | Stock In |
| 102 | SALEOUT | Sale Out |
| 103 | SALERETURN | Sale Return |
| 104 | STOCKADJUST | Stock Adjust |
| 105 | STOCKTRANSFEROUT | Stock Transfer Out |
| 106 | STOCKTRANSFERIN | Stock Transfer In |
| 107 | STOCKVOID | Stock Void |

**🧾 Invoice / Billing (2xx)**
| Code | Name | Description |
| ---: | :--- | :--- |
| 201 | INVOICECREATE | Invoice Create |
| 202 | INVOICEITEMADD | Invoice Item Add |
| 203 | INVOICEPAYMENT | Invoice Payment |
| 204 | INVOICEPAYMENTFAIL | Invoice Payment Fail |
| 205 | INVOICEVOID | Invoice Void |
| 206 | INVOICEITEMDEFINE | Invoice Item Define |
| 207 | INVOICEREFUND | Invoice Refund |

**🧑‍💼 Tasks / Workflow (3xx)**
| Code | Name | Description |
| ---: | :--- | :--- |
| 301 | TASKCREATE | Task Create |
| 302 | TASKASSIGN | Task Assign |
| 303 | TASKSTART | Task Start |
| 304 | TASKPROGRESS | Task Progress |
| 305 | TASKDONE | Task Done |
| 306 | TASKFAIL | Task Fail |
| 307 | TASKBLOCK | Task Block |
| 308 | TASKRESUME | Task Resume |
| 309 | TASKVOID | Task Void |
| 310 | TASKLINK | Task Link |
| 311 | TASKCOMMENT | Task Comment |

**💰 Accounts / Ledger (4xx)**
| Code | Name | Description |
| ---: | :--- | :--- |
| 401 | ACCOUNTPAYIN | Account Pay In |
| 402 | ACCOUNTPAYOUT | Account Pay Out |
| 403 | ACCOUNTREFUND | Account Refund |
| 404 | ACCOUNTADJUST | Account Adjust |

**🚚 Orders / Delivery (5xx)**
| Code | Name | Description |
| ---: | :--- | :--- |
| 501 | ORDERCREATE | Order Create |
| 502 | ORDERSHIP | Order Ship |
| 503 | ORDERDELIVER | Order Deliver |
| 504 | ORDERCANCEL | Order Cancel |

**🚕 Transport / Booking / Rental (6xx)**
| Code | Name | Description |
| ---: | :--- | :--- |
| 601 | RIDECREATE | Ride Create |
| 602 | RIDESTART | Ride Start |
| 603 | RIDEDONE | Ride Done |
| 604 | RIDECANCEL | Ride Cancel |
| 605 | MOTION | Driver or asset live location ping |
| 611 | BOOKINGCREATE | Booking Create |
| 612 | BOOKINGDONE | Booking Done |
| 621 | RENTALSTART | Rental Start |
| 622 | RENTALEND | Rental End |

**🏛 Tax / Government (7xx)**
| Code | Name | Description |
| ---: | :--- | :--- |
| 701 | GSTVATACCRUE | GST/VAT Accrue |
| 702 | GSTVATPAY | GST/VAT Pay |
| 703 | GSTVATREFUND | GST/VAT Refund |

**🧠 Memory / AI (8xx)**
| Code | Name | Description |
| ---: | :--- | :--- |
| 801 | MEMORYDEFINE | Memory Define |
| 802 | MEMORYWRITE | Memory Write |
| 803 | MEMORYUPDATE | Memory Update |
| 804 | MEMORYSNAPSHOT | Memory Snapshot |

**🔐 Identity / ACL (9xx)**
| Code | Name | Description |
| ---: | :--- | :--- |
| 901 | USERCREATE | User Create |
| 902 | USERROLEGRANT | User Role Grant |
| 903 | USERAUTH | User Auth |
| 904 | USERDISABLE | User Disable |
