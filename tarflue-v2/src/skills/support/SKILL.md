---
name: support
description: How to manage support tickets, customer service, and knowledge base
---

# Support Skill

## Core Concepts

### Ticket
Customer service request.
- Has status (open, in_progress, resolved, closed)
- Has priority (low, medium, high, urgent)
- Has category
- Has assignee
- Has SLA deadline

### Knowledge Base
Collection of help articles.
- Has title, content, tags
- Embeddable for semantic search
- Versioned

## Common Operations

### Create Ticket
1. action_create_ticket(title, description, priority)
2. Creates ticket matter
3. Sets status='open'
4. Notifies support team

### Reply to Ticket
1. action_reply_ticket(ticketId, reply)
2. Appends motion
3. Notifies customer

### Resolve Ticket
1. action_resolve_ticket(ticketId, resolution)
2. Advances to resolved
3. Sets status='resolved'

### Create KB Article
1. tool_create_matter(type='kb-article', title, content)
2. action_embed(text=content)
3. Embeds for semantic search

## Ticket Pipeline

### Stages
1. Open (phase 1)
2. In Progress (phase 2)
3. Waiting on Customer (phase 3)
4. Resolved (phase 4)
5. Closed (phase 5)

## SLA Tracking

### Priority Levels
- Urgent: 1 hour response
- High: 4 hours response
- Medium: 1 business day
- Low: 3 business days

### Tracking
- Set attr(sla_deadline=...)
- Check motion for first response time
- Alert when approaching deadline

## Best Practices

### Triage
- Categorize on creation
- Assign based on category
- Prioritize by impact

### Resolution
- Document solution in KB
- Link related tickets
- Follow up after resolution
