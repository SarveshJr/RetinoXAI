import { QUADRANTS, type LesionCount, type QuadrantKey } from '@/lib/clinical'
import { cn } from '@/lib/utils'

/**
 * ICDR 4:2:1 quadrant view — haemorrhage/MA burden per retinal quadrant.
 * Positions: ST (top-left), SN (top-right), IT (bottom-left), IN (bottom-right).
 */
export function QuadrantMap({ lesions, className }: { lesions: LesionCount[]; className?: string }) {
  const hem = lesions.find((l) => l.key === 'hem')
  const ma = lesions.find((l) => l.key === 'ma')

  const burden = (q: QuadrantKey) =>
    (hem?.quadrants[q] ?? 0) + (ma?.quadrants[q] ?? 0)
  const max = Math.max(1, ...QUADRANTS.map((q) => burden(q.key)))

  const pos: Record<QuadrantKey, string> = {
    ST: 'top-0 left-0',
    SN: 'top-0 right-0',
    IT: 'bottom-0 left-0',
    IN: 'bottom-0 right-0',
  }

  return (
    <div className={cn('relative mx-auto aspect-square w-full max-w-[220px]', className)}>
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1">
        {QUADRANTS.map((q) => {
          const b = burden(q.key)
          const intensity = b / max
          const heavy = b >= 5
          return (
            <div
              key={q.key}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-md border text-center transition-colors',
                pos[q.key],
                heavy ? 'border-danger/40' : 'border-border',
              )}
              style={{
                backgroundColor: `color-mix(in srgb, var(--danger) ${Math.round(intensity * 30)}%, var(--card))`,
              }}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {q.key}
              </span>
              <span
                className="tabular text-xl font-semibold"
                style={{ color: heavy ? 'var(--danger)' : 'var(--foreground)' }}
              >
                {b}
              </span>
              {heavy && <span className="text-[9px] font-medium text-danger">≥5 lesions</span>}
            </div>
          )
        })}
      </div>
      {/* Center macula marker */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card" />
    </div>
  )
}
