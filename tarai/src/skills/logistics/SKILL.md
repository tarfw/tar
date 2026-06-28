---
name: logistics
description: How to manage shipments, routes, deliveries, and tracking
---

# Logistics Skill

## Core Concepts

### Shipment
A package being sent to a destination.
- Has destination address
- Has items
- Has status (pending, dispatched, in_transit, delivered)
- Has assigned driver

### Route
Path for delivery.
- Has multiple stops
- Has optimized order
- Has estimated time

### Driver
Person delivering shipments.
- Has current location
- Has assigned shipments
- Has availability

## Common Operations

### Create Shipment
1. action_create_shipment(destination, items)
2. Creates shipment matter
3. Sets status='pending'

### Assign Driver
1. tool_link_graph(driver, assigned_to, shipment)
2. tool_set_attr(shipment, driver=driverId)
3. action_notify(driver, channel='sms')

### Update ETA
1. tool_set_attr(shipment, eta=...)
2. action_notify(customer, template='eta-update')

### Deliver Shipment
1. action_deliver_shipment(shipmentId)
2. Advances to delivered
3. Notifies customer

### Handle Return
1. Create return matter
2. Link to original shipment
3. Update inventory
4. Process refund

## Tracking

### Status Updates
- Log every status change to motion
- Include timestamp and location
- Notify relevant parties

### Proof of Delivery
- Capture signature
- Log delivery photo
- Store in motion data

## Best Practices

### Route Optimization
- Cluster deliveries by area
- Minimize backtracking
- Consider time windows

### Exception Handling
- Failed delivery: reschedule
- Damaged item: file claim
- Wrong address: contact customer
