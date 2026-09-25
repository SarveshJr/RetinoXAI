import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

interface Props {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: string
  trend?: { dir: 'up' | 'down'; value: string; good?: boolean }
  className?: string
}

export function StatCard({ icon: Icon, label, value, sub, accent, trend, className }: Props) {
  const color = accent ?? 'var(--color-primary)'
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 tabular text-2xl font-semibold leading-none">{value}</p>
          {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      {trend && (
        <p
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: trend.good === false ? 'var(--danger)' : 'var(--safe)' }}
        >
          {trend.dir === 'up' ? '▲' : '▼'} {trend.value}
        </p>
      )}
    </Card>
  )
}
