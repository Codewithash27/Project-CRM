import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '../store/auth-context'
import {
  ColumnScreen,
  SCREEN_COLUMNS,
  buildGridTemplate,
  getDefaultVisibility,
} from './definitions'
import { loadColumnVisibility, resetColumnVisibility, saveColumnVisibility } from './storage'

export function useColumnVisibility(screen: ColumnScreen) {
  const { user } = useAuth()
  const userId = user?.id
  const columns = SCREEN_COLUMNS[screen]

  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => getDefaultVisibility(screen))
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    const result = loadColumnVisibility(userId, screen)
    setVisibility(result.visibility)
    setLoadError(result.loadError)
    setSaveError(false)
  }, [userId, screen])

  const persist = useCallback(
    (next: Record<string, boolean>) => {
      const ok = saveColumnVisibility(userId, screen, next)
      setSaveError(!ok && Boolean(userId))
      return ok
    },
    [userId, screen],
  )

  const toggle = useCallback(
    (key: string) => {
      const def = columns.find((col) => col.key === key)
      if (!def || !def.hideable) return
      setVisibility((current) => {
        const next = { ...current, [key]: current[key] === false }
        persist(next)
        return next
      })
    },
    [columns, persist],
  )

  const reset = useCallback(() => {
    const result = resetColumnVisibility(userId, screen)
    setVisibility(result.visibility)
    setSaveError(!result.ok && Boolean(userId))
  }, [userId, screen])

  const clearSaveError = useCallback(() => setSaveError(false), [])
  const clearLoadError = useCallback(() => setLoadError(false), [])

  const isVisible = useCallback((key: string) => visibility[key] !== false, [visibility])

  const gridTemplateMd = useMemo(() => buildGridTemplate(screen, visibility), [screen, visibility])

  /** Phone layouts that keep only locked + lead tracks. */
  const gridTemplateXs = useMemo(() => {
    if (screen === 'reminders') return '22px minmax(0,1fr)'
    if (screen === 'leads') return 'minmax(0,1fr) auto'
    return 'minmax(0,1fr)'
  }, [screen])

  return {
    columns,
    visibility,
    isVisible,
    toggle,
    reset,
    gridTemplateMd,
    gridTemplateXs,
    loadError,
    saveError,
    clearSaveError,
    clearLoadError,
  }
}
