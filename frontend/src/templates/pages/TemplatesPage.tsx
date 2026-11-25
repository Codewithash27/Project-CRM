import CheckIcon from '@mui/icons-material/Check'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { FormEvent, useCallback, useEffect, useState } from 'react'

import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { ErrorAlert } from '../../components/common/ErrorAlert'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { ApiError } from '../../services/api/errors'
import { api } from '../../services/api/client'
import { useAuth } from '../../store/auth-context'
import { DEFAULT_TEMPLATE_COLOR, TEMPLATE_COLORS, TemplatePreview, useTemplateImage } from '../preview'

interface TemplateItem {
  id: string
  title: string
  message: string
  color: string
  has_image: boolean
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function TemplateCard({
  item,
  senderName,
  senderMobile,
  disabled,
  onView,
  onEdit,
  onDelete,
}: {
  item: TemplateItem
  senderName: string
  senderMobile: string | null
  disabled: boolean
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const imageUrl = useTemplateImage(item.has_image ? item.id : null)
  return (
    <TemplatePreview
      title={item.title}
      message={item.message}
      imageUrl={imageUrl}
      senderName={senderName}
      senderMobile={senderMobile}
      color={item.color || DEFAULT_TEMPLATE_COLOR}
      compact
      actions={
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="View">
            <IconButton aria-label={`View ${item.title}`} onClick={onView} sx={{ color: '#fff' }}>
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton aria-label={`Edit ${item.title}`} disabled={disabled} onClick={onEdit} sx={{ color: '#fff' }}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton aria-label={`Delete ${item.title}`} disabled={disabled} onClick={onDelete} sx={{ color: '#fff' }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      }
    />
  )
}

function TemplateViewDialog({
  item,
  senderName,
  senderMobile,
  onClose,
}: {
  item: TemplateItem | null
  senderName: string
  senderMobile: string | null
  onClose: () => void
}) {
  const imageUrl = useTemplateImage(item?.has_image ? item.id : null)
  return (
    <Dialog open={Boolean(item)} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogContent sx={{ pt: 2.5 }}>
        {item ? (
          <TemplatePreview
            title={item.title}
            message={item.message}
            imageUrl={imageUrl}
            senderName={senderName}
            senderMobile={senderMobile}
            color={item.color || DEFAULT_TEMPLATE_COLOR}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export function TemplatesPage() {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const { user } = useAuth()
  const [items, setItems] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TemplateItem | null>(null)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [color, setColor] = useState<string>(DEFAULT_TEMPLATE_COLOR)
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState('')
  const [removeImage, setRemoveImage] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TemplateItem | null>(null)
  const [viewing, setViewing] = useState<TemplateItem | null>(null)
  const storedImage = useTemplateImage(editing?.has_image && !removeImage && !file ? editing.id : null)

  const load = useCallback(async () => {
    setError('')
    try {
      const result = await api.get<{ items: TemplateItem[] }>('/api/v1/message-templates')
      setItems(result.data.items)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not load templates.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!file) {
      setFilePreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function closeForm() {
    if (saving) return
    setOpen(false)
    setEditing(null)
    setTitle('')
    setMessage('')
    setColor(DEFAULT_TEMPLATE_COLOR)
    setFile(null)
    setRemoveImage(false)
  }

  function openCreate() {
    setEditing(null)
    setTitle('')
    setMessage('')
    setColor(DEFAULT_TEMPLATE_COLOR)
    setFile(null)
    setRemoveImage(false)
    setError('')
    setOpen(true)
  }

  function openEdit(item: TemplateItem) {
    setEditing(item)
    setTitle(item.title)
    setMessage(item.message)
    setColor(item.color || DEFAULT_TEMPLATE_COLOR)
    setFile(null)
    setRemoveImage(false)
    setError('')
    setOpen(true)
  }

  function onPickImage(next: File | null) {
    if (!next) {
      setFile(null)
      return
    }
    if (next.size > MAX_IMAGE_BYTES) {
      setError('Image must be 5 MB or smaller.')
      return
    }
    setError('')
    setFile(next)
    setRemoveImage(false)
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    if (title.trim().length < 2) {
      setError('Enter a title.')
      return
    }
    if (!message.trim()) {
      setError('Enter the message.')
      return
    }
    const body = new FormData()
    body.set('title', title.trim())
    body.set('message', message.trim())
    body.set('color', color)
    if (file) body.set('image', file)
    if (editing) body.set('remove_image', removeImage ? 'true' : 'false')
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (editing) {
        await api.patchForm<TemplateItem>(`/api/v1/message-templates/${editing.id}`, body)
        setNotice('Template updated.')
      } else {
        await api.postForm<TemplateItem>('/api/v1/message-templates', body)
        setNotice('Template saved.')
      }
      setOpen(false)
      setEditing(null)
      setTitle('')
      setMessage('')
      setColor(DEFAULT_TEMPLATE_COLOR)
      setFile(null)
      setRemoveImage(false)
      await load()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not save this template.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.delete(`/api/v1/message-templates/${deleteTarget.id}`)
      setNotice('Template deleted.')
      setDeleteTarget(null)
      await load()
    } catch (requestError) {
      setDeleteTarget(null)
      setError(requestError instanceof ApiError ? requestError.message : 'Could not delete this template.')
    } finally {
      setSaving(false)
    }
  }

  const previewImage = filePreview || (removeImage ? '' : storedImage)

  if (loading && items.length === 0) return <LoadingScreen />

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>
            Templates
          </Typography>
          <Typography color="text.secondary">
            Each card is the message preview: title, image, message, then your name and number.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate} sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}>
          + Add Template
        </Button>
      </Stack>

      {error ? <ErrorAlert message={error} /> : null}
      {notice ? (
        <Typography color="success.main" fontWeight={600}>
          {notice}
        </Typography>
      ) : null}

      {items.length === 0 ? (
        <Typography color="text.secondary">No templates yet. Add one to send it from Reminders.</Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
            alignItems: 'stretch',
            gap: 2,
          }}
        >
          {items.map((item) => (
            <TemplateCard
              key={item.id}
              item={item}
              senderName={user?.full_name ?? ''}
              senderMobile={user?.mobile ?? null}
              disabled={saving}
              onView={() => setViewing(item)}
              onEdit={() => openEdit(item)}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
        </Box>
      )}

      <Dialog open={open} onClose={closeForm} fullScreen={phone} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => void onSave(event)}>
          <DialogTitle>{editing ? 'Edit template' : 'Add template'}</DialogTitle>
          <DialogContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} sx={{ pt: 0.5, alignItems: 'stretch' }}>
              <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
                <TextField
                  label="Title"
                  value={title}
                  required
                  fullWidth
                  autoFocus
                  disabled={saving}
                  placeholder="Welcome message"
                  onChange={(event) => setTitle(event.target.value)}
                />
                <Stack spacing={1}>
                  <Typography variant="body2" fontWeight={600}>
                    Color
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {TEMPLATE_COLORS.map((swatch) => {
                      const selected = swatch.value.toUpperCase() === color.toUpperCase()
                      return (
                        <Tooltip key={swatch.value} title={swatch.label}>
                          <IconButton
                            aria-label={swatch.label}
                            disabled={saving}
                            onClick={() => setColor(swatch.value)}
                            sx={{
                              width: 36,
                              height: 36,
                              bgcolor: swatch.value,
                              color: '#fff',
                              border: selected ? '2px solid #0f172a' : '2px solid transparent',
                              '&:hover': { bgcolor: swatch.value },
                            }}
                          >
                            {selected ? <CheckIcon sx={{ fontSize: 18 }} /> : null}
                          </IconButton>
                        </Tooltip>
                      )
                    })}
                  </Stack>
                </Stack>
                <Stack spacing={1}>
                  <Button variant="outlined" component="label" disabled={saving}>
                    Upload image
                    <input
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => onPickImage(event.target.files?.[0] ?? null)}
                    />
                  </Button>
                  {editing?.has_image && !file ? (
                    <Button type="button" color="inherit" disabled={saving} onClick={() => setRemoveImage((current) => !current)}>
                      {removeImage ? 'Keep current image' : 'Remove image'}
                    </Button>
                  ) : null}
                </Stack>
                <TextField
                  label="Message"
                  value={message}
                  required
                  fullWidth
                  multiline
                  minRows={4}
                  disabled={saving}
                  placeholder="Hi {name}, thank you for your enquiry."
                  helperText="Use {name} where the lead’s name should appear."
                  onChange={(event) => setMessage(event.target.value)}
                />
                {!user?.mobile ? (
                  <Typography variant="body2" color="warning.main">
                    {user?.roles.includes('BUSINESS_OWNER')
                      ? 'Add your mobile number on the Team page. It is added at the end of every message.'
                      : 'Your mobile number is missing. Ask the business owner to add it on the Team page.'}
                  </Typography>
                ) : null}
              </Stack>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                  Preview
                </Typography>
                <TemplatePreview
                  title={title}
                  message={message}
                  imageUrl={previewImage}
                  senderName={user?.full_name ?? ''}
                  senderMobile={user?.mobile ?? null}
                  color={color}
                />
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <TemplateViewDialog
        item={viewing}
        senderName={user?.full_name ?? ''}
        senderMobile={user?.mobile ?? null}
        onClose={() => setViewing(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Delete ${deleteTarget.title}?` : 'Delete template?'}
        description="This removes the template for the whole company."
        confirmLabel="Delete"
        loading={saving}
        onCancel={() => {
          if (!saving) setDeleteTarget(null)
        }}
        onConfirm={() => void confirmDelete()}
      />
    </Stack>
  )
}
