import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import { FUNDAQ8_PASS_RATIO, type FundaQResult } from '@/lib/clinical'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Human-readable rejection reason for each FundaQ-8 parameter that scores low. */
const REASONS: Record<string, string> = {
  resolution: 'Resolution too low — recapture at a higher resolution.',
  fov: 'Field of view too small — center the retina and fill the frame.',
  color: 'Poor color fidelity — image may not be a proper fundus photograph.',
  artifacts: 'Glare / dust / smudge artifacts detected — clean the lens and avoid reflections.',
  vessels: 'Retinal vessels not clearly visible — check focus and illumination.',
  sharpness: 'Image is out of focus / blurry — refocus and hold the camera steady.',
  disc: 'Optic disc poorly illuminated — adjust lighting and re-center.',
  cup: 'Optic cup not clearly resolved — improve focus over the disc.',
}

/** Parameters below this fraction of their max are treated as failing factors. */
const LOW = 0.5

export function qualityReasons(quality: FundaQResult): string[] {
  return quality.params
    .filter((p) => p.score / p.max < LOW)
    .sort((a, b) => a.score / a.max - b.score / b.max)
    .map((p) => REASONS[p.key] ?? `${p.label} below acceptable quality.`)
}

function barColor(ratio: number) {
  if (ratio >= 0.75) return 'var(--safe)'
  if (ratio >= LOW) return 'var(--warn)'
  return 'var(--danger, #ef4444)'
}

interface Props {
  quality: FundaQResult | null
  analyzing?: boolean
  onRecapture?: () => void
  className?: string
}

/**
 * FundaQ-8 image-quality gate. Shows the overall 0–16 score against the pass
 * threshold, the per-parameter breakdown, and — when the image fails — the
 * specific reasons plus a recapture / upload-another action.
 */
export function QualityGate({ quality, analyzing, onRecapture, className }: Props) {
  if (analyzing) {
    return (
      <div className={cn('flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-4', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">Checking image quality…</p>
          <p className="text-xs text-muted-foreground">Running FundaQ-8 analysis on the upload</p>
        </div>
      </div>
    )
  }

  if (!quality) return null

  const passed = quality.passed
  const reasons = passed ? [] : qualityReasons(quality)
  const threshold = Math.round(FUNDAQ8_PASS_RATIO * 16 * 10) / 10

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        passed ? 'border-[color:var(--safe)]/40 bg-[color:var(--safe)]/5' : 'border-warn/40 bg-warn/5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {passed ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: 'var(--safe)' }} />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {passed ? 'Image quality passed' : 'Image quality too low'}
            </p>
            <p className="text-xs text-muted-foreground">
              FundaQ-8 · pass threshold {threshold}/16 ({Math.round(FUNDAQ8_PASS_RATIO * 100)}%)
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className="text-2xl font-bold leading-none tabular-nums"
            style={{ color: passed ? 'var(--safe)' : 'var(--warn)' }}
          >
            {quality.total}
            <span className="text-sm font-medium text-muted-foreground">/16</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{Math.round(quality.ratio * 100)}% quality</p>
        </div>
      </div>

      {/* Overall bar with threshold marker */}
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, quality.ratio * 100)}%`, backgroundColor: passed ? 'var(--safe)' : 'var(--warn)' }}
        />
        <div
          className="absolute top-[-2px] h-3 w-0.5 bg-foreground/60"
          style={{ left: `${FUNDAQ8_PASS_RATIO * 100}%` }}
          title={`Pass threshold ${threshold}/16`}
        />
      </div>

      {/* Per-parameter breakdown */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {quality.params.map((p) => {
          const ratio = p.score / p.max
          return (
            <div key={p.key}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="truncate text-muted-foreground">{p.label}</span>
                <span className="font-medium tabular-nums">{p.score}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, backgroundColor: barColor(ratio) }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Rejection reasons + action */}
      {!passed && (
        <div className="mt-4 border-t border-warn/30 pt-3">
          <p className="text-xs font-semibold text-warn">Why it was rejected</p>
          <ul className="mt-1.5 space-y-1">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-warn" />
                {r}
              </li>
            ))}
          </ul>
          {onRecapture && (
            <Button variant="outline" size="sm" className="mt-3 w-full gap-2" onClick={onRecapture}>
              <RotateCcw className="h-3.5 w-3.5" /> Recapture / upload another image
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
