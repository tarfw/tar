# Table Schema: Matter, Mass, Motion, Relation

| Table | Column | Type | Details |
| :--- | :--- | :--- | :--- |
| **matter** | id | TEXT | PRIMARY KEY |
| **matter** | code | TEXT | UNIQUE |
| **matter** | type | TEXT | |
| **matter** | scope | TEXT | |
| **matter** | owner | TEXT | |
| **matter** | title | TEXT | |
| **matter** | public | INTEGER | DEFAULT 0 |
| **matter** | data | TEXT | |
| **matter** | time | TIMESTAMPTZ / TEXT | DEFAULT CURRENT_TIMESTAMP |
| **mass** | id | TEXT | PRIMARY KEY |
| **mass** | matter | TEXT | NOT NULL |
| **mass** | type | TEXT | |
| **mass** | scope | TEXT | |
| **mass** | qty | REAL | |
| **mass** | value | REAL | |
| **mass** | active | INTEGER | DEFAULT 1 |
| **mass** | geo | TEXT | |
| **mass** | start | TIMESTAMPTZ / TEXT | |
| **mass** | end | TIMESTAMPTZ / TEXT | |
| **mass** | data | TEXT | |
| **mass** | time | TIMESTAMPTZ / TEXT | DEFAULT CURRENT_TIMESTAMP |
| **motion** | id | TEXT | PRIMARY KEY |
| **motion** | stream | TEXT | NOT NULL |
| **motion** | seq | INTEGER | NOT NULL |
| **motion** | action | INTEGER | NOT NULL |
| **motion** | status | TEXT | |
| **motion** | delta | REAL | |
| **motion** | scope | TEXT | |
| **motion** | data | TEXT | |
| **motion** | time | TIMESTAMPTZ / TEXT | DEFAULT CURRENT_TIMESTAMP |
| **relation** | src | TEXT | NOT NULL, PRIMARY KEY |
| **relation** | tgt | TEXT | NOT NULL, PRIMARY KEY |
| **relation** | type | TEXT | NOT NULL, PRIMARY KEY |
| **relation** | weight | REAL | DEFAULT 1.0 |
| **relation** | time | TIMESTAMPTZ / TEXT | DEFAULT CURRENT_TIMESTAMP |
