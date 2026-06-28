---
name: booking
description: How to manage reservations, appointments, and resource allocation
---

# Booking Skill

## Core Concepts

### Reservation
Booked time slot for a resource.
- Has start/end time
- Has resource
- Has customer
- Has status (booked, confirmed, cancelled)

### Resource
Bookable item (room, equipment, person).
- Has availability schedule
- Has capacity
- Has pricing

## Common Operations

### Book Slot
1. action_book_slot(resourceId, start, end, customerName)
2. Creates reservation matter
3. Sets status='booked'
4. Links to resource

### Confirm Reservation
1. action_advance_stage(targetPhase=2)
2. tool_set_attr(status='confirmed')
3. action_notify(customer, template='booking-confirmed')

### Cancel Reservation
1. action_advance_stage(targetPhase=3)
2. tool_set_attr(status='cancelled')
3. action_notify(customer, template='booking-cancelled')

### Check Availability
1. tool_list_matters(type='reservation', filters=[resource, date])
2. Check for conflicts

## Best Practices

### Scheduling
- Block buffer time between bookings
- Set cancellation policies
- Send reminders

### Resources
- Track utilization rates
- Optimize pricing by demand
- Maintain equipment
