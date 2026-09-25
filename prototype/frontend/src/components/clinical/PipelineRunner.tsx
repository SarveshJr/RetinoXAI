import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { PIPELINE_STAGES } from '@/lib/clinical'
import { cn } from '@/lib/utils'

interface Props {
  running: boolean
  /**
   * Whether the actual processing has finished. The runner animates through the
   * stages, but holds the final stage "processing" until `ready` is true — so on
   * a live upload the checkmarks only complete once the MATLAB backend returns,
   * while a sample (instant) completes on the animation timer.
   */
  ready?: boolean
  /** Optional per-stage durations (ms); real backend timings once available. */
  timings?: { key: string; ms: number }[]
  onComplete?: () => void
  compact?: boolean
}

/** Plays the 9-stage RetinoXAI pipeline as an animated checklist. */
export function PipelineRunner({ running, ready = true, timings, onComplete, compact }: Props) {
  const [activeIdx, setActiveIdx] = useState(-1)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [reachedEnd, setReachedEnd] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const completed = useRef(false)

  const lastIdx = PIPELINE_STAGES.length - 1

  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (!running) {
      setActiveIdx(-1)
      setDone(new Set())
      setReachedEnd(false)
      completed.current = false
      return
    }
    setActiveIdx(0)
    setDone(new Set())
    setReachedEnd(false)
    completed.current = false

    let acc = 0
    const scale = 0.55
    PIPELINE_STAGES.forEach((stage, i) => {
      const dur = ((timings?.find((t) => t.key === stage.key)?.ms ?? 500) * scale) + 260
      timers.current.push(setTimeout(() => setActiveIdx(i), acc))
      acc += dur
      timers.current.push(
        setTimeout(() => {
          if (i < lastIdx) {
            setDone((prev) => new Set(prev).add(i))
          } else {
            // Reached the last stage: keep it "processing" until the backend is ready.
            setActiveIdx(lastIdx)
            setReachedEnd(true)
          }
        }, acc),
      )
    })
    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  // Complete only once the animation has reached the end AND processing is done.
  useEffect(() => {
    if (running && reachedEnd && ready && !completed.current) {
      completed.current = true
      setDone(new Set(PIPELINE_STAGES.map((_, i) => i)))
      setActiveIdx(-1)
      onComplete?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, reachedEnd, ready])

  const waitingOnBackend = reachedEnd && !ready

  return (
    <ol className="space-y-1">
      {PIPELINE_STAGES.map((stage, i) => {
        const isDone = done.has(i)
        const isActive = activeIdx === i
        const pending = !isDone && !isActive
        return (
          <li
            key={stage.key}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
              isActive && 'bg-primary/8',
              pending && 'opacity-55',
            )}
          >
            <div
              className={cn(
                'grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors',
                isDone && 'border-safe bg-safe text-white',
                isActive && 'border-primary bg-primary/15 text-primary',
                pending && 'border-border bg-secondary text-muted-foreground',
              )}
            >
              {isDone ? (
                <Check className="h-3.5 w-3.5" />
              ) : isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                i + 1
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{stage.name}</p>
                <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {stage.short}
                </span>
                {isActive && i === lastIdx && waitingOnBackend && (
                  <span className="shrink-0 text-[10px] font-medium text-primary">running on MATLAB…</span>
                )}
              </div>
              {!compact && <p className="truncate text-xs text-muted-foreground">{stage.detail}</p>}
            </div>
            {isDone && timings && timings.find((t) => t.key === stage.key) && (
              <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                {timings.find((t) => t.key === stage.key)?.ms}ms
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
