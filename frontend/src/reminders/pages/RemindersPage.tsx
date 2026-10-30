import CheckIcon from '@mui/icons-material/Check'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'

import { ErrorAlert } from '../../components/common/ErrorAlert'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import {
  addDaysIso,
  dateInputToIsoNoon,
  FollowWhen,
  followWhen,
  formatDueLabel,
  isoToDateInput,
} from '../../leads/lead-dates'
import {
  Lead,
  LeadList,
  LeadPriority,
  LeadProjectOption,
  PRIORITY_LABEL,
  PRIORITY_TONE,
} from '../../leads/types'
import { ApiError } from '../../services/api/errors'
import { api } from '../../services/api/client'
import { useAuth } from '../../store/auth-context'

type WhenFilter = 'ALL' | 'o' | 't' | 'u'
type SortBy = 'time' | 'pri' | 'name'

const WHEN_LABEL: Record<WhenFilter, string> = {
  ALL: 'All reminders',
  o: 'Overdue reminders',
  t: "Today's reminders",
  u: 'Upcoming reminders',
}

const WHEN_CHIP: Record<Exclude<FollowWhen, 'ALL'>, { label: string; bg: string; color: string }> = {
  o: { label: 'Overdue', bg: '#fee2e2', color: '#b91c1c' },
  t: { label: 'Due today', bg: '#fef3c7', color: '#92400e' },
  u: { label: 'Upcoming', bg: '#e0ecff', color: '#1d4ed8' },
}

const DAY_CHIP = { bg: '#ede9fe', color: '#5b21b6' }
const PRI_RANK: Record<LeadPriority, number> = { high: 0, medium: 1, low: 2 }
const AVATAR_COLORS = ['#dbeafe', '#fce7f3', '#d1fae5', '#ffedd5', '#e0e7ff', '#fef3c7']

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function avatarBg(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % AVATAR_COLORS.length
  return AVATAR_COLORS[hash] ?? AVATAR_COLORS[0]
}

function dayAgeLabel(createdAt: string) {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return null
  const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000))
  return `Day ${Math.max(1, days + 1)}`
}

export function RemindersPage() {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('md'))
  const { user } = useAuth()
  const canUpdate = Boolean(user?.permissions.includes('leads.update'))
  const canCreate = Boolean(user?.permissions.includes('leads.create'))

  const [leads, setLeads] = useState<Lead[]>([])
  const [projects, setProjects] = useState<LeadProjectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [when, setWhen] = useState<WhenFilter>('ALL')
  const [projectId, setProjectId] = useState('')
  const [priority, setPriority] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortBy>('time')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addLeadId, setAddLeadId] = useState('')
  const [addDate, setAddDate] = useState(() => isoToDateInput(addDaysIso(null, 1)))
  const [addPriority, setAddPriority] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [callLead, setCallLead] = useState<Lead | null>(null)
  const [callSummary, setCallSummary] = useState('')
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [menuLead, setMenuLead] = useState<Lead | null>(null)
  const [rescheduleLead, setRescheduleLead] = useState<Lead | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState(() => isoToDateInput(addDaysIso(null, 1)))

  const loadProjects = useCallback(async () => {
    const result = await api.get<{ items: LeadProjectOption[] }>('/api/v1/projects')
    setProjects(result.data.items)
  }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (projectId) params.set('project_id', projectId)
      const result = await api.get<LeadList>(`/api/v1/leads?${params}`)
      setLeads(result.data.items)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not load reminders.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadProjects().catch(() => {
      /* projects dropdown stays empty; reminders can still load */
    })
  }, [loadProjects])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const withFollowup = useMemo(
    () => leads.filter((lead) => Boolean(lead.next_followup_at)),
    [leads],
  )

  const scopedFollowup = useMemo(() => {
    if (!projectId) return withFollowup
    return withFollowup.filter((lead) => lead.project_id === projectId)
  }, [projectId, withFollowup])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = scopedFollowup.filter((lead) => {
      const bucket = followWhen(lead.next_followup_at)
      if (when !== 'ALL' && bucket !== when) return false
      if (priority && lead.priority !== priority) return false
      if (
        q &&
        ![
          lead.full_name,
          lead.mobile,
          lead.lead_number,
          lead.requirement,
          lead.city,
          lead.company_name,
          lead.project_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      ) {
        return false
      }
      return true
    })
    rows.sort((a, b) => {
      const rank = (p: LeadPriority) => PRI_RANK[p] ?? 1
      if (sort === 'name') return a.full_name.localeCompare(b.full_name)
      if (sort === 'pri') {
        return rank(a.priority) - rank(b.priority) || (a.next_followup_at ?? '').localeCompare(b.next_followup_at ?? '')
      }
      return (a.next_followup_at ?? '').localeCompare(b.next_followup_at ?? '') || rank(a.priority) - rank(b.priority)
    })
    return rows
  }, [priority, scopedFollowup, search, sort, when])

  const counts = useMemo(() => {
    const base = { ALL: scopedFollowup.length, o: 0, t: 0, u: 0 }
    for (const lead of scopedFollowup) {
      const bucket = followWhen(lead.next_followup_at)
      if (bucket) base[bucket] += 1
    }
    return base
  }, [scopedFollowup])

  const perPage = 8
  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageSafe = Math.min(page, pages)
  const pageRows = filtered.slice((pageSafe - 1) * perPage, pageSafe * perPage)

  useEffect(() => {
    setPage(1)
    setSelected([])
  }, [when, priority, search, sort, projectId])

  function toggleSelect(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function patchLead(id: string, body: Record<string, unknown>, okMessage: string) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.patch(`/api/v1/leads/${id}`, body)
      setNotice(okMessage)
      await load()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not update reminder.')
    } finally {
      setSaving(false)
    }
  }

  function closeMenu() {
    setMenuAnchor(null)
    setMenuLead(null)
  }

  async function snoozeLead(lead: Lead) {
    closeMenu()
    await patchLead(
      lead.id,
      { next_followup_at: addDaysIso(lead.next_followup_at, 1) },
      `Snoozed ${lead.full_name} to tomorrow.`,
    )
  }

  async function markNoAnswer(lead: Lead) {
    closeMenu()
    const note = 'No answer'
    const requirement = lead.requirement ? `${lead.requirement}\n${note}` : note
    await patchLead(
      lead.id,
      {
        requirement,
        next_followup_at: addDaysIso(lead.next_followup_at, 1),
      },
      `Marked no answer for ${lead.full_name}. Reminder moved to tomorrow.`,
    )
  }

  async function saveReschedule(event: FormEvent) {
    event.preventDefault()
    if (!rescheduleLead || !rescheduleDate) {
      setError('Pick a due date.')
      return
    }
    const iso = dateInputToIsoNoon(rescheduleDate)
    if (!iso) {
      setError('Pick a valid due date.')
      return
    }
    await patchLead(rescheduleLead.id, { next_followup_at: iso }, `Rescheduled ${rescheduleLead.full_name}.`)
    setRescheduleLead(null)
  }

  async function snoozeSelected() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      for (const id of selected) {
        const lead = leads.find((item) => item.id === id)
        if (!lead?.next_followup_at) continue
        await api.patch(`/api/v1/leads/${id}`, { next_followup_at: addDaysIso(lead.next_followup_at, 1) })
      }
      setNotice(`${selected.length} reminder${selected.length === 1 ? '' : 's'} moved to tomorrow.`)
      setSelected([])
      await load()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not snooze reminders.')
    } finally {
      setSaving(false)
    }
  }

  async function saveCallDone(event: FormEvent) {
    event.preventDefault()
    if (!callLead) return
    const note = callSummary.trim()
    const requirement = note
      ? `${callLead.requirement ? `${callLead.requirement}\n` : ''}Call: ${note}`
      : callLead.requirement
    await patchLead(
      callLead.id,
      {
        status: 'contacted',
        requirement,
        next_followup_at: addDaysIso(null, 3),
      },
      `Call done for ${callLead.full_name}.`,
    )
    setCallLead(null)
    setCallSummary('')
  }

  async function saveReminder(event: FormEvent) {
    event.preventDefault()
    if (!addLeadId || !addDate) {
      setError('Pick a lead and due date.')
      return
    }
    const iso = dateInputToIsoNoon(addDate)
    if (!iso) {
      setError('Pick a valid due date.')
      return
    }
    const body: Record<string, unknown> = { next_followup_at: iso }
    if (addPriority) body.priority = addPriority
    if (addNotes.trim()) {
      const lead = leads.find((item) => item.id === addLeadId)
      body.requirement = `${lead?.requirement ? `${lead.requirement}\n` : ''}Reminder: ${addNotes.trim()}`
    }
    await patchLead(addLeadId, body, 'Reminder saved.')
    setAddOpen(false)
    setAddNotes('')
  }

  const addLeadOptions = useMemo(() => {
    if (!projectId) return leads
    return leads.filter((lead) => lead.project_id === projectId)
  }, [leads, projectId])

  if (loading && leads.length === 0) return <LoadingScreen />

  if (!loading && leads.length === 0 && !projectId) {
    return (
      <Stack spacing={2}>
        <Typography variant="h1">Reminders</Typography>
        {error ? <ErrorAlert message={error} /> : null}
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', p: 3 }}>
          <Typography sx={{ mb: 1.5 }}>No leads yet.</Typography>
          {canCreate ? (
            <Button component={RouterLink} to="/app/leads" variant="contained">
              Create lead
            </Button>
          ) : null}
        </Box>
      </Stack>
    )
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'flex-start' }, justifyContent: 'space-between' }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h1">Reminders</Typography>
          <Typography color="text.secondary">
            Never miss an important follow-up. Stay on track, close more deals.
          </Typography>
        </Stack>
        {canUpdate ? (
          <Button variant="contained" onClick={() => setAddOpen(true)} sx={{ flexShrink: 0 }}>
            + Add reminder
          </Button>
        ) : null}
      </Stack>

      {error ? <ErrorAlert message={error} /> : null}
      {notice ? (
        <Box sx={{ bgcolor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: 2, px: 1.5, py: 1 }}>
          <Typography variant="body2">{notice}</Typography>
        </Box>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
        {(['ALL', 'o', 't', 'u'] as WhenFilter[]).map((key) => {
          const on = when === key
          const tone = key === 'ALL' ? null : WHEN_CHIP[key]
          return (
            <Chip
              key={key}
              clickable
              label={`${key === 'ALL' ? 'All' : tone?.label} (${counts[key]})`}
              onClick={() => setWhen(key)}
              sx={{
                height: 36,
                px: 0.5,
                fontWeight: 700,
                bgcolor: on ? (tone?.color ?? 'primary.main') : tone ? `${tone.bg}` : '#fff',
                color: on ? '#fff' : tone?.color ?? 'text.primary',
                border: '1px solid',
                borderColor: on ? (tone?.color ?? 'primary.main') : tone?.bg ?? 'divider',
                '&:hover': { opacity: 0.92 },
              }}
            />
          )
        })}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1.1fr 0.9fr 0.8fr 1.4fr' },
        }}
      >
        <TextField
          select
          label="Project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <MenuItem value="">All projects</MenuItem>
          {projects.map((project) => (
            <MenuItem key={project.id} value={project.id}>
              {project.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="When" value={when} onChange={(event) => setWhen(event.target.value as WhenFilter)}>
          <MenuItem value="ALL">All dates</MenuItem>
          <MenuItem value="o">Overdue</MenuItem>
          <MenuItem value="t">Due today</MenuItem>
          <MenuItem value="u">Upcoming</MenuItem>
        </TextField>
        <TextField select label="Priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="high">Hot</MenuItem>
          <MenuItem value="medium">Warm</MenuItem>
          <MenuItem value="low">Cold</MenuItem>
        </TextField>
        <TextField
          label="Search"
          placeholder="Search reminder, lead, mobile"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Box>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', overflow: 'hidden' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{
            px: 2,
            py: 1.5,
            alignItems: { sm: 'center' },
            background: 'linear-gradient(110deg,#eef2ff,#f8fafc 55%,#ecfdf5)',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography fontWeight={700} sx={{ flex: 1 }}>
            {WHEN_LABEL[when]} ({filtered.length})
            {projectId
              ? ` · ${projects.find((project) => project.id === projectId)?.name ?? 'Project'}`
              : ''}
          </Typography>
          <TextField
            select
            size="small"
            label="Sort by"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortBy)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="time">Due date</MenuItem>
            <MenuItem value="pri">Priority</MenuItem>
            <MenuItem value="name">Name</MenuItem>
          </TextField>
        </Stack>

        {selected.length > 0 && canUpdate ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{ px: 2, py: 1, bgcolor: '#eff6ff', borderBottom: '1px solid', borderColor: 'divider', alignItems: 'center' }}
          >
            <Typography variant="body2" fontWeight={600}>
              {selected.length} selected
            </Typography>
            <Button size="small" disabled={saving} onClick={() => void snoozeSelected()}>
              Snooze to tomorrow
            </Button>
            <Button size="small" onClick={() => setSelected([])}>
              Clear
            </Button>
          </Stack>
        ) : null}

        {pageRows.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography fontWeight={600}>Nothing here</Typography>
            <Typography color="text.secondary">
              {projectId
                ? 'No reminders for this project with these filters.'
                : 'No reminders match these filters.'}
            </Typography>
          </Box>
        ) : (
          pageRows.map((lead) => {
            const bucket = followWhen(lead.next_followup_at) ?? 'u'
            const tone = WHEN_CHIP[bucket]
            const priorityKey: LeadPriority = lead.priority in PRIORITY_TONE ? lead.priority : 'medium'
            const pri = PRIORITY_TONE[priorityKey]
            const on = selected.includes(lead.id)
            const day = dayAgeLabel(lead.created_at)
            const projectBit = lead.project_name ? ` · ${lead.project_name}` : ''
            return (
              <Box
                key={lead.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '28px 1fr', md: '28px minmax(0,2.4fr) auto auto' },
                  gap: { xs: 1, md: 1.5 },
                  alignItems: 'center',
                  px: 2,
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: on ? '#eff6ff' : 'transparent',
                  '&:hover': { bgcolor: on ? '#eff6ff' : '#f8fafc' },
                }}
              >
                <Checkbox
                  size="small"
                  checked={on}
                  disabled={!canUpdate}
                  onChange={() => toggleSelect(lead.id)}
                  inputProps={{ 'aria-label': `Select ${lead.full_name}` }}
                />
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: avatarBg(lead.full_name),
                      color: '#1e3a8a',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                    }}
                  >
                    {initials(lead.full_name)}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>
                      {lead.full_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {lead.requirement || lead.company_name || 'Follow-up call'}
                    </Typography>
                    <Typography variant="caption" color="primary.main" fontWeight={600} noWrap display="block">
                      {lead.lead_number}
                      {projectBit} · {lead.mobile}
                    </Typography>
                  </Box>
                </Stack>

                <Stack
                  direction="row"
                  spacing={0.75}
                  useFlexGap
                  flexWrap="wrap"
                  sx={{ gridColumn: { xs: '2', md: 'auto' }, alignItems: 'center' }}
                >
                  {day ? (
                    <Chip size="small" label={day} sx={{ bgcolor: DAY_CHIP.bg, color: DAY_CHIP.color, fontWeight: 700 }} />
                  ) : null}
                  <Chip
                    size="small"
                    label={PRIORITY_LABEL[priorityKey]}
                    sx={{ bgcolor: pri.bg, color: pri.color, fontWeight: 700 }}
                  />
                  <Chip
                    size="small"
                    icon={<TodayOutlinedIcon sx={{ fontSize: '16px !important' }} />}
                    label={formatDueLabel(lead.next_followup_at)}
                    sx={{ bgcolor: '#f8fafc', fontWeight: 600 }}
                  />
                  <Chip size="small" label={tone.label} sx={{ bgcolor: tone.bg, color: tone.color, fontWeight: 700 }} />
                </Stack>

                {canUpdate ? (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ gridColumn: { xs: '2', md: 'auto' }, justifyContent: { md: 'flex-end' } }}
                  >
                    <IconButton
                      size="small"
                      color="primary"
                      disabled={saving}
                      aria-label={`Call done ${lead.full_name}`}
                      onClick={() => {
                        setCallLead(lead)
                        setCallSummary('')
                      }}
                      sx={{ bgcolor: '#e0e7ff', '&:hover': { bgcolor: '#c7d2fe' } }}
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={saving}
                      aria-label={`More actions for ${lead.full_name}`}
                      onClick={(event) => {
                        setMenuAnchor(event.currentTarget)
                        setMenuLead(lead)
                      }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ) : null}
              </Box>
            )
          })
        )}

        <Stack direction="row" spacing={1} sx={{ px: 2, py: 1.5, alignItems: 'center', color: 'text.secondary' }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            Showing {pageRows.length} of {filtered.length} reminders
          </Typography>
          <Button size="small" disabled={pageSafe <= 1} onClick={() => setPage((current) => current - 1)}>
            ‹
          </Button>
          <Typography variant="body2">
            {pageSafe} / {pages}
          </Typography>
          <Button size="small" disabled={pageSafe >= pages} onClick={() => setPage((current) => current + 1)}>
            ›
          </Button>
        </Stack>
      </Box>

      <Drawer
        anchor={phone ? 'bottom' : 'right'}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            maxHeight: { xs: '88vh', sm: '100%' },
            borderTopLeftRadius: { xs: 16, sm: 0 },
            borderTopRightRadius: { xs: 16, sm: 0 },
            p: 2.5,
          },
        }}
      >
        <Box component="form" onSubmit={(event) => void saveReminder(event)}>
          <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Add reminder
            </Typography>
            <IconButton aria-label="Close" onClick={() => setAddOpen(false)}>
              ✕
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set a custom follow-up date for a lead.
          </Typography>
          <Stack spacing={2}>
            <TextField
              select
              label="Related lead"
              required
              value={addLeadId}
              onChange={(event) => setAddLeadId(event.target.value)}
            >
              {addLeadOptions.map((lead) => (
                <MenuItem key={lead.id} value={lead.id}>
                  {lead.full_name} · {lead.lead_number}
                  {lead.project_name ? ` · ${lead.project_name}` : ''}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Due date"
                type="date"
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={addDate}
                onChange={(event) => setAddDate(event.target.value)}
              />
              <TextField
                select
                label="Priority"
                fullWidth
                value={addPriority}
                onChange={(event) => setAddPriority(event.target.value)}
              >
                <MenuItem value="">Keep current</MenuItem>
                <MenuItem value="high">Hot</MenuItem>
                <MenuItem value="medium">Warm</MenuItem>
                <MenuItem value="low">Cold</MenuItem>
              </TextField>
            </Stack>
            <TextField
              label="Notes"
              multiline
              minRows={3}
              placeholder="Why this date? Add important details."
              value={addNotes}
              onChange={(event) => setAddNotes(event.target.value)}
            />
            <Stack direction="row" spacing={1}>
              <Button fullWidth onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button fullWidth type="submit" variant="contained" disabled={saving}>
                Save reminder
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Drawer>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          component={RouterLink}
          to="/app/leads"
          onClick={closeMenu}
        >
          Open lead
        </MenuItem>
        <MenuItem
          disabled={saving || !menuLead}
          onClick={() => menuLead && void markNoAnswer(menuLead)}
        >
          No answer
        </MenuItem>
        <MenuItem
          disabled={saving || !menuLead}
          onClick={() => menuLead && void snoozeLead(menuLead)}
        >
          Snooze to tomorrow
        </MenuItem>
        <MenuItem
          disabled={saving || !menuLead}
          onClick={() => {
            if (!menuLead) return
            setRescheduleLead(menuLead)
            setRescheduleDate(isoToDateInput(addDaysIso(menuLead.next_followup_at, 1)))
            closeMenu()
          }}
        >
          Reschedule
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(callLead)} onClose={() => setCallLead(null)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={(event) => void saveCallDone(event)}>
          <DialogTitle>Call done · {callLead?.full_name}</DialogTitle>
          <DialogContent>
            <TextField
              label="Call summary"
              placeholder="What happened on the call?"
              value={callSummary}
              fullWidth
              multiline
              minRows={3}
              autoFocus
              sx={{ mt: 1 }}
              onChange={(event) => setCallSummary(event.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCallLead(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(rescheduleLead)} onClose={() => setRescheduleLead(null)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={(event) => void saveReschedule(event)}>
          <DialogTitle>Reschedule · {rescheduleLead?.full_name}</DialogTitle>
          <DialogContent>
            <TextField
              label="New due date"
              type="date"
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={rescheduleDate}
              sx={{ mt: 1 }}
              onChange={(event) => setRescheduleDate(event.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRescheduleLead(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              Save date
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  )
}
