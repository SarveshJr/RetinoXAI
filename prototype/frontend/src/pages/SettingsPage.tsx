import { useEffect, useState } from 'react'
import { Moon, Sun, Languages, WifiOff, ShieldCheck, Cpu, UserRound, Server } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store/useAppStore'
import { checkHealth, type BackendHealth } from '@/lib/api'
import { CURRENT_DOCTOR } from '@/lib/demoData'
import { FROZEN_CONFIG } from '@/lib/clinical'

export function SettingsPage() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const [language, setLanguage] = useState('en')
  const [offlineFirst, setOfflineFirst] = useState(true)
  const [autoClear, setAutoClear] = useState(true)
  const [threshold, setThreshold] = useState(FROZEN_CONFIG.referableThreshold * 100)
  const [health, setHealth] = useState<BackendHealth | null>(null)

  useEffect(() => {
    checkHealth().then(setHealth)
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance & language</CardTitle>
          <CardDescription>Interface preferences for this workstation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Row
            icon={theme === 'dark' ? Moon : Sun}
            title="Theme"
            desc="Switch between light and dark clinical themes"
          >
            <div className="flex items-center gap-2 rounded-lg bg-secondary p-1">
              <button
                onClick={() => setTheme('light')}
                className={`rounded-md px-3 py-1 text-sm font-medium ${theme === 'light' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
              >
                Light
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`rounded-md px-3 py-1 text-sm font-medium ${theme === 'dark' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
              >
                Dark
              </button>
            </div>
          </Row>
          <Row icon={Languages} title="Report language" desc="Patient-facing reports and summaries">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ta">தமிழ் · Tamil</SelectItem>
                <SelectItem value="hi">हिन्दी · Hindi</SelectItem>
                <SelectItem value="te">తెలుగు · Telugu</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </CardContent>
      </Card>

      {/* Screening defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Screening behaviour</CardTitle>
          <CardDescription>Human-in-the-loop policy and field-deployment settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Row icon={WifiOff} title="Offline-first processing" desc="Run the pipeline on local hardware; sync when online">
            <Switch checked={offlineFirst} onCheckedChange={setOfflineFirst} />
          </Row>
          <Row icon={ShieldCheck} title="Auto-clear high-confidence normals" desc="AI clears confident Grade 0–1; doctor reviews the rest">
            <Switch checked={autoClear} onCheckedChange={setAutoClear} />
          </Row>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <Label>Referable threshold</Label>
                <p className="text-xs text-muted-foreground">Grade ≥2 referral probability cut-off</p>
              </div>
              <span className="tabular font-mono text-sm font-medium text-primary">
                {(threshold / 100).toFixed(2)}
              </span>
            </div>
            <Slider value={[threshold]} onValueChange={(v) => setThreshold(v[0])} min={10} max={60} step={1} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Frozen validated value is {FROZEN_CONFIG.referableThreshold}. Changing this re-tunes
              sensitivity/specificity and is disabled in production.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Backend */}
      <Card>
        <CardHeader>
          <CardTitle>MATLAB backend</CardTitle>
          <CardDescription>Inference engine connection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Row icon={Server} title="Engine status" desc={health?.engine ?? 'Checking…'}>
            <Badge variant={health?.source === 'live' ? 'safe' : 'warn'}>
              {health?.source === 'live' ? 'Connected' : 'Demo simulation'}
            </Badge>
          </Row>
          <Row icon={Cpu} title="Model version" desc="Frozen ensemble build">
            <span className="font-mono text-xs text-muted-foreground">{health?.modelVersion ?? '—'}</span>
          </Row>
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance & governance</CardTitle>
          <CardDescription>Regulatory posture · compliance-by-design</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Compliance title="DPDP Act 2023" desc="On-device / anonymized processing before any cloud transfer; consent captured at intake." />
          <Compliance title="CDSCO SaMD pathway" desc="Phased certification as a clinical decision-support tool; AI never grades without doctor sign-off." />
          <Compliance title="Human-in-the-loop" desc="ICDR rule cross-check plus mandatory clinician review aligns with medical-device norms." />
        </CardContent>
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Clinician profile</CardTitle>
        </CardHeader>
        <CardContent>
          <Row icon={UserRound} title={CURRENT_DOCTOR.name} desc={`${CURRENT_DOCTOR.role} · Reg. ${CURRENT_DOCTOR.regNo}`}>
            <Badge variant="secondary">{CURRENT_DOCTOR.facility}</Badge>
          </Row>
        </CardContent>
      </Card>

      <p className="pb-4 text-center text-xs text-muted-foreground">
        RetinoXAI · Team HACK PROCESSING UNIT · SIH26-A0H-T316 · Problem SIH26038
      </p>
    </div>
  )
}

function Row({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof Moon
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Compliance({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-safe" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}
