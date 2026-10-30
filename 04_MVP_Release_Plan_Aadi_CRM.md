# Aadi CRM — MVP Release Plan

## Objective
Deliver a usable CRM that helps the sales team capture leads, assign ownership, follow up on time, and track deals.

## MVP Must-Have Features
| Feature | Salesperson Benefit |
|---|---|
| Login and roles | Secure access for Admin, Manager, Sales Rep |
| Lead creation | Fast lead capture with mandatory fields |
| Lead list | Search, filter, sort assigned leads |
| Lead assignment | Manager assigns/reassigns leads |
| Follow-up tasks | Call, meeting, WhatsApp, site visit reminders |
| Today view | Overdue, today, tomorrow, upcoming work |
| Task completion | Outcome, notes, next follow-up |
| Activity timeline | Full lead history |
| Lead conversion | Lead to Contact + Account + Deal |
| Deal pipeline | Kanban with sales stages |
| Rep dashboard | Personal follow-ups and pipeline |
| Manager dashboard | Team pipeline and overdue follow-ups |
| CSV import | Upload existing leads |
| Basic export | Export permitted data |
| Notifications | In-app task/assignment alerts |
| Audit trail | Track critical changes |

## Sales Team Must-Haves
1. Add lead in under 30 seconds.
2. Every lead has a clear owner.
3. Mandatory next follow-up date.
4. Today’s follow-up list.
5. Overdue follow-up alerts.
6. One-tap activity logging.
7. Lead history before calling.
8. Clear deal pipeline.
9. Manager visibility.
10. Mobile-friendly workflows.

## User Stories
### Sales Rep
- I want to add a lead quickly so no inquiry is lost.
- I want to see today’s follow-ups.
- I want to log a call and set next follow-up.
- I want lead history before calling.
- I want to convert a qualified lead into a deal.
- I want overdue task reminders.

### Sales Manager
- I want to assign leads to reps.
- I want to see overdue follow-ups by rep.
- I want to see team pipeline.
- I want to see leads by source.
- I want to reassign unavailable reps’ leads.

### Admin
- I want to create users and assign roles.
- I want to import old Excel leads.
- I want to configure lead sources and pipeline stages.
- I want to export data.

## Acceptance Criteria
- Lead creation under 30 seconds.
- Mandatory fields enforced.
- Every lead has owner and next follow-up.
- Rep dashboard shows overdue/today/upcoming tasks.
- Task completion stores outcome and timestamp.
- Manager can view team pipeline and overdue tasks.
- Conversion creates Contact, Account, Deal.
- Stage changes are logged.
- Rep cannot access other reps’ data by default.
- CSV import works.
- Mobile browser experience works.

## Release Timeline
| Phase | Duration | Deliverables |
|---|---:|---|
| Foundation | Week 1–2 | Auth, roles, users, company setup |
| Sales core | Week 3–5 | Leads, contacts, accounts, activities, tasks |
| Pipeline | Week 6–7 | Deals, stages, Kanban, conversion |
| Manager layer | Week 8 | Dashboards, assignment, reports, exports |
| QA and pilot | Week 9 | Testing, import, training |
| Go-live | Week 10 | Production release |

## Post-MVP Roadmap
| Release | Features |
|---|---|
| v1.1 | WhatsApp click-to-chat, email templates, attachments, duplicate merge |
| v1.2 | Automated sequences, lead scoring, custom fields |
| v1.3 | Advanced reports, targets, leaderboards, forecasting |
| v1.4 | WhatsApp/SMS/email automation, API integrations |
| v2.0 | Multi-company switching, mobile app, workflow builder |
