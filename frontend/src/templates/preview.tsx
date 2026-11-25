import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import { Box, Typography } from '@mui/material'
import { useEffect, useState, type ReactNode } from 'react'

import { apiBlob } from '../services/api/client'

export const TEMPLATE_COLORS = [
  { value: '#128C7E', label: 'Teal' },
  { value: '#0F766E', label: 'Green' },
  { value: '#047857', label: 'Emerald' },
  { value: '#1D4ED8', label: 'Blue' },
  { value: '#0369A1', label: 'Sky' },
  { value: '#7C3AED', label: 'Violet' },
  { value: '#BE123C', label: 'Rose' },
  { value: '#B45309', label: 'Amber' },
] as const

export const DEFAULT_TEMPLATE_COLOR = TEMPLATE_COLORS[0].value

export function useTemplateImage(templateId: string | null) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!templateId) {
      setUrl('')
      return
    }
    let active = true
    let objectUrl = ''
    void apiBlob(`/api/v1/message-templates/${templateId}/image`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setUrl(objectUrl)
      })
      .catch(() => {
        if (active) setUrl('')
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [templateId])

  return url
}

function TemplateImage({ src, compact }: { src: string; compact: boolean }) {
  return (
    <Box
      component="img"
      src={src}
      alt=""
      sx={{
        width: '100%',
        height: compact ? 120 : 'auto',
        display: 'block',
        objectFit: compact ? 'cover' : 'contain',
        objectPosition: 'center',
        borderRadius: '14px',
        bgcolor: '#f1f5f9',
      }}
    />
  )
}

export function TemplatePreview({
  title,
  message,
  imageUrl,
  color,
  actions,
  compact = false,
}: {
  title: string
  message: string
  imageUrl: string
  color: string
  actions?: ReactNode
  compact?: boolean
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        borderRadius: '18px',
        bgcolor: '#fff',
        border: '1px solid #e6e8ec',
        boxShadow: '0 10px 28px rgba(15, 23, 42, 0.06)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.75,
          py: 1.25,
          bgcolor: color,
          color: '#fff',
        }}
      >
        <Typography fontWeight={700} noWrap sx={{ flex: 1, fontSize: 16 }}>
          {title.trim() || 'Template title'}
        </Typography>
        {actions}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, p: 1.5, flex: 1 }}>
        {imageUrl ? (
          <TemplateImage src={imageUrl} compact={compact} />
        ) : (
          <Box
            sx={{
              height: compact ? 120 : 160,
              borderRadius: '14px',
              display: 'grid',
              placeItems: 'center',
              color,
              bgcolor: '#f8fafc',
              border: '1px dashed #dbe3ee',
            }}
          >
            <ImageOutlinedIcon />
          </Box>
        )}
        <Typography
          sx={{
            whiteSpace: 'pre-line',
            fontSize: '0.9rem',
            lineHeight: 1.55,
            color: '#0f172a',
            ...(compact
              ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  minHeight: '4.65em',
                }
              : {}),
          }}
        >
          {message.trim() || 'Your message will show here.'}
        </Typography>
      </Box>
    </Box>
  )
}
