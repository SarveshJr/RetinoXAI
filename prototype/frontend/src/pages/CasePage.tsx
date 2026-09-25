import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
  Cell,
} from 'recharts'
import {
  ArrowLeft,
  Printer,
  Layers,
  Sparkles,
  Scan,
  CircleDot,
  ShieldCheck,
  AlertTriangle,
  Stethoscope,
  FileText,
  Send,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { FundusViewer } from '@/components/fundus/FundusViewer'
import type { FundusLayer } from '@/components/fundus/FundusImage'
import { ConfidenceGauge } from '@/components/clinical/ConfidenceGauge'
import { GradeBadge, DecisionChip, ReferableChip, InferenceModeChip, gradeColor } from '@/components/clinical/grade'
import { QuadrantMap } from '@/components/clinical/QuadrantMap'
import { ChartTooltip } from '@/components/clinical/ChartTooltip'
import { ReportView } from '@/components/clinical/ReportView'
import { useAppStore } from '@/store/useAppStore'
import { signOff } from '@/lib/api'
import { CURRENT_DOCTOR } from '@/lib/demoData'
import { FROZEN_CONFIG, GRADES, type DRGrade } from '@/lib/clinical'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'

const LAYERS: { key: FundusLayer; label: string; icon: typeof Layers }[] = [
  { key: 'original', label: 'Original', icon: CircleDot },
  { key: 'enhanced', label: 'Enhanced', icon: Sparkles },
  { key: 'segmentation', label: 'Segmentation', icon: Scan },
  { key: 'gradcam', label: 'Grad-CAM++', icon: Layers },
]

export function CasePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const result = useAppStore((s) => s.worklist.find((c) => c.id === id))
  const signOffCase = useAppStore((s) => s.signOffCase)

  const [layer, setLayer] = useState<FundusLayer>('gradcam')
  const [opacity, setOpacity] = useState(75)

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-muted-foreground">
          <Info className="h-6 w-6" />
        </div>
        <p className="text-lg font-medium">Case not found</p>
        <p className="text-sm text-muted-foreground">This screening is not in the current worklist.</p>
        <Button onClick={() => navigate('/worklist')}>Back to worklist</Button>
      </div>
    )
  }

  const signedOff = result.decision === 'signed-off'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{result.patient.name}</h2>
            <GradeBadge grade={result.grade} showCode />
            <ReferableChip referable={result.referable} />
            <DecisionChip status={result.decision} />
            {result.source === 'live' && <InferenceModeChip mode={result.inferenceMode} />}
          </div>
          <p className="text-sm text-muted-foreground">
            {result.patient.id} · {result.eye} · {result.patient.age}
            {result.patient.sex} · {result.patient.diabetesYears}y diabetic · {result.patient.village}
          </p>
        </div>
      </div>

      <Tabs defaultValue="analysis">
        <TabsList>
          <TabsTrigger value="analysis">
            <Stethoscope className="h-3.5 w-3.5" /> Clinical analysis
          </TabsTrigger>
          <TabsTrigger value="report">
            <FileText className="h-3.5 w-3.5" /> Report
          </TabsTrigger>
        </TabsList>

        {/* ANALYSIS */}
        <TabsContent value="analysis" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-5">
            {/* Imaging */}
            <div className="space-y-5 lg:col-span-3">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>Fundus imaging</CardTitle>
                    <div className="flex gap-1 rounded-lg bg-secondary p-1">
                      {LAYERS.map((l) => (
                        <button
                          key={l.key}
                          onClick={() => setLayer(l.key)}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            layer === l.key
                              ? 'bg-card text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <l.icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{l.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-xl border border-border bg-black">
                    <FundusViewer result={result} layer={layer} opacity={opacity / 100} className="aspect-[4/3]" />
                  </div>
                  {layer === 'gradcam' && (
                    <div className="mt-3 flex items-center gap-3">
                      <Label className="shrink-0 text-xs text-muted-foreground">Heatmap opacity</Label>
                      <Slider
                        value={[opacity]}
                        onValueChange={(v) => setOpacity(v[0])}
                        min={0}
                        max={100}
                        step={5}
                        className="flex-1"
                      />
                      <span className="tabular w-10 text-right text-xs text-muted-foreground">{opacity}%</span>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {layer === 'original' && 'Raw capture as received from the portable fundus camera.'}
                    {layer === 'enhanced' && 'Illumination normalization → CLAHE → anisotropic diffusion.'}
                    {layer === 'segmentation' && 'Multiclass U-Net structures with Hessian-confirmed microaneurysms.'}
                    {layer === 'gradcam' && 'Grad-CAM++ localizes the ensemble evidence driving the grade.'}
                  </p>
                </CardContent>
              </Card>

              {/* Ensemble */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Ensemble severity distribution</CardTitle>
                  <CardDescription>
                    Per-class softmax · ResNet-50 ({FROZEN_CONFIG.resnetWeight}) + EfficientNet-B5 (
                    {FROZEN_CONFIG.efficientNetWeight})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EnsembleChart result={result} />
                </CardContent>
              </Card>

              {/* FundaQ-8 */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>FundaQ-8 quality</CardTitle>
                      <CardDescription>8-parameter classical score · 0–16</CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-2xl font-semibold" style={{ color: result.quality.passed ? 'var(--safe)' : 'var(--warn)' }}>
                        {result.quality.total}
                        <span className="text-sm text-muted-foreground">/16</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {result.quality.passed ? 'Accepted directly' : result.quality.enhanced ? 'Enhanced & re-scored' : 'Flagged'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
                    {result.quality.params.map((p) => (
                      <div key={p.key}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{p.label}</span>
                          <span className="tabular font-medium">{p.score}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(p.score / p.max) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Findings & sign-off */}
            <div className="space-y-5 lg:col-span-2">
              <Card>
                <CardContent className="flex flex-col items-center gap-3 pt-5">
                  <ConfidenceGauge value={result.confidence} size={160} label="Referral confidence" sublabel="calibrated · refer vs not" />
                  <div className="grid w-full grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg border border-border p-2.5">
                      <p className="text-xs text-muted-foreground">AI grade</p>
                      <p className="mt-0.5 font-semibold" style={{ color: gradeColor(result.grade) }}>
                        {GRADES[result.grade].label}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-2.5">
                      <p className="text-xs text-muted-foreground">Referable prob.</p>
                      <p className="tabular mt-0.5 font-semibold">
                        {(result.ensemble.referableProb * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Rule engine */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">ICDR 4:2:1 rule engine</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <QuadrantMap lesions={result.lesions} />
                  <div className="space-y-1.5">
                    <RuleRow label="Haem/MA in ≥4 quadrants" met={result.rule.fourTwoOne.haemMA4} />
                    <RuleRow label="Venous beading in ≥2 quadrants" met={result.rule.fourTwoOne.venousBeading2} />
                    <RuleRow label="IRMA in ≥1 quadrant" met={result.rule.fourTwoOne.irma1} />
                  </div>
                  <div
                    className="flex items-start gap-2 rounded-lg p-3 text-sm"
                    style={{
                      backgroundColor: result.rule.agreesWithAI
                        ? 'color-mix(in srgb, var(--safe) 10%, transparent)'
                        : 'color-mix(in srgb, var(--warn) 12%, transparent)',
                    }}
                  >
                    {result.rule.agreesWithAI ? (
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-safe" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                    )}
                    <div>
                      <p className="font-medium">
                        {result.rule.agreesWithAI
                          ? 'Rule engine agrees with AI grade'
                          : `Disagreement — rule suggests ${GRADES[result.rule.ruleGrade].short}`}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">{result.rule.note}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lesion counts */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Lesion evidence</CardTitle>
                  <CardDescription>U-Net segmented · B0 verified</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {result.lesions.map((l) => (
                      <div key={l.key} className="flex items-center gap-2 py-1 text-sm">
                        <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">{l.abbr}</span>
                        <span className="flex-1 truncate">{l.label}</span>
                        <span className="tabular font-semibold">{l.total}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Sign-off */}
              <SignoffPanel
                signedOff={signedOff}
                aiGrade={result.grade}
                reviewedBy={result.reviewedBy}
                finalGrade={result.finalGrade}
                onSign={(finalGrade, note) => {
                  signOffCase(result.id, finalGrade, note, CURRENT_DOCTOR.name)
                  signOff({ id: result.id, finalGrade, note, reviewedBy: CURRENT_DOCTOR.name })
                  toast.success('Report signed off', {
                    description: `${result.patient.name} · final grade ${GRADES[finalGrade].code}`,
                  })
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* REPORT */}
        <TabsContent value="report" className="mt-5">
          <div className="mb-3 flex justify-end">
            <Button variant="outline" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print / Export PDF
            </Button>
          </div>
          <ReportView result={result} />
        </TabsContent>
      </Tabs>

      <p className="text-center text-xs text-muted-foreground">
        Processed {formatDateTime(result.processedAt)} · model RetinoXAI-ensemble-v2 (frozen) ·{' '}
        <Link to="/pipeline" className="text-primary hover:underline">
          view pipeline
        </Link>
      </p>
    </div>
  )
}

function RuleRow({ label, met }: { label: string; met: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className="rounded px-1.5 py-0.5 text-xs font-medium"
        style={{
          backgroundColor: met ? 'color-mix(in srgb, var(--danger) 14%, transparent)' : 'var(--secondary)',
          color: met ? 'var(--danger)' : 'var(--muted-foreground)',
        }}
      >
        {met ? 'Met' : 'Not met'}
      </span>
    </div>
  )
}

function EnsembleChart({ result }: { result: import('@/lib/clinical').ScreeningResult }) {
  const data = useMemo(
    () =>
      [0, 1, 2, 3, 4].map((g) => ({
        grade: GRADES[g as DRGrade].short,
        ResNet: +(result.ensemble.resnetScores[g] * 100).toFixed(1),
        EfficientNet: +(result.ensemble.efficientNetScores[g] * 100).toFixed(1),
        Fused: +(result.ensemble.fusedScores[g] * 100).toFixed(1),
        isPred: g === result.grade,
      })),
    [result],
  )
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barGap={2}>
          <XAxis dataKey="grade" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
          <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" unit="%" />
          <RTooltip content={<ChartTooltip unit="%" />} cursor={{ fill: 'var(--color-secondary)' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="ResNet" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar dataKey="EfficientNet" fill="var(--chart-4)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar dataKey="Fused" radius={[3, 3, 0, 0]} maxBarSize={22}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.isPred ? 'var(--color-primary)' : 'color-mix(in srgb, var(--color-primary) 45%, transparent)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SignoffPanel({
  signedOff,
  aiGrade,
  reviewedBy,
  finalGrade,
  onSign,
}: {
  signedOff: boolean
  aiGrade: DRGrade
  reviewedBy?: string
  finalGrade?: DRGrade
  onSign: (grade: DRGrade, note: string) => void
}) {
  const [selected, setSelected] = useState<DRGrade>(aiGrade)
  const [note, setNote] = useState('')

  if (signedOff) {
    return (
      <Card className="border-safe/30 bg-safe/5">
        <CardContent className="flex items-start gap-3 pt-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-safe/15 text-safe">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">Report signed off</p>
            <p className="text-sm text-muted-foreground">
              Final grade {GRADES[finalGrade ?? aiGrade].code} · reviewed by {reviewedBy}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/25">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="h-4 w-4 text-primary" /> Doctor sign-off
        </CardTitle>
        <CardDescription>Human-in-the-loop · AI never grades alone</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Confirm or override grade</Label>
          <div className="mt-1.5 grid grid-cols-5 gap-1.5">
            {([0, 1, 2, 3, 4] as DRGrade[]).map((g) => (
              <button
                key={g}
                onClick={() => setSelected(g)}
                className="flex flex-col items-center gap-1 rounded-lg border py-2 text-xs font-medium transition-all"
                style={{
                  borderColor: selected === g ? gradeColor(g) : 'var(--border)',
                  backgroundColor: selected === g ? `color-mix(in srgb, ${gradeColor(g)} 12%, transparent)` : 'transparent',
                  color: selected === g ? gradeColor(g) : 'var(--muted-foreground)',
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: gradeColor(g) }} />
                {g}
              </button>
            ))}
          </div>
          {selected !== aiGrade && (
            <p className="mt-1.5 text-xs text-warn">Overriding AI grade {GRADES[aiGrade].code}</p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Clinical note (optional)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add findings, referral instructions or follow-up…"
            className="mt-1.5"
          />
        </div>
        <Button className="w-full gap-2" onClick={() => onSign(selected, note)}>
          <Send className="h-4 w-4" /> Confirm & sign report
        </Button>
      </CardContent>
    </Card>
  )
}
