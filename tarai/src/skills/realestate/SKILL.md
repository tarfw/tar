---
name: realestate
description: How to manage property listings, showings, and offers
---

# Real Estate Skill

## Core Concepts

### Property
Real estate listing.
- Has address, type, size
- Has price
- Has status (available, under_contract, sold)
- Has features

### Showing
Property viewing appointment.
- Has scheduled date/time
- Has agent and client
- Has feedback

### Offer
Purchase proposal.
- Has offer price
- Has conditions
- Has status (pending, accepted, rejected)

## Common Operations

### List Property
1. tool_create_matter(type='property', title, data={address, type, size, price})
2. tool_set_attr(status='available')
3. action_embed(text=property description)

### Schedule Showing
1. action_book_slot(resourceId=propertyId, start, end)
2. Links agent and client

### Make Offer
1. tool_create_matter(type='offer', value=offerPrice)
2. tool_link_graph(client, made_offer, property)
3. action_notify(seller, template='new-offer')

### Accept Offer
1. action_advance_stage(targetPhase=2)
2. tool_set_attr(status='under_contract')
3. action_notify(buyer, template='offer-accepted')

## Best Practices

### Listings
- Quality photos
- Detailed descriptions
- Accurate pricing

### Showings
- Confirm 24h before
- Collect feedback
- Follow up within 24h
