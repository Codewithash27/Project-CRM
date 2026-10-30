# Aadi CRM — Role-Based Features

## Super Admin
- Manage companies/workspaces
- Manage all users and roles
- Configure global settings
- View all data
- Access audit logs
- Manage subscriptions and billing
- Manage backup/export

## Admin
- Create/edit/deactivate users
- Assign roles and teams
- Configure lead sources, industries, pipeline stages
- Import/export data
- Configure mandatory fields
- View all leads, contacts, deals, tasks, reports
- Resolve duplicates
- Manage notifications

## Sales Manager
- View team dashboard
- View team leads, contacts, deals, tasks
- Create and assign leads
- Reassign leads
- Create/edit team deals
- View overdue follow-ups by rep
- Review pipeline and conversion
- Add activities to team records
- Export team reports
- Limited settings access

## Sales Representative
- Create leads
- View/edit own leads
- Log calls, meetings, notes, WhatsApp follow-ups
- Create follow-up tasks/reminders
- Complete tasks with outcome and next follow-up
- Convert qualified leads
- Create/manage own deals
- Move own deals through stages
- View own dashboard/performance
- Search own records
- No delete permission by default
- No full export permission by default
- No access to other reps’ records by default

## Viewer
- Read-only access
- View dashboards/reports
- No create/edit/delete/assign/export

## Permission Examples
| Permission | Admin | Manager | Sales Rep | Viewer |
|---|---:|---:|---:|---:|
| lead.view_all | Yes | No | No | No |
| lead.view_team | Yes | Yes | No | No |
| lead.view_own | Yes | Yes | Yes | Yes |
| lead.create | Yes | Yes | Yes | No |
| lead.assign | Yes | Yes | No | No |
| lead.delete | Yes | No | No | No |
| deal.view_team | Yes | Yes | No | No |
| deal.create | Yes | Yes | Yes | No |
| task.view_team | Yes | Yes | No | No |
| task.create | Yes | Yes | Yes | No |
| report.view_team | Yes | Yes | No | No |
| settings.manage | Yes | Limited | No | No |
