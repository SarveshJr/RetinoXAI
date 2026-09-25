import { CONFUSION_MATRIX, GRADES, type DRGrade } from '@/lib/clinical'

/** 5-class confusion matrix heatmap (rows = true, cols = predicted). */
export function ConfusionMatrix() {
  const max = Math.max(...CONFUSION_MATRIX.flat())
  const labels = ([0, 1, 2, 3, 4] as DRGrade[]).map((g) => GRADES[g].short)

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-12" />
            <th colSpan={5} className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Predicted
            </th>
          </tr>
          <tr>
            <th />
            {labels.map((l) => (
              <th key={l} className="px-1 pb-1 text-center text-xs font-medium text-muted-foreground">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CONFUSION_MATRIX.map((row, i) => (
            <tr key={i}>
              <th className="pr-1 text-right text-xs font-medium text-muted-foreground">
                {i === 0 && (
                  <span className="mr-1 hidden text-[11px] uppercase tracking-wide sm:inline">True</span>
                )}
                {labels[i]}
              </th>
              {row.map((val, j) => {
                const isDiag = i === j
                const intensity = val / max
                return (
                  <td
                    key={j}
                    className="h-11 w-11 rounded-md text-center align-middle text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: isDiag
                        ? `color-mix(in srgb, var(--safe) ${20 + intensity * 55}%, var(--card))`
                        : val === 0
                          ? 'var(--secondary)'
                          : `color-mix(in srgb, var(--danger) ${15 + intensity * 45}%, var(--card))`,
                      color: intensity > 0.5 ? '#fff' : 'var(--foreground)',
                    }}
                    title={`True ${labels[i]} → Pred ${labels[j]}: ${val}`}
                  >
                    {val}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
