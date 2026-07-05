---
name: bookings
version: 1.0.0
module: bookings
tools: [create, read, update, delete, link]
---

# Bookings Skill

## Purpose
Manage table reservations, scheduling, reminders.

## Actions

### action_create_booking
Book a table or time slot.

Steps:
1. `create(table='matter', type='booking', title='{service} for {customer}', value={amount}, data:{date:{date}, time:{time}, party_size:{size}, customer:{name}, phone:{phone}}, scope='{scope}')`
2. `create(table='motion', type='booking', data:{bookingId:{id}, status:'confirmed', date:{date}, time:{time}})`

### action_cancel_booking
Cancel a reservation.

Steps:
1. `update(table='matter', id='{bookingId}', active=0)`
2. `create(table='motion', type='booking', data:{bookingId:{id}, status:'cancelled'})`

### action_reschedule_booking
Move booking to new date/time.

Steps:
1. `update(table='matter', id='{bookingId}', data:{...currentData, date:{newDate}, time:{newTime}})`
2. `create(table='motion', type='booking', data:{bookingId:{id}, status:'rescheduled', date:{newDate}, time:{newTime}})`

## Intent Matching

| User says | Action |
|---|---|
| book / reserve / table for | action_create_booking |
| cancel reservation | action_cancel_booking |
| reschedule / move booking | action_reschedule_booking |
