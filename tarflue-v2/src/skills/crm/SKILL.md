---
name: crm
description: How to manage customer relationships, leads, deals, and sales pipelines
---

# CRM Skill

## Core Concepts

### Lead
A potential customer who has shown interest.
- Has contact info (name, phone, email)
- Has source (walk-in, online, referral, cold-call, social)
- Has interest (product/service they want)
- Has estimated value
- Has score (0-100, AI-generated)
- Moves through pipeline stages

### Deal
A lead that has been qualified and is in active negotiation.
- Has deal value (confirmed)
- Has probability percentage
- Has expected close date
- Links to contact and organization

### Contact
A person record with communication details.
- Can be linked to multiple leads/deals
- Has interaction history (motion stream)

### Organization
A company or business entity.
- Has multiple contacts
- Has multiple deals

## Common Operations

### Create Lead
1. Collect: name, phone, email, source, interest, value
2. tool_create_matter(type='lead')
3. tool_set_attr(status='new', source=...)
4. tool_link_graph(owned_by, current_user)
5. action_score(criteria='purchase intent')
6. action_embed(text=interest description)

### Qualify Lead
1. Check lead score > 50
2. action_advance_stage(phase=2, action=80001)
3. tool_set_attr(status='qualified')

### Convert Lead to Deal
1. action_convert_lead(dealValue, notes)
2. Creates deal matter
3. Links to contact
4. Updates pipeline

### Log Visit
1. action_log_visit(person, notes, rating)
2. Creates visit matter
3. Logs to motion

## Pipeline Stages

### Lead Pipeline
1. New (phase 1)
2. Contacted (phase 2)
3. Qualified (phase 3)
4. Proposal Sent (phase 4)
5. Negotiation (phase 5)
6. Won/Lost (phase 6)

## Best Practices

### Scoring
- Score leads weekly using action_score
- Criteria: budget, urgency, fit, engagement
- Re-score after each interaction

### Follow-up
- Log every interaction to motion
- Set reminders via tool_set_attr(due=...)
- Use action_notify for follow-up alerts

### Data Quality
- Always use tool_set_attr for indexed fields
- Use tool_link_graph for relationships
- Never store structured data in JSON only
