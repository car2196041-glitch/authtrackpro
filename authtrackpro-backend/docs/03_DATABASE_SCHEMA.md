# AuthTrack Pro Database Schema

**Document:** 03_DATABASE_SCHEMA.md  
**Version:** 1.0  
**Status:** Planned Architecture  
**Last Updated:** July 2026  
**Owner:** AuthTrack Pro LLC

---

## 1. Purpose

This document defines the planned PostgreSQL database architecture for AuthTrack Pro. It is the authoritative reference for tables, relationships, keys, constraints, indexes, migration order, and multi-tenant data isolation.

The schema is designed to support:

- Multiple customer organizations
- Delegated organization administrators
- Manager and employee roles
- Secure organization-level data isolation
- User invitations and access management
- Prior authorization tracking
- Audit logging
- Executive and operational reporting
- Subscriptions and usage tracking
- Multi-location organizations
- Future EHR, payer, Microsoft, automation, and AI integrations

---

## 2. Design Principles

### 2.1 Multi-tenant isolation

Every organization-owned record must contain an `organization_id`.

The backend must derive `organization_id` from the authenticated user. It must not trust an organization ID submitted by the frontend.

### 2.2 Referential integrity

Foreign keys should be used wherever practical to prevent orphaned records.

### 2.3 Soft deletion

Users, organizations, authorizations, invitations, and files should generally be disabled or archived rather than permanently deleted.

### 2.4 Auditability

Security-sensitive and business-critical changes must be recorded in append-only audit logs.

### 2.5 Least-privilege access

Roles and permissions determine what users may view or modify. Database queries must also enforce organization boundaries.

### 2.6 Protected health information

Only the minimum necessary patient information should be stored. Sensitive fields must not be included in ordinary logs, email messages, or error responses.

---

## 3. Entity Relationship Overview

```text
organizations
├── users
├── organization_locations
├── departments
├── user_invitations
├── authorizations
│   ├── authorization_status_history
│   ├── authorization_notes
│   └── authorization_files
├── audit_logs
├── subscriptions
├── organization_usage
├── user_permissions
└── integration_connections

users
├── created authorizations
├── assigned authorizations
├── invitations sent
├── audit activity
└── permissions granted
```

---

# 4. Core Tables

## 4.1 organizations

Stores each customer organization or tenant.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | BIGSERIAL | Primary key | Organization identifier |
| name | VARCHAR(200) | Not null | Legal or display name |
| slug | VARCHAR(200) | Unique, not null | URL-safe identifier |
| organization_type | VARCHAR(75) | | Practice, hospital, SNF group, etc. |
| industry | VARCHAR(100) | | Healthcare segment |
| number_of_locations | INTEGER | Default 1 | Estimated location count |
| estimated_user_count | INTEGER | | Estimated users |
| monthly_authorization_volume | INTEGER | | Estimated monthly volume |
| subscription_plan | VARCHAR(50) | Default `trial` | Current plan |
| subscription_status | VARCHAR(50) | Default `trial` | Trial, active, past_due, suspended, cancelled |
| status | VARCHAR(30) | Default `active` | Active, suspended, archived |
| trial_start_date | TIMESTAMPTZ | | Trial start |
| trial_end_date | TIMESTAMPTZ | | Trial end |
| primary_admin_user_id | BIGINT | Nullable FK after users exist | Primary administrator |
| created_at | TIMESTAMPTZ | Default now() | Created timestamp |
| updated_at | TIMESTAMPTZ | Default now() | Last update |

### Constraints

```sql
CHECK (number_of_locations >= 0)
CHECK (estimated_user_count IS NULL OR estimated_user_count >= 0)
CHECK (monthly_authorization_volume IS NULL OR monthly_authorization_volume >= 0)
```

### Indexes

```sql
CREATE UNIQUE INDEX idx_organizations_slug
ON organizations(slug);

CREATE INDEX idx_organizations_status
ON organizations(status);

CREATE INDEX idx_organizations_subscription_status
ON organizations(subscription_status);
```

---

## 4.2 users

Stores all AuthTrack Pro customer and platform users.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | BIGSERIAL | Primary key | User identifier |
| organization_id | BIGINT | FK, nullable only for super admin | User organization |
| first_name | VARCHAR(100) | | First name |
| last_name | VARCHAR(100) | | Last name |
| email | VARCHAR(255) | Not null | Login email |
| password_hash | TEXT | Not null | Bcrypt password hash |
| role | VARCHAR(30) | Not null | super_admin, org_admin, manager, employee |
| status | VARCHAR(30) | Default `active` | invited, pending, active, disabled, locked |
| job_title | VARCHAR(150) | | Job title |
| department_id | BIGINT | FK | Optional department |
| location_id | BIGINT | FK | Optional location |
| phone | VARCHAR(30) | | Phone |
| email_verified | BOOLEAN | Default false | Verification status |
| must_change_password | BOOLEAN | Default false | Force password update |
| failed_login_attempts | INTEGER | Default 0 | Security tracking |
| locked_until | TIMESTAMPTZ | | Temporary lock |
| last_login_at | TIMESTAMPTZ | | Last successful login |
| created_by_user_id | BIGINT | Self-referencing FK | Creator |
| created_at | TIMESTAMPTZ | Default now() | Created timestamp |
| updated_at | TIMESTAMPTZ | Default now() | Last update |
| disabled_at | TIMESTAMPTZ | | Soft-disable timestamp |

### Recommended uniqueness

Customer emails should be globally unique unless future enterprise requirements call for the same email in multiple organizations.

```sql
CREATE UNIQUE INDEX idx_users_email_lower
ON users(LOWER(email));
```

### Indexes

```sql
CREATE INDEX idx_users_organization
ON users(organization_id);

CREATE INDEX idx_users_org_role
ON users(organization_id, role);

CREATE INDEX idx_users_org_status
ON users(organization_id, status);
```

---

## 4.3 organization_locations

Supports customers with multiple offices, hospitals, clinics, or facilities.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, not null |
| name | VARCHAR(200) | Not null |
| location_code | VARCHAR(50) | |
| address_line_1 | VARCHAR(200) | |
| address_line_2 | VARCHAR(200) | |
| city | VARCHAR(100) | |
| state | VARCHAR(50) | |
| postal_code | VARCHAR(20) | |
| timezone | VARCHAR(75) | |
| status | VARCHAR(30) | Default `active` |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Default now() |

### Indexes

```sql
CREATE INDEX idx_locations_organization
ON organization_locations(organization_id);

CREATE UNIQUE INDEX idx_locations_org_code
ON organization_locations(organization_id, location_code)
WHERE location_code IS NOT NULL;
```

---

## 4.4 departments

Stores departments within an organization.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, not null |
| name | VARCHAR(150) | Not null |
| description | TEXT | |
| status | VARCHAR(30) | Default `active` |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Default now() |

### Constraint

```sql
UNIQUE (organization_id, name)
```

---

# 5. Access Management Tables

## 5.1 user_invitations

Stores pending user invitations.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, not null |
| email | VARCHAR(255) | Not null |
| first_name | VARCHAR(100) | |
| last_name | VARCHAR(100) | |
| role | VARCHAR(30) | Not null |
| department_id | BIGINT | FK |
| location_id | BIGINT | FK |
| invited_by_user_id | BIGINT | FK, not null |
| token_hash | TEXT | Not null |
| status | VARCHAR(30) | Default `pending` |
| expires_at | TIMESTAMPTZ | Not null |
| accepted_at | TIMESTAMPTZ | |
| cancelled_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | Default now() |

### Indexes

```sql
CREATE UNIQUE INDEX idx_pending_invitation_org_email
ON user_invitations(organization_id, LOWER(email))
WHERE status = 'pending';

CREATE INDEX idx_invitation_token_hash
ON user_invitations(token_hash);

CREATE INDEX idx_invitation_expiration
ON user_invitations(expires_at);
```

---

## 5.2 permissions

Stores available permission definitions.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| permission_key | VARCHAR(100) | Unique, not null |
| description | TEXT | |
| category | VARCHAR(75) | |
| created_at | TIMESTAMPTZ | Default now() |

### Initial permission keys

```text
users.view
users.invite
users.manage
users.assign_roles

authorizations.view_own
authorizations.view_team
authorizations.view_all
authorizations.create
authorizations.edit
authorizations.delete
authorizations.assign

dashboards.employee
dashboards.manager
dashboards.executive

reports.view
reports.export

audit_logs.view

billing.view
billing.manage

organization.settings
organization.security
organization.integrations
```

---

## 5.3 role_permissions

Maps default permissions to roles.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| role | VARCHAR(30) | Not null |
| permission_id | BIGINT | FK, not null |
| created_at | TIMESTAMPTZ | Default now() |

### Constraint

```sql
UNIQUE (role, permission_id)
```

---

## 5.4 user_permissions

Provides user-specific permission overrides.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, not null |
| user_id | BIGINT | FK, not null |
| permission_id | BIGINT | FK, not null |
| granted | BOOLEAN | Not null |
| granted_by_user_id | BIGINT | FK, not null |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Default now() |

### Constraint

```sql
UNIQUE (user_id, permission_id)
```

---

# 6. Authorization Workflow Tables

## 6.1 authorizations

Stores prior authorization records.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, not null |
| location_id | BIGINT | FK |
| department_id | BIGINT | FK |
| created_by_user_id | BIGINT | FK, not null |
| assigned_to_user_id | BIGINT | FK |
| patient_name | VARCHAR(200) | Not null |
| patient_identifier | VARCHAR(100) | |
| payer | VARCHAR(200) | |
| procedure_name | VARCHAR(250) | |
| cpt_code | VARCHAR(50) | |
| diagnosis_code | VARCHAR(50) | |
| status | VARCHAR(50) | Not null |
| priority | VARCHAR(30) | Default `normal` |
| submitted_date | DATE | |
| due_date | DATE | |
| follow_up_date | DATE | |
| decision_date | DATE | |
| authorization_number | VARCHAR(100) | |
| reference_number | VARCHAR(100) | |
| site_of_service | VARCHAR(200) | |
| provider_name | VARCHAR(200) | |
| facility_name | VARCHAR(200) | |
| denial_reason | TEXT | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Default now() |
| archived_at | TIMESTAMPTZ | |

### Indexes

```sql
CREATE INDEX idx_authorizations_organization
ON authorizations(organization_id);

CREATE INDEX idx_authorizations_org_status
ON authorizations(organization_id, status);

CREATE INDEX idx_authorizations_org_assigned
ON authorizations(organization_id, assigned_to_user_id);

CREATE INDEX idx_authorizations_org_due_date
ON authorizations(organization_id, due_date);

CREATE INDEX idx_authorizations_org_priority
ON authorizations(organization_id, priority);

CREATE INDEX idx_authorizations_org_created_at
ON authorizations(organization_id, created_at DESC);
```

---

## 6.2 authorization_status_history

Tracks every authorization status change.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, not null |
| authorization_id | BIGINT | FK, not null |
| previous_status | VARCHAR(50) | |
| new_status | VARCHAR(50) | Not null |
| changed_by_user_id | BIGINT | FK, not null |
| change_reason | TEXT | |
| created_at | TIMESTAMPTZ | Default now() |

### Indexes

```sql
CREATE INDEX idx_auth_status_history_authorization
ON authorization_status_history(authorization_id, created_at);

CREATE INDEX idx_auth_status_history_org
ON authorization_status_history(organization_id, created_at);
```

---

## 6.3 authorization_notes

Separates notes from the main authorization record and supports note history.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, not null |
| authorization_id | BIGINT | FK, not null |
| user_id | BIGINT | FK, not null |
| note_text | TEXT | Not null |
| note_type | VARCHAR(50) | Default `general` |
| is_internal | BOOLEAN | Default true |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Default now() |
| deleted_at | TIMESTAMPTZ | |

---

## 6.4 authorization_files

Stores metadata for securely uploaded files.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, not null |
| authorization_id | BIGINT | FK, not null |
| uploaded_by_user_id | BIGINT | FK, not null |
| original_filename | VARCHAR(255) | Not null |
| storage_key | TEXT | Not null |
| mime_type | VARCHAR(150) | |
| file_size_bytes | BIGINT | |
| checksum | VARCHAR(128) | |
| created_at | TIMESTAMPTZ | Default now() |
| deleted_at | TIMESTAMPTZ | |

Large files should be stored in secure object storage rather than directly in PostgreSQL.

---

# 7. Audit and Security Tables

## 7.1 audit_logs

Stores immutable audit events.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, nullable for platform events |
| user_id | BIGINT | FK |
| action | VARCHAR(100) | Not null |
| entity_type | VARCHAR(75) | |
| entity_id | BIGINT | |
| authorization_id | BIGINT | FK |
| details | JSONB | |
| ip_address | INET | |
| user_agent | TEXT | |
| created_at | TIMESTAMPTZ | Default now() |

### Indexes

```sql
CREATE INDEX idx_audit_logs_org_created
ON audit_logs(organization_id, created_at DESC);

CREATE INDEX idx_audit_logs_user_created
ON audit_logs(user_id, created_at DESC);

CREATE INDEX idx_audit_logs_action
ON audit_logs(action);
```

Do not store passwords, tokens, full clinical documents, or unnecessary PHI in `details`.

---

## 7.2 refresh_tokens

Recommended for future secure session management.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| user_id | BIGINT | FK, not null |
| token_hash | TEXT | Not null |
| expires_at | TIMESTAMPTZ | Not null |
| revoked_at | TIMESTAMPTZ | |
| device_info | TEXT | |
| ip_address | INET | |
| created_at | TIMESTAMPTZ | Default now() |

---

## 7.3 password_reset_tokens

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| user_id | BIGINT | FK, not null |
| token_hash | TEXT | Not null |
| expires_at | TIMESTAMPTZ | Not null |
| used_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | Default now() |

---

## 7.4 email_verification_tokens

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| user_id | BIGINT | FK, not null |
| token_hash | TEXT | Not null |
| expires_at | TIMESTAMPTZ | Not null |
| verified_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | Default now() |

---

# 8. Subscription and Usage Tables

## 8.1 subscriptions

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, unique, not null |
| provider_customer_id | VARCHAR(255) | |
| provider_subscription_id | VARCHAR(255) | |
| plan | VARCHAR(50) | Not null |
| billing_cycle | VARCHAR(30) | |
| status | VARCHAR(50) | Not null |
| trial_end_date | TIMESTAMPTZ | |
| current_period_start | TIMESTAMPTZ | |
| current_period_end | TIMESTAMPTZ | |
| cancel_at_period_end | BOOLEAN | Default false |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Default now() |

---

## 8.2 organization_usage

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, not null |
| period_start | DATE | Not null |
| period_end | DATE | Not null |
| active_users | INTEGER | Default 0 |
| authorization_count | INTEGER | Default 0 |
| file_storage_bytes | BIGINT | Default 0 |
| email_count | INTEGER | Default 0 |
| automation_runs | INTEGER | Default 0 |
| api_requests | BIGINT | Default 0 |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Default now() |

### Constraint

```sql
UNIQUE (organization_id, period_start, period_end)
```

---

# 9. Integration Tables

## 9.1 integration_connections

Stores customer-specific integration configurations.

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, not null |
| integration_type | VARCHAR(75) | Not null |
| provider_name | VARCHAR(100) | |
| status | VARCHAR(30) | Default `inactive` |
| encrypted_credentials | TEXT | |
| configuration | JSONB | |
| last_sync_at | TIMESTAMPTZ | |
| created_by_user_id | BIGINT | FK |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Default now() |

Credentials must be encrypted and should preferably be stored in a secrets manager rather than directly in the database.

---

## 9.2 integration_sync_logs

| Column | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | Primary key |
| organization_id | BIGINT | FK, not null |
| integration_connection_id | BIGINT | FK, not null |
| sync_type | VARCHAR(75) | |
| status | VARCHAR(30) | Not null |
| records_processed | INTEGER | Default 0 |
| error_summary | TEXT | |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | Default now() |

---

# 10. Reporting and Analytics Views

Recommended PostgreSQL views or materialized views:

```text
v_authorization_summary
v_authorization_aging
v_employee_productivity
v_payer_performance
v_denial_trends
v_turnaround_time
v_location_performance
v_executive_roi
```

All reporting views must include `organization_id`.

Materialized views may be considered later for large datasets.

---

# 11. Foreign Key Strategy

Recommended delete behavior:

| Relationship | Delete behavior |
|---|---|
| Organization → Users | Restrict or soft delete |
| Organization → Authorizations | Restrict or archive |
| User → Created authorizations | Restrict |
| User → Assigned authorizations | Set null |
| Authorization → Status history | Cascade |
| Authorization → Notes | Cascade |
| Authorization → File metadata | Restrict or soft delete |
| Organization → Invitations | Cascade |
| Organization → Usage | Cascade |

Hard deletion of customer organizations should require a controlled retention and deletion workflow.

---

# 12. Timestamp Management

All tables should use:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

A shared trigger may update `updated_at` automatically.

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

# 13. Migration Order

Database migrations should be completed in this order:

## Phase 1 — Multi-tenant foundation

1. Create `organizations`.
2. Create one default organization for current data.
3. Add nullable `organization_id` to `users`.
4. Assign current users to the default organization.
5. Make `users.organization_id` required for customer users.
6. Add expanded role and status fields to users.
7. Add `organization_id` to `authorizations`.
8. Assign existing authorizations to the default organization.
9. Make `authorizations.organization_id` not null.
10. Add `organization_id` to `audit_logs`.

## Phase 2 — Access management

11. Create `organization_locations`.
12. Create `departments`.
13. Add location and department references to users.
14. Create `permissions`.
15. Create `role_permissions`.
16. Create `user_permissions`.
17. Create `user_invitations`.

## Phase 3 — Workflow history

18. Create `authorization_status_history`.
19. Create `authorization_notes`.
20. Create `authorization_files`.

## Phase 4 — Security

21. Create `refresh_tokens`.
22. Create `password_reset_tokens`.
23. Create `email_verification_tokens`.
24. Expand audit indexes.

## Phase 5 — Subscription and integrations

25. Create `subscriptions`.
26. Create `organization_usage`.
27. Create `integration_connections`.
28. Create `integration_sync_logs`.

---

# 14. Initial Migration Safety Rules

Before each migration:

1. Back up the production database.
2. Test the SQL in a non-production environment.
3. Confirm current column names and data types.
4. Add new foreign-key columns as nullable first.
5. Backfill existing rows.
6. Validate that no rows remain unassigned.
7. Add `NOT NULL` only after successful backfill.
8. Add indexes after data migration.
9. Deploy backend changes that support both old and new structures where necessary.
10. Monitor Render logs after deployment.

Never drop the existing `password` column or rename it until the current backend code is updated and tested.

---

# 15. Initial Organizations Table Migration

The first production migration should create only the organization foundation.

```sql
CREATE TABLE IF NOT EXISTS organizations (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  organization_type VARCHAR(75),
  industry VARCHAR(100),
  number_of_locations INTEGER NOT NULL DEFAULT 1,
  estimated_user_count INTEGER,
  monthly_authorization_volume INTEGER,
  subscription_plan VARCHAR(50) NOT NULL DEFAULT 'trial',
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'trial',
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  primary_admin_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (number_of_locations >= 0),
  CHECK (estimated_user_count IS NULL OR estimated_user_count >= 0),
  CHECK (
    monthly_authorization_volume IS NULL
    OR monthly_authorization_volume >= 0
  )
);
```

The `primary_admin_user_id` foreign key should be added only after the users migration is completed to avoid circular dependency during initial setup.

---

# 16. Tenant-Safe Query Pattern

Correct:

```sql
SELECT *
FROM authorizations
WHERE organization_id = $1
ORDER BY created_at DESC;
```

For employee-scoped access:

```sql
SELECT *
FROM authorizations
WHERE organization_id = $1
  AND assigned_to_user_id = $2
ORDER BY created_at DESC;
```

Unsafe:

```sql
SELECT *
FROM authorizations
WHERE id = $1;
```

Safer:

```sql
SELECT *
FROM authorizations
WHERE id = $1
  AND organization_id = $2;
```

Every read, update, and delete query must include the organization boundary.

---

# 17. Open Decisions

The following items must be finalized before their migrations are implemented:

- Whether customer email addresses must be globally unique
- Whether managers may invite users by default
- Whether employees may view team authorizations
- Whether patient names should remain stored as plain text or be field-level encrypted
- Which payment provider will manage subscriptions
- Which secure object-storage provider will store documents
- Retention periods for audit logs and uploaded files
- Whether organizations may have multiple organization administrators
- Whether departments and locations are required or optional
- Whether the initial 30-day trial includes all features

---

# 18. Change Control

Any database change must include:

- A migration file
- A rollback or recovery plan
- An update to this document
- API impact review
- Frontend impact review
- Security and tenant-isolation review
- Testing before production deployment
- A descriptive Git commit

Suggested migration naming:

```text
001_create_organizations.sql
002_add_organization_to_users.sql
003_add_organization_to_authorizations.sql
004_create_permissions.sql
005_create_user_invitations.sql
```

---

# 19. Current Next Step

The first implementation task is:

```text
Create migration 001_create_organizations.sql
```

After that migration succeeds, the next task is to create a default AuthTrack Pro organization for current records and safely add `organization_id` to the existing users table.
