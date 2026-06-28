---
name: projects
description: How to manage projects, tasks, sprints, and team workflows
---

# Projects Skill

## Core Concepts

### Project
Top-level container for work.
- Has start/end dates
- Has team members
- Contains tasks and milestones

### Task
Work item to be completed.
- Has status (todo, in_progress, review, done, blocked)
- Has priority (low, medium, high)
- Has assignee
- Has estimate
- Has dependencies

### Sprint
Time-boxed iteration.
- Has capacity (total hours)
- Has start/end dates
- Contains tasks

### Milestone
Significant point in project.
- Has criteria
- Links to tasks

## Common Operations

### Create Project
1. action_create_project(title, description, start, end)
2. Creates project matter
3. Sets status='active'

### Create Task
1. action_create_task(title, assigneeId, projectId, priority, due)
2. Creates task matter
3. Sets status='todo'
4. Links to project via graph

### Assign Task
1. action_assign_task(taskId, assigneeId, assignedBy)
2. Sets assignee attr
3. Creates graph edge
4. Notifies assignee

### Complete Task
1. action_complete_task(taskId, completedBy)
2. Advances to phase 6
3. Sets status='done'

### Create Sprint
1. action_create_sprint(title, projectId, start, end, capacity)
2. Creates sprint matter
3. Sets capacity attr

## Task Pipeline

### Stages
1. Backlog (phase 1)
2. Todo (phase 2)
3. In Progress (phase 3)
4. Review (phase 4)
5. Testing (phase 5)
6. Done (phase 6)
7. Blocked (phase 7)

### Transitions
- todo → in_progress: Start work
- in_progress → review: Submit for review
- review → testing: QA testing
- testing → done: Approved
- any → blocked: Block

## Dependencies

### Types
- Finish-to-start (most common)
- Start-to-start
- Finish-to-finish

### Tracking
- tool_link_graph(task, depends_on, other_task)
- Query ready tasks: NOT IN depends_on targets

## Best Practices

### Decomposition
- Break tasks into 2-4 hour chunks
- Define acceptance criteria
- Estimate effort

### Standups
- What did you do yesterday?
- What will you do today?
- Any blockers?

### Burndown
- Track daily completions via motion
- Review at sprint end
