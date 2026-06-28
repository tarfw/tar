---
name: lms
description: How to manage courses, lessons, enrollments, and student progress
---

# LMS Skill

## Core Concepts

### Course
Collection of lessons on a topic.
- Has title, description
- Has modules/lessons
- Has enrollment count
- Has completion rate

### Lesson
Individual learning unit.
- Has title, content
- Has order within module
- Has duration

### Enrollment
Student registration for a course.
- Has enrollment date
- Has progress percentage
- Has completion status

## Common Operations

### Create Course
1. tool_create_matter(type='course', title, data={description, modules})
2. tool_set_attr(status='draft')
3. action_embed(text=course content)

### Enroll Student
1. tool_create_matter(type='enrollment')
2. tool_link_graph(student, enrolled_in, course)
3. tool_set_attr(progress=0)
4. action_notify(student, template='enrollment-confirmation')

### Track Progress
1. Update attr(progress=percentage)
2. Log completion events to motion

### Complete Course
1. action_advance_stage(targetPhase=6)
2. tool_set_attr(status='completed')
3. action_notify(student, template='course-completion')

## Best Practices

### Content
- Break into small chunks
- Include assessments
- Provide resources

### Engagement
- Track completion rates
- Send reminders
- Celebrate milestones
