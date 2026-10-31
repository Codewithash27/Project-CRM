import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { ErrorAlert } from '../../components/common/ErrorAlert'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import type { LeadField, LeadFieldList } from '../../lead-fields/types'
import { OPTION_TYPES } from '../../lead-fields/types'
import { ApiError } from '../../services/api/errors'
import { api } from '../../services/api/client'
import { useAuth } from '../../store/auth-context'
import { defaultFollowupLocal, formatDueLabel, localInputToIso, toDatetimeLocalValue } from '../lead-dates'
import {
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  Lead,
  LeadList,
  LeadPriority,
  LeadProjectOption,
  LeadStatus,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
} from '../types'

function ToneChip({
  label,
  bg,
  color,
}: {
  label: string
  bg?: string
  color?: string
}) {
  return (
    <Chip
      size="small"
      label={label || '—'}
      sx={{
        bgcolor: bg ?? '#f1f5f9',
        color: color ?? '#475569',
        fontWeight: 600,
        height: 24,
        borderRadius: '999px',
      }}
    />
  )
}

type LeadForm = {
  project_id: string
  full_name: string
  mobile: string
  email: string
  company_name: string
  city: string
  lead_source: string
  requirement: string
  expected_value: string
  status: LeadStatus
  priority: LeadPriority
  next_followup_at: string
  extra_values: Record<string, string | string[] | boolean>
}

function blankForm(projectId = ''): LeadForm {
  return {
    project_id: projectId,
    full_name: '',
    mobile: '',
    email: '',
    company_name: '',
    city: '',
    lead_source: '',
    requirement: '',
    expected_value: '',
    status: 'new',
    priority: 'medium',
    next_followup_at: defaultFollowupLocal(),
    extra_values: {},
  }
}

function formatExtraDisplay(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  return String(value)
}

function extraFromLead(lead: Lead): Record<string, string | string[] | boolean> {
  const next: Record<string, string | string[] | boolean> = {}
  for (const [key, value] of Object.entries(lead.extra_values ?? {})) {
    if (typeof value === 'boolean' || typeof value === 'string' || Array.isArray(value)) {
      next[key] = value as string | string[] | boolean
    } else if (typeof value === 'number') {
      next[key] = String(value)
    }
  }
  return next
}

export function LeadsPage() {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const openLeadId = searchParams.get('open')
  const openedFromQuery = useRef<string | null>(null)
  const { user } = useAuth()
  const canCreate = Boolean(user?.permissions.includes('leads.create'))
  const canUpdate = Boolean(user?.permissions.includes('leads.update'))
  const canDelete = Boolean(user?.permissions.includes('leads.delete'))
  const isOwner = Boolean(user?.roles.includes('BUSINESS_OWNER'))
  const isSales = Boolean(user?.roles.includes('SALESPERSON')) && !isOwner

  const [items, setItems] = useState<Lead[]>([])
  const [projects, setProjects] = useState<LeadProjectOption[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [source, setSource] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [form, setForm] = useState<LeadForm>(blankForm())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [projectFields, setProjectFields] = useState<LeadField[]>([])
  const [listFields, setListFields] = useState<LeadField[]>([])

  const activeFields = useMemo(
    () => projectFields.filter((field) => field.is_active),
    [projectFields],
  )

  const fetchFields = useCallback(async (selected: string) => {
    if (!selected) return [] as LeadField[]
    try {
      const result = await api.get<LeadFieldList>(`/api/v1/lead-fields?project_id=${selected}`)
      return result.data.items
    } catch {
      return [] as LeadField[]
    }
  }, [])

  const loadProjectFields = useCallback(
    async (selected: string) => {
      const items = await fetchFields(selected)
      setProjectFields(items)
      return items
    },
    [fetchFields],
  )

  const loadProjects = useCallback(async () => {
    try {
      const result = await api.get<{ items: LeadProjectOption[]; can_create: boolean }>('/api/v1/projects')
      setProjects(result.data.items)
      return result.data.items
    } catch (requestError) {
      setProjects([])
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not load your projects. Refresh and try again.',
      )
      return [] as LeadProjectOption[]
    }
  }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (status) params.set('status', status)
      if (priority) params.set('priority', priority)
      if (source) params.set('source', source)
      if (projectFilter) params.set('project_id', projectFilter)
      params.set('limit', '100')
      const query = params.toString()
      const result = await api.get<LeadList>(`/api/v1/leads${query ? `?${query}` : ''}`)
      setItems(result.data.items)
      setTotal(result.data.total)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not load leads.')
    } finally {
      setLoading(false)
    }
  }, [priority, projectFilter, search, source, status])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      if (!projectFilter) {
        setListFields([])
        return
      }
      const fields = await fetchFields(projectFilter)
      setListFields(fields.filter((field) => field.is_active && field.show_in_list))
    })()
  }, [fetchFields, projectFilter])

  async function openCreate() {
    const list = projects.length ? projects : await loadProjects()
    const first = list[0]?.id ?? ''
    setForm(blankForm(first))
    setFieldErrors({})
    await loadProjectFields(first)
    setCreateOpen(true)
  }

  function closeCreateDialog() {
    if (saving) return
    setCreateOpen(false)
  }

  function closeEditDialog() {
    if (saving) return
    setEditLead(null)
  }

  async function openEdit(lead: Lead) {
    setEditLead(lead)
    setForm({
      project_id: lead.project_id ?? '',
      full_name: lead.full_name,
      mobile: lead.mobile,
      email: lead.email ?? '',
      company_name: lead.company_name ?? '',
      city: lead.city ?? '',
      lead_source: lead.lead_source ?? '',
      requirement: lead.requirement ?? '',
      expected_value: lead.expected_value ?? '',
      status: lead.status,
      priority: lead.priority,
      next_followup_at: lead.next_followup_at
        ? toDatetimeLocalValue(new Date(lead.next_followup_at))
        : defaultFollowupLocal(),
      extra_values: extraFromLead(lead),
    })
    setFieldErrors({})
    await loadProjectFields(lead.project_id ?? '')
  }

  useEffect(() => {
    if (!openLeadId || loading || openedFromQuery.current === openLeadId) return

    let cancelled = false
    void (async () => {
      const match = items.find((lead) => lead.id === openLeadId)
      try {
        const lead =
          match ??
          (await api.get<Lead>(`/api/v1/leads/${openLeadId}`)).data
        if (cancelled) return
        openedFromQuery.current = openLeadId
        await openEdit(lead)
        navigate('/app/leads', { replace: true })
      } catch {
        if (!cancelled) {
          openedFromQuery.current = openLeadId
          navigate('/app/leads', { replace: true })
          setError('Could not open that lead.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // openEdit reads current form helpers; run once per openLeadId after list load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loading, navigate, openLeadId])

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.project_id) next.project_id = 'Choose which project this lead belongs to.'
    if (form.full_name.trim().length < 2) next.full_name = 'Enter the lead name.'
    if (!form.mobile.trim()) next.mobile = 'Enter a mobile number.'
    if (!form.lead_source) next.lead_source = 'Choose a source.'
    if (!form.next_followup_at || !localInputToIso(form.next_followup_at)) {
      next.next_followup_at = 'Choose the next follow-up.'
    }
    for (const field of activeFields) {
      if (!field.is_required) continue
      const value = form.extra_values[field.key]
      const empty =
        value == null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (field.field_type === 'check' && value !== true)
      if (empty) next[`extra_values.${field.key}`] = `${field.label} is required.`
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  function payloadFromForm() {
    const extras: Record<string, unknown> = {}
    for (const field of activeFields) {
      const value = form.extra_values[field.key]
      if (value === undefined || value === '') continue
      if (Array.isArray(value) && value.length === 0) continue
      extras[field.key] = field.field_type === 'number' && typeof value === 'string' && value.trim()
        ? Number(value)
        : value
    }
    return {
      project_id: form.project_id || null,
      full_name: form.full_name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim() || null,
      company_name: form.company_name.trim() || null,
      city: form.city.trim() || null,
      lead_source: form.lead_source || null,
      requirement: form.requirement.trim() || null,
      expected_value: form.expected_value.trim() || null,
      status: form.status,
      priority: form.priority,
      next_followup_at: localInputToIso(form.next_followup_at),
      extra_values: extras,
    }
  }

  function setExtra(key: string, value: string | string[] | boolean) {
    setForm((current) => ({
      ...current,
      extra_values: { ...current.extra_values, [key]: value },
    }))
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    if (!validate()) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.post<Lead>('/api/v1/leads', payloadFromForm())
      setCreateOpen(false)
      setNotice('Lead created.')
      await load()
      await loadProjects()
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.details?.length) {
        const next: Record<string, string> = {}
        for (const detail of requestError.details) next[detail.field] = detail.message
        setFieldErrors(next)
      }
      setError(requestError instanceof ApiError ? requestError.message : 'Could not create lead.')
    } finally {
      setSaving(false)
    }
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editLead || !validate()) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.patch<Lead>(`/api/v1/leads/${editLead.id}`, payloadFromForm())
      setEditLead(null)
      setNotice('Lead updated.')
      await load()
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.details?.length) {
        const next: Record<string, string> = {}
        for (const detail of requestError.details) next[detail.field] = detail.message
        setFieldErrors(next)
      }
      setError(requestError instanceof ApiError ? requestError.message : 'Could not update lead.')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!editLead) return
    setSaving(true)
    setError('')
    try {
      await api.delete(`/api/v1/leads/${editLead.id}`)
      setEditLead(null)
      setNotice('Lead deleted.')
      await load()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not delete lead.')
    } finally {
      setSaving(false)
    }
  }

  function formFields(disabled: boolean) {
    const selected = projects.find((project) => project.id === form.project_id)
    return (
      <Stack spacing={2} sx={{ pt: 0.5 }}>
        <TextField
          select
          label="Project"
          value={form.project_id}
          required
          fullWidth
          disabled={disabled || projects.length === 0}
          error={Boolean(fieldErrors.project_id)}
          helperText={
            fieldErrors.project_id ||
            (projects.length === 0
              ? 'No project assigned yet. Ask your business owner to assign you on Team.'
              : selected
                ? `Lead number will use ${selected.code}-…`
                : 'Which project did this enquiry come for?')
          }
          onChange={(event) => {
            const nextProject = event.target.value
            setForm((current) => ({ ...current, project_id: nextProject, extra_values: {} }))
            void loadProjectFields(nextProject)
          }}
        >
          {projects.map((project) => (
            <MenuItem key={project.id} value={project.id}>
              {project.name} ({project.code})
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Full name"
          value={form.full_name}
          required
          fullWidth
          autoFocus
          disabled={disabled}
          error={Boolean(fieldErrors.full_name)}
          helperText={fieldErrors.full_name}
          onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Mobile"
            value={form.mobile}
            required
            fullWidth
            disabled={disabled}
            error={Boolean(fieldErrors.mobile)}
            helperText={fieldErrors.mobile}
            onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value }))}
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            fullWidth
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select
            label="Source"
            value={form.lead_source}
            required
            fullWidth
            disabled={disabled}
            error={Boolean(fieldErrors.lead_source)}
            helperText={fieldErrors.lead_source || 'Where did this lead come from?'}
            onChange={(event) => setForm((current) => ({ ...current, lead_source: event.target.value }))}
          >
            {LEAD_SOURCES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="City"
            value={form.city}
            fullWidth
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Company / organisation"
            value={form.company_name}
            fullWidth
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, company_name: event.target.value }))}
          />
          <TextField
            label="Expected value"
            value={form.expected_value}
            fullWidth
            disabled={disabled}
            placeholder="Optional"
            onChange={(event) => setForm((current) => ({ ...current, expected_value: event.target.value }))}
          />
        </Stack>

        <TextField
          label="Requirement"
          value={form.requirement}
          fullWidth
          multiline
          minRows={2}
          disabled={disabled}
          placeholder="What are they looking for?"
          onChange={(event) => setForm((current) => ({ ...current, requirement: event.target.value }))}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select
            label="Status"
            value={form.status}
            fullWidth
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as LeadStatus }))}
          >
            {LEAD_STATUSES.map((item) => (
              <MenuItem key={item} value={item}>
                {STATUS_LABEL[item]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Priority"
            value={form.priority}
            fullWidth
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as LeadPriority }))}
          >
            {LEAD_PRIORITIES.map((item) => (
              <MenuItem key={item} value={item}>
                {PRIORITY_LABEL[item]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <TextField
          label="Next follow-up"
          type="datetime-local"
          value={form.next_followup_at}
          required
          fullWidth
          disabled={disabled}
          InputLabelProps={{ shrink: true }}
          error={Boolean(fieldErrors.next_followup_at)}
          helperText={fieldErrors.next_followup_at || 'When will you call them next?'}
          onChange={(event) => setForm((current) => ({ ...current, next_followup_at: event.target.value }))}
        />

        {activeFields.length ? (
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Project fields{selected ? ` · ${selected.name}` : ''}
            </Typography>
            {activeFields.map((field) => {
              const errorKey = `extra_values.${field.key}`
              const value = form.extra_values[field.key]
              if (field.field_type === 'check') {
                return (
                  <FormControlLabel
                    key={field.id}
                    control={
                      <Checkbox
                        checked={value === true}
                        disabled={disabled}
                        onChange={(event) => setExtra(field.key, event.target.checked)}
                      />
                    }
                    label={field.label + (field.is_required ? ' *' : '')}
                  />
                )
              }
              if (field.field_type === 'multi') {
                const selectedValues = Array.isArray(value) ? value : []
                return (
                  <TextField
                    key={field.id}
                    select
                    SelectProps={{ multiple: true }}
                    label={field.label}
                    value={selectedValues}
                    required={field.is_required}
                    fullWidth
                    disabled={disabled}
                    error={Boolean(fieldErrors[errorKey])}
                    helperText={fieldErrors[errorKey]}
                    onChange={(event) => {
                      const next = event.target.value
                      setExtra(field.key, typeof next === 'string' ? next.split(',') : next)
                    }}
                  >
                    {(field.options ?? []).map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                )
              }
              if (OPTION_TYPES.has(field.field_type) || field.field_type === 'radio') {
                return (
                  <TextField
                    key={field.id}
                    select
                    label={field.label}
                    value={typeof value === 'string' ? value : ''}
                    required={field.is_required}
                    fullWidth
                    disabled={disabled}
                    error={Boolean(fieldErrors[errorKey])}
                    helperText={fieldErrors[errorKey]}
                    onChange={(event) => setExtra(field.key, event.target.value)}
                  >
                    {(field.options ?? []).map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                )
              }
              return (
                <TextField
                  key={field.id}
                  label={field.label}
                  value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                  required={field.is_required}
                  fullWidth
                  disabled={disabled}
                  multiline={field.field_type === 'area'}
                  minRows={field.field_type === 'area' ? 2 : undefined}
                  type={
                    field.field_type === 'number'
                      ? 'number'
                      : field.field_type === 'email'
                        ? 'email'
                        : field.field_type === 'date'
                          ? 'date'
                          : field.field_type === 'url'
                            ? 'url'
                            : 'text'
                  }
                  InputLabelProps={field.field_type === 'date' ? { shrink: true } : undefined}
                  error={Boolean(fieldErrors[errorKey])}
                  helperText={fieldErrors[errorKey]}
                  onChange={(event) => setExtra(field.key, event.target.value)}
                />
              )
            })}
          </Stack>
        ) : null}
      </Stack>
    )
  }

  if (loading && items.length === 0 && projects.length === 0) return <LoadingScreen />

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'flex-start' }, justifyContent: 'space-between' }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="h1">Leads</Typography>
          <Typography color="text.secondary">
            {isOwner
              ? 'Every lead in your business. Open one to review status and follow-ups.'
              : projects.length
                ? `Your leads on ${projects.map((project) => project.name).join(', ')}. Create one under a project you are assigned to.`
                : 'Your leads only. Ask your business owner to assign you to a project on Team first.'}
          </Typography>
        </Stack>
        {canCreate ? (
          <Button variant="contained" onClick={() => void openCreate()} sx={{ flexShrink: 0 }} disabled={isSales && projects.length === 0}>
            + Create lead
          </Button>
        ) : null}
      </Stack>

      {isSales && projects.length === 0 ? (
        <Alert severity="warning">
          You are not assigned to any project yet. Ask your business owner to tick you on Team, then you can create leads here.
        </Alert>
      ) : null}

      {error ? <ErrorAlert message={error} /> : null}
      {notice ? (
        <Typography color="success.main" variant="body2">
          {notice}
        </Typography>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1.2fr 1fr 1fr 1fr 1fr' },
        }}
      >
        <TextField
          label="Search"
          placeholder="Name, mobile, email…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <TextField select label="Project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
          <MenuItem value="">All projects</MenuItem>
          {projects.map((project) => (
            <MenuItem key={project.id} value={project.id}>
              {project.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <MenuItem value="">All statuses</MenuItem>
          {LEAD_STATUSES.map((item) => (
            <MenuItem key={item} value={item}>
              {STATUS_LABEL[item]}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
          <MenuItem value="">All</MenuItem>
          {LEAD_PRIORITIES.map((item) => (
            <MenuItem key={item} value={item}>
              {PRIORITY_LABEL[item]}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Source" value={source} onChange={(event) => setSource(event.target.value)}>
          <MenuItem value="">All sources</MenuItem>
          {LEAD_SOURCES.map((item) => (
            <MenuItem key={item} value={item}>
              {item}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '16px',
          bgcolor: 'background.paper',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography fontWeight={700}>
            {total} lead{total === 1 ? '' : 's'}
          </Typography>
        </Box>
        {items.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            {canCreate && projects.length
              ? `No leads yet on your projects. Create the first one for ${projects[0]?.name ?? 'a project'}.`
              : canCreate
                ? 'No leads yet. Get assigned to a project, then create the first one.'
                : 'No leads match these filters.'}
          </Typography>
        ) : (
          <>
            <Box
              sx={{
                display: { xs: 'none', md: 'grid' },
                gridTemplateColumns: 'minmax(0,1.6fr) 104px 84px 100px 96px 44px',
                columnGap: 1.25,
                alignItems: 'center',
                px: 2,
                py: 1,
                bgcolor: '#f8fafc',
                borderBottom: '1px solid #dbe3ee',
              }}
            >
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                Lead
              </Typography>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                Status
              </Typography>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                Priority
              </Typography>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                Follow-up
              </Typography>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                Source
              </Typography>
              <Typography variant="caption" fontWeight={700} color="text.secondary" textAlign="right">
                {' '}
              </Typography>
            </Box>
            {items.map((lead) => {
              const clickable = canUpdate || isOwner
              const statusTone = STATUS_TONE[lead.status] ?? { bg: '#f1f5f9', color: '#475569' }
              return (
                <Box
                  key={lead.id}
                  onClick={() => {
                    if (clickable) void openEdit(lead)
                  }}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0,1fr) auto',
                      md: 'minmax(0,1.6fr) 104px 84px 100px 96px 44px',
                    },
                    columnGap: 1.25,
                    rowGap: 0.75,
                    alignItems: 'center',
                    px: 2,
                    py: 1.15,
                    borderBottom: '1px solid #edf1f7',
                    cursor: clickable ? 'pointer' : 'default',
                    '&:hover': { bgcolor: '#f8fbff' },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>
                      {lead.full_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {lead.lead_number}
                      {lead.project_name ? ` · ${lead.project_name}` : ''}
                      {lead.city ? ` · ${lead.city}` : ''}
                      {' · '}
                      <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                        {lead.mobile}
                      </Box>
                    </Typography>
                    {listFields.length > 0 ? (
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {listFields
                          .slice(0, 3)
                          .map((field) => `${field.label}: ${formatExtraDisplay(lead.extra_values?.[field.key])}`)
                          .join(' · ')}
                      </Typography>
                    ) : null}
                  </Box>
                  <Box sx={{ gridColumn: { xs: '1', md: 'auto' } }}>
                    <ToneChip label={STATUS_LABEL[lead.status] ?? lead.status} {...statusTone} />
                  </Box>
                  <Box sx={{ gridColumn: { xs: '1', md: 'auto' } }}>
                    <ToneChip label={PRIORITY_LABEL[lead.priority]} {...PRIORITY_TONE[lead.priority]} />
                  </Box>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{
                      alignItems: 'center',
                      gridColumn: { xs: '1', md: 'auto' },
                      fontSize: 13,
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <TodayOutlinedIcon sx={{ fontSize: 15 }} />
                    {formatDueLabel(lead.next_followup_at)}
                  </Stack>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ gridColumn: { xs: '1', md: 'auto' }, color: 'text.secondary' }}
                  >
                    {lead.lead_source || '—'}
                  </Typography>
                  <Stack
                    direction="row"
                    onClick={(event) => event.stopPropagation()}
                    sx={{ justifyContent: 'flex-end', gridColumn: { xs: '2', md: 'auto' }, gridRow: { xs: '1', md: 'auto' } }}
                  >
                    <Tooltip title="Open">
                      <IconButton
                        size="small"
                        aria-label={`Open ${lead.full_name}`}
                        onClick={() => void openEdit(lead)}
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '8px',
                          color: 'text.secondary',
                          '&:hover': { bgcolor: '#eef2f7', color: 'text.primary' },
                        }}
                      >
                        <OpenInNewOutlinedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              )
            })}
          </>
        )}
      </Box>

      <Dialog open={createOpen} onClose={closeCreateDialog} fullScreen={phone} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => void onCreate(event)}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
            <Box component="span" sx={{ flex: 1 }}>
              Create lead
            </Box>
            <IconButton
              type="button"
              aria-label="Close"
              onClick={(event) => {
                event.preventDefault()
                closeCreateDialog()
              }}
              edge="end"
              size="small"
              disabled={saving}
            >
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent>{formFields(saving)}</DialogContent>
          <DialogActions>
            <Button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                closeCreateDialog()
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving || projects.length === 0}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(editLead)} onClose={closeEditDialog} fullScreen={phone} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => void onSaveEdit(event)}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
            <Box component="span" sx={{ flex: 1 }}>
              {editLead?.full_name ?? 'Lead'}
            </Box>
            <IconButton
              type="button"
              aria-label="Close"
              onClick={(event) => {
                event.preventDefault()
                closeEditDialog()
              }}
              edge="end"
              size="small"
              disabled={saving}
            >
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {editLead ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {editLead.lead_number}
                {editLead.project_name ? ` · ${editLead.project_name}` : ''}
              </Typography>
            ) : null}
            {formFields(!canUpdate || saving)}
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'space-between' }}>
            {canDelete ? (
              <Button type="button" color="error" disabled={saving} onClick={() => void onDelete()}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Stack direction="row" spacing={1}>
              <Button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  closeEditDialog()
                }}
                disabled={saving}
              >
                Close
              </Button>
              {canUpdate ? (
                <Button type="submit" variant="contained" disabled={saving}>
                  Save
                </Button>
              ) : null}
            </Stack>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  )
}
