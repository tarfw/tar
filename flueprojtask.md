# Project Management & Task Management in Our System

## Everything is a Matter

```
Project     = matter (type='project')
Task        = matter (type='task')
Subtask     = matter (type='subtask') with parent task via graph
Milestone   = matter (type='milestone')
Sprint      = matter (type='sprint')
Epic        = matter (type='epic')
Comment     = motion event
Assignment  = graph + attr
```

---

## Project Matter

```sql
INSERT INTO matter (id, type, scope, title, data) VALUES
('project-001', 'project', 'team-eng', 'Mobile App v2',
 '{"description":"Rewrite mobile app in React Native",
   "owner":"user-alice",
   "team":"team-eng",
   "status":"active",
   "start":"2026-07-01",
   "end":"2026-09-30",
   "budget":50000,
   "priority":"high"}');
```

---

## Task Matter

```sql
INSERT INTO matter (id, type, scope, title, data, value, start, end) VALUES
('task-001', 'task', 'team-eng', 'Setup CI/CD pipeline',
 '{"description":"GitHub Actions + EAS build",
   "project":"project-001",
   "assignee":"user-bob",
   "status":"todo",
   "priority":"high",
   "estimate":8,
   "labels":["devops","setup"]}',
 8, -- estimated hours
 '2026-07-01',
 '2026-07-03');
```

---

## Subtask

```sql
-- Subtask is just a task with parent
INSERT INTO matter (id, type, scope, title, data) VALUES
('task-001-a', 'subtask', 'team-eng', 'Configure GitHub Actions',
 '{"parent":"task-001","assignee":"user-bob","status":"done"}');

INSERT INTO matter (id, type, scope, title, data) VALUES
('task-001-b', 'subtask', 'team-eng', 'Setup EAS build',
 '{"parent":"task-001","assignee":"user-bob","status":"in-progress"}');

-- Graph links subtask → parent
INSERT INTO graph (src, rel, tgt, data) VALUES
('task-001-a', 'child_of', 'task-001', '{}'),
('task-001-b', 'child_of', 'task-001', '{}');
```

---

## Milestone

```sql
INSERT INTO matter (id, type, scope, title, data, end) VALUES
('milestone-001', 'milestone', 'team-eng', 'Beta Release',
 '{"project":"project-001",
   "criteria":["All P0 tasks done","QA passed","Stakeholder demo"],
   "tasks":["task-001","task-002","task-003"]}',
 '2026-08-15');
```

---

## Sprint

```sql
INSERT INTO matter (id, type, scope, title, data) VALUES
('sprint-001', 'sprint', 'team-eng', 'Sprint 1: Setup',
 '{"project":"project-001",
   "start":"2026-07-01",
   "end":"2026-07-14",
   "goal":"Project setup + CI/CD",
   "capacity":120,  -- total hours
   "tasks":["task-001","task-002"]}');
```

---

## Epic

```sql
INSERT INTO matter (id, type, scope, title, data) VALUES
('epic-001', 'epic', 'team-eng', 'User Authentication',
 '{"project":"project-001",
   "description":"Login, signup, password reset",
   "tasks":["task-010","task-011","task-012"],
   "milestone":"milestone-002"}');
```

---

## Task Pipeline (form.type='pipeline')

```sql
INSERT INTO form (id, type, scope, title, data) VALUES
('form-task', 'pipeline', 'team-eng', 'Task Pipeline',
 '{"stages":[
    {"phase":1,"name":"backlog"},
    {"phase":2,"name":"todo"},
    {"phase":3,"name":"in-progress"},
    {"phase":4,"name":"review"},
    {"phase":5,"name":"testing"},
    {"phase":6,"name":"done"},
    {"phase":7,"name":"blocked"}
  ],
  "transitions":{
    "2→3":{"action":70001,"label":"Start"},
    "3→4":{"action":70002,"label":"Submit for review"},
    "4→5":{"action":70003,"label":"QA testing"},
    "5→6":{"action":70004,"label":"Approve"},
    "any→7":{"action":70005,"label":"Block"}
  }}');
```

---

## Status via Attr (Hot Field)

```sql
-- Quick lookup: what's the status?
INSERT INTO attr (matter, key, val) VALUES
('task-001', 'status', 'in-progress'),
('task-002', 'status', 'todo'),
('task-003', 'status', 'done');

-- Priority
INSERT INTO attr (matter, key, val) VALUES
('task-001', 'priority', 'high'),
('task-002', 'priority', 'medium');

-- Assignee
INSERT INTO attr (matter, key, val, ref) VALUES
('task-001', 'assignee', 'user-bob', 'user-bob');
```

---

## Project Graph (Relationships)

```sql
-- Project → tasks
INSERT INTO graph (src, rel, tgt, data) VALUES
('project-001', 'contains', 'task-001', '{}'),
('project-001', 'contains', 'task-002', '{}'),
('project-001', 'contains', 'task-003', '{}');

-- Task → subtasks
INSERT INTO graph (src, rel, tgt, data) VALUES
('task-001', 'has_subtask', 'task-001-a', '{}'),
('task-001', 'has_subtask', 'task-001-b', '{}');

-- Task → dependencies
INSERT INTO graph (src, rel, tgt, data) VALUES
('task-002', 'depends_on', 'task-001', '{"type":"finish-to-start"}'),
('task-003', 'depends_on', 'task-002', '{"type":"finish-to-start"}');

-- Task → assignee
INSERT INTO graph (src, rel, tgt, data) VALUES
('user-bob', 'assigned_to', 'task-001', '{"by":"user-alice"}'),
('user-carol', 'assigned_to', 'task-002', '{"by":"user-alice"}');

-- Task → milestone
INSERT INTO graph (src, rel, tgt, data) VALUES
('task-001', 'part_of', 'milestone-001', '{}'),
('task-002', 'part_of', 'milestone-001', '{}');

-- Task → sprint
INSERT INTO graph (src, rel, tgt, data) VALUES
('task-001', 'in_sprint', 'sprint-001', '{}'),
('task-002', 'in_sprint', 'sprint-001', '{}');
```

---

## Task Activity (Motion Stream)

```sql
-- Each task = chat stream of activity
INSERT INTO motion (stream, seq, action, data) VALUES
('matter-task-001', 1, 99993, '{"event":"created","by":"user-alice"}', datetime('now')),
('matter-task-001', 2, 99993, '{"event":"assigned","to":"user-bob"}', datetime('now')),
('matter-task-001', 3, 99993, '{"event":"comment","user":"user-alice","text":"Priority is high"}', datetime('now')),
('matter-task-001', 4, 99993, '{"event":"status_change","from":"todo","to":"in-progress"}', datetime('now')),
('matter-task-001', 5, 99993, '{"event":"time_logged","hours":3,"by":"user-bob"}', datetime('now'));
```

---

## Comments (Motion Events)

```sql
-- Comments are motion events with action=99993
INSERT INTO motion (stream, seq, action, data) VALUES
('matter-task-001', 10, 99993,
 '{"event":"comment",
   "user":"user-bob",
   "text":"Started CI setup, GitHub Actions config looking good",
   "mentions":["user-alice"]}',
 datetime('now'));

-- @mention triggers notification
INSERT INTO motion (stream, seq, action, data) VALUES
('matter-task-001', 11, 99993,
 '{"event":"mention",
   "user":"user-bob",
   "mentions":["user-alice"],
   "context":"Need approval for EAS credentials"}',
 datetime('now'));
```

---

## Time Tracking

```sql
-- Time log as motion event
INSERT INTO motion (stream, seq, action, delta, data) VALUES
('matter-task-001', 20, 99993, 2.5,
 '{"event":"time_logged","hours":2.5,"user":"user-bob","note":"GitHub Actions setup"}',
 datetime('now'));

-- Total time via aggregate query
SELECT stream, SUM(CAST(json_extract(data, '$.hours') AS REAL)) as total_hours
FROM motion
WHERE stream = 'matter-task-001'
  AND json_extract(data, '$.event') = 'time_logged'
GROUP BY stream;
```

---

## Dependencies & Blocking

```sql
-- Task blocks another task
INSERT INTO graph (src, rel, tgt, data) VALUES
('task-001', 'blocks', 'task-002', '{"reason":"Need CI first"}');

-- Query: what blocks task-002?
SELECT src FROM graph 
WHERE tgt = 'task-002' 
  AND rel = 'blocks' 
  AND active = 1;

-- Query: what's ready to start?
SELECT id FROM matter
WHERE type = 'task'
  AND mark = 2  -- todo
  AND id NOT IN (
    SELECT tgt FROM graph WHERE rel = 'depends_on' AND active = 1
  );
```

---

## Kanban Board (via Query)

```sql
-- Backlog
SELECT id, title FROM matter
WHERE type = 'task' AND mark = 1 AND scope = 'team-eng';

-- Todo
SELECT id, title FROM matter
WHERE type = 'task' AND mark = 2 AND scope = 'team-eng';

-- In Progress
SELECT id, title FROM matter
WHERE type = 'task' AND mark = 3 AND scope = 'team-eng';

-- Done
SELECT id, title FROM matter
WHERE type = 'task' AND mark = 6 AND scope = 'team-eng';
```

---

## Personal Todo (No Team)

```sql
-- Personal todo = matter with scope='user-{id}'
INSERT INTO matter (id, type, scope, title, data) VALUES
('task-personal-001', 'task', 'user-alice', 'Buy groceries',
 '{"status":"todo","priority":"low","due":"2026-07-16"}');

-- Quick add via attr
INSERT INTO attr (matter, key, val) VALUES
('task-personal-001', 'status', 'todo'),
('task-personal-001', 'due', '2026-07-16');
```

---

## Daily Standup (Workflow)

```sql
INSERT INTO form (id, type, scope, data) VALUES
('workflow-daily-standup', 'workflow', 'team-eng', '{
    "trigger":"schedule",
    "schedule_id":"schedule-standup",
    "steps":[
      {"query":"SELECT id, title, assignee FROM matter WHERE type=''task'' AND mark IN (3,4) AND active=1"},
      {"action":"action_notify","args":{"channel":"channel-slack","template":"standup-reminder"}},
      {"action":"action_notify","args":{"channel":"channel-slack","template":"what-did-you-do"}}
    ]
  }');

INSERT INTO form (id, type, scope, data) VALUES
('schedule-standup', 'schedule', 'team-eng', '{
    "cron":"0 9 * * 1-5",  -- weekdays at 9am
    "workflow":"workflow-daily-standup"
  }');
```

---

## Sprint Planning Workflow

```sql
INSERT INTO form (id, type, scope, data) VALUES
('workflow-sprint-planning', 'workflow', 'team-eng', '{
    "trigger":"manual",
    "input":{"sprint_id":"sprint-002","project_id":"project-001"},
    "steps":[
      {"query":"SELECT id FROM matter WHERE type=''task'' AND mark=1 AND scope=''team-eng'' ORDER BY priority"},
      {"action":"action_score","args":{"criteria":"complexity + dependencies","batch":true}},
      {"action":"action_notify","args":{"channel":"slack","template":"sprint-ready-for-review"}}
    ]
  }');
```

---

## Burndown Chart (Query)

```sql
-- Daily completion count for current sprint
SELECT 
  date(json_extract(data, '$.time')) as day,
  COUNT(*) as tasks_done
FROM motion
WHERE stream LIKE 'matter-%'
  AND json_extract(data, '$.event') = 'status_change'
  AND json_extract(data, '$.to') = 'done'
  AND time >= '2026-07-01'
GROUP BY day;
```

---

## Composite Action: Complete Task

```typescript
export const actionCompleteTask = defineAction({
  async run({ harness, input }) {
    // 1. Validate dependencies done
    const deps = await harness.tools.call(toolTraverseGraph, {
      src: input.taskId,
      rel: 'depends_on',
      direction: 'out',
    });
    
    for (const dep of deps.edges) {
      const task = await harness.tools.call(toolGetMatter, { id: dep.tgt });
      if (task.mark !== 6) { // not done
        throw new Error(`Dependency ${task.title} not complete`);
      }
    }
    
    // 2. Advance stage (core action)
    await harness.actions.call(actionAdvanceStage, {
      matterId: input.taskId,
      targetPhase: 6, // done
      actionCode: 70004,
    });
    
    // 3. Update status attr
    await harness.tools.call(toolSetAttr, {
      matterId: input.taskId,
      key: 'status',
      val: 'done',
    });
    
    // 4. Notify assignee
    await harness.actions.call(actionNotify, {
      to: input.completedBy,
      channel: 'email',
      template: 'task-completed',
      data: { taskId: input.taskId, taskTitle: input.taskTitle },
    });
    
    // 5. Check milestone progress
    const milestone = await harness.tools.call(toolTraverseGraph, {
      src: input.taskId,
      rel: 'part_of',
      direction: 'out',
    });
    
    // 6. Log event
    await harness.tools.call(toolAppendMotion, {
      stream: `matter-${input.taskId}`,
      seq: Date.now(),
      action: 99993,
      data: { event: 'completed', by: input.completedBy },
    });
    
    return { completed: true };
  },
});
```

---

## Composite Action: Assign Task

```typescript
export const actionAssignTask = defineAction({
  async run({ harness, input }) {
    // 1. Create graph edge
    await harness.tools.call(toolLinkGraph, {
      src: input.assigneeId,
      rel: 'assigned_to',
      tgt: input.taskId,
      data: { by: input.assignedBy, at: new Date().toISOString() },
    });
    
    // 2. Update attr
    await harness.tools.call(toolSetAttr, {
      matterId: input.taskId,
      key: 'assignee',
      val: input.assigneeId,
      ref: input.assigneeId,
    });
    
    // 3. Notify assignee
    await harness.actions.call(actionNotify, {
      to: input.assigneeId,
      channel: 'slack',
      template: 'task-assigned',
      data: {
        taskId: input.taskId,
        taskTitle: input.taskTitle,
        assignedBy: input.assignedBy,
      },
    });
    
    // 4. Log
    await harness.tools.call(toolAppendMotion, {
      stream: `matter-${input.taskId}`,
      seq: Date.now(),
      action: 99993,
      data: { event: 'assigned', to: input.assigneeId, by: input.assignedBy },
    });
    
    return { assigned: true };
  },
});
```

---

## The Project Agent

```sql
INSERT INTO form (id, type, scope, title, data) VALUES
('agent-projects', 'subagent', 'projects', 'Project Management Agent',
 '{"parent":"agent-master",
   "scope":"projects",
   "types":["project","task","subtask","milestone","sprint","epic"],
   "tools":["tool_get_matter","tool_list_matters","tool_create_matter","tool_update_matter","tool_append_motion","tool_link_graph","tool_traverse_graph","tool_set_attr"],
   "actions":["action_advance_stage","action_notify","action_run_pipeline"],
   "skills":["task-planning","estimation","risk-assessment","standup-facilitator"]}');
```

---

## Skills for Projects

```markdown
---
name: task-planning
description: How to break down work into tasks
---
# Task Planning

## Decomposition
1. Identify deliverables
2. Break into 2-4 hour chunks
3. Define acceptance criteria
4. Estimate effort

## Dependencies
- Finish-to-start (most common)
- Start-to-start
- Finish-to-finish

## Estimation
- Use story points (1, 2, 3, 5, 8, 13)
- Or hours (for small tasks)
- Or t-shirt sizes (S/M/L/XL)
```

```markdown
---
name: standup-facilitator
description: How to run daily standups
---
# Standup Facilitator

## Each person answers:
1. What did you do yesterday?
2. What will you do today?
3. Any blockers?

## Time-box: 15 minutes
## Format: Round-robin or walking stick
## Action: Capture blockers in motion log
```

```markdown
---
name: risk-assessment
description: How to identify project risks
---
# Risk Assessment

## Categories:
- Technical (complexity, dependencies)
- Schedule (estimates, deadlines)
- Resource (people, budget)
- External (vendors, APIs)

## Mitigation:
- Identify early
- Document in motion log
- Track in attr (risk_register)
- Review weekly
```

---

## Personal Todo (Quick Add)

```typescript
// Simple: just create matter
export const actionQuickAddTask = defineAction({
  async run({ harness, input }) {
    const taskId = `task-${Date.now()}`;
    
    await harness.tools.call(toolCreateMatter, {
      id: taskId,
      form: 'form-task',
      type: 'task',
      scope: input.userId,  // personal scope
      title: input.title,
      data: { 
        priority: input.priority || 'medium',
        due: input.due,
      },
      mark: 2, // todo
    });
    
    await harness.tools.call(toolSetAttr, {
      matterId: taskId,
      key: 'status',
      val: 'todo',
    });
    
    await harness.tools.call(toolSetAttr, {
      matterId: taskId,
      key: 'due',
      val: input.due,
    });
    
    return { taskId };
  },
});
```

---

## Project Dashboard (Query Examples)

```sql
-- Active projects
SELECT id, title, end FROM matter
WHERE type = 'project' AND mark = 1 AND active = 1;

-- My tasks
SELECT m.id, m.title, m.end, a.val as priority
FROM matter m
JOIN attr a ON a.matter = m.id AND a.key = 'assignee'
WHERE m.type = 'task' 
  AND m.mark IN (2,3,4,5) 
  AND m.active = 1
  AND a.val = 'user-alice';

-- Sprint burndown
SELECT 
  COUNT(CASE WHEN mark = 6 THEN 1 END) as done,
  COUNT(CASE WHEN mark != 6 THEN 1 END) as remaining
FROM matter
WHERE type = 'task' 
  AND active = 1
  AND id IN (SELECT tgt FROM graph WHERE src = 'sprint-001' AND rel = 'in_sprint');
```

---

## LLM Creates Everything

```
User: "Create project 'Mobile App v2' with 3 tasks"

Master Agent:
- Creates project matter
- Creates 3 task matters
- Links via graph
- Sets defaults
- Done in 2 seconds

User: "Add subtask to task-001 for GitHub Actions setup"

Master Agent:
- Creates subtask matter
- Links parent via graph
- Done

User: "Create sprint from July 1-14 with capacity 120 hours"

Master Agent:
- Creates sprint matter
- Ready for tasks to be assigned

User: "Schedule daily standup at 9am weekdays"

Master Agent:
- Creates schedule + workflow
- Workflow posts to Slack
- Live
```

---

## Summary

```
Project Management:
  Project = matter (type='project')
  Task = matter (type='task')
  Subtask = matter (type='subtask') + graph parent link
  Milestone = matter (type='milestone')
  Sprint = matter (type='sprint')
  Epic = matter (type='epic')
  Pipeline = form.type='pipeline' (stages: backlog → todo → in-progress → review → testing → done)
  Status = attr (hot field for quick lookup)
  Dependencies = graph (task blocks task)
  Assignment = graph + attr
  Comments = motion events
  Time logs = motion events with delta
  Activity = motion stream per matter

Personal Todo:
  Same matter (type='task')
  Scope = 'user-{id}' (private)
  Quick add via action_quick_add_task
  No team, no dependencies
  Just: title, due, priority, done

Same 6 tables.
Same composite actions.
Same LLM creation.
LLM creates: projects, tasks, sprints, milestones, schedules, workflows.
```
