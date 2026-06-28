-- Email Channel
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('channel-email', 'channel', 'system', 'Email',
 '{"provider":"sendgrid",
  "config":{}}');

-- SMS Channel
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('channel-sms', 'channel', 'system', 'SMS',
 '{"provider":"twilio",
  "config":{}}');

-- Slack Channel
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('channel-slack', 'channel', 'system', 'Slack',
 '{"provider":"slack",
  "config":{}}');
