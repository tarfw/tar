---
name: logistics
description: How to manage deliveries, drivers, shipments, and route tracking
---

# Logistics Skill

## Core Concepts

### Delivery
A delivery order stored as `matter` with `type='delivery'`.
- `data` = `{ orderId, pickup, drop, driver, status, eta }`

### Driver
A driver profile stored as `matter` with `type='driver'`.
- `data` = `{ phone, vehicle, rating, available }`

## Common Operations (6-Tool Pattern)

### Create Delivery
1. `create(table='matter', type='delivery', title='Delivery #{id}', data:{orderId, pickup, drop, status:'pending'}, scope='{scope}')`
2. `link(src='{orderId}', rel='has_delivery', tgt='{deliveryId}')`
3. `create(table='motion', stream:'{deliveryId}', action=99993, data:{event:'delivery_created'}, scope='{scope}')`

### Assign Driver
1. `read(table='matter', id='{deliveryId}')` — get current data
2. `update(table='matter', id='{deliveryId}', patch:{data:{...currentData, driver: driverId, status:'assigned'}})`
3. `link(src='{driverId}', rel='driving', tgt='{deliveryId}')`
4. `create(table='motion', stream:'{deliveryId}', action=99993, data:{event:'driver_assigned'}, scope='{scope}')`

### Mark Delivered
1. `read(table='matter', id='{deliveryId}')` — get current data
2. `update(table='matter', id='{deliveryId}', patch:{data:{...currentData, status:'delivered'}})`
3. `create(table='motion', stream:'{deliveryId}', action=99993, data:{event:'delivery_completed'}, scope='{scope}')`

### List Pending Deliveries
1. `read(table='matter', type='delivery', scope='{scope}', filters:[{key:'status', val:'pending'}])`

### List Driver's Deliveries
1. `search(query='{driverName}', scope='{scope}')`

## Status Flow

1. pending → assigned → picked_up → in_transit → delivered

## Best Practices

- Link deliveries to orders via `graph(rel='has_delivery')`
- Link drivers to deliveries via `graph(rel='driving')`
- Store pickup/drop addresses in `data` JSON
- Log status changes to motion table
