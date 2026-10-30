# Aadi CRM — Database Design Document

## Recommended Database
PostgreSQL.

## Core Entities
- companies
- users
- roles
- permissions
- role_permissions
- teams
- team_members
- lead_sources
- leads
- contacts
- accounts
- pipelines
- pipeline_stages
- deals
- deal_contacts
- activities
- tasks
- notifications
- audit_logs
- files

## Relationships
company 1-N users  
company 1-N teams  
team N-N users via team_members  

user 1-N leads  
lead 1-N activities  
lead 1-N tasks  

lead 1-0..1 contact after conversion  
contact N-1 account  
account 1-N contacts  
account 1-N deals  
contact 1-N deals  

pipeline 1-N pipeline_stages  
deal N-1 pipeline_stage  

## companies
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(150) NOT NULL | |
| slug | VARCHAR(80) UNIQUE NOT NULL | |
| email | VARCHAR(150) | |
| phone | VARCHAR(20) | |
| address | TEXT | |
| status | VARCHAR(20) DEFAULT active | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

## users
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| company_id | UUID FK companies.id | |
| full_name | VARCHAR(120) NOT NULL | |
| email | VARCHAR(150) UNIQUE NOT NULL | |
| phone | VARCHAR(20) | |
| password_hash | VARCHAR(255) NOT NULL | |
| role_id | UUID FK roles.id | |
| manager_id | UUID FK users.id | |
| team_id | UUID FK teams.id | |
| status | VARCHAR(20) DEFAULT active | |
| last_login_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Indexes:
- company_id
- role_id
- manager_id
- (company_id, email)

## roles
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| company_id | UUID FK companies.id | |
| name | VARCHAR(80) NOT NULL | |
| code | VARCHAR(50) NOT NULL | ADMIN, SALES_MANAGER, SALES_REP |
| description | TEXT | |
| is_system_role | BOOLEAN DEFAULT false | |

Unique: (company_id, code)

## permissions
| Column | Type |
|---|---|
| id | UUID PK |
| code | VARCHAR(100) |
| module | VARCHAR(50) |
| description | TEXT |

Examples:
- lead.view_own
- lead.view_team
- lead.view_all
- lead.create
- lead.edit_own
- lead.assign
- lead.import
- lead.export
- task.create
- task.complete
- deal.view_own
- deal.view_team
- user.manage
- settings.manage

## role_permissions
| Column | Type |
|---|---|
| id | UUID PK |
| role_id | UUID FK roles.id |
| permission_id | UUID FK permissions.id |

Unique: (role_id, permission_id)

## teams
| Column | Type |
|---|---|
| id | UUID PK |
| company_id | UUID FK companies.id |
| name | VARCHAR(100) NOT NULL |
| manager_id | UUID FK users.id |
| status | VARCHAR(20) DEFAULT active |

## team_members
| Column | Type |
|---|---|
| id | UUID PK |
| team_id | UUID FK teams.id |
| user_id | UUID FK users.id |
| joined_at | TIMESTAMPTZ |

Unique: (team_id, user_id)

## lead_sources
| Column | Type |
|---|---|
| id | UUID PK |
| company_id | UUID FK companies.id |
| name | VARCHAR(80) NOT NULL |
| status | VARCHAR(20) DEFAULT active |

## leads
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| company_id | UUID FK companies.id | |
| lead_number | VARCHAR(30) UNIQUE NOT NULL | LEAD-000123 |
| full_name | VARCHAR(120) NOT NULL | |
| mobile | VARCHAR(20) NOT NULL | |
| alternate_mobile | VARCHAR(20) | |
| email | VARCHAR(150) | |
| company_name | VARCHAR(150) | |
| city | VARCHAR(100) | |
| address | TEXT | |
| requirement | TEXT | |
| expected_value | NUMERIC(15,2) | |
| lead_source_id | UUID FK lead_sources.id | |
| owner_id | UUID NOT NULL FK users.id | |
| created_by_id | UUID FK users.id | |
| status | VARCHAR(30) DEFAULT new | |
| priority | VARCHAR(20) DEFAULT medium | |
| next_followup_at | TIMESTAMPTZ | |
| converted_contact_id | UUID FK contacts.id | |
| converted_account_id | UUID FK accounts.id | |
| converted_at | TIMESTAMPTZ | |
| is_deleted | BOOLEAN DEFAULT false | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Indexes:
- company_owner_status
- mobile
- email
- next_followup_at
- created_at

## contacts
| Column | Type |
|---|---|
| id | UUID PK |
| company_id | UUID FK companies.id |
| account_id | UUID FK accounts.id |
| owner_id | UUID FK users.id |
| full_name | VARCHAR(120) NOT NULL |
| mobile | VARCHAR(20) NOT NULL |
| email | VARCHAR(150) |
| designation | VARCHAR(100) |
| address | TEXT |
| remarks | TEXT |
| is_deleted | BOOLEAN DEFAULT false |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

## accounts
| Column | Type |
|---|---|
| id | UUID PK |
| company_id | UUID FK companies.id |
| owner_id | UUID FK users.id |
| name | VARCHAR(150) NOT NULL |
| industry | VARCHAR(100) |
| website | VARCHAR(255) |
| email | VARCHAR(150) |
| phone | VARCHAR(20) |
| city | VARCHAR(100) |
| address | TEXT |
| gst_number | VARCHAR(30) |
| remarks | TEXT |
| is_deleted | BOOLEAN DEFAULT false |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

## pipelines
| Column | Type |
|---|---|
| id | UUID PK |
| company_id | UUID FK companies.id |
| name | VARCHAR(100) NOT NULL |
| is_default | BOOLEAN DEFAULT false |
| status | VARCHAR(20) DEFAULT active |

## pipeline_stages
| Column | Type |
|---|---|
| id | UUID PK |
| pipeline_id | UUID FK pipelines.id |
| name | VARCHAR(80) NOT NULL |
| code | VARCHAR(50) NOT NULL |
| sequence | INTEGER NOT NULL |
| probability | INTEGER DEFAULT 0 |
| is_won | BOOLEAN DEFAULT false |
| is_lost | BOOLEAN DEFAULT false |

## deals
| Column | Type |
|---|---|
| id | UUID PK |
| company_id | UUID FK companies.id |
| deal_number | VARCHAR(30) UNIQUE NOT NULL |
| name | VARCHAR(150) NOT NULL |
| account_id | UUID FK accounts.id |
| primary_contact_id | UUID FK contacts.id |
| owner_id | UUID NOT NULL FK users.id |
| pipeline_id | UUID FK pipelines.id |
| pipeline_stage_id | UUID FK pipeline_stages.id |
| amount | NUMERIC(15,2) DEFAULT 0 |
| currency | VARCHAR(5) DEFAULT INR |
| expected_close_date | DATE |
| actual_close_date | DATE |
| probability | INTEGER DEFAULT 0 |
| source | VARCHAR(80) |
| lost_reason | TEXT |
| remarks | TEXT |
| is_deleted | BOOLEAN DEFAULT false |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

## deal_contacts
| Column | Type |
|---|---|
| id | UUID PK |
| deal_id | UUID FK deals.id |
| contact_id | UUID FK contacts.id |
| contact_role | VARCHAR(50) |
| is_primary | BOOLEAN DEFAULT false |

Unique: (deal_id, contact_id)

## activities
| Column | Type |
|---|---|
| id | UUID PK |
| company_id | UUID FK companies.id |
| user_id | UUID FK users.id |
| activity_type | VARCHAR(30) NOT NULL |
| subject | VARCHAR(200) NOT NULL |
| description | TEXT |
| activity_at | TIMESTAMPTZ NOT NULL |
| lead_id | UUID FK leads.id |
| contact_id | UUID FK contacts.id |
| account_id | UUID FK accounts.id |
| deal_id | UUID FK deals.id |
| metadata | JSONB |
| created_at | TIMESTAMPTZ |

## tasks
| Column | Type |
|---|---|
| id | UUID PK |
| company_id | UUID FK companies.id |
| title | VARCHAR(200) NOT NULL |
| task_type | VARCHAR(30) NOT NULL |
| description | TEXT |
| due_at | TIMESTAMPTZ NOT NULL |
| reminder_at | TIMESTAMPTZ |
| priority | VARCHAR(20) DEFAULT medium |
| status | VARCHAR(20) DEFAULT open |
| assigned_to_id | UUID NOT NULL FK users.id |
| created_by_id | UUID FK users.id |
| lead_id | UUID FK leads.id |
| contact_id | UUID FK contacts.id |
| deal_id | UUID FK deals.id |
| completed_at | TIMESTAMPTZ |
| outcome | TEXT |
| next_task_id | UUID FK tasks.id |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

## notifications
| Column | Type |
|---|---|
| id | UUID PK |
| company_id | UUID FK companies.id |
| user_id | UUID FK users.id |
| title | VARCHAR(200) NOT NULL |
| message | TEXT |
| type | VARCHAR(50) |
| link | VARCHAR(255) |
| is_read | BOOLEAN DEFAULT false |
| created_at | TIMESTAMPTZ |

## audit_logs
| Column | Type |
|---|---|
| id | UUID PK |
| company_id | UUID FK companies.id |
| user_id | UUID FK users.id |
| entity_type | VARCHAR(50) |
| entity_id | UUID |
| action | VARCHAR(50) |
| old_value | JSONB |
| new_value | JSONB |
| ip_address | VARCHAR(50) |
| created_at | TIMESTAMPTZ |
