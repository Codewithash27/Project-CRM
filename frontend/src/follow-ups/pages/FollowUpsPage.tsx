import MoreVertIcon from '@mui/icons-material/MoreVert'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ErrorAlert } from '../../components/common/ErrorAlert'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import {
  FollowupPlanStep,
  gapForStep,
  loadFollowupPlan,
  nextPlanStep,
  planLabels,
} from '../../followup-plan/plan'
import { addDaysIso, followWhen, formatDueLabel } from '../../leads/lead-dates'
import {
  Lead,
  LeadList,
  LeadProjectOption,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  type LeadPriority,
} from '../../leads/types'
import { ApiError } from '../../services/api/errors'
import { api } from '../../services/api/client'
import { useAuth } from '../../store/auth-context'

type SessionTally = { connected: number; noAnswer: number; snoozed: number; skipped: number }

function dueDisplay(lead: Lead) {
  const when = followWhen(lead.next_followup_at)
  const label = formatDueLabel(lead.next_followup_at)
  if (!lead.next_followup_at) return { label: '—', overdue: false }
  if (when === 'o') return { label: `${label} (overdue)`, overdue: true }
  return { label, overdue: false }
}

export function FollowUpsPage() {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('md'))
  const { user } = useAuth()
  const canUpdate = Boolean(user?.permissions.includes('leads.update'))

  const [items, setItems] = useState<Lead[]>([])
  const [projects, setProjects] = useState<LeadProjectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [projectId, setProjectId] = useState('')
  const [step, setStep] = useState('')
  const [saving, setSaving] = useState(false)
  const [tally, setTally] = useState<SessionTally>({ connected: 0, noAnswer: 0, snoozed: 0, skipped: 0 })
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [menuLead, setMenuLead] = useState<Lead | null>(null)
  const [plan, setPlan] = useState<FollowupPlanStep[]>(() => loadFollowupPlan(user?.company_id))

  useEffect(() => {
    setPlan(loadFollowupPlan(user?.company_id))
  }, [user?.company_id])

  useEffect(() => {
    void (async () => {
      try {
        const result = await api.get<{ items: LeadProjectOption[] }>('/api/v1/projects')
        setProjects(result.data.items)
      } catch {
        setProjects([])
      }
    })()
  }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      const params = new URLSearchParams({ limit: '200', exclude_lost: 'true' })
      if (projectId) params.set('project_id', projectId)
      if (step) params.set('plan_step', step)
      const result = await api.get<LeadList>(`/api/v1/leads?${params}`)
      const rows = [...result.data.items].sort((a, b) => {
        const aDue = a.next_followup_at ?? '9999'
        const bDue = b.next_followup_at ?? '9999'
        return aDue.localeCompare(bDue)
      })
      setItems(rows)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not load follow-ups.')
    } finally {
      setLoading(false)
    }
  }, [projectId, step])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const subtitle = useMemo(
    () =>
      `Open plans by step. Completed this session: ${tally.connected} connected · ${tally.noAnswer} no answer · ${tally.snoozed} snoozed · ${tally.skipped} skipped.`,
    [tally],
  )

  function closeMenu() {
    setMenuAnchor(null)
    setMenuLead(null)
  }

  async function patchOutcome(
    lead: Lead,
    body: Record<string, unknown>,
    kind: keyof SessionTally,
    message: string,
  ) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.patch(`/api/v1/leads/${lead.id}`, body)
      setTally((current) => ({ ...current, [kind]: current[kind] + 1 }))
      setNotice(message)
      closeMenu()
      await load()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not update follow-up.')
    } finally {
      setSaving(false)
    }
  }

  async function onConnected(lead: Lead) {
    const current = lead.plan_step || plan[0]?.label || 'Day 1'
    const next = nextPlanStep(plan, current)
    const target = next?.label ?? current
    const body: Record<string, unknown> = {
      next_followup_at: next ? addDaysIso(null, next.gapDays) : addDaysIso(null, gapForStep(plan, target)),
      plan_step: target,
    }
    if (lead.status === 'new') body.status = 'contacted'
    const note = 'Connected'
    body.requirement = lead.requirement ? `${lead.requirement}\n${note}` : note
    await patchOutcome(lead, body, 'connected', `Connected · ${lead.full_name}`)
  }

  async function onNoAnswer(lead: Lead) {
    const note = 'No answer'
    await patchOutcome(
      lead,
      {
        requirement: lead.requirement ? `${lead.requirement}\n${note}` : note,
        next_followup_at: addDaysIso(lead.next_followup_at, 1),
      },
      'noAnswer',
      `No answer · ${lead.full_name}`,
    )
  }

  async function onSnooze(lead: Lead) {
    await patchOutcome(
      lead,
      { next_followup_at: addDaysIso(lead.next_followup_at, 1) },
      'snoozed',
      `Snoozed · ${lead.full_name}`,
    )
  }

  async function onSkip(lead: Lead) {
    await patchOutcome(lead, { next_followup_at: null }, 'skipped', `Skipped · ${lead.full_name}`)
  }

  if (loading && items.length === 0) return <LoadingScreen />

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.75}>
        <Typography variant="h1">Follow-ups</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 760, lineHeight: 1.55 }}>
          {subtitle}
        </Typography>
      </Stack>

      {error ? <ErrorAlert message={error} /> : null}
      {notice ? (
        <Typography color="success.main" variant="body2" fontWeight={600}>
          {notice}
        </Typography>
      ) : null}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { sm: 'flex-start' } }}
      >
        <TextField
          select
          size="small"
          label="Project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 260 } }}
        >
          <MenuItem value="">All projects</MenuItem>
          {projects.map((project) => (
            <MenuItem key={project.id} value={project.id}>
              {project.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Plan step"
          value={step}
          onChange={(event) => setStep(event.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 260 } }}
        >
          <MenuItem value="">All steps</MenuItem>
          {planLabels(plan).map((item) => (
            <MenuItem key={item} value={item}>
              {item}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

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
        {!phone ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '110px minmax(100px,1fr) minmax(120px,1.2fr) 90px 120px 90px 48px',
              gap: 1,
              px: 2,
              py: 1.25,
              bgcolor: '#fafbfc',
              borderBottom: '1px solid',
              borderColor: 'divider',
              typography: 'caption',
              fontWeight: 700,
              color: 'text.secondary',
            }}
          >
            <Box>Lead ID</Box>
            <Box>Project</Box>
            <Box>Name</Box>
            <Box>Plan step</Box>
            <Box>Due</Box>
            <Box>Priority</Box>
            <Box />
          </Box>
        ) : null}

        {items.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            {step ? `No follow-ups for ${step}.` : 'No open follow-ups in your scope.'}
          </Typography>
        ) : (
          items.map((lead) => {
            const due = dueDisplay(lead)
            const priorityKey: LeadPriority = lead.priority in PRIORITY_TONE ? lead.priority : 'medium'
            return (
              <Box
                key={lead.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr auto',
                    md: '110px minmax(100px,1fr) minmax(120px,1.2fr) 90px 120px 90px 48px',
                  },
                  gap: { xs: 1, md: 1 },
                  alignItems: 'center',
                  px: 2,
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: '#f8fafc' },
                }}
              >
                {phone ? (
                  <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>
                      {lead.full_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {lead.lead_number}
                      {lead.project_name ? ` · ${lead.project_name}` : ''} · {lead.plan_step || 'Day 1'}
                    </Typography>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      <Typography
                        variant="body2"
                        fontWeight={due.overdue ? 700 : 500}
                        color={due.overdue ? 'error.main' : 'text.primary'}
                      >
                        {due.label}
                      </Typography>
                      <Chip
                        size="small"
                        label={PRIORITY_LABEL[priorityKey]}
                        sx={{ bgcolor: PRIORITY_TONE[priorityKey].bg, color: PRIORITY_TONE[priorityKey].color, fontWeight: 700 }}
                      />
                    </Stack>
                    {canUpdate ? (
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        <Button size="small" variant="contained" disabled={saving} onClick={() => void onConnected(lead)}>
                          Connected
                        </Button>
                        <Button size="small" disabled={saving} onClick={() => void onNoAnswer(lead)}>
                          No answer
                        </Button>
                        <Button size="small" disabled={saving} onClick={() => void onSnooze(lead)}>
                          Snooze
                        </Button>
                        <Button size="small" disabled={saving} onClick={() => void onSkip(lead)}>
                          Skip
                        </Button>
                      </Stack>
                    ) : null}
                  </Stack>
                ) : (
                  <>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {lead.lead_number}
                    </Typography>
                    <Typography variant="body2" noWrap>
                      {lead.project_name || '—'}
                    </Typography>
                    <Typography fontWeight={700} noWrap>
                      {lead.full_name}
                    </Typography>
                    <Chip size="small" label={lead.plan_step || 'Day 1'} sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }} />
                    <Typography
                      variant="body2"
                      fontWeight={due.overdue ? 700 : 500}
                      color={due.overdue ? 'error.main' : 'text.primary'}
                    >
                      {due.label}
                    </Typography>
                    <Chip
                      size="small"
                      label={PRIORITY_LABEL[priorityKey]}
                      sx={{ bgcolor: PRIORITY_TONE[priorityKey].bg, color: PRIORITY_TONE[priorityKey].color, fontWeight: 700 }}
                    />
                  </>
                )}
                {canUpdate && !phone ? (
                  <IconButton
                    size="small"
                    disabled={saving}
                    aria-label={`Actions for ${lead.full_name}`}
                    onClick={(event) => {
                      setMenuAnchor(event.currentTarget)
                      setMenuLead(lead)
                    }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                ) : phone ? (
                  <span />
                ) : null}
              </Box>
            )
          })
        )}
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem disabled={saving || !menuLead} onClick={() => menuLead && void onConnected(menuLead)}>
          Connected
        </MenuItem>
        <MenuItem disabled={saving || !menuLead} onClick={() => menuLead && void onNoAnswer(menuLead)}>
          No answer
        </MenuItem>
        <MenuItem disabled={saving || !menuLead} onClick={() => menuLead && void onSnooze(menuLead)}>
          Snooze
        </MenuItem>
        <MenuItem disabled={saving || !menuLead} onClick={() => menuLead && void onSkip(menuLead)}>
          Skip
        </MenuItem>
      </Menu>
    </Stack>
  )
}
