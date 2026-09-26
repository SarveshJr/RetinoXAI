import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  Sparkles,
  Play,
  Eye,
  ImageIcon,
  ArrowRight,
  RotateCcw,
  UserRound,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PipelineRunner } from '@/components/clinical/PipelineRunner'
import { FundusViewer } from '@/components/fundus/FundusViewer'
import { QualityGate } from '@/components/clinical/QualityGate'
import { GradeBadge, DecisionChip, ReferableChip } from '@/components/clinical/grade'
import { ConfidenceGauge } from '@/components/clinical/ConfidenceGauge'
import { DEMO_PATIENTS } from '@/lib/demoData'
import { GRADES, type DRGrade, type Eye as EyeSide, type FundaQResult, type PatientRef, type ScreeningResult } from '@/lib/clinical'
import { screen } from '@/lib/api'
import { analyzeFundaQ } from '@/lib/imageQuality'
import { sampleFundus } from '@/lib/fundusSamples'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

type Phase = 'idle' | 'running' | 'done'

export function ScreeningPage() {
  const navigate = useNavigate()
  const addResult = useAppStore((s) => s.addResult)

  const [mode, setMode] = useState<'sample' | 'upload'>('sample')
  const [patientId, setPatientId] = useState(DEMO_PATIENTS[0].id)
  const [eye, setEye] = useState<EyeSide>('OD')
  const [sampleGrade, setSampleGrade] = useState<DRGrade | 'auto'>('auto')
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [quality, setQuality] = useState<FundaQResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<ScreeningResult | null>(null)
  const [backendDone, setBackendDone] = useState(false)
  const [realTimings, setRealTimings] = useState<{ key: string; ms: number }[] | undefined>(undefined)
  const pendingResult = useRef<ScreeningResult | null>(null)

  const patient = DEMO_PATIENTS.find((p) => p.id === patientId) ?? DEMO_PATIENTS[0]

  const clearUpload = useCallback(() => {
    setUploaded(null)
    setQuality(null)
    setAnalyzing(false)
  }, [])

  // On upload, immediately run the FundaQ-8 quality gate on the real pixels.
  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      setUploaded(dataUrl)
      setQuality(null)
      setAnalyzing(true)
      try {
        setQuality(await analyzeFundaQ(dataUrl))
      } catch {
        setQuality(null)
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }, [])

  // Block the pipeline until an uploaded image clears the quality gate.
  const uploadBlocked =
    mode === 'upload' && (!uploaded || analyzing || (quality != null && !quality.passed))

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxFiles: 1,
  })

  async function run() {
    if (mode === 'upload') {
      if (!uploaded) {
        toast.error('Upload a fundus image first')
        return
      }
      if (analyzing) {
        toast.message('Still checking image quality…')
        return
      }
      if (quality && !quality.passed) {
        toast.error('Image failed the quality gate', {
          description: 'Recapture or upload another image before screening.',
        })
        return
      }
    }
    setPhase('running')
    setResult(null)
    setBackendDone(false)
    setRealTimings(undefined)
    pendingResult.current = null
    const p: PatientRef = patient

    let imageBase64 = mode === 'upload' ? uploaded ?? undefined : undefined
    if (mode === 'sample') {
      try {
        const sampleUrl = sampleFundus(patient.id + eye, sampleGrade === 'auto' ? 0 : sampleGrade)
        imageBase64 = await urlToBase64(sampleUrl)
      } catch {
        // continue if image asset load fails
      }
    }

    try {
      const r = await screen({
        patient: p,
        eye,
        imageBase64,
        targetGrade: mode === 'sample' && sampleGrade !== 'auto' ? sampleGrade : undefined,
        quality: mode === 'upload' ? quality ?? undefined : undefined,
      })
      pendingResult.current = r
      setRealTimings(r.timings)
      setBackendDone(true) // gates the pipeline runner's final completion
    } catch (err) {
      setPhase('idle')
      toast.error('MATLAB Inference Error', {
        description: (err as Error).message || 'Failed to communicate with MATLAB backend',
      })
    }
  }

  function finalize() {
    const r = pendingResult.current
    if (!r) return
    addResult(r)
    setResult(r)
    setPhase('done')
    toast.success(`Screening complete · ${GRADES[r.grade].label}`, {
      description: `Confidence ${r.confidence.toFixed(1)}% · ${r.decision === 'ai-cleared' ? 'auto-cleared' : 'flagged for review'}`,
    })
  }

  function reset() {
    setPhase('idle')
    setResult(null)
    setBackendDone(false)
    setRealTimings(undefined)
    clearUpload()
    pendingResult.current = null
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Intake */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" /> Patient
            </CardTitle>
            <CardDescription>Select the patient and eye to screen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Patient</Label>
                <Select value={patientId} onValueChange={setPatientId} disabled={phase === 'running'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_PATIENTS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {p.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Age / Sex</Label>
                <Input value={`${patient.age} · ${patient.sex}`} readOnly className="bg-secondary/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Diabetes (yrs)</Label>
                <Input value={patient.diabetesYears} readOnly className="bg-secondary/50" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Eye</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["OD", "OS"] as EyeSide[]).map((e) => (
                  <button
                    key={e}
                    disabled={phase === 'running'}
                    onClick={() => setEye(e)}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors',
                      eye === e
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-secondary',
                    )}
                  >
                    <Eye className="h-4 w-4" /> {e === 'OD' ? 'Right (OD)' : 'Left (OS)'}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" /> Fundus image
            </CardTitle>
            <CardDescription>Upload a capture or use a sample fundus</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'sample' | 'upload')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sample" disabled={phase === 'running'}>
                  <Sparkles className="h-3.5 w-3.5" /> Sample
                </TabsTrigger>
                <TabsTrigger value="upload" disabled={phase === 'running'}>
                  <Upload className="h-3.5 w-3.5" /> Upload
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sample" className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label>Preset severity (for demo)</Label>
                  <Select
                    value={String(sampleGrade)}
                    onValueChange={(v) => setSampleGrade(v === 'auto' ? 'auto' : (Number(v) as DRGrade))}
                    disabled={phase === 'running'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (model decides)</SelectItem>
                      {([0, 1, 2, 3, 4] as DRGrade[]).map((g) => (
                        <SelectItem key={g} value={String(g)}>
                          {GRADES[g].code} · {GRADES[g].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="upload" className="mt-4 space-y-3">
                {uploaded ? (
                  <>
                    <div className="relative overflow-hidden rounded-lg border border-border">
                      <img src={uploaded} alt="Uploaded fundus" className="aspect-square w-full object-cover" />
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute right-2 top-2"
                        onClick={clearUpload}
                        disabled={phase === 'running'}
                      >
                        Replace
                      </Button>
                    </div>
                    <QualityGate quality={quality} analyzing={analyzing} onRecapture={clearUpload} />
                  </>
                ) : (
                  <div
                    {...getRootProps()}
                    className={cn(
                      'flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors',
                      isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/40',
                    )}
                  >
                    <input {...getInputProps()} />
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <Upload className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium">Drop fundus image</p>
                    <p className="text-xs text-muted-foreground">PNG or JPG · single eye</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="mt-4 flex gap-2">
              {phase !== 'idle' ? (
                <Button variant="outline" className="flex-1 gap-2" onClick={reset}>
                  <RotateCcw className="h-4 w-4" /> New screening
                </Button>
              ) : (
                <Button className="flex-1 gap-2" onClick={run} disabled={uploadBlocked}>
                  <Play className="h-4 w-4" />
                  {analyzing ? 'Checking quality…' : 'Run screening pipeline'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Runner / result */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>
                {phase === 'done' ? 'Screening result' : 'Pipeline'}
              </CardTitle>
              <CardDescription>
                {phase === 'idle' && 'Nine-stage MATLAB pipeline · runs fully offline'}
                {phase === 'running' && 'Processing on local hardware…'}
                {phase === 'done' && `${patient.name} · ${eye} · ${GRADES[result!.grade].label}`}
              </CardDescription>
            </div>
            {result && <DecisionChip status={result.decision} />}
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {phase === 'done' && result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="overflow-hidden rounded-xl border border-border">
                      <FundusViewer result={result} layer="gradcam" className="aspect-square" />
                      <div className="flex items-center justify-between bg-secondary/50 px-3 py-2 text-xs">
                        <span className="font-medium">Grad-CAM++ overlay</span>
                        <span className="text-muted-foreground">Lesion evidence</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border p-4">
                      <ConfidenceGauge value={result.confidence} label="Referral confidence" sublabel="refer vs not" />
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <GradeBadge grade={result.grade} size="lg" showCode />
                        <ReferableChip referable={result.referable} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <MiniStat label="FundaQ-8" value={`${result.quality.total}/16`} ok={result.quality.passed} />
                    <MiniStat
                      label="Rule engine"
                      value={result.rule.agreesWithAI ? 'Agrees' : 'Disagrees'}
                      ok={result.rule.agreesWithAI}
                    />
                    <MiniStat label="Processing" value={`${(result.processingMs / 1000).toFixed(1)}s`} ok />
                  </div>

                  <Button className="w-full gap-2" onClick={() => navigate(`/case/${result.id}`)}>
                    Open full case review <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="runner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {phase === 'idle' && (
                    <div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed border-border bg-secondary/30 p-4">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Configure the patient and image, then run the pipeline. Each stage below
                        executes in sequence with the frozen 35/65 ensemble.
                      </p>
                    </div>
                  )}
                  <PipelineRunner
                    running={phase === 'running'}
                    ready={backendDone}
                    timings={realTimings}
                    onComplete={finalize}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MiniStat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className="mt-1 text-sm font-semibold"
        style={{ color: ok ? 'var(--safe)' : 'var(--warn)' }}
      >
        {value}
      </p>
    </div>
  )
}
