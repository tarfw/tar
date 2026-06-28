---
name: hr
description: How to manage employees, attendance, leave, and payroll
---

# HR Skill

## Core Concepts

### Employee
Person working for the organization.
- Has role and department
- Has hire date
- Has salary
- Has attendance records

### Attendance
Daily clock in/out record.
- Has clock-in time
- Has clock-out time
- Has total hours

### Leave
Time off request.
- Has type (sick, vacation, personal)
- Has start/end dates
- Has approval status

## Common Operations

### Clock In
1. action_clock_in(employeeId)
2. Creates attendance matter
3. Sets status='in'

### Clock Out
1. action_clock_out(attendanceId)
2. Advances to phase 2
3. Calculates total hours

### Request Leave
1. tool_create_matter(type='leave', data={employee, type, start, end})
2. tool_set_attr(status='pending')
3. action_notify(manager, template='leave-request')

### Approve Leave
1. action_advance_stage(targetPhase=2)
2. tool_set_attr(status='approved')
3. action_notify(employee, template='leave-approved')

### Generate Payroll
1. Query attendance for period
2. Calculate hours worked
3. Apply deductions
4. Generate pay slip matter

## Best Practices

### Attendance
- Track daily consistently
- Review weekly
- Address patterns

### Leave Management
- Set clear policies
- Track balances
- Plan coverage
