export interface PipelineStage {
  id: string
  project_id: string
  key: string
  label: string
  color: string
  sort_order: number
  is_entry: boolean
  is_won: boolean
  is_lost: boolean
  is_locked: boolean
  lead_count: number
}

export interface PipelineStageList {
  items: PipelineStage[]
  project_id: string
}

export const STAGE_COLOR_PRESETS = [
  '#93c5fd',
  '#60a5fa',
  '#f59e0b',
  '#34d399',
  '#10b981',
  '#f87171',
  '#a78bfa',
  '#64748b',
  '#fb7185',
  '#38bdf8',
] as const
