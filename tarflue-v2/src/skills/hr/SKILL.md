---
name: hr
description: How to manage employees, attendance, leave requests, and payroll
---

# HR Skill

## Core Concepts

### Employee
A staff member stored as `matter` with `type='employee'`.
- `data` = `{ phone, role, department, joinDate, salary }`

### Attendance
Daily check-in/out stored as `matter` with `type='attendance'`.
- `data` = `{ employeeId, date, checkIn, checkOut, hours }`

### Leave Request
A leave application stored as `matter` with `type='leave'`.
- `data` = `{ employeeId, type, startDate, endDate, reason, status }`

## Common Operations (6-Tool Pattern)

### Clock In
1. `create(table='matter', type='attendance', title='Clock In', data:{employeeId, date: today, checkIn: now}, scope='{scope}')`
2. `create(table='motion', stream:'{employeeId}', action=99993, data:{event:'clock_in'}, scope='{scope}')`

### Clock Out
1. `read(table='matter', type='attendance', scope='{scope}', filters:[{key:'employeeId', val:'{employeeId}'}, {key:'date', val: today}])`
2. `update(table='matter', id='{attendanceId}', patch:{data:{...currentData, checkOut: now, hours: calculated}})`
3. `create(table='motion', stream:'{employeeId}', action=99993, data:{event:'clock_out'}, scope='{scope}')`

### Request Leave
1. `create(table='matter', type='leave', title='Leave Request', data:{employeeId, type, startDate, endDate, reason, status:'pending'}, scope='{scope}')`
2. `create(table='motion', stream:'{employeeId}', action=99993, data:{event:'leave_requested'}, scope='{scope}')`

### Approve Leave
1. `read(table='matter', id='{leaveId}')` — get current data
2. `update(table='matter', id='{leaveId}', patch:{data:{...currentData, status:'approved'}})`
3. `create(table='motion', stream:'{leaveId}', action=99993, data:{event:'leave_approved'}, scope='{scope}')`

### List Employees
1. `read(table='matter', type='employee', scope='{scope}')`

## Best Practices

- Store attendance in `data` JSON for time calculations
- Link employees to department via `graph(rel='member_of')`
- Log clock in/out to motion for audit
- Use `data.status` for leave workflow: pending → approved/rejected
