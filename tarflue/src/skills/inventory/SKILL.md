---
name: inventory
description: How to manage stock levels, warehouses, and reordering
---

# Inventory Skill

## Core Concepts

### Stock
Quantity of a product at a location.
- Stored in attr: key='stock-{location}', num=quantity
- Indexed for fast queries
- Tracked per product per location

### Warehouse
Physical storage location.
- Has address
- Has capacity
- Has products

### Reorder Point
Minimum stock level that triggers restocking.
- Stored in attr: key='reorder_point', num=N
- Checked periodically

## Common Operations

### Check Stock
1. tool_set_attr(matterId, key='stock-{location}')
2. Query: attr WHERE key LIKE 'stock-%'

### Update Stock
1. tool_set_attr(matterId, key='stock-{location}', num=newQty)
2. Append motion with delta

### Transfer Stock
1. Decrease source: tool_set_attr(stock-source, num=-qty)
2. Increase destination: tool_set_attr(stock-dest, num=+qty)
3. Log transfer to motion

### Set Reorder Point
1. tool_set_attr(matterId, key='reorder_point', num=N)

### Check Low Stock
1. Query attr WHERE key='stock-*' AND num < reorder_point
2. action_notify for each low item

## Best Practices

### Accuracy
- Count regularly
- Investigate variances
- Audit weekly

### Forecasting
- Track sales velocity
- Seasonal adjustments
- Lead time planning
