---
type: Business
title: Business profile
description: Basic info about this workspace — name, type, hours, location, UPI ID.
resource: docs://workspace/business/profile
tags: [business, profile, workspace]
timestamp: 2026-07-04T00:00:00Z
---

# Business profile

Fill this in when workspace is created.

## Fields

| Field | Example | Notes |
|---|---|---|
| `name` | "Ravanan's Restaurant" | Display name |
| `type` | "restaurant" | Business vertical |
| `phone` | "+919876543210" | Primary contact |
| `email` | "ravanan@example.com" | Business email |
| `address` | "123 Anna Nagar, Chennai" | Physical location |
| `hours` | "10:00-22:00" | Operating hours |
| `upi_id` | "ravanan@upi" | UPI payment ID |
| `timezone` | "Asia/Kolkata" | Timezone |

## Example

```json
{
  "name": "Ravanan's Restaurant",
  "type": "restaurant",
  "phone": "+919876543210",
  "address": "123 Anna Nagar, Chennai",
  "hours": "10:00-22:00",
  "upi_id": "ravanan@upi",
  "timezone": "Asia/Kolkata"
}
```

## Related

- [Team](/business/team.md) — who works here
- [Channels](/business/channels.md) — how people reach this workspace
