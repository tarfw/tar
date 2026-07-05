---
name: crm
version: 1.0.0
module: crm
tools: [create, read, update, delete, link, search]
---

# CRM Skill

## Purpose
Track customers, manage leads, handle follow-ups.

## Actions

### action_create_lead
Create a new customer/lead record.

Steps:
1. `create(table='matter', type='lead', title='{name}', data:{phone:{phone}, source:{source}}, scope='{scope}')`
2. `link(src='{scope}', tgt='{leadId}', rel='has_lead')`

### action_update_lead
Update lead information or status.

Steps:
1. `update(table='matter', id='{leadId}', data:{...currentData, status:{status}, notes:{notes}})`

### action_follow_up
Schedule a follow-up reminder.

Steps:
1. `create(table='motion', type='follow_up', data:{leadId:{id}, leadName:{name}, dueDate:{date}, notes:{notes}})`
2. `link(src='{scope}', tgt='{leadId}', rel='follows_up')`

## Intent Matching

| User says | Action |
|---|---|
| new customer / add lead | action_create_lead |
| update customer / change info | action_update_lead |
| follow up / remind me | action_follow_up |
