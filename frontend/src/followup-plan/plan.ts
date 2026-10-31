export type FollowupPlanStep = {
  /** Display name, e.g. "Day 3" */
  label: string
  /** Days to wait AFTER completing this step before the next reminder */
  gapDays: number
}

export const CUSTOM_STEP = 'Custom'

/** Defaults match the demo cadence: after Day 1 wait 2 days → Day 3, then 4 → Day 7, etc. */
export const DEFAULT_FOLLOWUP_PLAN: FollowupPlanStep[] = [
  { label: 'Day 1', gapDays: 2 },
  { label: 'Day 3', gapDays: 4 },
  { label: 'Day 7', gapDays: 14 },
  { label: 'Day 21', gapDays: 69 },
  { label: '3-month review', gapDays: 90 },
]

const STORAGE_PREFIX = 'aaditech.followupPlan.'
const STORAGE_VERSION = 2

function storageKey(companyId: string | null | undefined) {
  return `${STORAGE_PREFIX}v${STORAGE_VERSION}.${companyId || 'local'}`
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

export function findPlanStep(steps: FollowupPlanStep[], label: string): FollowupPlanStep | null {
  return steps.find((step) => step.label === label) ?? null
}

export function nextPlanStep(steps: FollowupPlanStep[], current: string): FollowupPlanStep | null {
  const index = steps.findIndex((step) => step.label === current)
  if (index < 0) return steps[0] ?? null
  return steps[index + 1] ?? null
}

/** Days to wait after finishing `current` before the next step is due. */
export function waitDaysAfterStep(steps: FollowupPlanStep[], current: string) {
  return findPlanStep(steps, current)?.gapDays ?? 7
}

export function gapForStep(steps: FollowupPlanStep[], label: string) {
  return waitDaysAfterStep(steps, label)
}

export function stepIndex(steps: FollowupPlanStep[], label: string) {
  return steps.findIndex((step) => step.label === label)
}
