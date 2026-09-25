import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
  Line,
  ComposedChart,
} from 'recharts'
import {
  Users,
  Timer,
  Activity,
  Gauge,
  Cpu,
  Stethoscope,
  Layers3,
  TrendingUp,
  Wifi,
  Building2,
  Boxes,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatCard } from '@/components/clinical/StatCard'
import { ConfusionMatrix } from '@/components/clinical/ConfusionMatrix'
import { ChartTooltip } from '@/components/clinical/ChartTooltip'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Reveal } from '@/components/motion/Reveal'
import { CountUp } from '@/components/motion/CountUp'
import { ABLATION, DISTRICT, DIGITAL_TWIN, ITERATION_COMPARISON, MODEL_METRICS } from '@/lib/clinical'
import { makeRng } from '@/lib/rng'

export function AnalyticsPage() {
  // Deterministic 8-hour SimEvents-style throughput + turnaround series.
  const sim = useMemo(() => {
    const rng = makeRng('digital-twin')
    let queue = 0
    return Array.from({ length: DIGITAL_TWIN.sessionHours }, (_, i) => {
      const arrivals = Math.round(3600 / DIGITAL_TWIN.arrivalIntervalSec + (rng() - 0.5) * 3)
      const cleared = Math.min(arrivals + queue, DIGITAL_TWIN.patientsPerHour + Math.round((rng() - 0.5) * 4))
      queue = Math.max(0, queue + arrivals - cleared)
      // turnaround: AI (15-20s) auto-cleared, + review (120s) for flagged share
      const flaggedShare = 0.28 + (rng() - 0.5) * 0.06
      const turnaround = Math.round(18 + flaggedShare * DIGITAL_TWIN.reviewAvgSec)
      return { hour: `${9 + i}:00`, arrivals, cleared, queue, turnaround }
    })
  }, [])

  const totalHandled = sim.reduce((a, s) => a + s.cleared, 0)
  const avgTurnaround = Math.round(sim.reduce((a, s) => a + s.turnaround, 0) / sim.length)

  // Connectivity: bandwidth drops during the day; reports buffer offline and
  // sync when the uplink recovers (offline-first, point 5: bandwidth constraints).
  const conn = useMemo(() => {
    const rng = makeRng('bandwidth')
    let backlog = 0
    return Array.from({ length: DIGITAL_TWIN.sessionHours }, (_, i) => {
      // rural uplink: low mid-morning, recovers later
      const bw = Math.max(0.2, 2.4 + Math.sin((i - 1) / 1.5) * 1.8 + (rng() - 0.5) * 0.5)
      const generated = sim[i]?.cleared ?? 60 // one report per cleared patient
      const syncCapacity = Math.round(bw * 22) // reports/hr the link can push (~1.6 Mbit each)
      const synced = Math.min(backlog + generated, syncCapacity)
      backlog = Math.max(0, backlog + generated - synced)
      return { hour: `${9 + i}:00`, bandwidth: +bw.toFixed(1), backlog, synced }
    })
  }, [sim])

  return (
    <div className="space-y-6">
      {/* KPI */}
      <Reveal>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard icon={Activity} label="Sustained throughput" value={<><CountUp value={DIGITAL_TWIN.patientsPerHour} />/hr</>} sub="SimEvents validated" accent="var(--color-primary)" />
          <StatCard icon={Users} label="Handled / 8h session" value={<CountUp value={totalHandled} />} sub={`${DIGITAL_TWIN.totalHandledMin}–${DIGITAL_TWIN.totalHandledMax} range`} accent="var(--chart-2)" />
          <StatCard icon={Timer} label="Avg turnaround" value={<><CountUp value={avgTurnaround} />s</>} sub="capture → signed report" accent="var(--grade-0)" />
          <StatCard icon={Stethoscope} label="Doctor review" value={`${DIGITAL_TWIN.reviewAvgSec}s`} sub="flagged cases only" accent="var(--warn)" />
        </div>
      </Reveal>

      {/* Digital twin */}
      <Reveal delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" /> MATLAB–Simulink digital twin
            </CardTitle>
            <CardDescription>
              8-hour PHC session · {DIGITAL_TWIN.arrivalIntervalSec}s arrivals · queue-based throughput & turnaround model
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={sim} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                      <RTooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-border)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="cleared" name="Cleared" stroke="var(--color-primary)" strokeWidth={2} fill="url(#cl)" />
                      <Bar dataKey="arrivals" name="Arrivals" fill="var(--chart-2)" opacity={0.35} radius={[3, 3, 0, 0]} maxBarSize={24} />
                      <Line type="monotone" dataKey="queue" name="Queue length" stroke="var(--warn)" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-3">
                <SimParam icon={Users} label="Patient arrival" value={`1 every ${DIGITAL_TWIN.arrivalIntervalSec}s`} />
                <SimParam icon={Cpu} label="AI inference" value={`${DIGITAL_TWIN.aiProcessingSecMin}–${DIGITAL_TWIN.aiProcessingSecMax}s`} />
                <SimParam icon={Stethoscope} label="Doctor review" value={`${DIGITAL_TWIN.reviewSecMin}–${DIGITAL_TWIN.reviewSecMax}s`} />
                <SimParam icon={Timer} label="Avg turnaround" value={`${avgTurnaround}s / patient`} />
                <SimParam icon={Gauge} label="Sustained rate" value={`${DIGITAL_TWIN.patientsPerHour} patients/hr`} highlight />
              </div>
            </div>
          </CardContent>
        </Card>
      </Reveal>

      {/* Connectivity + District scaling */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-primary" /> Connectivity & bandwidth
              </CardTitle>
              <CardDescription>
                Offline-first: reports buffer locally on weak uplinks and sync when bandwidth recovers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={conn} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--warn)" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="var(--warn)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                    <YAxis yAxisId="l" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                    <YAxis yAxisId="r" orientation="right" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" unit=" Mbps" />
                    <RTooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-border)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Area yAxisId="l" type="monotone" dataKey="backlog" name="Unsynced reports" stroke="var(--warn)" strokeWidth={2} fill="url(#bl)" />
                    <Line yAxisId="r" type="monotone" dataKey="bandwidth" name="Uplink (Mbps)" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Screening never blocks on the network — grading runs on local hardware and the
                backlog drains automatically once connectivity returns.
              </p>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.15}>
          <DistrictPlanner />
        </Reveal>
      </div>

      {/* Model validation */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-primary" /> Confusion matrix
              </CardTitle>
              <CardDescription>Frozen 35/65 ensemble · internal test · 5-class</CardDescription>
            </CardHeader>
            <CardContent>
              <ConfusionMatrix />
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <ValidationStat label="Sensitivity" value={MODEL_METRICS.sensitivity} target={MODEL_METRICS.targetSensitivity} />
                <ValidationStat label="Specificity" value={MODEL_METRICS.specificity} target={MODEL_METRICS.targetSpecificity} />
                <ValidationStat label="5-class acc." value={MODEL_METRICS.accuracy5class} />
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.15}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-primary" /> Ensemble vs single technique
              </CardTitle>
              <CardDescription>
                Ablation — the integrated ensemble outperforms either backbone alone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ABLATION} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={9.5} stroke="var(--color-muted-foreground)" interval={0} />
                    <YAxis domain={[70, 100]} tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" unit="%" />
                    <RTooltip content={<ChartTooltip unit="%" />} cursor={{ fill: 'var(--color-secondary)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="sensitivity" name="Sensitivity" fill="var(--color-primary)" radius={[3, 3, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="specificity" name="Specificity" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="accuracy" name="5-class acc." fill="var(--chart-3)" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Validated against IDRiD + APTOS; Messidor-2 held out for external benchmarking.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      {/* Iteration tuning */}
      <Reveal delay={0.1}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Ensemble weight & threshold tuning
            </CardTitle>
            <CardDescription>
              Grid search — 35/65 @ threshold 0.37 is the frozen configuration meeting both targets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ITERATION_COMPARISON} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis domain={[80, 100]} tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" unit="%" />
                  <RTooltip content={<ChartTooltip unit="%" />} cursor={{ fill: 'var(--color-secondary)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sensitivity" name="Sensitivity" fill="var(--color-primary)" radius={[3, 3, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="specificity" name="Specificity" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  )
}

function DistrictPlanner() {
  const [units, setUnits] = useState<number>(DISTRICT.defaultUnits)
  const [perDay, setPerDay] = useState<number>(DISTRICT.patientsPerUnitPerDay)
  const annual = units * perDay * DISTRICT.workingDaysPerYear
  const pct = Math.min(100, (annual / DISTRICT.target) * 100)
  const meets = annual >= DISTRICT.target

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> District-scale planner
        </CardTitle>
        <CardDescription>Resource allocation for a district program (100,000+ patients/year)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Projected annual capacity</p>
          <p className="tabular mt-1 text-3xl font-semibold" style={{ color: meets ? 'var(--safe)' : 'var(--warn)' }}>
            <CountUp value={annual} />
          </p>
          <p className="text-xs text-muted-foreground">patients screened / year</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: meets ? 'var(--safe)' : 'var(--warn)' }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Target 100,000 / yr</span>
            <Badge variant={meets ? 'safe' : 'warn'}>{meets ? 'Target met' : `${pct.toFixed(0)}% of target`}</Badge>
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Screening units (camps / ambulances / PHCs)</Label>
            <span className="tabular text-sm font-medium text-primary">{units}</span>
          </div>
          <Slider value={[units]} onValueChange={(v) => setUnits(v[0])} min={1} max={30} step={1} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Patients / unit / day</Label>
            <span className="tabular text-sm font-medium text-primary">{perDay}</span>
          </div>
          <Slider value={[perDay]} onValueChange={(v) => setPerDay(v[0])} min={100} max={525} step={25} />
        </div>
        <p className="text-xs text-muted-foreground">
          At the Simulink-validated {DIGITAL_TWIN.patientsPerHour}/hr, {DISTRICT.defaultUnits} units clear the
          district target across {DISTRICT.workingDaysPerYear} working days.
        </p>
      </CardContent>
    </Card>
  )
}

function SimParam({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof Users
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
        style={{
          backgroundColor: highlight ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--secondary)',
          color: highlight ? 'var(--color-primary)' : 'var(--muted-foreground)',
        }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

function ValidationStat({ label, value, target }: { label: string; value: number; target?: number }) {
  const pass = target === undefined || value >= target
  return (
    <div className="rounded-lg border border-border p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="tabular text-lg font-semibold" style={{ color: pass ? 'var(--safe)' : 'var(--warn)' }}>
        {value.toFixed(2)}%
      </p>
      {target !== undefined && <p className="text-[10px] text-muted-foreground">target ≥{target}%</p>}
    </div>
  )
}
