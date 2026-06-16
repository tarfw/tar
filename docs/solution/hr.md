# HR & Staff Flow — End to End

How employee management, payroll, and leave work in TAR.

---

## Overview

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Employee │───▶│  Clock   │───▶│   Task   │───▶│ Payroll  │
│  (App)   │    │   (DO)   │    │   (DO)   │    │   (DO)   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Part A: Attendance

### Step 1: Clock In

```sql
-- From Workspace DO (t:company_101)
INSERT INTO matter (id, form, type, start, data)
VALUES ('attend_2026_06_16_ravi', 'emp_ravi', 'slot', 
  '2026-06-16T09:00:00Z', '{"location":"office"}');

INSERT INTO motion (stream, seq, action, data)
VALUES ('attend_2026_06_16_ravi', 1, 501, '{"gps":"13.08,80.27"}');
-- CLOCK_IN
```

### Step 2: Clock Out

```sql
UPDATE motion SET phase = 502 WHERE stream = 'attend_2026_06_16_ravi';
-- CLOCK_OUT

UPDATE matter SET active = 0, end = '2026-06-16T18:00:00Z' 
WHERE id = 'attend_2026_06_16_ravi';
```

---

## Part B: Task Management

### Step 3: Assign Task (Private)

```
Manager assigns task to employee
  → Stored in Personal DB (p)
  → Only employee sees it
```

```sql
-- From Personal DB (user_${self}.db)
INSERT INTO form (id, type, title, data)
VALUES ('task_001', 'task', 'Update inventory', '{
  "priority": "high",
  "due": "2026-06-17"
}');

INSERT INTO matter (id, form, type, start, end)
VALUES ('slot_task_001', 'task_001', 'slot', 
  '2026-06-16T10:00:00Z', '2026-06-17T18:00:00Z');

-- No motion for tasks (state lives in matter.active)
```

### Step 4: Complete Task

```sql
UPDATE matter SET active = 0, end = '2026-06-16T15:00:00Z' 
WHERE id = 'slot_task_001';
```

---

## Part C: Performance Notes

### Step 5: Performance Note

```sql
-- From Workspace DO (t:company_101)
INSERT INTO motion (stream, seq, action, data)
VALUES ('emp_ravi', 1, 505, '{
  "from": "manager_suresh",
  "type": "positive",
  "note": "Excellent customer service today"
}');
-- PERF_NOTE
```

---

## Part D: Leave Management

### Step 6: Leave Request

```sql
INSERT INTO matter (id, form, type, start, end, data)
VALUES ('leave_ravi_2026_06_20', 'emp_ravi', 'slot',
  '2026-06-20', '2026-06-21', '{"type":"casual","reason":"Family event"}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('leave_ravi_2026_06_20', 1, 506, 506);  -- LEAVE_REQ
```

### Step 7: Leave Approved

```sql
UPDATE motion SET phase = 507 WHERE stream = 'leave_ravi_2026_06_20';
-- APPROVED
```

### Step 8: Leave Rejected (alternative)

```sql
UPDATE motion SET phase = 508 WHERE stream = 'leave_ravi_2026_06_20';
-- REJECTED
```

---

## Part E: Payroll

### Step 9: Generate Payroll

```sql
-- From Workspace DO (t:company_101)
INSERT INTO matter (id, form, type, value, data)
VALUES ('payroll_ravi_2026_06', 'emp_ravi', 'invoice', 45000, '{
  "basic": 35000,
  "allowances": 8000,
  "deductions": 2000,
  "net": 41000,
  "days_present": 26,
  "days_leave": 2
}');

INSERT INTO motion (stream, seq, action, phase)
VALUES ('payroll_ravi_2026_06', 1, 503, 503);  -- PAYROLL
```

### Step 10: Payroll Paid

```sql
-- Payment processed
INSERT INTO motion (stream, seq, action, phase)
VALUES ('payroll_ravi_2026_06', 2, 802, 802);  -- PAY_SUCCESS
```

---

## Complete Timeline

| # | Event | Opcode | Written To | Strategy |
|---|-------|--------|------------|----------|
| 1 | Clock in | 501 | t:company_101 | Append |
| 2 | Clock out | 502 | t:company_101 | Append |
| 3 | Task assigned | — | Personal DB | Local |
| 4 | Task complete | — | Personal DB | Local |
| 5 | Performance note | 505 | t:company_101 | Append |
| 6 | Leave request | 506 | t:company_101 | Append |
| 7 | Leave approved | 507 | t:company_101 | Phase |
| 8 | Payroll generated | 503 | t:company_101 | Append |
| 9 | Payroll paid | 802 | t:company_101 | Phase |
