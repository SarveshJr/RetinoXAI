import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, ArrowUpDown, Send, Inbox } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GradeBadge, DecisionChip } from '@/components/clinical/grade'
import { FundusThumb } from '@/components/fundus/FundusThumb'
import { useAppStore } from '@/store/useAppStore'
import { GRADES, type DecisionStatus, type DRGrade } from '@/lib/clinical'
import { timeAgo, cn } from '@/lib/utils'
import { toast } from 'sonner'

type SortKey = 'priority' | 'recent' | 'grade' | 'confidence'

const DECISION_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'flagged', label: 'Needs review' },
  { value: 'ai-cleared', label: 'AI cleared' },
  { value: 'signed-off', label: 'Signed off' },
  { value: 'recapture', label: 'Recapture' },
]

// Priority weight: flagged referable first, then flagged, then recapture.
const priorityWeight = (d: DecisionStatus, referable: boolean) => {
  if (d === 'flagged' && referable) return 0
  if (d === 'flagged') return 1
  if (d === 'recapture') return 2
  if (d === 'ai-cleared') return 3
  return 4
}

export function WorklistPage() {
  const worklist = useAppStore((s) => s.worklist)
  const navigate = useNavigate()

  const [q, setQ] = useState('')
  const [decision, setDecision] = useState('all')
  const [gradeF, setGradeF] = useState('all')
  const [sort, setSort] = useState<SortKey>('priority')

  const rows = useMemo(() => {
    let list = worklist.filter((c) => {
      if (q && !`${c.patient.name} ${c.patient.id} ${c.patient.village}`.toLowerCase().includes(q.toLowerCase()))
        return false
      if (decision !== 'all' && c.decision !== decision) return false
      if (gradeF !== 'all' && c.grade !== Number(gradeF)) return false
      return true
    })
    list = [...list].sort((a, b) => {
      if (sort === 'priority')
        return priorityWeight(a.decision, a.referable) - priorityWeight(b.decision, b.referable)
      if (sort === 'recent') return +new Date(b.capturedAt) - +new Date(a.capturedAt)
      if (sort === 'grade') return b.grade - a.grade
      return b.confidence - a.confidence
    })
    return list
  }, [worklist, q, decision, gradeF, sort])

  const counts = useMemo(
    () => ({
      total: worklist.length,
      flagged: worklist.filter((c) => c.decision === 'flagged').length,
      referable: worklist.filter((c) => c.referable).length,
      cleared: worklist.filter((c) => c.decision === 'ai-cleared').length,
    }),
    [worklist],
  )

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, ID or village…"
            className="pl-9"
          />
        </div>
        <Select value={decision} onValueChange={setDecision}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DECISION_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={gradeF} onValueChange={setGradeF}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All grades</SelectItem>
            {([0, 1, 2, 3, 4] as DRGrade[]).map((g) => (
              <SelectItem key={g} value={String(g)}>
                {GRADES[g].code} · {GRADES[g].short}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-40">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="grade">Severity</SelectItem>
            <SelectItem value="confidence">Confidence</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-sm">
        <Chip label="Total" value={counts.total} />
        <Chip label="Needs review" value={counts.flagged} color="var(--warn)" />
        <Chip label="Referable" value={counts.referable} color="var(--danger)" />
        <Chip label="AI cleared" value={counts.cleared} color="var(--safe)" />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Eye</th>
                <th className="px-4 py-3 font-medium">Grade</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Quality</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Captured</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer transition-colors hover:bg-secondary/50"
                  onClick={() => navigate(`/case/${c.id}`)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border">
                        <FundusThumb seed={c.id} grade={c.grade} alt={`${c.patient.name} fundus`} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.patient.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.patient.id} · {c.patient.village}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.eye}</td>
                  <td className="px-4 py-2.5">
                    <GradeBadge grade={c.grade} size="sm" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="tabular font-medium"
                      style={{ color: c.confidence >= 85 ? 'var(--safe)' : c.confidence >= 70 ? 'var(--warn)' : 'var(--danger)' }}
                    >
                      {c.confidence.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('tabular text-xs', c.quality.passed ? 'text-muted-foreground' : 'text-warn')}>
                      {c.quality.total}/16
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <DecisionChip status={c.decision} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{timeAgo(c.capturedAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {c.referable && c.decision === 'flagged' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          toast.success('Teleconsult requested', {
                            description: `${c.patient.name} referred to retina specialist`,
                          })
                        }}
                      >
                        <Send className="h-3.5 w-3.5" /> Refer
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Inbox className="h-5 w-5" />
            </div>
            <p className="font-medium">No cases match these filters</p>
            <p className="text-sm text-muted-foreground">Adjust the search or filters above.</p>
          </div>
        )}
      </Card>
    </div>
  )
}

function Chip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1">
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-semibold">{value}</span>
    </div>
  )
}
