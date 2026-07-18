# AuthTrack Pro Enterprise Architecture Blueprint

**Version:** 1.0  
**Date:** July 2026  
**Owner:** AuthTrack Pro LLC  
**Status:** Approved target architecture; implementation is phased

> This blueprint describes the intended platform architecture. Features are Existing, In Development, Planned, or Future and should not all be represented as currently live.

## 1. Product Vision

AuthTrack Pro will be a secure, multi-organization SaaS platform for tracking prior authorizations, managing staff workloads, measuring operational performance, reducing authorization delays, and demonstrating financial return on investment.

Each customer organization will have its own users, permissions, authorizations, dashboards, reports, audit history, subscription, usage limits, settings, and data boundaries. A user from one organization must never be able to access another organization’s data.

## 2. Architecture Principles

- Multi-tenant by design: every customer-owned record is associated with an organization_id.
- Least-privilege access: users receive only the access required for their role and delegated permissions.
- Backend enforcement: hiding a menu item is never considered sufficient security.
- Individual accounts: shared logins are not permitted.
- Auditability: important access and change events are recorded.
- Extensibility: subscriptions, integrations, automation, and AI are designed as modular services.
- Healthcare readiness: protect PHI, minimize unnecessary data, and support HIPAA-aligned operations.
- Incremental migration: the existing AuthTrack Pro application is upgraded without deleting current production data.

## 3. Organization Structure

AuthTrack Pro uses a multi-tenant organization model.

```text
AuthTrack Pro Platform
├── Customer Organization A
│   ├── Organization Administrator
│   ├── Managers
│   ├── Employees
│   ├── Authorizations
│   ├── Reports
│   └── Audit Logs
├── Customer Organization B
│   ├── Organization Administrator
│   ├── Managers
│   ├── Employees
│   ├── Authorizations
│   ├── Reports
│   └── Audit Logs
└── AuthTrack Pro Super Admin
    ├── Customer organizations
    ├── Subscriptions
    ├── Usage monitoring
    ├── Support tools
    └── System health
```

Every organization-owned record should include organization_id. This includes users, authorizations, reports, invitations, audit logs, files, notifications, tasks, automation events, integrations, locations, and subscription usage.

## 4. User Roles

AUTHTRACK PRO SUPER ADMIN
Internal platform role for the AuthTrack Pro owner and specifically authorized support personnel.

May view and manage customer organizations, subscription and trial statuses, usage, storage, feature flags, system health, failed emails or integrations, and controlled support access. Customer users never receive this role.

ORGANIZATION ADMINISTRATOR
The first verified user who creates an organization becomes its initial Organization Administrator.

May invite, approve, disable, and remove users; assign employee, manager, and administrator roles; manage organization settings, security, locations, integrations, subscription, billing, audit logs, reports, and all permitted organization authorizations.

MANAGER
May access Employee, Manager, and Executive dashboards; view organization KPIs; assign work; manage workloads; view operational reports; and review permitted audit activity. A manager may manage users only when specifically delegated that permission by an Organization Administrator.

EMPLOYEE
May access the Employee Dashboard and permitted authorization workflows. Employees may create and update records, add notes, upload permitted files, receive alerts, and view records assigned to them or otherwise permitted by organization policy. Employees cannot access Manager or Executive dashboards, billing, user management, role assignment, or organization-wide protected analytics.

## 5. Role and Permission Matrix

Organization Admin: Employee Dashboard, Manager Dashboard, Executive Dashboard, user management, role assignment, organization settings, reports, audit logs, integrations, billing, subscription, and all organization authorization access.

Manager: Employee Dashboard, Manager Dashboard, Executive Dashboard, team workload, organization KPIs, operational reports, assignment tools, and optionally delegated user-management permissions.

Employee: Employee Dashboard and authorized daily work only. No Manager Dashboard, Executive Dashboard, billing, user-management, or organization-settings access.

Super Admin: AuthTrack Pro platform administration only. Support access to customer data must be controlled, time-limited where possible, and audited.

## 6. Permission Model

AuthTrack Pro should combine role-based access control with permission-based access control.

Recommended permission keys:
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

A user’s role provides a standard permission set. User-specific grants or denials can support delegated access, such as allowing a manager to invite employees without giving full organization-administrator privileges.

## 7. Core Database Schema

ORGANIZATIONS
id, name, slug, industry, organization_type, number_of_locations, estimated_user_count, subscription_plan, subscription_status, trial_start_date, trial_end_date, status, primary_admin_user_id, created_at, updated_at.

Suggested statuses: trial, active, past_due, suspended, cancelled.

USERS
id, organization_id, first_name, last_name, email, password_hash, role, status, job_title, department, phone, email_verified, must_change_password, last_login_at, failed_login_attempts, locked_until, created_by, created_at, updated_at.

Suggested roles: super_admin, org_admin, manager, employee.
Suggested statuses: invited, pending, active, disabled, locked.

USER_INVITATIONS
id, organization_id, email, first_name, last_name, role, permissions, invited_by, invitation_token_hash, expires_at, accepted_at, status, created_at.

Invitation statuses: pending, accepted, expired, cancelled.

AUTHORIZATIONS
id, organization_id, created_by_user_id, assigned_to_user_id, patient_name, patient_identifier, payer, procedure_name, cpt_code, diagnosis_code, status, priority, submitted_date, due_date, authorization_number, reference_number, site_of_service, provider_name, facility_name, follow_up_date, decision_date, denial_reason, notes, created_at, updated_at.

AUTHORIZATION_STATUS_HISTORY
id, organization_id, authorization_id, previous_status, new_status, changed_by_user_id, change_reason, created_at.

AUDIT_LOGS
id, organization_id, user_id, authorization_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at.

PERMISSIONS
id, permission_key, description.

ROLE_PERMISSIONS
id, role, permission_id.

USER_PERMISSIONS
id, organization_id, user_id, permission_id, granted, granted_by, created_at.

SUBSCRIPTIONS
id, organization_id, provider_customer_id, provider_subscription_id, plan, billing_cycle, status, trial_end_date, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at.

ORGANIZATION_USAGE
id, organization_id, period_start, period_end, active_users, authorization_count, file_storage_bytes, email_count, automation_runs, api_requests, created_at, updated_at.

AUTHORIZATION_FILES
id, organization_id, authorization_id, uploaded_by_user_id, original_filename, stored_filename, mime_type, file_size_bytes, storage_location, checksum, created_at, deleted_at.

ORGANIZATION_LOCATIONS
id, organization_id, name, location_code, address, city, state, postal_code, status, created_at.

Users and authorizations may include location_id to support customers with multiple facilities.

## 8. Tenant Isolation Requirements

Every organization-owned database query must filter by the authenticated user’s organization_id.

The frontend must never be treated as the source of truth for organization identity. The backend derives organization_id from the authenticated user or verified server-side session.

Unsafe pattern:
const organizationId = req.body.organizationId;

Required pattern:
const organizationId = req.user.organizationId;

An employee’s authorization query may require both organization and assignment filtering. A manager or administrator may have broader organization-level access according to permissions.

Cross-organization access attempts must return 403 Forbidden or 404 Not Found according to the route’s security design, and the attempt should be logged when appropriate.

## 9. Upgraded Registration and Onboarding

The current registration page becomes a true multi-step organization onboarding workflow.

STEP 1 — ORGANIZATION INFORMATION
Organization name, organization type, number of locations, approximate employees, monthly authorization volume, and current authorization system or process.

STEP 2 — ADMINISTRATOR ACCOUNT
First name, last name, job title, work email, phone, password, and password confirmation. The screen clearly explains that this person becomes the initial Organization Administrator.

STEP 3 — ROI CALCULATOR
Staff count, average hourly cost, monthly authorization volume, minutes per authorization, rework or denial volume, follow-up time, and estimated reimbursement delays. Outputs include estimated labor cost, time saved, monthly savings, annual savings, and a recommended plan.

STEP 4 — PLAN RECOMMENDATION
Recommended plan, monthly and annual pricing, included users, storage, authorization limits, dashboards, automation features, and trial terms. The user may select another plan.

STEP 5 — REVIEW AND CONFIRMATION
Organization details, administrator details, ROI estimate, selected plan, trial dates, and required terms acknowledgements.

STEP 6 — PROCESSING
A visible “Creating your AuthTrack Pro organization…” state disables repeat submission. Only the final Create Organization button sends the registration request.

Backend sequence: validate request, begin transaction, create organization, create Organization Administrator, associate user and organization, create trial subscription, commit transaction, return authentication response, queue welcome email, and redirect to onboarding or the Organization Admin Dashboard.

Email delivery must not block account creation. Email failures are logged and retried separately.

## 10. Registration API

Recommended endpoint:
POST /api/onboarding/register-organization

The request includes organization, administrator, ROI, plan, and billing-cycle objects. The server validates all fields and creates the organization and its first administrator inside one database transaction.

The response must never contain a password hash. It should include only the token/session data and safe user, organization, role, onboarding, and plan information needed by the frontend.

## 11. User Invitation Workflow

The Organization Administrator opens Organization Management → Users → Invite User.

Invitation fields: first name, last name, work email, role, department, location, and optional delegated permissions.

The invitation email identifies the organization, inviter, assigned role, expiration date, and secure account setup link.

The recipient confirms their identity, creates a password, accepts required terms, activates the account, and is directed to the correct dashboard.

Invitation tokens should expire within 24–72 hours and only token hashes should be stored. Administrators should be able to resend or cancel pending invitations.

## 12. Dashboard Architecture

EMPLOYEE DASHBOARD
Daily work view: assigned authorizations, due today, overdue, urgent, recently updated, follow-up tasks, alerts, quick-add tools, and personal productivity summary.

MANAGER DASHBOARD
Team operations view: total authorizations, pending review, approved, denied, urgent, overdue, approval rate, employee workload, unassigned cases, aging, payer response patterns, assignment tools, employee drill-down, and team performance trends.

EXECUTIVE DASHBOARD
Organization performance and ROI: authorization volume, approval and denial rates, turnaround time, rework, estimated labor savings, reimbursement protected, financial impact, productivity by team or location, payer performance, site-of-service issues, denial trends, forecasting, subscription utilization, and ROI compared with plan cost.

Accessible to org_admin and manager. Not accessible to employees.

ORGANIZATION ADMIN DASHBOARD
Users, invitations, organization settings, security, billing, subscription, usage, locations, departments, audit logs, integrations, export settings, and feature access.

AUTH TRACK PRO SUPER ADMIN PORTAL
Organizations, trials, subscriptions, usage, storage, failed emails, failed integrations, system audit events, support cases, feature flags, and platform analytics. Controlled customer-data access must be logged.

## 13. Backend Authorization Model

Recommended middleware stack:
authenticateToken
requireActiveUser
requireOrganization
requireRole
requirePermission

Example: the Manager Dashboard and Executive Dashboard routes require org_admin or manager. Employee attempts must return 403 Forbidden.

All authorization and report endpoints must enforce both organization isolation and role/permission requirements. Frontend route guards improve user experience but never replace backend enforcement.

## 14. Frontend Route Protection

```text
Recommended routes:
/
├── login
├── register
├── pricing
├── about
├── forgot-password
├── reset-password
└── app
    ├── dashboard
    ├── authorizations
    ├── manager-dashboard
    ├── executive-dashboard
    ├── reports
    ├── audit-log
    ├── users
    ├── organization-settings
    └── billing
```

Frontend guards check authentication, account status, role, and required permission. Unauthorized users are redirected to an Access Denied page while the backend independently denies the API request.

## 15. Login Experience

The upgraded login page includes professional AuthTrack Pro branding, email and password fields, show/hide password, remember-email option, forgot-password link, loading state, clear errors, locked or disabled account messaging, public About and Pricing links, and security reassurance.

Role-based default redirects:
Employee → Employee Dashboard
Manager → Manager Dashboard
Organization Administrator → Organization Admin Dashboard
Super Admin → Platform Admin Portal

## 16. Email and Notification System

Required transactional emails include organization welcome, email verification, user invitation, invitation reminder, password reset, password changed, role changed, user disabled, trial ending, subscription activated, payment failed, authorization due soon, authorization overdue, authorization denied, manager daily summary, executive weekly report, and demo-request confirmation.

Emails should be queued or processed asynchronously so registration and login do not appear frozen while Microsoft Graph or SMTP responds.

Messages should avoid unnecessary PHI. Email templates should use AuthTrack Pro branding and support plain-text fallback where practical.

## 17. Security Architecture

Authentication and account security:
- Bcrypt password hashing
- Strong password requirements
- Short-lived access tokens and secure refresh strategy
- Fifteen-minute inactivity logout or organization-configurable equivalent
- Failed-login tracking and temporary lockout
- Email verification
- Password reset with expiring, single-use tokens
- Future multifactor authentication
- Secure secret management and environment variables

Healthcare and PHI safeguards:
- Encryption in transit and at rest
- Minimum necessary patient identifiers
- Secure object storage for documents
- Data-retention and deletion rules
- Secure backups and recovery testing
- Audit logging for sensitive changes and access
- Business Associate Agreements with applicable vendors
- Restricted, audited support access
- No passwords, tokens, or unnecessary PHI in audit logs

Audit events include login attempts, authorization creation and changes, assignments, role changes, invitations, report exports, file downloads, settings changes, and administrative support access.

## 18. Reports Architecture

Initial reports:
- Authorization status
- Aging
- Overdue
- Denial
- Payer performance
- Employee productivity
- Location performance
- Turnaround time
- Urgent cases
- Site-of-service issues
- Missing information
- ROI and savings
- Audit activity

Exports may include CSV, Excel, and PDF. Reports must always respect organization, role, and permission restrictions.

## 19. Subscription and Usage Design

Recommended plans: Starter, Professional, Business, and Enterprise.

Plan limits may include users, locations, monthly authorization volume, file storage, dashboards, automation, advanced reports, API access, integrations, data retention, and support level.

Every user should have an individual account. Secure role separation should not be weakened to reduce licensing cost.

Usage tracking supports plan enforcement, customer transparency, upgrade recommendations, and the ROI calculator.

## 20. Integration Architecture

Near-term integrations: Microsoft Outlook, Microsoft Graph, Power Automate, Excel and CSV import, email notifications, and Power BI exports.

Healthcare integrations: PointClickCare, Epic, Oracle Health/Cerner, athenahealth, eClinicalWorks, NextGen, payer portals, and clearinghouses.

Standards to prepare for: FHIR, HL7, X12 278, X12 270/271, OAuth 2.0, webhooks, and secure REST APIs.

Integrations should use a separate service layer so the core authorization workflow does not directly depend on a single EHR or payer vendor.

## 21. Automation and RPA Roadmap

PHASE 1 — GUIDED AUTOMATION
Missing-field alerts, due-date alerts, payer follow-up reminders, diagnosis/CPT mismatch warnings, duplicate warnings, and peer-to-peer deadline reminders.

PHASE 2 — SEMI-AUTOMATED WORKFLOWS
Generate follow-up tasks, draft payer communications, assign cases by workload rules, update status from structured messages, trigger manager escalation, and produce daily staff attendance summaries through Microsoft Power Automate.

PHASE 3 — RPA INTEGRATIONS
Payer portal status checks, authorization reference retrieval, automated status updates, document uploads, portal navigation, and repetitive data-entry assistance.

RPA involving PHI requires secure credentials, detailed audit logs, customer authorization, and a documented risk assessment.

## 22. AI Roadmap

Initial AI capabilities: summarize notes, identify missing documentation, suggest follow-up actions, categorize denial reasons, detect delays, draft appeal or follow-up language, and explain dashboard trends.

Future AI capabilities: predict denial risk, estimate turnaround time, recommend next-best action, forecast staffing needs, detect payer behavior changes, and provide executive operational insights.

AI output is advisory. It should be labeled as a suggestion and should not independently make clinical or payer coverage decisions.

## 23. Recommended Backend Structure

```text
backend/
├── config/db.js
├── controllers/
│   ├── authController.js
│   ├── organizationController.js
│   ├── userController.js
│   ├── invitationController.js
│   ├── authorizationController.js
│   ├── dashboardController.js
│   ├── reportController.js
│   └── subscriptionController.js
├── middleware/
│   ├── authenticateToken.js
│   ├── requireRole.js
│   ├── requirePermission.js
│   ├── requireOrganization.js
│   ├── errorHandler.js
│   └── validateRequest.js
├── routes/
│   ├── authRoutes.js
│   ├── organizationRoutes.js
│   ├── userRoutes.js
│   ├── invitationRoutes.js
│   ├── authorizationRoutes.js
│   ├── dashboardRoutes.js
│   ├── reportRoutes.js
│   └── subscriptionRoutes.js
├── services/
│   ├── emailService.js
│   ├── graphEmailService.js
│   ├── invitationService.js
│   ├── auditService.js
│   ├── subscriptionService.js
│   └── storageService.js
├── templates/
│   ├── welcomeEmail.js
│   ├── invitationEmail.js
│   └── passwordResetEmail.js
├── migrations/
└── server.js
```

Routes should gradually move out of the current large server.js file as the application grows.

## 24. Recommended Frontend Structure

```text
src/
├── components/
│   ├── Sidebar.jsx
│   ├── ProtectedRoute.jsx
│   ├── RoleRoute.jsx
│   ├── PermissionGate.jsx
│   ├── LoadingButton.jsx
│   └── FormField.jsx
├── context/
│   ├── AuthContext.jsx
│   └── OrganizationContext.jsx
├── pages/
│   ├── public/
│   │   ├── Home.jsx
│   │   ├── About.jsx
│   │   ├── Pricing.jsx
│   │   ├── Login.jsx
│   │   └── Register.jsx
│   ├── employee/EmployeeDashboard.jsx
│   ├── manager/
│   │   ├── ManagerDashboard.jsx
│   │   └── ExecutiveDashboard.jsx
│   └── admin/
│       ├── OrganizationDashboard.jsx
│       ├── UserManagement.jsx
│       ├── Invitations.jsx
│       ├── OrganizationSettings.jsx
│       └── Billing.jsx
├── services/
│   ├── api.js
│   ├── authApi.js
│   ├── usersApi.js
│   └── organizationsApi.js
└── utils/
    ├── permissions.js
    └── roles.js
```

## 25. Implementation Roadmap

PHASE 1 — MULTI-ORGANIZATION FOUNDATION
Create organizations; add organization_id, role, and status fields to users; migrate existing users to a default organization; add organization_id to authorizations and audit logs; update JWT/session data; add tenant filtering; add role middleware.

PHASE 2 — ORGANIZATION ONBOARDING
Upgrade registration; implement true multi-step state; build ROI calculator and plan recommendation; add review screen; create organization and administrator transaction; improve loading and errors; send welcome email asynchronously.

PHASE 3 — USER ADMINISTRATION
Build User Management, invitations, invitation acceptance, user status controls, role assignment, and delegated permissions.

PHASE 4 — DASHBOARD RESTRICTIONS
Protect Manager and Executive dashboards, implement employee data restrictions, add Access Denied page, and test direct URL and API access.

PHASE 5 — EXECUTIVE REPORTING
Create KPI aggregation, turnaround metrics, denial trends, productivity metrics, ROI reports, and location-level reporting.

PHASE 6 — SUBSCRIPTION AND USAGE
Track users, authorizations, storage, and trial status; add plan limits, upgrade recommendations, payment integration, and billing page.

PHASE 7 — ENTERPRISE SECURITY
Add email verification, password reset, MFA, enhanced audit logging, data retention, controlled support access, and HIPAA-readiness documentation.

PHASE 8 — INTEGRATIONS AND AUTOMATION
Microsoft integrations, Power Automate attendance, authorization notifications, EHR integration service, RPA workflows, and AI assistance.

## 26. Immediate Build Sequence

1. Back up the production database.
2. Create the organizations table through a versioned migration.
3. Create a default organization for existing AuthTrack Pro test data.
4. Add nullable organization_id, role, and status fields to users.
5. Migrate existing users and then make organization_id required where appropriate.
6. Add organization_id to authorizations and audit logs.
7. Update JWT/session claims and server-side user lookup.
8. Add tenant-isolation middleware and query filtering.
9. Add backend role and permission middleware.
10. Test direct API access as employee, manager, and administrator.
11. Upgrade the registration and login pages.
12. Add user invitation and delegated administration.

This sequence protects the existing application while preparing it for secure multi-user customer organizations.

## 27. Status Legend and Governance

STATUS LEGEND
Existing — Functionality currently present in AuthTrack Pro.
In Development — Work actively being built or tested.
Planned — Approved for a future development phase.
Future — Strategic capability requiring later design, partnership, or investment.

DOCUMENT GOVERNANCE
Document owner: AuthTrack Pro LLC
Version: 1.0
Initial date: July 2026
Review cadence: update after each major architecture phase or material product decision.

The blueprint describes the target architecture. It must not be represented to customers as proof that every listed feature or compliance control is currently live.
