### TAR Super Agent — Finalized Architecture + Sample Data

## Core Model

| Table      | Meaning                     |
| ---------- | --------------------------- |
| **matter** | What the thing is           |
| **mass**   | What is available right now |
| **motion** | What happened               |

---

## Shopping

### matter

```json
{
  "id": "prod_nike_airmax",
  "type": "product",
  "scope": "g",
  "title": "Nike Air Max 90"
}
```

### mass

```json
[
  {
    "id": "var_8",
    "matter": "prod_nike_airmax",
    "type": "variant",
    "qty": 12,
    "value": 5999,
    "data": { "size": "8" }
  },
  {
    "id": "var_9",
    "matter": "prod_nike_airmax",
    "type": "variant",
    "qty": 8,
    "value": 5999,
    "data": { "size": "9" }
  }
]
```

---

## Food

### matter

```json
{
  "id": "rest_biryani_hut",
  "type": "restaurant",
  "scope": "g",
  "title": "Biryani Hut"
}
```

### mass

```json
[
  {
    "id": "item_chicken",
    "matter": "rest_biryani_hut",
    "type": "item",
    "value": 180,
    "data": { "name": "Chicken Biryani" }
  },
  {
    "id": "item_mutton",
    "matter": "rest_biryani_hut",
    "type": "item",
    "value": 220,
    "data": { "name": "Mutton Biryani" }
  }
]
```

---

## Transport

### matter

```json
{
  "id": "taxi_dzire",
  "type": "transport",
  "scope": "g",
  "title": "Maruti Suzuki Dzire"
}
```

### mass

```json
[
  {
    "id": "driver_1",
    "matter": "taxi_dzire",
    "type": "unit",
    "value": 180,
    "geo": "13.0827,80.2707",
    "data": {
      "driver": "Ravi",
      "eta": 4
    }
  },
  {
    "id": "driver_2",
    "matter": "taxi_dzire",
    "type": "unit",
    "value": 200,
    "geo": "13.0700,80.2500",
    "data": {
      "driver": "Suresh",
      "eta": 6
    }
  }
]
```

---

## Tickets

### matter

```json
{
  "id": "movie_kgf3",
  "type": "event",
  "scope": "g",
  "title": "KGF Chapter 3"
}
```

### mass

```json
[
  {
    "id": "gold",
    "matter": "movie_kgf3",
    "type": "seat",
    "qty": 50,
    "value": 250
  },
  {
    "id": "silver",
    "matter": "movie_kgf3",
    "type": "seat",
    "qty": 120,
    "value": 180
  }
]
```

---

## Hotels

### matter

```json
{
  "id": "hotel_taj",
  "type": "hotel",
  "scope": "g",
  "title": "Taj Coromandel"
}
```

### mass

```json
[
  {
    "id": "deluxe",
    "matter": "hotel_taj",
    "type": "room",
    "qty": 12,
    "value": 12000
  },
  {
    "id": "suite",
    "matter": "hotel_taj",
    "type": "room",
    "qty": 4,
    "value": 22000
  }
]
```

---

## Services

### matter

```json
{
  "id": "svc_clean",
  "type": "service",
  "scope": "g",
  "title": "SparkClean"
}
```

### mass

```json
[
  {
    "id": "slot_9am",
    "matter": "svc_clean",
    "type": "slot",
    "start": "2026-06-12T09:00:00Z",
    "end": "2026-06-12T11:00:00Z",
    "value": 799
  },
  {
    "id": "slot_2pm",
    "matter": "svc_clean",
    "type": "slot",
    "start": "2026-06-12T14:00:00Z",
    "end": "2026-06-12T16:00:00Z",
    "value": 799
  }
]
```

---

## User Booking Flow

```text
Search
   ↓
Vector Search (global.db)
   ↓
Matter Results
   ↓
Select Matter
   ↓
Load Mass
   ↓
Select Mass
   ↓
Create Motion
   ↓
Order / Booking
```

---

## motion Example

```json
{
  "id": "motion_001",
  "opcode": "BOOK",
  "matter": "taxi_dzire",
  "mass": "driver_1",
  "scope": "c:user123",
  "payload": {
    "pickup": "Anna Nagar",
    "drop": "Airport"
  }
}
```

### Final Rule

```text
matter = What exists
mass   = What is available
motion = What happened
```

This single model works for:

- 🛒 Shopping
- 🍔 Food
- 🚕 Transport
- 🎫 Tickets
- 🏨 Hotels
- 🏠 Services

without creating separate booking/order/taxi/hotel schemas.
