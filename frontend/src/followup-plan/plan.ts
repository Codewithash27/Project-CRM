export type FollowupPlanStep = {
  label: string
  gapDays: number
}

export const CUSTOM_STEP = 'Custom'

export const DEFAULT_FOLLOWUP_PLAN: FollowupPlanStep[] = [
  { label: 'Day 1', gapDays: 1 },
  { label: 'Day 3', gapDays: 2 },
  { label: 'Day 7', gapDays: 4 },
  { label: 'Day 21', gapDays: 14 },
  { label: '3-month review', gapDays: 69 },
]

const STORAGE_PREFIX = 'aaditech.followupPlan.'

function storageKey(companyId: string | null | undefined) {
  return `${STORAGE_PREFIX}${companyId || 'local'}`
}

export function loadFollowupPlan(companyId: string | null | undefined): FollowupPlanStep[] {
  try {
    const raw = localStorage.getItem(storageKey(companyId))
    if (!raw) return DEFAULT_FOLLOWUP_PLAN.map((step) => ({ ...step }))
    const parsed = JSON.parse(raw) as FollowupPlanStep[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_FOLLOWUP_PLAN.map((step) => ({ ...step }))
    }
    return parsed
      .map((step) => ({
        label: String(step.label || '').trim().slice(0, 40),
        gapDays: Math.max(1, Math.min(365, Number(step.gapDays) || 1)),
      }))
      .filter((step) => step.label.length > 0)
      .slice(0, 12)
  } catch {
    return DEFAULT_FOLLOWUP_PLAN.map((step) => ({ ...step }))
  }
}

export function saveFollowupPlan(companyId: string | null | undefined, steps: FollowupPlanStep[]) {
  const cleaned = steps
    .map((step) => ({
      label: step.label.trim().slice(0, 40),
      gapDays: Math.max(1, Math.min(365, Number(step.gapDays) || 1)),
    }))
    .filter((step) => step.label.length > 0)
    .slice(0, 12)
  if (cleaned.length === 0) {
    localStorage.removeItem(storageKey(companyId))
    return DEFAULT_FOLLOWUP_PLAN.map((step) => ({ ...step }))
  }
  localStorage.setItem(storageKey(companyId), JSON.stringify(cleaned))
  return cleaned
}

export function planLabels(steps: FollowupPlanStep[]) {
  return [...steps.map((step) => step.label), CUSTOM_STEP]
}

export function nextPlanStep(steps: FollowupPlanStep[], current: string): FollowupPlanStep | null {
  const labels = steps.map((step) => step.label)
  const index = labels.indexOf(current)
  if (index < 0) return steps[0] ?? null
  return steps[index + 1] ?? null
}

export function gapForStep(steps: FollowupPlanStep[], label: string) {
  return steps.find((step) => step.label === label)?.gapDays ?? 7
}

export function stepIndex(steps: FollowupPlanStep[], label: string) {
  return steps.findIndex((step) => step.label === label)
}
