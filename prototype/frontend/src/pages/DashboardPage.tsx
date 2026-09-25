import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Gauge,
  ScanEye,
  Timer,
  ArrowRight,
  ShieldCheck,
  ListChecks,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip as RTooltip,
  Area,
  AreaChart,
} from 'recharts'
import { StatCard } from '@/components/clinical/StatCard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GradeBadge, DecisionChip, ReferableChip, DECISION_META } from '@/components/clinical/grade'
import { FundusThumb } from '@/components/fundus/FundusThumb'
import { Reveal } from '@/components/motion/Reveal'
import { CountUp } from '@/components/motion/CountUp'
import { useAppStore } from '@/store/useAppStore'
import { DIGITAL_TWIN, GRADES, MODEL_METRICS, type DRGrade, type DecisionStatus } from '@/lib/clinical'
import { timeAgo } from '@/lib/utils'
import { ChartTooltip } from '@/components/clinical/ChartTooltip'

export function DashboardPage() {
  const worklist = useAppStore((s) => s.worklist)
  const navigate = useNavigate()

  const stats = useMemo(() => {
    const total = worklist.length
    const referable = worklist.filter((c) => c.referable).length
    const flagged = worklist.filter((c) => c.decision === 'flagged').length
    const cleared = worklist.filter((c) => c.decision === 'ai-cleared' || c.decision === 'signed-off').length
    const avgProc = worklist.reduce((a, c) => a + c.processingMs, 0) / Math.max(1, total) / 1000
    const dist = ([0, 1, 2, 3, 4] as DRGrade[]).map((g) => ({
      grade: g,
      label: GRADES[g].short,
      count: worklist.filter((c) => c.grade === g).length,
      color: `var(--grade-${g})`,
    }))
    const triage = (['ai-cleared', 'flagged', 'recapture', 'signed-off'] as DecisionStatus[]).map(
      (d) => ({ key: d, count: worklist.filter((c) => c.decision === d).length }),
    )
    const autoCleared = worklist.filter((c) => c.decision === 'ai-cleared').length
    const autoClearedPct = total ? Math.round((autoCleared / total) * 100) : 0
    return { total, referable, flagged, cleared, avgProc, dist, triage, autoCleared, autoClearedPct }
  }, [worklist])

  const recent = worklist.slice(0, 6)

  // Synthetic throughput curve for the session (patients cleared per hour).
  const throughput = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        hour: `${9 + i}:00`,
        patients: Math.round(DIGITAL_TWIN.patientsPerHour * (0.82 + Math.sin(i / 2) * 0.14)),
      })),
    [],
  )

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <Reveal>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon={ScanEye}
            label="Screened today"
            value={<CountUp value={stats.total} />}
            sub={`${stats.cleared} auto-cleared by AI`}
            accent="var(--color-primary)"
          />
          <StatCard
            icon={AlertTriangle}
            label="Referable flagged"
            value={<CountUp value={stats.referable} />}
            sub={`${stats.flagged} awaiting sign-off`}
            accent="var(--warn)"
          />
          <StatCard
            icon={Timer}
            label="Avg AI turnaround"
            value={<><CountUp value={stats.avgProc} decimals={1} />s</>}
            sub="FundaQ-8 → report"
            accent="var(--chart-2)"
          />
          <StatCard
            icon={Activity}
            label="Throughput"
            value={<><CountUp value={DIGITAL_TWIN.patientsPerHour} />/hr</>}
            sub="Simulink-validated"
            accent="var(--grade-0)"
          />
        </div>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: recent worklist */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Live worklist</CardTitle>
              <CardDescription>Most recent screenings this session</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/worklist')} className="gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recent.map((c) => (
                <Link
                  key={c.id}
                  to={`/case/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/50"
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border">
                    <FundusThumb seed={c.id} grade={c.grade} alt={`${c.patient.name} fundus`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.patient.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.patient.id} · {c.eye} · {c.patient.age}
                      {c.patient.sex} · {timeAgo(c.capturedAt)}
                    </p>
                  </div>
                  <div className="hidden xl:block">
                    <ReferableChip referable={c.referable} />
                  </div>
                  <GradeBadge grade={c.grade} size="sm" />
                  <DecisionChip status={c.decision} />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: grade distribution + model perf */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Grade distribution</CardTitle>
              <CardDescription>ICDR severity across today's cases</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.dist} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" allowDecimals={false} />
                    <RTooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-secondary)' }} />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={40}>
                      {stats.dist.map((d) => (
                        <Cell key={d.grade} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Model performance
              </CardTitle>
              <CardDescription>Frozen 35/65 ensemble · internal test</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <MetricRow
                label="Referable sensitivity"
                value={MODEL_METRICS.sensitivity}
                target={MODEL_METRICS.targetSensitivity}
              />
              <MetricRow
                label="Referable specificity"
                value={MODEL_METRICS.specificity}
                target={MODEL_METRICS.targetSpecificity}
              />
              <MetricRow label="5-class accuracy" value={MODEL_METRICS.accuracy5class} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Throughput + AI triage */}
      <Reveal delay={0.05}>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" /> Session throughput
                </CardTitle>
                <CardDescription>
                  8-hour PHC session · digital-twin sustained {DIGITAL_TWIN.patientsPerHour} patients/hour
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/analytics')} className="gap-1">
                Digital twin <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={throughput} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                    <RTooltip content={<ChartTooltip unit=" patients" />} cursor={{ stroke: 'var(--color-border)' }} />
                    <Area type="monotone" dataKey="patients" stroke="var(--color-primary)" strokeWidth={2} fill="url(#tp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" /> AI triage outcome
              </CardTitle>
              <CardDescription>Human-in-the-loop caseload split</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="tabular text-4xl font-semibold text-safe">
                  <CountUp value={stats.autoClearedPct} />%
                </span>
                <span className="mb-1 text-sm text-muted-foreground">auto-cleared by AI</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Doctor time is spent only on flagged and referable cases.
              </p>
              {/* Stacked triage bar */}
              <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                {stats.triage
                  .filter((t) => t.count > 0)
                  .map((t) => (
                    <div
                      key={t.key}
                      style={{
                        width: `${(t.count / stats.total) * 100}%`,
                        backgroundColor: DECISION_META[t.key as DecisionStatus].color,
                      }}
                    />
                  ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {stats.triage.map((t) => (
                  <div key={t.key} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: DECISION_META[t.key as DecisionStatus].color }}
                    />
                    <span className="flex-1 text-muted-foreground">
                      {DECISION_META[t.key as DecisionStatus].label}
                    </span>
                    <span className="tabular font-medium">{t.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Reveal>
    </div>
  )
}

function MetricRow({ label, value, target }: { label: string; value: number; target?: number }) {
  const pass = target === undefined || value >= target
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular font-semibold" style={{ color: pass ? 'var(--safe)' : 'var(--warn)' }}>
          {value.toFixed(2)}%
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: pass ? 'var(--safe)' : 'var(--warn)' }}
        />
        {target !== undefined && (
          <div
            className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-foreground/40"
            style={{ left: `${target}%` }}
            title={`Target ${target}%`}
          />
        )}
      </div>
    </div>
  )
}
