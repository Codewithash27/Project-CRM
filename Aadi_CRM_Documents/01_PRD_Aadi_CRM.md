# Aadi CRM — Product Requirements Document (PRD)

## 1. Product Overview
- Product: Aadi CRM
- Type: Web-based responsive sales CRM
- Users: Sales Representatives, Sales Managers, Admins
- Goal: Capture every lead, assign ownership, follow up on time, and track deals through a clear pipeline.

## 2. Problem
Sales teams lose leads and revenue because inquiries are stored in WhatsApp, Excel, or notebooks; follow-ups are missed; ownership is unclear; and managers lack visibility.

## 3. Goals and Metrics
| Goal | Metric |
|---|---|
| No missed leads | 100% leads have owner and next follow-up date |
| Follow-up discipline | % tasks completed on time |
| Pipeline visibility | Weekly manager pipeline review |
| Conversion | Lead-to-deal and deal-to-won rate |
| Data quality | % leads with mandatory fields completed |

## 4. Non-Goals for v1
- Marketing automation
- WhatsApp/SMS automation
- AI lead scoring
- Billing/invoicing
- Inventory
- Multi-company account switching
- Native mobile apps

## 5. User Roles
| Role | Access |
|---|---|
| Super Admin | All data and settings |
| Admin | All company data and configuration |
| Sales Manager | Own + team data |
| Sales Representative | Own records |
| Viewer | Read-only assigned scope |

## 6. Core Journeys
### Sales Rep
1. Login and view Today’s Follow-ups.
2. Create lead.
3. Log call/meeting/WhatsApp activity.
4. Set next follow-up.
5. Move lead through stages.
6. Convert qualified lead to Contact + Account + Deal.

### Sales Manager
1. View team dashboard.
2. Check unassigned, overdue, stale leads.
3. Assign/reassign leads.
4. Review pipeline and rep performance.

### Admin
1. Create users and roles.
2. Configure masters and pipeline.
3. Import leads.
4. Manage permissions.

## 7. Functional Requirements
### Authentication
- Email/password login
- Forgot/reset password
- Logout
- Session timeout
- Active/inactive users

### Lead Management
Mandatory:
- Full name
- Mobile
- Lead source
- Owner
- Status
- Next follow-up date

Optional:
- Email, company, city, address, requirement, expected value, remarks, priority, reference.

Statuses:
- New, Contacted, Interested, Qualified, Not Interested, Junk/Duplicate, Converted.

Rules:
- Duplicate check on mobile/email.
- Every lead must have owner.
- Active leads require next follow-up.
- Soft delete only.

### Follow-ups and Reminders
Task types:
- Call, WhatsApp, Meeting, Site Visit, Email, Proposal, Payment, General.

Task fields:
- Title, type, related record, due date/time, priority, status, assignee, notes, reminder time.

Dashboard groups:
- Overdue
- Today
- Tomorrow
- This week

On completion:
- Outcome
- Next follow-up
- Notes

### Contacts and Accounts
Contact:
- Name, mobile, email, designation, account, owner, address, remarks.

Account:
- Company name, industry, website, city, address, owner, GST, remarks.

### Deals
Fields:
- Deal name, account, primary contact, owner, amount, expected close date, stage, probability, source, product/service, lost reason, remarks.

Default stages:
1. New
2. Qualified
3. Demo / Discussion
4. Proposal Sent
5. Negotiation
6. Won
7. Lost

Rules:
- Kanban drag-and-drop.
- Stage changes logged.
- Won requires closed amount/date.
- Lost requires reason.

### Activity Timeline
Types:
- Note, Call, Meeting, WhatsApp, Email, Task, Stage Change, Assignment Change, File.

### Lead Assignment
- Manual assignment
- Manager reassignment
- Bulk assignment
- Assignment history

### Import/Export
- CSV/Excel import
- Field mapping
- Duplicate detection
- Error report
- Role-based export

### Dashboards
Rep:
- Today’s follow-ups
- Overdue
- New leads
- Open deals
- Won deals
- Pipeline value

Manager:
- Team pipeline
- Leads by source/owner
- Overdue follow-ups
- Conversion
- Won/Lost
- Stale leads

### Reports
- Lead report
- Follow-up compliance
- Pipeline report
- Conversion report
- Won/Lost report
- Activity report

### Notifications
- In-app notifications
- Task due reminders
- Overdue alerts
- Lead assignment alerts
- Daily follow-up digest

## 8. UX Requirements
- Mobile-first responsive UI
- Global search
- Quick Add Lead
- Filters and bulk actions
- Lead detail tabs: Details, Activities, Tasks, Deals, Files
- Confirmation for destructive actions
- Audit trail

## 9. Switch Account
“Switch Account” is a UI placeholder only for v1. It should be marked “Coming Soon” or removed unless multi-tenant functionality is required.

## 10. Acceptance Criteria
- Rep can create lead in under 30 seconds.
- Every lead has owner and next follow-up.
- Rep dashboard shows overdue/today/upcoming tasks.
- Manager can view team pipeline and overdue tasks.
- Lead conversion creates Contact, Account, and Deal.
- Rep cannot access other reps’ records by default.
