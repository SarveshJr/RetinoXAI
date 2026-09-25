import { cn } from '@/lib/utils'
import { GRADES, type DRGrade, type DecisionStatus } from '@/lib/clinical'
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, ShieldCheck, Cpu } from 'lucide-react'

export function gradeColor(g: DRGrade) {
  return `var(--grade-${g})`
}

export function GradeDot({ grade, className }: { grade: DRGrade; className?: string }) {
  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 rounded-full', className)}
      style={{ backgroundColor: gradeColor(grade) }}
    />
  )
}

export function GradeBadge({
  grade,
  size = 'md',
  showCode = false,
}: {
  grade: DRGrade
  size?: 'sm' | 'md' | 'lg'
  showCode?: boolean
}) {
  const meta = GRADES[grade]
  const color = gradeColor(grade)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium',
        size === 'sm' && 'px-1.5 py-0.5 text-xs',
        size === 'md' && 'px-2 py-0.5 text-sm',
        size === 'lg' && 'px-2.5 py-1 text-base',
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        color,
      }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {showCode ? meta.code : meta.short}
    </span>
  )
}

export const DECISION_META: Record<
  DecisionStatus,
  { label: string; icon: typeof CheckCircle2; variant: 'safe' | 'warn' | 'danger' | 'muted'; color: string }
> = {
  'ai-cleared': { label: 'AI cleared', icon: ShieldCheck, variant: 'safe', color: 'var(--safe)' },
  flagged: { label: 'Needs review', icon: AlertTriangle, variant: 'warn', color: 'var(--warn)' },
  'signed-off': { label: 'Signed off', icon: CheckCircle2, variant: 'safe', color: 'var(--safe)' },
  recapture: { label: 'Recapture', icon: RefreshCw, variant: 'danger', color: 'var(--danger)' },
}

export function DecisionChip({ status, className }: { status: DecisionStatus; className?: string }) {
  const m = DECISION_META[status]
  const Icon = m.icon
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium', className)}
      style={{
        backgroundColor: `color-mix(in srgb, ${m.color} 14%, transparent)`,
        color: m.color,
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {m.label}
    </span>
  )
}

export function ReferableChip({ referable }: { referable: boolean }) {
  if (referable)
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-danger/12 px-2 py-0.5 text-xs font-medium text-danger">
        <AlertTriangle className="h-3.5 w-3.5" /> Referable DR
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-safe/12 px-2 py-0.5 text-xs font-medium text-safe">
      <CheckCircle2 className="h-3.5 w-3.5" /> Non-referable
    </span>
  )
}

const INFERENCE_META: Record<string, { label: string; variant: 'safe' | 'warn' }> = {
  live: { label: 'Live ensemble', variant: 'safe' },
  'live-resnet': { label: 'Live · ResNet-50 only', variant: 'warn' },
  'live-efficientnet': { label: 'Live · EfficientNet-B5 only', variant: 'warn' },
  estimate: { label: 'Estimate · models unavailable', variant: 'warn' },
}

/** Shows how a live-backend result was computed (full ensemble vs degraded). */
export function InferenceModeChip({ mode }: { mode?: string }) {
  if (!mode) return null
  const m = INFERENCE_META[mode]
  if (!m) return null
  const color = m.variant === 'safe' ? 'var(--safe)' : 'var(--warn)'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`, color }}
    >
      <Cpu className="h-3.5 w-3.5" />
      {m.label}
    </span>
  )
}

export function PendingChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <Clock className="h-3.5 w-3.5" /> Queued
    </span>
  )
}
