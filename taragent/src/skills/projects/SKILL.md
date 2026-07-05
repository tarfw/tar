---
name: projects
description: How to manage tasks, sprints, milestones, and team assignments
---

# Projects Skill

## Core Concepts

### Task
A work item stored as `matter` with `type='task'`.
- `data` = `{ assignee, dueDate, priority, status, sprintId }`

### Sprint
A time-boxed iteration stored as `matter` with `type='sprint'`.
- `data` = `{ startDate, endDate, goal, status }`

### Milestone
A checkpoint stored as `matter` with `type='milestone'`.
- `data` = `{ dueDate, status }`

## Common Operations (6-Tool Pattern)

### Create Task
1. `create(table='matter', type='task', title='{title}', data:{assignee, dueDate, priority:'medium', status:'todo'}, scope='{scope}')`
2. `link(src='{userId}', rel='assigned', tgt='{taskId}')`
3. `create(table='motion', stream:'{taskId}', action=99993, data:{event:'task_created', title}, scope='{scope}')`

### Assign Task
1. `read(table='matter', id='{taskId}')` — get current data
2. `update(table='matter', id='{taskId}', patch:{data:{...currentData, assignee: newAssignee}})`
3. `link(src='{newAssigneeId}', rel='assigned', tgt='{taskId}')`

### Complete Task
1. `read(table='matter', id='{taskId}')` — get current data
2. `update(table='matter', id='{taskId}', patch:{data:{...currentData, status:'done'}})`
3. `create(table='motion', stream:'{taskId}', action=99993, data:{event:'task_completed'}, scope='{scope}')`

### Create Sprint
1. `create(table='matter', type='sprint', title='{name}', data:{startDate, endDate, goal, status:'active'}, scope='{scope}')`

### List Open Tasks
1. `read(table='matter', type='task', scope='{scope}', filters:[{key:'status', val:'todo'}])`

### List Tasks by Assignee
1. `search(query='{assigneeName}', scope='{scope}')`

## Task Status

1. todo → in_progress → done

## Best Practices

- Link tasks to sprints via `graph(rel='in_sprint')`
- Store priority in `data.priority`: low, medium, high, urgent
- Log status changes to motion table
- Use `data.assignee` for filtering
