---
name: support
description: How to manage support tickets, customer inquiries, and issue resolution
---

# Support Skill

## Core Concepts

### Ticket
A support request stored as `matter` with `type='ticket'`.
- `data` = `{ customerId, subject, description, priority, status, assignedTo }`

## Common Operations (6-Tool Pattern)

### Create Ticket
1. `create(table='matter', type='ticket', title='{subject}', data:{customerId, description, priority:'medium', status:'open'}, scope='{scope}')`
2. `link(src='{customerId}', rel='submitted', tgt='{ticketId}')`
3. `create(table='motion', stream:'{ticketId}', action=99993, data:{event:'ticket_created', subject}, scope='{scope}')`

### Assign Ticket
1. `read(table='matter', id='{ticketId}')` — get current data
2. `update(table='matter', id='{ticketId}', patch:{data:{...currentData, assignedTo: agentId, status:'assigned'}})`
3. `link(src='{agentId}', rel='handling', tgt='{ticketId}')`

### Reply to Ticket
1. `create(table='matter', type='ticket_reply', title='Re: {subject}', data:{ticketId, message, repliedBy}, scope='{scope}')`
2. `link(src='{ticketId}', rel='has_reply', tgt='{replyId}')`
3. `create(table='motion', stream:'{ticketId}', action:99993, data:{event:'ticket_replied'}, scope='{scope}')`

### Resolve Ticket
1. `read(table='matter', id='{ticketId}')` — get current data
2. `update(table='matter', id='{ticketId}', patch:{data:{...currentData, status:'resolved'}})`
3. `create(table='motion', stream:'{ticketId}', action:99993, data:{event:'ticket_resolved'}, scope='{scope}')`

### List Open Tickets
1. `read(table='matter', type='ticket', scope='{scope}', filters:[{key:'status', val:'open'}])`

### Search Tickets
1. `search(query='{searchTerm}', scope='{scope}')`

## Ticket Status

1. open → assigned → in_progress → resolved → closed

## Best Practices

- Link tickets to customers via `graph(rel='submitted')`
- Store priority in `data.priority`: low, medium, high, urgent
- Log all replies to motion for history
- Use `data.status` for workflow tracking
