import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useEffect, useMemo, useState } from 'react'

import { ApiError } from '../../services/api/errors'
import { api, apiBlob } from '../../services/api/client'
import { renderWhatsAppMessage } from '../../templates/message'
import { DEFAULT_TEMPLATE_COLOR, useTemplateImage } from '../../templates/preview'

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

function TemplateChoice({
  item,
  selected,
  onSelect,
}: {
  item: TemplateItem
  selected: boolean
  onSelect: () => void
}) {
  const imageUrl = useTemplateImage(item.has_image ? item.id : null)
  const accent = item.color || DEFAULT_TEMPLATE_COLOR
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      sx={{
        position: 'relative',
        p: 0,
        overflow: 'hidden',
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: '16px',
        bgcolor: '#fff',
        opacity: selected ? 1 : 0.55,
        border: `4px solid ${selected ? accent : '#e6e8ec'}`,
        boxShadow: selected ? `0 0 0 4px ${accent}` : 'none',
      }}
    >
      <Typography noWrap fontWeight={700} sx={{ px: 1.25, py: 0.9, pr: 5, bgcolor: accent, color: '#fff', fontSize: 14 }}>
        {item.title}
      </Typography>
      {selected ? (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 26,
            height: 26,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: '#fff',
            color: accent,
          }}
        >
          <CheckRoundedIcon sx={{ fontSize: 18 }} />
        </Box>
      ) : null}
      {imageUrl ? (
        <Box component="img" src={imageUrl} alt="" sx={{ width: '100%', height: 132, objectFit: 'cover', display: 'block' }} />
      ) : (
        <Box sx={{ height: 132, display: 'grid', placeItems: 'center', color: accent, bgcolor: '#f8fafc' }}>
          <ImageOutlinedIcon />
        </Box>
      )}
    </Box>
  )
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
  const [items, setItems] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError('')
    setNotice('')
    setLoading(true)
    void api
      .get<{ items: TemplateItem[] }>('/api/v1/message-templates')
      .then((result) => {
        if (cancelled) return
        setItems(result.data.items)
        setTemplateId('')
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(requestError instanceof ApiError ? requestError.message : 'Could not load templates.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const selected = useMemo(() => items.find((item) => item.id === templateId) ?? null, [items, templateId])

  useEffect(() => {
    if (!open || !selected?.has_image) {
      setImageBlob(null)
      return
    }
    let active = true
    void apiBlob(`/api/v1/message-templates/${selected.id}/image`)
      .then((blob) => {
        if (active) setImageBlob(blob)
      })
      .catch(() => {
        if (active) setImageBlob(null)
      })
    return () => {
      active = false
    }
  }, [open, selected])

  const preview = selected ? renderWhatsAppMessage(selected.message, lead?.full_name ?? '') : ''

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

  async function onSend() {
    if (!selected || !lead) return
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
    <Dialog open={open} onClose={busy ? undefined : onClose} fullScreen={phone} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1.5 }}>
        Send template
        <IconButton aria-label="Close" onClick={onClose} disabled={busy} edge="end">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
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
          {loading ? null : items.length === 0 ? (
            <Typography color="text.secondary">Add a template first, from the Templates menu.</Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 2.5,
                p: 1,
              }}
            >
              {items.map((item) => (
                <TemplateChoice
                  key={item.id}
                  item={item}
                  selected={item.id === templateId}
                  onSelect={() => setTemplateId(item.id)}
                />
              ))}
            </Box>
          )}
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={() => void onSend()} disabled={busy || !selected}>
          Send
        </Button>
      </DialogActions>
    </Dialog>
  )
}
