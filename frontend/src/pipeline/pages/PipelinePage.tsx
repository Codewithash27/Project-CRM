import MoreVertIcon from '@mui/icons-material/MoreVert'
import {
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
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

import { ErrorAlert } from '../../components/common/ErrorAlert'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { formatDueLabel, followWhen } from '../../leads/lead-dates'
import {
  LEAD_PRIORITIES,
  LEAD_SOURCES,
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
import { PipelineStage, PipelineStageList, STAGE_COLOR_PRESETS } from '../types'

function money(value: string | null) {
  if (!value) return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function dayAge(createdAt: string) {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return null
  const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000))
  return `Day ${Math.max(1, days + 1)}`
}

function expectedSum(leads: Lead[]) {
  return leads.reduce((sum, lead) => sum + (Number(lead.expected_value) || 0), 0)
}

type StageForm = {
  label: string
  color: string
  is_entry: boolean
  is_won: boolean
  is_lost: boolean
}

function blankStageForm(): StageForm {
  return { label: '', color: '#64748b', is_entry: false, is_won: false, is_lost: false }
}

export function PipelinePage() {
  const { user } = useAuth()
  const canManage = Boolean(
    user?.roles.includes('BUSINESS_OWNER') || user?.roles.includes('SUPER_ADMIN'),
  )
  const canMove = Boolean(user?.permissions.includes('leads.update'))

  const [stages, setStages] = useState<PipelineStage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [projects, setProjects] = useState<LeadProjectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [projectId, setProjectId] = useState('')
  const [source, setSource] = useState('')
  const [priority, setPriority] = useState('')
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [menuLead, setMenuLead] = useState<Lead | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [stageForm, setStageForm] = useState<StageForm>(blankStageForm())
  const [editStage, setEditStage] = useState<PipelineStage | null>(null)
  const [deleteStage, setDeleteStage] = useState<PipelineStage | null>(null)
  const [moveToKey, setMoveToKey] = useState('')
  const [saving, setSaving] = useState(false)

  const loadStages = useCallback(async () => {
    const result = await api.get<PipelineStageList>('/api/v1/pipeline-stages')
    setStages(result.data.items)
    return result.data.items
  }, [])

  const loadLeads = useCallback(async () => {
    const params = new URLSearchParams({ limit: '500' })
    if (search.trim()) params.set('search', search.trim())
    if (projectId) params.set('project_id', projectId)
    if (source) params.set('source', source)
    if (priority) params.set('priority', priority)
    const result = await api.get<LeadList>(`/api/v1/leads?${params}`)
    setLeads(result.data.items)
  }, [search, projectId, source, priority])

  const loadProjects = useCallback(async () => {
    const result = await api.get<{ items: LeadProjectOption[] }>('/api/v1/projects')
    setProjects(result.data.items)
  }, [])

  const refresh = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      await Promise.all([loadStages(), loadLeads(), loadProjects()])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the pipeline.')
    } finally {
      setLoading(false)
    }
  }, [loadStages, loadLeads, loadProjects])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const byStage = useMemo(() => {
    const map = new Map<string, Lead[]>()
    for (const stage of stages) map.set(stage.key, [])
    for (const lead of leads) {
      const key = lead.status
      const list = map.get(key)
      if (list) list.push(lead)
      else {
        const orphan = map.get('__other__') ?? []
        orphan.push(lead)
        map.set('__other__', orphan)
      }
    }
    return map
  }, [stages, leads])

  async function moveLead(leadId: string, status: string) {
    if (!canMove) return
    setError(null)
    try {
      await api.patch<Lead>(`/api/v1/leads/${leadId}`, { status })
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, status } : lead)))
      setMenuAnchor(null)
      setMenuLead(null)
      await loadStages()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not move the lead.')
    }
  }

  async function saveStage(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (editStage) {
        await api.patch(`/api/v1/pipeline-stages/${editStage.id}`, stageForm)
      } else {
        await api.post('/api/v1/pipeline-stages', stageForm)
      }
      setEditStage(null)
      setStageForm(blankStageForm())
      await loadStages()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the stage.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteStage) return
    setSaving(true)
    setError(null)
    try {
      const q = moveToKey ? `?move_to_stage_key=${encodeURIComponent(moveToKey)}` : ''
      await api.delete(`/api/v1/pipeline-stages/${deleteStage.id}${q}`)
      setDeleteStage(null)
      setMoveToKey('')
      await Promise.all([loadStages(), loadLeads()])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the stage.')
    } finally {
      setSaving(false)
    }
  }

  async function moveStage(stageId: string, direction: -1 | 1) {
    const index = stages.findIndex((stage) => stage.id === stageId)
    const swap = index + direction
    if (index < 0 || swap < 0 || swap >= stages.length) return
    const next = [...stages]
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setSaving(true)
    try {
      await api.post('/api/v1/pipeline-stages/reorder', {
        stage_ids: next.map((stage) => stage.id),
      })
      setStages(next.map((stage, order) => ({ ...stage, sort_order: order + 1 })))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reorder stages.')
      await loadStages()
    } finally {
      setSaving(false)
    }
  }

  if (loading && stages.length === 0) return <LoadingScreen />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, height: '100%' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <Box>
          <Typography variant="h1">Sales Pipeline</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            All your projects. Move leads between stages to track progress. Drag a card, or use the menu.
          </Typography>
        </Box>
        {canManage ? (
          <Button variant="outlined" onClick={() => setManageOpen(true)} sx={{ alignSelf: 'flex-start' }}>
            Manage stages
          </Button>
        ) : null}
      </Stack>

      {error ? <ErrorAlert message={error} /> : null}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search name, mobile, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220, flex: 1 }}
        />
        <TextField
          select
          size="small"
          label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          sx={{ minWidth: 160 }}
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
          label="Source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All sources</MenuItem>
          {LEAD_SOURCES.map((item) => (
            <MenuItem key={item} value={item}>
              {item}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          sx={{ minWidth: 130 }}
        >
          <MenuItem value="">All priorities</MenuItem>
          {LEAD_PRIORITIES.map((item) => (
            <MenuItem key={item} value={item}>
              {PRIORITY_LABEL[item]}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          overflowX: 'auto',
          pb: 1,
          flex: 1,
          alignItems: 'stretch',
          minHeight: 420,
        }}
      >
        {stages.map((stage) => {
          const column = byStage.get(stage.key) ?? []
          const total = expectedSum(column)
          return (
            <Box
              key={stage.id}
              onDragOver={(e) => {
                if (!canMove) return
                e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                const leadId = e.dataTransfer.getData('text/lead-id') || draggingId
                if (leadId) void moveLead(leadId, stage.key)
                setDraggingId(null)
              }}
              sx={{
                minWidth: 260,
                maxWidth: 300,
                flex: '0 0 280px',
                bgcolor: '#fff',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderTop: `4px solid ${stage.color}`,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '100%',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.25 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    size="small"
                    label={stage.label}
                    sx={{ bgcolor: `${stage.color}33`, color: '#0f172a', fontWeight: 700 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {column.length}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {total ? `₹${total.toLocaleString('en-IN')} expected` : '—'}
                </Typography>
              </Stack>
              <Stack spacing={1} sx={{ px: 1, pb: 1, overflowY: 'auto', flex: 1 }}>
                {column.map((lead) => {
                  const when = followWhen(lead.next_followup_at)
                  const pTone = PRIORITY_TONE[lead.priority as LeadPriority] ?? PRIORITY_TONE.medium
                  return (
                    <Box
                      key={lead.id}
                      draggable={canMove}
                      onDragStart={(e) => {
                        setDraggingId(lead.id)
                        e.dataTransfer.setData('text/lead-id', lead.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: '#fff',
                        cursor: canMove ? 'grab' : 'default',
                        opacity: draggingId === lead.id ? 0.6 : 1,
                        '&:hover': { borderColor: stage.color },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={700} noWrap>
                            {lead.full_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }} noWrap>
                            {lead.requirement || lead.project_name || lead.lead_number}
                          </Typography>
                        </Box>
                        {canMove ? (
                          <IconButton
                            size="small"
                            aria-label="Move lead"
                            onClick={(e) => {
                              setMenuAnchor(e.currentTarget)
                              setMenuLead(lead)
                            }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        ) : null}
                      </Stack>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          mt: 0.75,
                          color: when === 'o' ? 'error.main' : 'text.secondary',
                          fontWeight: when === 'o' ? 700 : 500,
                        }}
                      >
                        Follow-up: {formatDueLabel(lead.next_followup_at)}
                        {when === 'o' ? ' · overdue' : ''}
                      </Typography>
                      {money(lead.expected_value) ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {money(lead.expected_value)} (est.)
                        </Typography>
                      ) : null}
                      <Stack direction="row" spacing={0.75} sx={{ mt: 1 }} useFlexGap flexWrap="wrap">
                        <Chip
                          size="small"
                          label={PRIORITY_LABEL[lead.priority as LeadPriority] ?? lead.priority}
                          sx={{ height: 22, bgcolor: pTone.bg, color: pTone.color, fontWeight: 700 }}
                        />
                        {dayAge(lead.created_at) ? (
                          <Chip size="small" label={dayAge(lead.created_at)} sx={{ height: 22 }} />
                        ) : null}
                      </Stack>
                    </Box>
                  )
                })}
              </Stack>
            </Box>
          )
        })}
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {stages.map((stage) => (
          <MenuItem
            key={stage.id}
            disabled={menuLead?.status === stage.key}
            onClick={() => menuLead && void moveLead(menuLead.id, stage.key)}
          >
            Move to {stage.label}
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={manageOpen} onClose={() => setManageOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Manage pipeline stages</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add, rename, recolor, reorder, or remove columns. Salespeople can only move leads.
          </Typography>
          <Stack spacing={1.25} sx={{ mb: 2 }}>
            {stages.map((stage, index) => (
              <Stack
                key={stage.id}
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
              >
                <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: stage.color, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} noWrap>
                    {stage.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stage.key}
                    {stage.is_entry ? ' · entry' : ''}
                    {stage.is_won ? ' · won' : ''}
                    {stage.is_lost ? ' · lost' : ''}
                    {` · ${stage.lead_count} leads`}
                  </Typography>
                </Box>
                <Button size="small" disabled={index === 0 || saving} onClick={() => void moveStage(stage.id, -1)}>
                  Up
                </Button>
                <Button
                  size="small"
                  disabled={index === stages.length - 1 || saving}
                  onClick={() => void moveStage(stage.id, 1)}
                >
                  Down
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setEditStage(stage)
                    setStageForm({
                      label: stage.label,
                      color: stage.color,
                      is_entry: stage.is_entry,
                      is_won: stage.is_won,
                      is_lost: stage.is_lost,
                    })
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    setDeleteStage(stage)
                    setMoveToKey(stages.find((item) => item.id !== stage.id)?.key ?? '')
                  }}
                >
                  Remove
                </Button>
              </Stack>
            ))}
          </Stack>

          <Box component="form" onSubmit={(e) => void saveStage(e)}>
            <Typography fontWeight={700} sx={{ mb: 1 }}>
              {editStage ? `Edit ${editStage.label}` : 'Add stage'}
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                required
                label="Label"
                value={stageForm.label}
                onChange={(e) => setStageForm((prev) => ({ ...prev, label: e.target.value }))}
                fullWidth
              />
              <TextField
                select
                label="Color"
                value={stageForm.color}
                onChange={(e) => setStageForm((prev) => ({ ...prev, color: e.target.value }))}
                fullWidth
              >
                {STAGE_COLOR_PRESETS.map((color) => (
                  <MenuItem key={color} value={color}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 16, height: 16, bgcolor: color, borderRadius: 0.5 }} />
                      <span>{color}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={stageForm.is_entry}
                    onChange={(e) => setStageForm((prev) => ({ ...prev, is_entry: e.target.checked }))}
                  />
                }
                label="Entry stage (new leads land here)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={stageForm.is_won}
                    onChange={(e) => setStageForm((prev) => ({ ...prev, is_won: e.target.checked }))}
                  />
                }
                label="Won stage"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={stageForm.is_lost}
                    onChange={(e) => setStageForm((prev) => ({ ...prev, is_lost: e.target.checked }))}
                  />
                }
                label="Lost stage"
              />
              <Stack direction="row" spacing={1}>
                <Button type="submit" variant="contained" disabled={saving}>
                  {editStage ? 'Save stage' : 'Add stage'}
                </Button>
                {editStage ? (
                  <Button
                    onClick={() => {
                      setEditStage(null)
                      setStageForm(blankStageForm())
                    }}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManageOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteStage)} onClose={() => setDeleteStage(null)} fullWidth maxWidth="xs">
        <DialogTitle>Remove {deleteStage?.label}?</DialogTitle>
        <DialogContent>
          {(deleteStage?.lead_count ?? 0) > 0 ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Typography>
                {deleteStage?.lead_count} lead(s) are in this stage. Move them to another stage first.
              </Typography>
              <TextField
                select
                label="Move leads to"
                value={moveToKey}
                onChange={(e) => setMoveToKey(e.target.value)}
                fullWidth
              >
                {stages
                  .filter((stage) => stage.id !== deleteStage?.id)
                  .map((stage) => (
                    <MenuItem key={stage.id} value={stage.key}>
                      {stage.label}
                    </MenuItem>
                  ))}
              </TextField>
            </Stack>
          ) : (
            <Typography sx={{ mt: 1 }}>This stage has no leads. It can be removed safely.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteStage(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={saving || ((deleteStage?.lead_count ?? 0) > 0 && !moveToKey)}
            onClick={() => void confirmDelete()}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
