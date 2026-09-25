import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Workflow,
  Cpu,
  Database,
  Boxes,
  ArrowRight,
  CheckCircle2,
  Layers,
  Wrench,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PIPELINE_STAGES, FROZEN_CONFIG, MODEL_METRICS } from '@/lib/clinical'

const DATASETS = [
  { name: 'IDRiD', role: 'Train / Val', note: 'Indian Diabetic Retinopathy Image Dataset' },
  { name: 'APTOS 2019', role: 'Train / Val', note: 'Blindness detection (Kaggle)' },
  { name: 'Messidor-2', role: 'External benchmark', note: 'Held out for published-benchmark validation' },
  { name: 'DRIVE', role: 'Vessels', note: 'Vessel segmentation reference' },
]

const TOOLBOXES = [
  'Image Processing Toolbox',
  'Computer Vision Toolbox',
  'Deep Learning Toolbox',
  'Medical Imaging Toolbox',
  'Statistics & ML Toolbox',
  'Simulink · SimEvents',
]

const MODELS = [
  { name: 'ResNet-50', role: 'Ensemble backbone', weight: FROZEN_CONFIG.resnetWeight, color: 'var(--chart-2)' },
  { name: 'EfficientNet-B5', role: 'Ensemble backbone', weight: FROZEN_CONFIG.efficientNetWeight, color: 'var(--chart-4)' },
  { name: 'Multiclass U-Net', role: 'Structure segmentation', weight: null, color: 'var(--color-primary)' },
  { name: 'EfficientNet-B0', role: 'Lesion verifier', weight: null, color: 'var(--grade-2)' },
]

export function PipelinePage() {
  const location = useLocation()

  // Scroll to the Model Performance section when linked with #model-performance.
  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  return (
    <div className="space-y-6">
      {/* Pipeline flow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" /> Screening pipeline architecture
          </CardTitle>
          <CardDescription>
            Nine sequential stages · MATLAB image analysis → ensemble grading → explainable report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PIPELINE_STAGES.map((s, i) => (
              <div key={s.key} className="relative">
                <div className="flex h-full flex-col rounded-xl border border-border bg-surface-2/40 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="font-medium">{s.name}</span>
                  </div>
                  <p className="flex-1 text-xs text-muted-foreground">{s.detail}</p>
                  <Badge variant="muted" className="mt-3 w-fit">
                    <Wrench className="h-3 w-3" /> {s.toolbox}
                  </Badge>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <ArrowRight className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-border lg:block" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Model card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" /> Model composition
            </CardTitle>
            <CardDescription>Weighted-softmax ensemble with rule-engine cross-check</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {MODELS.map((m) => (
              <div key={m.name} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: `color-mix(in srgb, ${m.color} 15%, transparent)`, color: m.color }}
                >
                  <Layers className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.role}</p>
                </div>
                {m.weight !== null && (
                  <div className="text-right">
                    <p className="tabular text-lg font-semibold" style={{ color: m.color }}>
                      {(m.weight * 100).toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">ensemble weight</p>
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-start gap-2 rounded-lg bg-primary/8 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-muted-foreground">
                Trained on IDRiD + APTOS (85%), validated (15%); Messidor-2 held out for external
                benchmarking. The ensemble outperforms either backbone alone (see ablation).
                Temperature-scaled calibration; referable threshold{' '}
                <span className="font-medium text-foreground">{FROZEN_CONFIG.referableThreshold}</span>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Frozen config */}
        <Card id="model-performance" className="scroll-mt-24">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" /> Frozen configuration
            </CardTitle>
            <CardDescription>Iteration 2 · locked</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <ConfigRow label="ResNet-50 weight" value={FROZEN_CONFIG.resnetWeight.toFixed(2)} />
            <ConfigRow label="EfficientNet-B5 weight" value={FROZEN_CONFIG.efficientNetWeight.toFixed(2)} />
            <ConfigRow label="Referable threshold" value={FROZEN_CONFIG.referableThreshold.toFixed(2)} />
            <ConfigRow label="Calibration" value={FROZEN_CONFIG.calibration} />
            <div className="my-2 h-px bg-border" />
            <ConfigRow label="Sensitivity (≥2)" value={`${MODEL_METRICS.sensitivity}%`} good />
            <ConfigRow label="Specificity (≥2)" value={`${MODEL_METRICS.specificity}%`} good />
            <ConfigRow label="5-class accuracy" value={`${MODEL_METRICS.accuracy5class}%`} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Datasets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" /> Datasets
            </CardTitle>
            <CardDescription>Peer-reviewed, publicly available benchmarks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {DATASETS.map((d) => (
                <div key={d.name} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.note}</p>
                  </div>
                  <Badge variant="secondary">{d.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Toolboxes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" /> MATLAB toolboxes
            </CardTitle>
            <CardDescription>Backend runtime stack</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {TOOLBOXES.map((t) => (
                <Badge key={t} variant="outline" className="px-2.5 py-1">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              The React clinician frontend communicates with a pure-MATLAB REST backend that runs
              this pipeline against the trained <span className="font-mono text-xs">.mat</span> ensemble
              models, and syncs signed reports when connectivity is available.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ConfigRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-medium font-mono text-xs" style={{ color: good ? 'var(--safe)' : 'var(--foreground)' }}>
        {value}
      </span>
    </div>
  )
}
