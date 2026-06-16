# Taxi Order Flow — End to End

How a taxi/ride-hailing order works in TAR, from passenger booking to drop-off.

---

## Overview

```
┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
│ Passenger │───▶│   KV      │───▶│  Order    │───▶│   R2      │
│   (App)   │    │ (drivers) │    │   DO      │    │ (archive) │
└───────────┘    └───────────┘    └───────────┘    └───────────┘
```

---

## Step 1: Passenger Opens App

### What happens

```
Passenger opens taxi screen
  → App gets GPS location
  → Sends to Worker: "Find nearby taxis"
```

### Location search

```javascript
// Passenger location
const passengerLat = 13.0827;
const passengerLng = 80.2707;

// Convert to H3 hex
const passengerHex = h3.latLngToCell(passengerLat, passengerLng, 8);
// Result: "8a2a1072b59ffff"

// Get 7 nearby hexes
const nearbyHexes = h3.gridDisk(passengerHex, 1);
// Result: ["8a2a1072b59ffff", "8a2a1072b5a7fff", ...]

// Read from KV (parallel)
const results = await Promise.all(
  nearbyHexes.map(hex => KV.get(`geo:${hex}`))
);

// Filter free drivers
const freeDrivers = results
  .filter(data => data !== null)
  .flatMap(data => Object.entries(data))
  .filter(([id, info]) => info.status === "free");

// Result: [["driver_44", { name:"Ravi", car:"Dzire", lat:13.08, ... }]]
```

### Response to passenger

```
┌─────────────────────────────────────────┐
│  Nearby Taxis                           │
├─────────────────────────────────────────┤
│  🚗 Ravi     · Maruti Dzire · 0.3 km  │
│  🚗 Suresh   · Maruti Dzire · 0.5 km  │
│  🚗 Kumar    · Maruti Dzire · 0.8 km  │
└─────────────────────────────────────────┘
```

---

## Step 2: Passenger Selects Driver

### What happens

```
Passenger taps "Book Ravi"
  → App creates Order DO (o:ride_789)
  → Order DO spawns, holds passenger + driver
```

### Data written

```sql
-- From Order DO (o:ride_789)
INSERT INTO matter (id, type, value, data)
VALUES ('ride_789', 'ride', 250, '{
  "passenger": "usr_123",
  "driver": "driver_44",
  "pickup": "Anna Nagar",
  "drop": "Airport",
  "pickup_lat": 13.0827,
  "pickup_lng": 80.2707,
  "drop_lat": 12.9977,
  "drop_lng": 80.1707
}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('ride_789', 1, 903, 903);  -- RIDE_REQ
```

### Opcode

| Action | Code | Strategy | Written To |
|--------|------|----------|------------|
| RIDE_REQ | 903 | Append | o:ride_789 |

---

## Step 3: Driver Matched

### What happens

```
Driver (Ravi) receives request
  → Taps "Accept"
  → Order DO receives DRIV_MATCH
  → Passenger sees "Ravi is coming to pick you up"
```

### Data written

```sql
-- From Order DO (o:ride_789)
UPDATE motion SET phase = 904 WHERE stream = 'ride_789';
-- DRIV_MATCH

-- Update KV: driver no longer free
KV.put('geo:8a2a1072b59ffff', {
  "driver_44": { "status": "onTrip" }
}, { expirationTtl: 30 });
```

### Real-time

```
Order DO broadcasts via WebSocket:
  → Passenger app: "Ravi accepted! ETA 4 min"
  → Driver app: "Navigate to pickup"
```

---

## Step 4: Driver En Route to Pickup

### What happens

```
Driver is moving toward passenger
  → Pings location every 5s to KV
  → Order DO receives EN_ROUTE
  → Passenger sees live map
```

### Data written

```sql
-- From Order DO (o:ride_789)
INSERT INTO motion (stream, seq, action, phase)
VALUES ('ride_789', 2, 401, 401);  -- DISPATCHED (en route)
```

### Driver location pings

```javascript
// Every 5 seconds
const driverHex = h3.latLngToCell(driverLat, driverLng, 8);
await KV.put(`geo:${driverHex}`, {
  "driver_44": { "lat": driverLat, "lng": driverLng, "status": "onTrip" }
}, { expirationTtl: 30 });
```

### ETA updates

```sql
-- Driver app sends ETA
INSERT INTO motion (stream, seq, action, phase, delta)
VALUES ('ride_789', 3, 404, 404, 4.0);  -- ETA_UPDATED (4 min)
```

---

## Step 5: Driver Arrives at Pickup

### What happens

```
Driver reaches passenger location
  → Taps "Arrived"
  → Order DO receives ARRIVED
  → Passenger sees "Ravi has arrived"
```

### Data written

```sql
-- From Order DO (o:ride_789)
UPDATE motion SET phase = 209 WHERE stream = 'ride_789';
-- TOKEN_CALLED (arrived at pickup)
```

---

## Step 6: Trip Starts

### What happens

```
Passenger gets in car
  → Driver taps "Start Trip"
  → Order DO receives IN_RIDE
  → Fare starts calculating
```

### Data written

```sql
-- From Order DO (o:ride_789)
UPDATE motion SET phase = 905 WHERE stream = 'ride_789';
-- IN_RIDE
```

### Real-time

```
Order DO broadcasts:
  → Passenger: "Trip started. Fare: ₹0"
  → Driver: "Trip in progress"
```

---

## Step 7: In Transit

### What happens

```
Driver is driving to destination
  → Pings location every 5s to KV
  → Passenger sees live map
  → ETA updates sent periodically
```

### Location pings

```javascript
// Every 5 seconds
const driverHex = h3.latLngToCell(driverLat, driverLng, 8);
await KV.put(`geo:${driverHex}`, {
  "driver_44": { "lat": driverLat, "lng": driverLng, "status": "onTrip" }
}, { expirationTtl: 30 });
```

### ETA updates

```sql
-- Every 30 seconds or on significant change
INSERT INTO motion (stream, seq, action, phase, delta)
VALUES ('ride_789', 4, 404, 404, 2.5);  -- ETA 2.5 min
```

---

## Step 8: Trip Ends

### What happens

```
Driver reaches destination
  → Taps "End Trip"
  → Order DO receives DELIVERED
  → Fare calculated
```

### Data written

```sql
-- From Order DO (o:ride_789)
UPDATE motion SET phase = 109 WHERE stream = 'ride_789';
-- DELIVERED

-- Update matter with final fare
UPDATE matter SET value = 250 WHERE id = 'ride_789';
```

### Fare calculation

```sql
-- Read trip details
SELECT value, data FROM matter WHERE id = 'ride_789';
-- value: 250 (final fare)

-- Read trip duration from motion
SELECT * FROM motion WHERE stream = 'ride_789' AND action = 905;
-- Start time from IN_RIDE phase
```

---

## Step 9: Payment

### What happens

```
Passenger pays (cash/UPI)
  → If UPI: Payment Worker processes
  → Order DO receives PAY_SUCCESS
```

### Data written

```sql
-- From Order DO (o:ride_789)
INSERT INTO motion (stream, seq, action, phase)
VALUES ('ride_789', 5, 801, 801);  -- PAY_INIT

UPDATE motion SET phase = 802 WHERE stream = 'ride_789' AND seq = 5;
-- PAY_SUCCESS
```

---

## Step 10: Rating

### What happens

```
Both passenger and driver rate each other
  → Ratings stored in Order DO
  → Used for reputation scoring
```

### Data written

```sql
-- Passenger rates driver
INSERT INTO motion (stream, seq, action, data)
VALUES ('ride_789', 6, 302, '{"from":"usr_123","rating":5}');  -- REVIEW

-- Driver rates passenger
INSERT INTO motion (stream, seq, action, data)
VALUES ('ride_789', 7, 302, '{"from":"driver_44","rating":5}');  -- REVIEW
```

---

## Step 11: Archive & Cleanup

### What happens

```
Trip complete + payment done
  → Order DO archives motion to R2/S3
  → Order DO deletes itself
  → Driver status returns to "free" in KV
```

### Archive flow

```
Order DO (o:ride_789):
  1. Export motion table → Parquet file
  2. Upload to R2: ride/ride_789.parquet
  3. DELETE FROM motion WHERE stream = 'ride_789'
  4. state.storage.deleteAll()  // DO self-destructs
```

### Driver returns to free

```javascript
// After trip ends
const driverHex = h3.latLngToCell(driverLat, driverLng, 8);
await KV.put(`geo:${driverHex}`, {
  "driver_44": { "status": "free" }
}, { expirationTtl: 30 });
```

---

## Complete Timeline

| # | Event | Opcode | Written To | Strategy |
|---|-------|--------|------------|----------|
| 1 | Ride request | 903 | o:ride_789 | Append |
| 2 | Driver matched | 904 | o:ride_789 | Phase |
| 3 | Dispatched (en route) | 401 | o:ride_789 | Append |
| 4 | ETA updates | 404 | o:ride_789 | Phase (multiple) |
| 5 | Arrived at pickup | 209 | o:ride_789 | Phase |
| 6 | Trip started | 905 | o:ride_789 | Phase |
| 7 | Trip ended | 109 | o:ride_789 | Phase |
| 8 | Payment init | 801 | o:ride_789 | Append |
| 9 | Payment success | 802 | o:ride_789 | Phase |
| 10 | Ratings | 302 | o:ride_789 | Append |
| 11 | Archive | — | R2/S3 | Export |
| 12 | Delete DO | — | — | Self-destruct |

---

## Data Flow Diagram

```
┌───────────┐
│ Passenger │
│   App     │
└─────┬─────┘
      │
      │ "Find nearby taxis"
      ▼
┌─────────────────────────────────────────────────────┐
│                    Workers KV                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ geo:8a2a1072b59ffff                         │   │
│  │   driver_44: { lat, lng, status: "free" }   │   │
│  │   driver_91: { lat, lng, status: "free" }   │   │
│  │ geo:8a2a1072b5a7fff                         │   │
│  │   driver_12: { lat, lng, status: "free" }   │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
      │
      │ "Book Ravi"
      ▼
┌─────────────────────────────────────────────────────┐
│              Order DO (o:ride_789)                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ matter  │ │ motion  │ │  bond   │               │
│  │ (ride)  │ │ (log)   │ │ (links) │               │
│  └────┬────┘ └────┬────┘ └────┬────┘               │
│       │           │           │                     │
│       └─────┬─────┘           │                     │
│             │                 │                     │
│             ▼                 ▼                     │
│  ┌─────────────────────────────────────────────┐   │
│  │           WebSocket Broadcasts               │   │
│  │  → Passenger: "Ravi is coming"               │   │
│  │  → Driver: "Navigate to pickup"              │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
      │
      │ Trip complete
      ▼
┌─────────────────────────────────────────────────────┐
│                    R2 / S3                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ ride/ride_789.parquet                       │   │
│  │   - Full motion ledger                       │   │
│  │   - Trip details                             │   │
│  │   - Ratings                                  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Cost per Ride

| Component | Cost |
|-----------|------|
| Order DO (ephemeral) | ~$0.00001 |
| KV reads (driver search) | ~$0.0000035 |
| KV writes (driver pings, 10 min ride) | ~$0.000012 |
| R2 archive | ~$0.000001 |
| **Total** | **~$0.000027** |

**~37,000 rides per cent.**

---

## Comparison: Food vs Taxi

| Aspect | Food Order | Taxi Order |
|--------|------------|------------|
| DO type | o:order_42 | o:ride_789 |
| Scope involved | s:rest_123 (storefront) | None (self-contained) |
| Stock management | Yes (s:rest_123) | No |
| Location tracking | Driver to restaurant | Driver to passenger, then to destination |
| ETA updates | Few (kitchen time) | Many (real-time driving) |
| Duration | 30-60 min | 10-30 min |
| Phases | 12 | 10 |
| Cost | ~$0.000025 | ~$0.000027 |

---

## Why This Design Works

| Problem | Solution |
|---------|----------|
| "How to find nearby drivers?" | H3 hex grid → 7 KV reads |
| "How to track driver location?" | Driver pings KV every 5s, auto-expires via TTL |
| "How to coordinate passenger + driver?" | Order DO holds WebSocket room for both |
| "How to handle payment?" | Payment Worker writes to Order DO |
| "How to store trip history?" | Order DO archives to R2, then self-destructs |
| "How to handle offline?" | Local SQLite + sync on reconnect |
