---
name: crm
description: How to manage customer relationships, leads, deals, and sales pipelines
---

# CRM Skill

## Core Concepts

### Lead
A potential customer stored as `matter` with `type='lead'`.
- `title` = lead name
- `value` = estimated deal value
- `data` = `{ phone, email, source, interest, status }`
- Linked to owner via `graph(rel='owns')`

### Deal
A qualified lead stored as `matter` with `type='deal'`.
- `value` = confirmed deal value
- `data` = `{ probability, expectedClose, notes }`

### Contact
A person record stored as `matter` with `type='contact'`.
- `data` = `{ phone, email, company }`

## Common Operations (6-Tool Pattern)

### Create Lead
1. `create(table='matter', type='lead', title='{name}', value={estimatedValue}, data:{phone, email, source, interest, status:'new'}, scope='{scope}')`
2. `link(src='{userId}', rel='owns', tgt='{leadId}')`
3. `create(table='motion', stream='{leadId}', action=99993, data:{event:'lead_created', name}, scope='{scope}')`

### Qualify Lead
1. `read(table='matter', id='{leadId}')` — check current status
2. `update(table='matter', id='{leadId}', patch:{data:{...currentData, status:'qualified'}})`
3. `create(table='motion', stream='{leadId}', action=99993, data:{event:'lead_qualified'}, scope='{scope}')`

### Convert Lead to Deal
1. `create(table='matter', type='deal', title='{leadName}', value={dealValue}, data:{leadId, probability, notes}, scope='{scope}')`
2. `link(src='{leadId}', rel='converted_to', tgt='{dealId}')`
3. `update(table='matter', id='{leadId}', patch:{data:{...currentData, status:'converted'}})`
4. `create(table='motion', stream='{dealId}', action=99993, data:{event:'deal_created'}, scope='{scope}')`

### Log Visit
1. `create(table='matter', type='visit', title='Visit to {person}', data:{notes, rating, personId}, scope='{scope}')`
2. `link(src='{personId}', rel='visited_by', tgt='{visitId}')`
3. `create(table='motion', stream='{personId}', action=99993, data:{event:'visit_logged'}, scope='{scope}')`

### List Leads
1. `read(table='matter', type='lead', scope='{scope}', limit=50)`

### Search Leads
1. `search(query='{searchTerm}', scope='{scope}')`

## Pipeline Stages

1. New (status='new')
2. Contacted (status='contacted')
3. Qualified (status='qualified')
4. Proposal Sent (status='proposal')
5. Negotiation (status='negotiation')
6. Won (status='won') / Lost (status='lost')

## Best Practices

- Store contact info in `matter.data` JSON, not separate tables
- Link leads to owners via `graph(rel='owns')`
- Log every interaction to motion table
- Use `search(query)` for semantic lead lookup
