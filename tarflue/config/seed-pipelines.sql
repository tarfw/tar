-- Lead Pipeline
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('pipeline-lead', 'pipeline', 'system', 'Lead Pipeline',
 '{"stages":[
    {"phase":1,"name":"new"},
    {"phase":2,"name":"contacted"},
    {"phase":3,"name":"qualified"},
    {"phase":4,"name":"proposal"},
    {"phase":5,"name":"negotiation"},
    {"phase":6,"name":"won"}
  ],
  "transitions":{
    "1→2":{"action":80001,"label":"Contact"},
    "2→3":{"action":80002,"label":"Qualify"},
    "3→4":{"action":80003,"label":"Send proposal"},
    "4→5":{"action":80004,"label":"Negotiate"},
    "5→6":{"action":80005,"label":"Close deal"}
  },
  "applies_to":"lead"}');

-- Task Pipeline
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('pipeline-task', 'pipeline', 'system', 'Task Pipeline',
 '{"stages":[
    {"phase":1,"name":"backlog"},
    {"phase":2,"name":"todo"},
    {"phase":3,"name":"in_progress"},
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
  },
  "applies_to":"task"}');

-- Order Pipeline
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('pipeline-order', 'pipeline', 'system', 'Order Pipeline',
 '{"stages":[
    {"phase":1,"name":"created"},
    {"phase":2,"name":"items_added"},
    {"phase":3,"name":"total_calculated"},
    {"phase":4,"name":"payment_captured"},
    {"phase":5,"name":"completed"},
    {"phase":6,"name":"refunded"},
    {"phase":7,"name":"failed"}
  ],
  "transitions":{
    "1→2":{"action":80010,"label":"Add items"},
    "2→3":{"action":80011,"label":"Calculate total"},
    "3→4":{"action":80012,"label":"Capture payment"},
    "4→5":{"action":80013,"label":"Mark complete"},
    "4→6":{"action":80014,"label":"Refund"},
    "3→7":{"action":80015,"label":"Payment failed"}
  },
  "applies_to":"order"}');

-- Shift Pipeline
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('pipeline-shift', 'pipeline', 'system', 'Shift Pipeline',
 '{"stages":[
    {"phase":1,"name":"opening"},
    {"phase":2,"name":"active"},
    {"phase":3,"name":"closing"},
    {"phase":4,"name":"closed"}
  ],
  "transitions":{
    "1→2":{"action":80020,"label":"Start shift"},
    "2→3":{"action":80021,"label":"End shift"},
    "3→4":{"action":80022,"label":"Reconcile and close"}
  },
  "applies_to":"shift"}');

-- Ticket Pipeline
INSERT OR REPLACE INTO form (id, type, scope, title, data) VALUES
('pipeline-ticket', 'pipeline', 'system', 'Ticket Pipeline',
 '{"stages":[
    {"phase":1,"name":"open"},
    {"phase":2,"name":"in_progress"},
    {"phase":3,"name":"waiting"},
    {"phase":4,"name":"resolved"},
    {"phase":5,"name":"closed"}
  ],
  "transitions":{
    "1→2":{"action":90001,"label":"Start working"},
    "2→3":{"action":90002,"label":"Waiting on customer"},
    "3→2":{"action":90003,"label":"Customer replied"},
    "2→4":{"action":90004,"label":"Resolve"},
    "4→5":{"action":90005,"label":"Close"}
  },
  "applies_to":"ticket"}');
