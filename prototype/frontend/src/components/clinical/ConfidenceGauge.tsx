import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  value: number // 0-100
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
  color?: string
  className?: string
}

/** Animated radial confidence gauge (270deg arc). */
export function ConfidenceGauge({
  value,
  size = 148,
  strokeWidth = 12,
  label,
  sublabel,
  color,
  className,
}: Props) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const from = display
    const dur = 800
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (value - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const arc = 270
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const arcLength = (arc / 360) * circumference
  const offset = arcLength * (1 - display / 100)
  const rotation = 135 // start at bottom-left

  const stroke =
    color ?? (value >= 85 ? 'var(--safe)' : value >= 70 ? 'var(--warn)' : 'var(--danger)')

  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-secondary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke 0.4s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-2xl font-semibold" style={{ color: stroke }}>
          {display.toFixed(1)}
          <span className="text-sm">%</span>
        </span>
        {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
        {sublabel && <span className="mt-0.5 text-[10px] text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  )
}
