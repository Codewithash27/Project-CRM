import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

import { ErrorAlert } from '../../components/common/ErrorAlert'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { ApiError } from '../../services/api/errors'
import { api } from '../../services/api/client'
import {
  FIELD_TYPE_OPTIONS,
  LeadField,
  LeadFieldList,
  LeadFieldProjectOption,
  LeadFieldType,
  OPTION_TYPES,
} from '../types'

type FieldForm = {
  label: string
  field_type: LeadFieldType
  optionsText: string
  is_required: boolean
  show_in_list: boolean
  is_active: boolean
}

function blankForm(): FieldForm {
  return {
    label: '',
    field_type: 'text',
    optionsText: '',
    is_required: false,
    show_in_list: true,
    is_active: true,
  }
}

function formFromField(field: LeadField): FieldForm {
  return {
    label: field.label,
    field_type: field.field_type,
    optionsText: (field.options ?? []).join('\n'),
    is_required: field.is_required,
    show_in_list: field.show_in_list,
    is_active: field.is_active,
  }
}

function parseOptions(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function LeadFieldsPage() {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('md'))
  const [projects, setProjects] = useState<LeadFieldProjectOption[]>([])
  const [projectId, setProjectId] = useState('')
  const [data, setData] = useState<LeadFieldList | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LeadField | null>(null)
  const [form, setForm] = useState<FieldForm>(blankForm())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const needsOptions = OPTION_TYPES.has(form.field_type)
  const typeLocked = Boolean(editing && editing.leads_with_data > 0)

  const loadProjects = useCallback(async () => {
    try {
      const result = await api.get<{ items: LeadFieldProjectOption[] }>('/api/v1/projects')
      setProjects(result.data.items)
      return result.data.items
    } catch (requestError) {
      setProjects([])
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not load your projects. Refresh and try again.',
      )
      return [] as LeadFieldProjectOption[]
    }
  }, [])

  const loadFields = useCallback(async (selected: string) => {
    if (!selected) {
      setData(null)
      return
    }
    setError('')
    try {
      const result = await api.get<LeadFieldList>(`/api/v1/lead-fields?project_id=${selected}`)
      setData(result.data)
    } catch (requestError) {
      setData(null)
      setError(requestError instanceof ApiError ? requestError.message : 'Could not load lead fields.')
    }
  }, [])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const list = await loadProjects()
      const first = list[0]?.id ?? ''
      setProjectId(first)
      if (first) await loadFields(first)
      setLoading(false)
    })()
  }, [loadFields, loadProjects])

  async function onProjectChange(next: string) {
    setProjectId(next)
    setNotice('')
    setLoading(true)
    await loadFields(next)
    setLoading(false)
  }

  function openAdd() {
    setEditing(null)
    setForm(blankForm())
    setFieldErrors({})
    setDialogOpen(true)
  }

  function openEdit(field: LeadField) {
    setEditing(field)
    setForm(formFromField(field))
    setFieldErrors({})
    setDialogOpen(true)
  }

  function validateForm(): boolean {
    const next: Record<string, string> = {}
    if (form.label.trim().length < 2) next.label = 'Label must be 2 to 40 characters.'
    if (needsOptions && parseOptions(form.optionsText).length === 0) {
      next.optionsText = 'Add at least one option, one per line.'
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSaveField(event: FormEvent) {
    event.preventDefault()
    if (!projectId || !validateForm()) return
    setSaving(true)
    setError('')
    setNotice('')
    const body = {
      label: form.label.trim(),
      field_type: form.field_type,
      options: needsOptions ? parseOptions(form.optionsText) : null,
      is_required: form.is_required,
      show_in_list: form.show_in_list,
      is_active: form.is_active,
    }
    try {
      if (editing) {
        await api.patch(`/api/v1/lead-fields/${editing.id}`, body)
        setNotice('Field updated.')
      } else {
        await api.post('/api/v1/lead-fields', { ...body, project_id: projectId })
        setNotice('Field added.')
      }
      setDialogOpen(false)
      await loadFields(projectId)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.details?.length) {
        const next: Record<string, string> = {}
        for (const detail of requestError.details) {
          if (detail.field === 'options') next.optionsText = detail.message
          else next[detail.field] = detail.message
        }
        setFieldErrors(next)
      }
      setError(requestError instanceof ApiError ? requestError.message : 'Could not save field.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleFlag(field: LeadField, key: 'is_required' | 'show_in_list' | 'is_active', value: boolean) {
    setSaving(true)
    setError('')
    try {
      await api.patch(`/api/v1/lead-fields/${field.id}`, { [key]: value })
      await loadFields(projectId)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not update field.')
    } finally {
      setSaving(false)
    }
  }

  async function moveField(field: LeadField, direction: -1 | 1) {
    if (!data) return
    const items = [...data.items]
    const index = items.findIndex((row) => row.id === field.id)
    const swap = index + direction
    if (index < 0 || swap < 0 || swap >= items.length) return
    ;[items[index], items[swap]] = [items[swap], items[index]]
    setSaving(true)
    setError('')
    try {
      const result = await api.post<LeadFieldList>('/api/v1/lead-fields/reorder', {
        project_id: projectId,
        field_ids: items.map((row) => row.id),
      })
      setData(result.data)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not reorder fields.')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(field: LeadField) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api.delete<LeadFieldList>(`/api/v1/lead-fields/${field.id}`)
      setData(result.data)
      setNotice(`Deleted ${field.label}.`)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not delete field.')
    } finally {
      setSaving(false)
    }
  }

  const selectedName = useMemo(
    () => projects.find((project) => project.id === projectId)?.name ?? data?.project_name ?? 'this project',
    [data?.project_name, projectId, projects],
  )

  if (loading && !data && projects.length === 0) {
    return <LoadingScreen />
  }

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.75}>
        <Typography variant="h1">Lead Fields</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720, lineHeight: 1.55 }}>
          Pick a project and add the extra fields its leads need. They appear in Create lead and the lead
          panel, and in the lead table when &quot;In lead table&quot; is ticked.
        </Typography>
      </Stack>

      {error ? <ErrorAlert message={error} /> : null}
      {notice ? (
        <Typography color="success.main" sx={{ fontWeight: 600 }}>
          {notice}
        </Typography>
      ) : null}

      {projects.length === 0 ? (
        <Box sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
          <Typography>No project is available to you yet.</Typography>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              p: { xs: 2, sm: 2.5 },
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              bgcolor: 'background.paper',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: { sm: 'flex-end' } }}
            >
              <TextField
                select
                label="Project"
                value={projectId}
                fullWidth
                sx={{ maxWidth: { sm: 320 } }}
                onChange={(event) => void onProjectChange(event.target.value)}
              >
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name} ({project.code})
                  </MenuItem>
                ))}
              </TextField>
              <Box sx={{ flex: 1 }} />
              <Button variant="contained" onClick={openAdd} disabled={!projectId || saving}>
                + Add field
              </Button>
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 1.5, fontSize: '0.92rem', lineHeight: 1.5 }}>
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Common fields
              </Box>{' '}
              (every project): {(data?.common_fields ?? []).join(', ') || 'Contact person, Mobile, Enquiry date, Location, Email, Requirement, Reference, Lead source, Priority, Follow-up, Status'}.
            </Typography>
          </Box>

          {loading ? (
            <LoadingScreen />
          ) : !data?.items.length ? (
            <Box sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
              <Typography>
                No extra fields yet for {selectedName}. Click <b>+ Add field</b> to create the first one.
              </Typography>
            </Box>
          ) : phone ? (
            <Stack spacing={1.5}>
              {data.items.map((field, index) => (
                <Box
                  key={field.id}
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    bgcolor: 'background.paper',
                    opacity: field.is_active ? 1 : 0.7,
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontWeight: 700 }}>
                        {field.label}
                        {!field.is_active ? ' · inactive' : ''}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {field.field_type_label}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Key <code>{field.key}</code>
                      {field.options?.length ? ` · ${field.options.join(', ')}` : ''}
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={field.is_required}
                          disabled={saving}
                          onChange={(event) => void toggleFlag(field, 'is_required', event.target.checked)}
                        />
                      }
                      label="Required"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={field.show_in_list}
                          disabled={saving}
                          onChange={(event) => void toggleFlag(field, 'show_in_list', event.target.checked)}
                        />
                      }
                      label="In lead table"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={field.is_active}
                          disabled={saving}
                          onChange={(event) => void toggleFlag(field, 'is_active', event.target.checked)}
                        />
                      }
                      label="Active"
                    />
                    <Typography variant="body2" color="text.secondary">
                      Leads with data: {field.leads_with_data}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Button size="small" disabled={saving || index === 0} onClick={() => void moveField(field, -1)}>
                        ↑
                      </Button>
                      <Button
                        size="small"
                        disabled={saving || index === data.items.length - 1}
                        onClick={() => void moveField(field, 1)}
                      >
                        ↓
                      </Button>
                      <Button size="small" onClick={() => openEdit(field)} disabled={saving}>
                        Edit
                      </Button>
                      <Button size="small" color="error" onClick={() => void onDelete(field)} disabled={saving}>
                        Delete
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          ) : (
            <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Order</TableCell>
                    <TableCell>Field</TableCell>
                    <TableCell>Key</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Options</TableCell>
                    <TableCell>Required</TableCell>
                    <TableCell>In lead table</TableCell>
                    <TableCell>Active</TableCell>
                    <TableCell>Leads with data</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((field, index) => (
                    <TableRow key={field.id} sx={{ opacity: field.is_active ? 1 : 0.65 }}>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <Button size="small" disabled={saving || index === 0} onClick={() => void moveField(field, -1)}>
                            ↑
                          </Button>
                          <Button
                            size="small"
                            disabled={saving || index === data.items.length - 1}
                            onClick={() => void moveField(field, 1)}
                          >
                            ↓
                          </Button>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography component="span" sx={{ fontWeight: 700 }}>
                          {field.label}
                        </Typography>
                        {!field.is_active ? (
                          <Typography component="span" variant="body2" color="text.secondary">
                            {' '}
                            inactive
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <code>{field.key}</code>
                      </TableCell>
                      <TableCell>{field.field_type_label}</TableCell>
                      <TableCell>{field.options?.length ? field.options.join(', ') : '—'}</TableCell>
                      <TableCell>
                        <Checkbox
                          size="small"
                          checked={field.is_required}
                          disabled={saving}
                          inputProps={{ 'aria-label': `Required for ${field.label}` }}
                          onChange={(event) => void toggleFlag(field, 'is_required', event.target.checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          size="small"
                          checked={field.show_in_list}
                          disabled={saving}
                          inputProps={{ 'aria-label': `In lead table for ${field.label}` }}
                          onChange={(event) => void toggleFlag(field, 'show_in_list', event.target.checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          size="small"
                          checked={field.is_active}
                          disabled={saving}
                          inputProps={{ 'aria-label': `Active for ${field.label}` }}
                          onChange={(event) => void toggleFlag(field, 'is_active', event.target.checked)}
                        />
                      </TableCell>
                      <TableCell>{field.leads_with_data}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" onClick={() => openEdit(field)} disabled={saving}>
                            Edit
                          </Button>
                          <Button size="small" color="error" onClick={() => void onDelete(field)} disabled={saving}>
                            Delete
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={onSaveField}>
          <DialogTitle>{editing ? 'Edit field' : 'Add field'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <TextField
                label="Field label"
                value={form.label}
                required
                fullWidth
                autoFocus
                disabled={saving}
                error={Boolean(fieldErrors.label)}
                helperText={fieldErrors.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              />
              <TextField
                select
                label={typeLocked ? 'Field type (locked, leads already hold data)' : 'Field type'}
                value={form.field_type}
                fullWidth
                disabled={saving || typeLocked}
                onChange={(event) =>
                  setForm((current) => ({ ...current, field_type: event.target.value as LeadFieldType }))
                }
              >
                {FIELD_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              {needsOptions ? (
                <TextField
                  label="Options, one per line"
                  value={form.optionsText}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={saving}
                  error={Boolean(fieldErrors.optionsText)}
                  helperText={fieldErrors.optionsText || 'Used for Dropdown, Multi-select, and Radio.'}
                  onChange={(event) => setForm((current) => ({ ...current, optionsText: event.target.value }))}
                />
              ) : null}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.is_required}
                    disabled={saving}
                    onChange={(event) => setForm((current) => ({ ...current, is_required: event.target.checked }))}
                  />
                }
                label="Required — must be filled to save a lead"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.show_in_list}
                    disabled={saving}
                    onChange={(event) => setForm((current) => ({ ...current, show_in_list: event.target.checked }))}
                  />
                }
                label="Lead table — show as a column in the lead table"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.is_active}
                    disabled={saving}
                    onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                  />
                }
                label="Active — shown in forms"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {editing ? 'Save field' : 'Add field'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  )
}
