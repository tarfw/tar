-- Inventory Alert (hourly)
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('schedule-inventory-alert', 'schedule', 'system', 'Inventory Alert',
 '{"cron":"0 * * * *",
  "workflow":"inventory-alert",
  "timezone":"UTC"}');

-- Daily Report (6pm)
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('schedule-daily-report', 'schedule', 'system', 'Daily Report',
 '{"cron":"0 18 * * *",
  "workflow":"daily-report",
  "timezone":"UTC"}');

-- Daily Standup (weekdays 9am)
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('schedule-daily-standup', 'schedule', 'system', 'Daily Standup',
 '{"cron":"0 9 * * 1-5",
  "workflow":"daily-standup",
  "timezone":"UTC"}');

-- Lead Scoring (every 5 minutes)
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('schedule-lead-scoring', 'schedule', 'system', 'Lead Scoring',
 '{"cron":"*/5 * * * *",
  "workflow":"lead-scoring",
  "timezone":"UTC"}');
