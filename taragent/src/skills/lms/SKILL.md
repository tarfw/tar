---
name: lms
description: How to manage courses, lessons, enrollments, and student progress
---

# LMS Skill

## Core Concepts

### Course
A learning course stored as `matter` with `type='course'`.
- `data` = `{ description, duration, price, instructor }`

### Enrollment
Student enrollment stored as `matter` with `type='enrollment'`.
- `data` = `{ courseId, studentId, enrollDate, progress, status }`

### Assignment
A task for students stored as `matter` with `type='assignment'`.
- `data` = `{ courseId, title, dueDate, maxScore }`

## Common Operations (6-Tool Pattern)

### Create Course
1. `create(table='matter', type='course', title='{name}', value={price}, data:{description, duration, instructor}, scope='{scope}')`
2. `create(table='motion', stream:'{courseId}', action=99993, data:{event:'course_created'}, scope='{scope}')`

### Enroll Student
1. `create(table='matter', type='enrollment', title='{studentName} → {courseName}', data:{courseId, studentId, enrollDate, progress:0, status:'active'}, scope='{scope}')`
2. `link(src='{studentId}', rel='enrolled_in', tgt='{courseId}')`
3. `create(table='motion', stream:'{courseId}', action=99993, data:{event:'student_enrolled'}, scope='{scope}')`

### Update Progress
1. `read(table='matter', id='{enrollmentId}')` — get current data
2. `update(table='matter', id='{enrollmentId}', patch:{data:{...currentData, progress: newProgress}})`

### Complete Course
1. `read(table='matter', id='{enrollmentId}')` — get current data
2. `update(table='matter', id='{enrollmentId}', patch:{data:{...currentData, progress:100, status:'completed'}})`
3. `create(table='motion', stream:'{enrollmentId}', action:99993, data:{event:'course_completed'}, scope='{scope}')`

### List Courses
1. `read(table='matter', type='course', scope='{scope}')`

### List Student Enrollments
1. `search(query='{studentName}', scope='{scope}')`

## Best Practices

- Link students to courses via `graph(rel='enrolled_in')`
- Store progress as percentage in `data.progress`
- Log completions to motion for certificates
- Use `data.status`: active, completed, dropped
