import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { FormEvent, useCallback, useEffect, useState } from 'react'

import { ErrorAlert } from '../../components/common/ErrorAlert'
import { LoadingScreen } from '../../components/common/LoadingScreen'
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
      sx={{ bgcolor: bg ?? '#f1f5f9', color: color ?? '#475569', fontWeight: 600, height: 24 }}
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
  }
}

export function LeadsPage() {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
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

  async function openCreate() {
    const list = projects.length ? projects : await loadProjects()
    setForm(blankForm(list[0]?.id ?? ''))
    setFieldErrors({})
    setCreateOpen(true)
  }

  function openEdit(lead: Lead) {
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
    })
    setFieldErrors({})
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.project_id) next.project_id = 'Choose which project this lead belongs to.'
    if (form.full_name.trim().length < 2) next.full_name = 'Enter the lead name.'
    if (!form.mobile.trim()) next.mobile = 'Enter a mobile number.'
    if (!form.lead_source) next.lead_source = 'Choose a source.'
    if (!form.next_followup_at || !localInputToIso(form.next_followup_at)) {
      next.next_followup_at = 'Choose the next follow-up.'
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  function payloadFromForm() {
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
    }
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
          onChange={(event) => setForm((current) => ({ ...current, project_id: event.target.value }))}
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
          borderRadius: 2,
          bgcolor: 'background.paper',
          overflow: 'auto',
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography fontWeight={600}>
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
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Lead</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Mobile</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Follow-up</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right"> </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((lead) => (
                <TableRow
                  key={lead.id}
                  hover
                  sx={{ cursor: canUpdate || isOwner ? 'pointer' : 'default' }}
                  onClick={() => openEdit(lead)}
                >
                  <TableCell>
                    <Typography fontWeight={600}>{lead.full_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {lead.lead_number}
                      {lead.city ? ` · ${lead.city}` : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>{lead.project_name || '—'}</TableCell>
                  <TableCell>{lead.mobile}</TableCell>
                  <TableCell>
                    <ToneChip label={STATUS_LABEL[lead.status]} {...STATUS_TONE[lead.status]} />
                  </TableCell>
                  <TableCell>
                    <ToneChip label={PRIORITY_LABEL[lead.priority]} {...PRIORITY_TONE[lead.priority]} />
                  </TableCell>
                  <TableCell>{formatDueLabel(lead.next_followup_at)}</TableCell>
                  <TableCell>{lead.lead_source || '—'}</TableCell>
                  <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                    <Button size="small" onClick={() => openEdit(lead)}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullScreen={phone} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => void onCreate(event)}>
          <DialogTitle>Create lead</DialogTitle>
          <DialogContent>{formFields(saving)}</DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving || projects.length === 0}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(editLead)} onClose={() => setEditLead(null)} fullScreen={phone} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => void onSaveEdit(event)}>
          <DialogTitle>{editLead?.full_name ?? 'Lead'}</DialogTitle>
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
              <Button color="error" disabled={saving} onClick={() => void onDelete()}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Stack direction="row" spacing={1}>
              <Button onClick={() => setEditLead(null)}>Close</Button>
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
