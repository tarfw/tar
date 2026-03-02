# The Universal Schema

Unified architecture hosted on a single Turso database instance.

All tables (`state`, `instance`, `trace`) reside within the same database environment, providing a consistent data layer for both public and private state management.

---

## 1. Table Relationships

| From       | To         | Relationship                                        |
| :--------- | :--------- | :-------------------------------------------------- |
| `state`    | `instance` | A state has many instances (stock, price, location) |
| `state`    | `trace`    | A state undergoes many traces (private DB only)     |
| `instance` | `trace`    | A trace can reference a specific instance           |

---

## 2. Table: `state`

Permanent entities: products, collections, services, users, actors, locations.

```sql
CREATE TABLE state (
    id TEXT PRIMARY KEY,
    ucode TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    payload TEXT,
    embedding BLOB,
    scope TEXT,
    author TEXT,
    ts TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

| Column      | Type        | Key | Description                            |
| :---------- | :---------- | :-- | :------------------------------------- |
| `id`        | TEXT        | PK  | Unique ID                              |
| `ucode`     | TEXT        | UQ  | Unique code identifier                 |
| `type`      | TEXT        |     | Categorization type                    |
| `title`     | TEXT        |     | Human-readable name                    |
| `payload`   | TEXT        |     | JSON for all dynamic/custom attributes |
| `embedding` | BLOB        |     | Vector embedding for semantic search   |
| `scope`     | TEXT        |     | Scope/Tenant identifier                |
| `author`    | TEXT        |     | Author/Creator identifier              |
| `ts`        | TIMESTAMPTZ |     | Creation timestamp                     |

---

## 3. Table: `instance`

Dynamic state cache. Handles stock, pricing, live GPS, availability, etc.

```sql
CREATE TABLE instance (
    id TEXT PRIMARY KEY,
    stateid TEXT NOT NULL,
    scope TEXT,
    metadata TEXT,
    qty REAL,
    value REAL,
    currency TEXT,
    available INTEGER,
    lat REAL,
    lng REAL,
    h3 TEXT,
    startts TIMESTAMPTZ,
    endts TIMESTAMPTZ,
    ts TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    payload TEXT,
    FOREIGN KEY (stateid) REFERENCES state(id)
);
```

| Column      | Type        | Key | Description               |
| :---------- | :---------- | :-- | :------------------------ |
| `id`        | TEXT        | PK  | Unique ID                 |
| `stateid`   | TEXT        | FK  | Associated state ID       |
| `scope`     | TEXT        |     | Scope/Tenant identifier   |
| `metadata`  | TEXT        |     | Metadata                  |
| `qty`       | REAL        |     | Quantity / Stock count    |
| `value`     | REAL        |     | Price value               |
| `currency`  | TEXT        |     | Currency code (e.g. USD)  |
| `available` | INTEGER     |     | Availability status       |
| `lat`       | REAL        |     | Live GPS latitude         |
| `lng`       | REAL        |     | Live GPS longitude        |
| `h3`        | TEXT        |     | H3 spatial index          |
| `startts`   | TIMESTAMPTZ |     | Validity start timestamp  |
| `endts`     | TIMESTAMPTZ |     | Validity end timestamp    |
| `ts`        | TIMESTAMPTZ |     | Update timestamp          |
| `payload`   | TEXT        |     | JSON for extra attributes |

---

## 4. Table: `trace`

The universal event-sourced ledger. Immutable, append-only.

```sql
CREATE TABLE trace (
    id TEXT PRIMARY KEY,
    streamid TEXT NOT NULL,
    opcode INTEGER NOT NULL,
    delta REAL,
    lat REAL,
    lng REAL,
    payload TEXT,
    ts TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    scope TEXT
);
```

| Column     | Type        | Key | Description                                 |
| :--------- | :---------- | :-- | :------------------------------------------ |
| `id`       | TEXT        | PK  | Unique trace ID                             |
| `streamid` | TEXT        |     | Which business stream this trace belongs to |
| `opcode`   | INTEGER     |     | Defines exactly what happened               |
| `delta`    | REAL        |     | Quantitative change                         |
| `lat`      | REAL        |     | Location latitude                           |
| `lng`      | REAL        |     | Location longitude                          |
| `payload`  | TEXT        |     | JSON parameters specific to this trace      |
| `ts`       | TIMESTAMPTZ |     | Trace timestamp                             |
| `scope`    | TEXT        |     | Scope/Tenant identifier                     |

---

## 5. The Universal Opcode Map

Integer-based opcodes for blindingly fast `trace` indexing.

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
