---
name: realestate
description: How to manage property listings, inquiries, showings, and offers
---

# Real Estate Skill

## Core Concepts

### Listing
A property listing stored as `matter` with `type='listing'`.
- `data` = `{ address, price, type, bedrooms, area, description }`

### Inquiry
A buyer inquiry stored as `matter` with `type='inquiry'`.
- `data` = `{ listingId, buyerName, phone, budget, notes }`

## Common Operations (6-Tool Pattern)

### Create Listing
1. `create(table='matter', type='listing', title='{address}', value={price}, data:{address, price, type, bedrooms, area, description}, scope='{scope}')`
2. `create(table='motion', stream:'{listingId}', action:99993, data:{event:'listing_created'}, scope='{scope}')`

### Record Inquiry
1. `create(table='matter', type='inquiry', title='Inquiry: {buyerName}', data:{listingId, buyerName, phone, budget, notes}, scope='{scope}')`
2. `link(src='{buyerId}', rel='interested_in', tgt='{listingId}')`
3. `create(table='motion', stream:'{listingId}', action:99993, data:{event:'inquiry_received', buyerName}, scope='{scope}')`

### Schedule Showing
1. `create(table='matter', type='showing', title='Showing: {listingAddress}', data:{listingId, buyerId, date, time, status:'scheduled'}, scope='{scope}')`
2. `create(table='motion', stream:'{listingId}', action:99993, data:{event:'showing_scheduled'}, scope='{scope}')`

### Mark Sold
1. `read(table='matter', id='{listingId}')` — get current data
2. `update(table='matter', id='{listingId}', patch:{data:{...currentData, status:'sold'}})`
3. `create(table='motion', stream:'{listingId}', action:99993, data:{event:'listing_sold'}, scope='{scope}')`

### List Properties
1. `read(table='matter', type='listing', scope='{scope}')`

### Search Properties
1. `search(query='{location}', scope='{scope}')`

## Best Practices

- Store property details in `data` JSON
- Link buyers to listings via `graph(rel='interested_in')`
- Log showings and offers to motion
- Use `data.status`: available, under_offer, sold
