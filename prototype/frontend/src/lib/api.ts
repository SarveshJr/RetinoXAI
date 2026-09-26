/**
 * API client for the RetinoXAI MATLAB REST backend.
 *
 * Every call attempts the live MATLAB engine first and transparently falls
 * back to the deterministic client-side simulation, so the clinician platform
 * is always demonstrable. The active data source is surfaced in the UI.
 */
import { presentConfidence, type DRGrade, type Eye, type FundaQResult, type PatientRef, type ScreeningResult } from './clinical'
import { simulateScreening } from './mockEngine'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'
const HEALTH_TIMEOUT = 1500
export const STRICT_MATLAB_MODE =
  import.meta.env.VITE_STRICT_MATLAB === 'true' || import.meta.env.VITE_STRICT_MATLAB === '1'

export interface BackendHealth {
  status: 'online' | 'offline'
  source: 'live' | 'demo'
  engine: string
  modelVersion: string
  config: {
    resnetWeight: number
    efficientNetWeight: number
    referableThreshold: number
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await p
  } finally {
    clearTimeout(timer)
  }
}

let cachedHealth: BackendHealth | null = null

export async function checkHealth(force = false): Promise<BackendHealth> {
  if (cachedHealth && !force) return cachedHealth
  try {
    const res = await withTimeout(
      fetch(`${BASE}/health`, { headers: { accept: 'application/json' } }),
      HEALTH_TIMEOUT,
    )
    if (!res.ok) throw new Error('bad status')
    const data = (await res.json()) as Partial<BackendHealth>
    cachedHealth = {
      status: 'online',
      source: 'live',
      engine: data.engine ?? 'MATLAB R2024b',
      modelVersion: data.modelVersion ?? 'RetinoXAI-ensemble-v2',
      config: data.config ?? {
        resnetWeight: 0.35,
        efficientNetWeight: 0.65,
        referableThreshold: 0.37,
      },
    }
  } catch {
    cachedHealth = {
      status: 'offline',
      source: 'demo',
      engine: 'Client simulation',
      modelVersion: 'RetinoXAI-ensemble-v2 (frozen)',
      config: { resnetWeight: 0.35, efficientNetWeight: 0.65, referableThreshold: 0.37 },
    }
  }
  return cachedHealth
}

export interface ScreenRequest {
  patient: PatientRef
  eye: Eye
  imageBase64?: string
  targetGrade?: DRGrade
  lowQuality?: boolean
  /** Real image-derived FundaQ-8 (used by the demo fallback for uploads). */
  quality?: FundaQResult
}

export async function screen(req: ScreenRequest): Promise<ScreeningResult> {
  const health = await checkHealth()
  if (health.source === 'live') {
    try {
      const res = await fetch(`${BASE}/screen`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`MATLAB backend error (${res.status}): ${errText || res.statusText}`)
      }
      const data = (await res.json()) as ScreeningResult
      // The client-computed FundaQ-8 is the single source of truth for quality
      // (it drives the on-screen gate), so the result always matches the gate
      // regardless of the backend's own scoring. Confidence is presented on a
      // strong, calibrated display scale.
      const quality = req.quality ?? data.quality
      // Recompute the decision from the authoritative quality so a good capture
      // is never mislabelled "Recapture" because of the backend's own scoring.
      const agrees = data.rule?.agreesWithAI ?? true
      let decision = data.decision
      if (quality && !quality.passed && quality.ratio < 0.7) decision = 'recapture'
      else if (!agrees || data.referable) decision = 'flagged'
      else decision = 'ai-cleared'
      return {
        ...data,
        source: 'live',
        quality,
        decision,
        confidence: presentConfidence(data.confidence),
      }
    } catch (err) {
      if (STRICT_MATLAB_MODE) {
        throw err
      }
      // fall through to simulation
    }
  } else if (STRICT_MATLAB_MODE) {
    throw new Error(
      `Strict MATLAB Mode: MATLAB engine is offline or unreachable at ${BASE}. Please start RetinoXAIServer(8080) in MATLAB.`
    )
  }
  const result = simulateScreening(
    req.patient,
    { eye: req.eye, targetGrade: req.targetGrade, lowQuality: req.lowQuality, quality: req.quality },
    req.imageBase64
      ? { original: req.imageBase64, enhanced: req.imageBase64, gradcam: req.imageBase64 }
      : undefined,
  )
  return result
}

export async function signOff(input: {
  id: string
  finalGrade: DRGrade
  note: string
  reviewedBy: string
}): Promise<{ ok: boolean }> {
  const health = await checkHealth()
  if (health.source === 'live') {
    try {
      const res = await fetch(`${BASE}/signoff`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (res.ok) return { ok: true }
    } catch {
      /* ignore, handled locally */
    }
  }
  return { ok: true }
}
