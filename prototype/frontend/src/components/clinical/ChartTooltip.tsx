interface TooltipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }>
  label?: string | number
  unit?: string
  labelKey?: string
}

/** Themed tooltip shared across all Recharts charts. */
export function ChartTooltip({ active, payload, label, unit = '' }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && (
        <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          {p.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />}
          <span className="text-muted-foreground">{p.name}</span>
          <span className="tabular ml-auto font-semibold text-popover-foreground">
            {p.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  )
}
