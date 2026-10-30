export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'lost'
export type LeadPriority = 'low' | 'medium' | 'high'

export interface Lead {
  id: string
  company_id: string
  project_id: string | null
  project_name: string | null
  lead_number: string
  full_name: string
  mobile: string
  alternate_mobile: string | null
  email: string | null
  company_name: string | null
  city: string | null
  address: string | null
  requirement: string | null
  expected_value: string | null
  lead_source: string | null
  owner_id: string
  created_by_id: string
  status: LeadStatus
  priority: LeadPriority
  next_followup_at: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface LeadProjectOption {
  id: string
  name: string
  code: string
  company_id: string
  company_name: string
}

export const LEAD_SOURCES = [
  'Website',
  'WhatsApp',
  'Instagram',
  'Facebook',
  'Referral',
  'Walk-in',
  'Phone call',
  'Google',
  'Campaign',
  'Other',
] as const

export interface LeadList {
  items: Lead[]
  total: number
}

export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'unqualified', 'lost']
export const LEAD_PRIORITIES: LeadPriority[] = ['high', 'medium', 'low']

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  unqualified: 'Unqualified',
  lost: 'Lost',
}

export const PRIORITY_LABEL: Record<LeadPriority, string> = {
  high: 'Hot',
  medium: 'Warm',
  low: 'Cold',
}

export const PRIORITY_TONE: Record<LeadPriority, { bg: string; color: string }> = {
  high: { bg: '#fee2e2', color: '#b91c1c' },
  medium: { bg: '#ffedd5', color: '#c2410c' },
  low: { bg: '#dbeafe', color: '#1d4ed8' },
}

export const STATUS_TONE: Record<LeadStatus, { bg: string; color: string }> = {
  new: { bg: '#e0e7ff', color: '#3730a3' },
  contacted: { bg: '#fef3c7', color: '#92400e' },
  qualified: { bg: '#d1fae5', color: '#047857' },
  unqualified: { bg: '#f1f5f9', color: '#475569' },
  lost: { bg: '#fee2e2', color: '#b91c1c' },
}
