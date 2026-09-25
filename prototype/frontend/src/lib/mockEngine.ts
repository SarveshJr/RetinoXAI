/**
 * Deterministic client-side simulation of the RetinoXAI MATLAB pipeline.
 *
 * Used as a graceful fallback so the clinician UI is fully demonstrable when
 * the MATLAB REST backend is not running. Every value is derived from a seed
 * (patient id + eye) and mirrors the real pipeline's output schema, using the
 * frozen ensemble weights and calibration from the Iteration 2 report.
 */
import {
  FROZEN_CONFIG,
  FUNDAQ8_PARAMS,
  FUNDAQ8_PASS_RATIO,
  GRADES,
  LESION_CLASSES,
  PIPELINE_STAGES,
  QUADRANTS,
  presentConfidence,
  type DRGrade,
  type DecisionStatus,
  type Eye,
  type FundaQResult,
  type LesionCount,
  type PatientRef,
  type QuadrantKey,
  type RuleEngineResult,
  type ScreeningResult,
} from './clinical'
import { makeRng, randFloat, randInt } from './rng'

function softmax(xs: number[]): number[] {
  const m = Math.max(...xs)
  const exps = xs.map((x) => Math.exp(x - m))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

function argmax(xs: number[]): number {
  let bi = 0
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[bi]) bi = i
  return bi
}

/** Fabricate class logits peaked around a target grade with some noise. */
function logitsFor(rng: () => number, target: DRGrade, spread: number): number[] {
  return [0, 1, 2, 3, 4].map((g) => {
    const dist = Math.abs(g - target)
    return -dist * spread + randFloat(rng, -0.4, 0.4)
  })
}

function computeFundaQ(rng: () => number, forceLow: boolean): FundaQResult {
  const params = FUNDAQ8_PARAMS.map((p) => {
    let score: number
    if (forceLow) score = randFloat(rng, 0.5, 1.5)
    else score = randFloat(rng, 1.0, 2.05)
    score = Math.min(p.max, Math.round(score * 2) / 2)
    return { key: p.key, label: p.label, score, max: p.max }
  })
  const total = params.reduce((a, p) => a + p.score, 0)
  const ratio = total / 16
  const passed = ratio >= FUNDAQ8_PASS_RATIO
  return { total: Math.round(total * 10) / 10, ratio, passed, enhanced: !passed, params }
}

function buildLesions(rng: () => number, grade: DRGrade): LesionCount[] {
  // Higher grade => more lesions, spread across quadrants. Advanced lesions
  // (venous beading, IRMA, neovascularization) only appear once the grade
  // warrants them, with no spurious noise at lower grades.
  const intensity = grade / 4
  return LESION_CLASSES.map((lc) => {
    const quadrants = {} as Record<QuadrantKey, number>
    let total = 0
    for (const q of QUADRANTS) {
      let n = 0
      if (lc.key === 'hem') {
        n = Math.max(0, Math.round(intensity * 4.2 + randFloat(rng, -0.5, 0.9)))
      } else if (lc.key === 'ma') {
        n = Math.max(0, Math.round(intensity * 3.0 + randFloat(rng, -0.5, 0.9)))
      } else if (lc.key === 'ex' || lc.key === 'se') {
        n = Math.max(0, Math.round(intensity * 3 + randFloat(rng, -0.5, 0.8)))
      } else if (lc.key === 'vb' && grade >= 3) {
        n = Math.max(0, Math.round(intensity * 1.4 + randFloat(rng, -0.2, 0.6)))
      } else if (lc.key === 'irma' && grade >= 3) {
        n = Math.max(0, Math.round(intensity * 1.1 + randFloat(rng, -0.2, 0.6)))
      } else if (lc.key === 'nv' && grade >= 4) {
        n = Math.max(0, Math.round(intensity * 1.6 + randFloat(rng, -0.1, 0.7)))
      }
      quadrants[q.key] = n
      total += n
    }
    return {
      key: lc.key,
      label: lc.label,
      abbr: lc.abbr,
      total,
      quadrants,
      confirmed: total > 0,
    }
  })
}

function runRuleEngine(lesions: LesionCount[], aiGrade: DRGrade): RuleEngineResult {
  const byKey = Object.fromEntries(lesions.map((l) => [l.key, l]))
  const haemMA = byKey['hem'] && byKey['ma']
  const quadWithHeavyHaem = QUADRANTS.filter(
    (q) => byKey['hem'].quadrants[q.key] + byKey['ma'].quadrants[q.key] >= 5,
  ).length
  const haemMA4 = !!haemMA && quadWithHeavyHaem >= 4
  const vbQuad = QUADRANTS.filter((q) => byKey['vb']?.quadrants[q.key] > 0).length
  const venousBeading2 = vbQuad >= 2
  const irmaQuad = QUADRANTS.filter((q) => byKey['irma']?.quadrants[q.key] > 0).length
  const irma1 = irmaQuad >= 1
  const nvTotal = byKey['nv']?.total ?? 0

  let ruleGrade: DRGrade = aiGrade
  if (nvTotal > 0) ruleGrade = 4
  else if (haemMA4 || venousBeading2 || irma1) ruleGrade = 3

  const agreesWithAI = ruleGrade === aiGrade
  let note: string
  if (nvTotal > 0) note = 'Neovascularization detected → proliferative (Grade 4).'
  else if (haemMA4) note = '4:2:1 met — severe haemorrhages in ≥4 quadrants.'
  else if (venousBeading2) note = '4:2:1 met — venous beading in ≥2 quadrants.'
  else if (irma1) note = '4:2:1 met — IRMA in ≥1 quadrant.'
  else note = '4:2:1 threshold not met — consistent with ≤ moderate NPDR.'

  return { ruleGrade, fourTwoOne: { haemMA4, venousBeading2, irma1 }, agreesWithAI, note }
}

export interface MockOptions {
  targetGrade?: DRGrade
  eye?: Eye
  lowQuality?: boolean
  /** Real image-derived FundaQ-8 result (from browser analysis of an upload). */
  quality?: FundaQResult
}

export function simulateScreening(
  patient: PatientRef,
  opts: MockOptions = {},
  images?: Partial<ScreeningResult['images']>,
): ScreeningResult {
  const eye: Eye = opts.eye ?? 'OD'
  const rng = makeRng(`${patient.id}-${eye}-${opts.targetGrade ?? 'auto'}`)

  // Choose a plausible grade if not forced (weighted toward lower grades).
  let target: DRGrade
  if (opts.targetGrade !== undefined) target = opts.targetGrade
  else {
    const r = rng()
    target = (r < 0.4 ? 0 : r < 0.6 ? 1 : r < 0.8 ? 2 : r < 0.92 ? 3 : 4) as DRGrade
  }

  const lowQuality = opts.lowQuality ?? rng() < 0.08
  // Prefer a real image-derived FundaQ-8 result when available (uploaded image
  // analysed in the browser); otherwise fall back to a seeded estimate.
  const quality = opts.quality ?? computeFundaQ(rng, lowQuality)

  // Two backbones produce independent logits; fuse with frozen weights.
  const resnetScores = softmax(logitsFor(rng, target, randFloat(rng, 1.7, 2.4)))
  const efficientNetScores = softmax(logitsFor(rng, target, randFloat(rng, 1.9, 2.8)))
  const fusedRaw = resnetScores.map(
    (r, i) =>
      FROZEN_CONFIG.resnetWeight * r + FROZEN_CONFIG.efficientNetWeight * efficientNetScores[i],
  )
  // Temperature scaling for calibrated confidence.
  const fusedScores = softmax(fusedRaw.map((s) => Math.log(s + 1e-9) / FROZEN_CONFIG.temperature))
  const grade = argmax(fusedScores) as DRGrade
  const referableProb = fusedScores[2] + fusedScores[3] + fusedScores[4]
  const referable = referableProb >= FROZEN_CONFIG.referableThreshold
  // Confidence in the referral decision (refer vs not) — high when the decision
  // is clear, lower only when genuinely ambiguous. Matches the MATLAB backend.
  const rawConfidence = Math.round((referable ? referableProb : 1 - referableProb) * 1000) / 10
  const confidence = presentConfidence(rawConfidence)

  const lesions = buildLesions(rng, grade)
  const rule = runRuleEngine(lesions, grade)

  // Decision policy: recapture if quality still fails; else flag on disagreement
  // or low confidence, otherwise auto-clear.
  let decision: DecisionStatus
  if (lowQuality && !quality.passed && quality.ratio < 0.7) decision = 'recapture'
  else if (!rule.agreesWithAI || rawConfidence < 55 || referable) decision = 'flagged'
  else decision = 'ai-cleared'

  const timings = PIPELINE_STAGES.map((s) => ({
    key: s.key,
    ms: Math.round(
      randFloat(
        rng,
        s.key === 'grade' ? 900 : s.key === 'segment' ? 700 : 120,
        s.key === 'grade' ? 1600 : s.key === 'segment' ? 1300 : 420,
      ),
    ),
  }))
  const processingMs = timings.reduce((a, t) => a + t.ms, 0)

  const now = new Date()
  return {
    id: `${patient.id}-${eye}-${Math.floor(rng() * 1e6)}`,
    patient,
    eye,
    capturedAt: new Date(now.getTime() - randInt(rng, 20, 300) * 1000).toISOString(),
    processedAt: now.toISOString(),
    source: 'demo',
    quality,
    grade,
    ensemble: { resnetScores, efficientNetScores, fusedScores, referableProb },
    confidence,
    referable,
    lesions,
    rule,
    decision,
    gradcamAvailable: true,
    timings,
    processingMs,
    images: {
      original: images?.original ?? '',
      enhanced: images?.enhanced ?? '',
      gradcam: images?.gradcam ?? '',
      segmentation: images?.segmentation ?? '',
    },
  }
}

export { GRADES }
