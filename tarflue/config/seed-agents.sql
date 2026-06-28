-- Master Agent
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('agent-master', 'agent', 'system', 'Master Agent',
 '{"model":"anthropic/claude-sonnet-4-6",
  "description":"Universal assistant for all business verticals",
  "tools":["tool_create_matter","tool_get_matter","tool_list_matters","tool_update_matter","tool_append_motion","tool_read_motions","tool_link_graph","tool_traverse_graph","tool_set_attr","tool_search_memory","tool_store_memory","tool_read_form"],
  "actions":["action_log_event","action_advance_stage","action_score","action_notify","action_embed","action_run_pipeline"],
  "skills":["crm","pos","projects","logistics","support","hr","inventory","ecommerce","realestate","lms","booking"],
  "subagents":["agent-crm","agent-logistics","agent-support","agent-hr","agent-realestate","agent-ecommerce","agent-projects","agent-booking","agent-inventory","agent-lms"]}');

-- CRM Subagent
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('agent-crm', 'subagent', 'system', 'CRM Agent',
 '{"parent":"agent-master",
  "scope":"crm",
  "types":["lead","deal","contact","org"],
  "description":"CRM specialist for leads, deals, and contacts"}');

-- Projects Subagent
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('agent-projects', 'subagent', 'system', 'Projects Agent',
 '{"parent":"agent-master",
  "scope":"projects",
  "types":["project","task","sprint","milestone"],
  "description":"Project management specialist for tasks and sprints"}');

-- E-Commerce Subagent
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('agent-ecommerce', 'subagent', 'system', 'E-Commerce Agent',
 '{"parent":"agent-master",
  "scope":"ecommerce",
  "types":["product","order","cart","payment"],
  "description":"E-commerce specialist for products and orders"}');

-- Inventory Subagent
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('agent-inventory', 'subagent', 'system', 'Inventory Agent',
 '{"parent":"agent-master",
  "scope":"inventory",
  "types":["product","stock","warehouse"],
  "description":"Inventory specialist for stock levels and reordering"}');
