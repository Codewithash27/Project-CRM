import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useEffect, useMemo, useState } from 'react'

import { ApiError } from '../../services/api/errors'
import { api, apiBlob } from '../../services/api/client'
import { useAuth } from '../../store/auth-context'
import { renderWhatsAppMessage } from '../../templates/message'
import { DEFAULT_TEMPLATE_COLOR, TemplatePreview } from '../../templates/preview'

interface TemplateItem {
  id: string
  title: string
  message: string
  color: string
  has_image: boolean
}

interface SendLead {
  full_name: string
  mobile: string
}

function imageFilename(blob: Blob, title: string) {
  const safe = title.replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '') || 'template'
  if (blob.type === 'image/png') return `${safe}.png`
  if (blob.type === 'image/webp') return `${safe}.webp`
  return `${safe}.jpg`
}

export function SendTemplateDialog({
  lead,
  open,
  onClose,
}: {
  lead: SendLead | null
  open: boolean
  onClose: () => void
}) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('md'))
  const { user, refreshUser } = useAuth()
  const [items, setItems] = useState<TemplateItem[]>([])
  const [templateId, setTemplateId] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError('')
    setNotice('')
    void refreshUser()
    void api
      .get<{ items: TemplateItem[] }>('/api/v1/message-templates')
      .then((result) => {
        if (cancelled) return
        setItems(result.data.items)
        setTemplateId((current) => current || result.data.items[0]?.id || '')
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(requestError instanceof ApiError ? requestError.message : 'Could not load templates.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, refreshUser])

  const selected = useMemo(() => items.find((item) => item.id === templateId) ?? null, [items, templateId])

  useEffect(() => {
    if (!open || !selected?.has_image) {
      setImageUrl('')
      setImageBlob(null)
      return
    }
    let active = true
    let objectUrl = ''
    void apiBlob(`/api/v1/message-templates/${selected.id}/image`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setImageBlob(blob)
        setImageUrl(objectUrl)
      })
      .catch(() => {
        if (active) {
          setImageBlob(null)
          setImageUrl('')
        }
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, selected])

  const previewMessage = selected ? selected.message.replace(/\{name\}/gi, lead?.full_name ?? '') : ''
  const preview = selected
    ? renderWhatsAppMessage(selected.message, lead?.full_name ?? '', user?.full_name ?? '', user?.mobile ?? null)
    : ''

  async function copyImage() {
    if (!imageBlob || !selected) return
    setError('')
    setNotice('')
    try {
      const type = imageBlob.type || 'image/png'
      await navigator.clipboard.write([new ClipboardItem({ [type]: imageBlob })])
      setNotice('Image copied. Paste it in the WhatsApp chat.')
    } catch {
      setError('This browser could not copy the image. Download it and attach it in WhatsApp.')
    }
  }

  function downloadImage() {
    if (!imageBlob || !selected) return
    const url = URL.createObjectURL(imageBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = imageFilename(imageBlob, selected.title)
    link.click()
    URL.revokeObjectURL(url)
  }

  async function onSet() {
    if (!selected || !lead) return
    if (!user?.mobile) {
      setError(
        user?.roles.includes('BUSINESS_OWNER')
          ? 'Add your mobile number on the Team page before sending.'
          : 'Your mobile number is missing. Ask the business owner to add it on the Team page.',
      )
      return
    }
    setBusy(true)
    setError('')
    try {
      if (phone && typeof navigator.share === 'function') {
        const payload: ShareData = { title: selected.title, text: preview }
        if (imageBlob && navigator.canShare) {
          const file = new File([imageBlob], imageFilename(imageBlob, selected.title), {
            type: imageBlob.type || 'image/jpeg',
          })
          if (navigator.canShare({ files: [file] })) payload.files = [file]
        }
        await navigator.share(payload)
        onClose()
        return
      }
      // No phone in the link. WhatsApp asks the sender to pick one chat,
      // including when the lead's number is not on WhatsApp.
      window.open(`https://wa.me/?text=${encodeURIComponent(preview)}`, '_blank', 'noopener,noreferrer')
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return
      setError('Could not open WhatsApp.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullScreen={phone} fullWidth maxWidth="sm">
      <DialogTitle>Send message</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error ? (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          ) : null}
          {notice ? (
            <Typography color="success.main" variant="body2">
              {notice}
            </Typography>
          ) : null}
          {items.length === 0 ? (
            <Typography color="text.secondary">Add a template first, from the Templates menu.</Typography>
          ) : (
            <TextField
              select
              label="Template"
              value={templateId}
              fullWidth
              size="small"
              onChange={(event) => setTemplateId(event.target.value)}
            >
              {items.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: item.color || DEFAULT_TEMPLATE_COLOR,
                        flexShrink: 0,
                      }}
                    />
                    <span>{item.title}</span>
                  </Stack>
                </MenuItem>
              ))}
            </TextField>
          )}
          {selected ? (
            <TemplatePreview
              title={selected.title}
              message={previewMessage}
              imageUrl={imageUrl}
              senderName={user?.full_name ?? ''}
              senderMobile={user?.mobile ?? null}
              color={selected.color || DEFAULT_TEMPLATE_COLOR}
            />
          ) : null}
          {!phone && selected?.has_image ? (
            <Stack direction="row" spacing={1}>
              <Button startIcon={<ContentCopyOutlinedIcon />} onClick={() => void copyImage()} disabled={!imageBlob}>
                Copy image
              </Button>
              <Button startIcon={<DownloadOutlinedIcon />} onClick={downloadImage} disabled={!imageBlob}>
                Download image
              </Button>
            </Stack>
          ) : null}
          {!phone && selected ? (
            <Typography variant="body2" color="text.secondary">
              {selected.has_image
                ? 'WhatsApp opens with this message. You pick one chat. Copy or download the image, then paste it into that chat.'
                : 'WhatsApp opens with this message. You pick one chat.'}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void onSet()} disabled={busy || !selected || !user?.mobile}>
          Set
        </Button>
      </DialogActions>
    </Dialog>
  )
}
