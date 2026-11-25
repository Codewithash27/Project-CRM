import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
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

import { PasswordField } from '../../auth/components/PasswordField'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { DeleteIconButton } from '../../components/common/DeleteIconButton'
import { ErrorAlert } from '../../components/common/ErrorAlert'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { ApiError } from '../../services/api/errors'
import { api } from '../../services/api/client'
import { useAuth } from '../../store/auth-context'

interface TeamProject {
  id: string
  name: string
  code: string
  company_id: string
  company_name: string
}

interface TeamPerson {
  id: string
  full_name: string
  email: string
  mobile: string | null
  role: string
  company_id: string | null
  company_name: string | null
}

interface TeamBoard {
  mode: 'platform' | 'owner'
  companies: { id: string; name: string }[]
  projects: TeamProject[]
  people: TeamPerson[]
  assignments: { project_id: string; user_id: string }[]
  lead_counts: { project_id: string; user_id: string; count: number }[]
  viewer: TeamPerson
}

function assignmentKey(projectId: string, userId: string) {
  return `${projectId}:${userId}`
}

function mobileDigits(value: string) {
  return value.replace(/\D/g, '')
}

function mobileIsValid(value: string) {
  const digits = mobileDigits(value)
  return digits.length === 10 || digits.length === 12
}

export function TeamPage() {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const { refreshUser } = useAuth()
  const [board, setBoard] = useState<TeamBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [companyId, setCompanyId] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mobile, setMobile] = useState('')
  const [ownMobile, setOwnMobile] = useState('')
  const [editTarget, setEditTarget] = useState<TeamPerson | null>(null)
  const [editName, setEditName] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [moveProjectId, setMoveProjectId] = useState('')
  const [fromUserId, setFromUserId] = useState('')
  const [toUserId, setToUserId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<TeamPerson | null>(null)

  const load = useCallback(async (selectedCompany?: string) => {
    setError('')
    try {
      const query = selectedCompany ? `?company_id=${selectedCompany}` : ''
      const result = await api.get<TeamBoard>(`/api/v1/team${query}`)
      setBoard(result.data)
      setOwnMobile(result.data.viewer.mobile ?? '')
      if (result.data.mode === 'platform') {
        setCompanyId((current) => selectedCompany || current || result.data.companies[0]?.id || '')
      }
      const sales = result.data.people.filter((person) => person.role === 'SALESPERSON')
      setMoveProjectId((current) => current || result.data.projects[0]?.id || '')
      setFromUserId((current) => current || sales[0]?.id || '')
      setToUserId((current) => current || sales[1]?.id || sales[0]?.id || '')
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const assigned = useMemo(() => {
    const set = new Set<string>()
    for (const item of board?.assignments ?? []) set.add(assignmentKey(item.project_id, item.user_id))
    return set
  }, [board])

  const leadCountMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of board?.lead_counts ?? []) {
      map.set(assignmentKey(item.project_id, item.user_id), item.count)
    }
    return map
  }, [board])

  const matrixPeople = useMemo(() => {
    if (!board) return []
    if (board.mode === 'platform') return board.people
    return board.people.filter((person) => person.role === 'SALESPERSON')
  }, [board])

  const countPeople = useMemo(() => {
    if (!board || board.mode !== 'owner') return []
    return [board.viewer, ...board.people]
  }, [board])

  async function toggleAssignment(person: TeamPerson, project: TeamProject, next: boolean) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api.patch<TeamBoard>('/api/v1/team/assignments', {
        project_id: project.id,
        user_id: person.id,
        assigned: next,
      })
      setBoard(result.data)
      setNotice(
        result.message?.trim()
          ? result.message
          : next
            ? `Assigned ${person.full_name} to ${project.name}.`
            : `Removed ${person.full_name} from ${project.name}.`,
      )
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not update assignment.')
    } finally {
      setSaving(false)
    }
  }

  async function onAddSalesperson(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    if (!mobileIsValid(mobile)) {
      setError('Mobile number must be 10 or 12 digits.')
      setSaving(false)
      return
    }
    try {
      const result = await api.post<TeamBoard>('/api/v1/team/salespeople', {
        full_name: fullName,
        email,
        password,
        mobile,
      })
      setBoard(result.data)
      setOwnMobile(result.data.viewer.mobile ?? '')
      setAddOpen(false)
      setFullName('')
      setEmail('')
      setPassword('')
      setMobile('')
      setNotice('Salesperson added.')
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not add salesperson.')
    } finally {
      setSaving(false)
    }
  }

  async function onSaveOwnMobile(event: FormEvent) {
    event.preventDefault()
    if (!mobileIsValid(ownMobile)) {
      setError('Mobile number must be 10 or 12 digits.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api.patch<TeamBoard>('/api/v1/team/mobile', { mobile: ownMobile })
      setBoard(result.data)
      setOwnMobile(result.data.viewer.mobile ?? '')
      await refreshUser()
      setNotice('Your mobile number was saved.')
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not save your mobile number.')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(person: TeamPerson) {
    setEditTarget(person)
    setEditName(person.full_name)
    setEditMobile(person.mobile ?? '')
    setError('')
  }

  async function onEditSalesperson(event: FormEvent) {
    event.preventDefault()
    if (!editTarget) return
    if (editName.trim().length < 2) {
      setError('Enter the salesperson name.')
      return
    }
    if (!mobileIsValid(editMobile)) {
      setError('Mobile number must be 10 or 12 digits.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api.patch<TeamBoard>(`/api/v1/team/salespeople/${editTarget.id}`, {
        full_name: editName.trim(),
        mobile: editMobile,
      })
      setBoard(result.data)
      setOwnMobile(result.data.viewer.mobile ?? '')
      setEditTarget(null)
      setNotice('Salesperson updated.')
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not update this salesperson.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteSalesperson() {
    if (!deleteTarget) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api.delete<TeamBoard>(`/api/v1/team/salespeople/${deleteTarget.id}`)
      setBoard(result.data)
      setNotice(result.message || 'Salesperson deleted.')
      setDeleteTarget(null)
    } catch (requestError) {
      setDeleteTarget(null)
      setError(requestError instanceof ApiError ? requestError.message : 'Could not delete this salesperson.')
    } finally {
      setSaving(false)
    }
  }

  async function onMoveLeads(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api.post<{ moved: number }>('/api/v1/team/move-leads', {
        project_id: moveProjectId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        which: 'all',
      })
      setNotice(`Moved ${result.data.moved} lead(s).`)
      await load(companyId || undefined)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not move leads.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !board) return <LoadingScreen />
  if (!board) {
    return (
      <Stack spacing={2}>
        <Typography variant="h1">Team</Typography>
        {error ? <ErrorAlert message={error} /> : null}
      </Stack>
    )
  }

  const isPlatform = board.mode === 'platform'
  const projects = isPlatform && companyId
    ? board.projects.filter((project) => project.company_id === companyId)
    : board.projects
  const people = isPlatform && companyId
    ? matrixPeople.filter((person) => person.company_id === companyId)
    : matrixPeople

  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Typography variant="h1">Team</Typography>
      </Stack>

      {error ? <ErrorAlert message={error} /> : null}
      {notice ? (
        <Typography color="success.main" variant="body2">
          {notice}
        </Typography>
      ) : null}

      {!isPlatform ? (
        <Box
          component="form"
          onSubmit={(event) => void onSaveOwnMobile(event)}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            p: 2,
          }}
        >
          <Typography fontWeight={600}>Your WhatsApp number</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            This name and number are added at the end of messages you send.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'flex-start' } }}>
            <TextField
              label="Mobile number"
              value={ownMobile}
              required
              disabled={saving}
              placeholder="9876543210"
              autoComplete="tel"
              onChange={(event) => setOwnMobile(event.target.value)}
              sx={{ maxWidth: 280 }}
            />
            <Button type="submit" variant="contained" disabled={saving}>
              Save number
            </Button>
          </Stack>
        </Box>
      ) : null}

      {isPlatform ? (
        <TextField
          select
          label="Business"
          value={companyId}
          onChange={(event) => {
            const next = event.target.value
            setCompanyId(next)
            setLoading(true)
            void load(next)
          }}
          sx={{ maxWidth: 360 }}
        >
          {board.companies.map((company) => (
            <MenuItem key={company.id} value={company.id}>
              {company.name}
            </MenuItem>
          ))}
        </TextField>
      ) : null}

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'auto',
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography fontWeight={600}>
            {isPlatform ? 'Business owner × project' : 'Salesperson × project'}
          </Typography>
        </Box>
        {projects.length === 0 || people.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            {isPlatform
              ? 'Create a business, its owners, and projects first. Then tick which owner gets which project.'
              : 'Add a salesperson and wait for projects from the platform admin.'}
          </Typography>
        ) : (
          <Table
            size="small"
            sx={{
              '& .MuiTableCell-root': { borderBottom: 'none' },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>{isPlatform ? 'Business owner' : 'Salesperson'}</TableCell>
                {projects.map((project) => (
                  <TableCell key={project.id} align="center">
                    {project.name}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {people.map((person) => (
                <TableRow key={person.id}>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={600}>{person.full_name}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {person.email}
                        </Typography>
                        {person.mobile ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {person.mobile}
                          </Typography>
                        ) : null}
                      </Box>
                      {!isPlatform && person.role === 'SALESPERSON' ? (
                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            size="small"
                            aria-label={`Edit ${person.full_name}`}
                            disabled={saving}
                            onClick={() => openEdit(person)}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <DeleteIconButton
                            onClick={() => setDeleteTarget(person)}
                            disabled={saving}
                            tooltip={`Delete ${person.full_name}`}
                          />
                        </Stack>
                      ) : null}
                    </Stack>
                  </TableCell>
                  {projects.map((project) => {
                    const checked = assigned.has(assignmentKey(project.id, person.id))
                    return (
                      <TableCell key={project.id} align="center">
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={checked}
                              disabled={saving}
                              onChange={(event) => void toggleAssignment(person, project, event.target.checked)}
                            />
                          }
                          label={checked ? 'Assigned' : ''}
                          sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 12, color: 'text.secondary' } }}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!isPlatform ? (
          <Box sx={{ p: 2 }}>
            <Button variant="contained" onClick={() => setAddOpen(true)}>
              + Add salesperson
            </Button>
          </Box>
        ) : null}
      </Box>

      {!isPlatform && board.projects.length > 0 && matrixPeople.length > 0 ? (
        <Box
          component="form"
          onSubmit={(event) => void onMoveLeads(event)}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            p: 2,
          }}
        >
          <Typography fontWeight={600} sx={{ mb: 2 }}>
            Move leads between salespeople
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-end' }}>
            <TextField
              select
              label="Project"
              value={moveProjectId}
              onChange={(event) => setMoveProjectId(event.target.value)}
              fullWidth
            >
              {board.projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="From"
              value={fromUserId}
              onChange={(event) => setFromUserId(event.target.value)}
              fullWidth
            >
              {matrixPeople.map((person) => (
                <MenuItem key={person.id} value={person.id}>
                  {person.full_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="To" value={toUserId} onChange={(event) => setToUserId(event.target.value)} fullWidth>
              {matrixPeople.map((person) => (
                <MenuItem key={person.id} value={person.id}>
                  {person.full_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Which leads" value="all" fullWidth disabled>
              <MenuItem value="all">All leads</MenuItem>
            </TextField>
            <Button type="submit" variant="contained" disabled={saving} sx={{ flexShrink: 0 }}>
              Move leads
            </Button>
          </Stack>
        </Box>
      ) : null}

      {!isPlatform && board.projects.length > 0 ? (
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            overflow: 'auto',
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography fontWeight={600}>Lead counts</Typography>
          </Box>
          <Table
            size="small"
            sx={{
              '& .MuiTableCell-root': { borderBottom: 'none' },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>Person</TableCell>
                <TableCell>Role</TableCell>
                {board.projects.map((project) => (
                  <TableCell key={project.id} align="center">
                    {project.name}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {countPeople.map((person) => (
                <TableRow key={person.id}>
                  <TableCell>{person.full_name}</TableCell>
                  <TableCell>
                    {person.role === 'BUSINESS_OWNER'
                      ? 'Business Owner'
                      : person.role === 'MARKETING'
                        ? 'Marketing'
                        : 'Salesperson'}
                  </TableCell>
                  {board.projects.map((project) => {
                    if (person.role === 'BUSINESS_OWNER') {
                      return (
                        <TableCell key={project.id} align="center" sx={{ color: 'success.main', fontWeight: 600 }}>
                          Sees all
                        </TableCell>
                      )
                    }
                    if (person.role === 'MARKETING') {
                      return (
                        <TableCell key={project.id} align="center" color="text.secondary">
                          —
                        </TableCell>
                      )
                    }
                    const count = leadCountMap.get(assignmentKey(project.id, person.id)) ?? 0
                    const onProject = assigned.has(assignmentKey(project.id, person.id))
                    return (
                      <TableCell key={project.id} align="center">
                        {onProject ? count : '—'}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : null}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullScreen={phone} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => void onAddSalesperson(event)}>
          <DialogTitle>Add salesperson</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <TextField
                label="Full name"
                value={fullName}
                required
                fullWidth
                autoFocus
                disabled={saving}
                onChange={(event) => setFullName(event.target.value)}
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                required
                fullWidth
                disabled={saving}
                onChange={(event) => setEmail(event.target.value)}
              />
              <PasswordField
                id="add-salesperson-password"
                label="Password"
                autoComplete="new-password"
                value={password}
                disabled={saving}
                onChange={setPassword}
              />
              <TextField
                label="Mobile number"
                value={mobile}
                required
                fullWidth
                disabled={saving}
                placeholder="9876543210"
                helperText="Added at the end of WhatsApp messages this person sends."
                autoComplete="off"
                onChange={(event) => setMobile(event.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              Add
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onClose={() => { if (!saving) setEditTarget(null) }} fullScreen={phone} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => void onEditSalesperson(event)}>
          <DialogTitle>Edit salesperson</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <TextField
                label="Full name"
                value={editName}
                required
                fullWidth
                disabled={saving}
                onChange={(event) => setEditName(event.target.value)}
              />
              <TextField
                label="Mobile number"
                value={editMobile}
                required
                fullWidth
                disabled={saving}
                placeholder="9876543210"
                helperText="Added at the end of WhatsApp messages this person sends."
                autoComplete="off"
                onChange={(event) => setEditMobile(event.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setEditTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Delete ${deleteTarget.full_name}?` : 'Delete salesperson?'}
        description="They will not be able to sign in. This only works when they have no leads. Move their leads first."
        confirmLabel="Delete"
        loading={saving}
        onCancel={() => {
          if (!saving) setDeleteTarget(null)
        }}
        onConfirm={() => void confirmDeleteSalesperson()}
      />
    </Stack>
  )
}
