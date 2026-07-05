---
name: booking
description: How to manage appointments, reservations, slots, and scheduling
---

# Booking Skill

## Core Concepts

### Booking
An appointment stored as `matter` with `type='booking'`.
- `title` = service name
- `data` = `{ date, time, customer, phone, status, notes }`

### Resource
A bookable resource (room, chair, table) stored as `matter` with `type='resource'`.
- `data` = `{ capacity, amenities }`

## Common Operations (6-Tool Pattern)

### Create Booking
1. `create(table='matter', type='booking', title='{service}', data:{date, time, customer, phone, status:'confirmed'}, scope='{scope}')`
2. `link(src='{customerId}', rel='booked', tgt='{bookingId}')`
3. `create(table='motion', stream:'{bookingId}', action=99993, data:{event:'booking_created', service, date, time}, scope='{scope}')`

### Cancel Booking
1. `read(table='matter', id='{bookingId}')` — get current data
2. `update(table='matter', id='{bookingId}', patch:{data:{...currentData, status:'cancelled'}})`
3. `create(table='motion', stream:'{bookingId}', action=99993, data:{event:'booking_cancelled'}, scope='{scope}')`

### Reschedule Booking
1. `read(table='matter', id='{bookingId}')` — get current data
2. `update(table='matter', id='{bookingId}', patch:{data:{...currentData, date: newDate, time: newTime, status:'rescheduled'}})`
3. `create(table='motion', stream:'{bookingId}', action=99993, data:{event:'booking_rescheduled'}, scope='{scope}')`

### List Bookings for Date
1. `read(table='matter', type='booking', scope='{scope}', filters:[{key:'date', val:'{date}'}])`

### Check Availability
1. `read(table='matter', type='booking', scope='{scope}', filters:[{key:'date', val:'{date}'}, {key:'time', val:'{time}'}])`
2. If no results → slot is available

### List Today's Bookings
1. `read(table='matter', type='booking', scope='{scope}', limit:50)`

## Best Practices

- Store date/time in `data` JSON for filtering
- Link bookings to customers via `graph(rel='booked')`
- Check availability before confirming
- Use `status` field: confirmed, cancelled, completed, no-show
