import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'

import {
  DEFAULT_FOLLOWUP_PLAN,
  FollowupPlanStep,
  loadFollowupPlan,
  saveFollowupPlan,
} from './plan'

type Props = {
  open: boolean
  companyId: string | null | undefined
  onClose: () => void
  onSaved: (steps: FollowupPlanStep[]) => void
}

export function FollowupPlanSettingsDialog({ open, companyId, onClose, onSaved }: Props) {
  const [steps, setSteps] = useState<FollowupPlanStep[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setSteps(loadFollowupPlan(companyId))
    setError('')
  }, [companyId, open])

  function save() {
    const labels = steps.map((step) => step.label.trim().toLowerCase())
    if (steps.some((step) => !step.label.trim())) {
      setError('Every step needs a label.')
      return
    }
    if (new Set(labels).size !== labels.length) {
      setError('Step labels must be unique.')
      return
    }
    const saved = saveFollowupPlan(companyId, steps)
    onSaved(saved)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Follow-up plan days</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Customize the cadence labels and days until the next step. These drive Reminders and Follow-ups.
        </Typography>
        <Stack spacing={1.25}>
          {steps.map((step, index) => (
            <Stack key={`step-${index}`} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TextField
                label={`Step ${index + 1} label`}
                value={step.label}
                fullWidth
                onChange={(event) => {
                  const next = [...steps]
                  next[index] = { ...step, label: event.target.value }
                  setSteps(next)
                }}
              />
              <TextField
                label="Gap days"
                type="number"
                value={step.gapDays}
                sx={{ width: 120 }}
                inputProps={{ min: 1, max: 365 }}
                onChange={(event) => {
                  const next = [...steps]
                  next[index] = { ...step, gapDays: Number(event.target.value) || 1 }
                  setSteps(next)
                }}
              />
              <IconButton
                aria-label={`Remove step ${index + 1}`}
                disabled={steps.length <= 1}
                onClick={() => setSteps(steps.filter((_, i) => i !== index))}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
        {error ? (
          <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>
            {error}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            startIcon={<AddOutlinedIcon />}
            disabled={steps.length >= 12}
            onClick={() => setSteps([...steps, { label: `Day ${steps.length + 1}`, gapDays: 7 }])}
          >
            Add step
          </Button>
          <Button onClick={() => setSteps(DEFAULT_FOLLOWUP_PLAN.map((item) => ({ ...item })))}>
            Reset defaults
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Save plan
        </Button>
      </DialogActions>
    </Dialog>
  )
}
