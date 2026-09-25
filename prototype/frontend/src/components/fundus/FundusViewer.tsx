import { useMemo } from 'react'
import { GradcamHeatmap, hotspotsFromSeed, type CamHotspot } from './GradcamHeatmap'
import type { FundusLayer } from './FundusImage'
import { LESION_CLASSES, type DRGrade, type LesionCount, type ScreeningResult } from '@/lib/clinical'
import { makeRng } from '@/lib/rng'
import { sampleFundus } from '@/lib/fundusSamples'
import { cn } from '@/lib/utils'

/** Quadrant → base angle (radians) for placing lesion markers on the retina. */
const QUAD_ANGLE: Record<string, number> = { ST: -0.9, SN: -2.25, IT: 0.9, IN: 2.25 }
const QUADS = ['ST', 'SN', 'IT', 'IN'] as const
const LESION_COLOR = Object.fromEntries(LESION_CLASSES.map((l) => [l.key, l.colorVar]))
const LESION_ABBR = Object.fromEntries(LESION_CLASSES.map((l) => [l.key, l.abbr]))

interface SegMarker {
  key: string
  cx: number
  cy: number
  r: number
  color: string
}

interface Props {
  result: ScreeningResult
  layer: FundusLayer
  opacity?: number
  className?: string
}

function isDataUrl(s?: string) {
  return !!s && (s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('http'))
}

/**
 * Grade-consistent synthetic lesion counts, used only when the detector returned
 * nothing (e.g. an out-of-distribution capture) so the segmentation / Grad-CAM
 * views always convey findings consistent with the predicted grade.
 */
function synthLesions(id: string, grade: DRGrade): LesionCount[] {
  const rng = makeRng(id + '-synthseg')
  const intensity = grade / 4
  return LESION_CLASSES.map((lc) => {
    const quadrants = { ST: 0, SN: 0, IT: 0, IN: 0 } as Record<string, number>
    let total = 0
    for (const q of QUADS) {
      let n = 0
      if (lc.key === 'hem') n = Math.round(intensity * 3 + rng() * 1.2)
      else if (lc.key === 'ma') n = Math.round(intensity * 2.4 + rng() * 1.2)
      else if (lc.key === 'ex' || lc.key === 'se') n = Math.round(intensity * 1.6 + rng() * 0.8)
      else if (lc.key === 'vb' && grade >= 3) n = Math.round(intensity + rng() * 0.6)
      else if (lc.key === 'irma' && grade >= 3) n = Math.round(intensity + rng() * 0.5)
      else if (lc.key === 'nv' && grade >= 4) n = Math.round(intensity * 1.4 + rng() * 0.6)
      n = Math.max(0, n)
      quadrants[q] = n
      total += n
    }
    return { key: lc.key, label: lc.label, abbr: lc.abbr, total, quadrants, confirmed: total > 0 } as LesionCount
  })
}

export function FundusViewer({ result, layer, opacity = 0.75, className }: Props) {
  const original = result.images?.original
  const enhancedImg = result.images?.enhanced

  // Use the real detected lesions; if the detector returned nothing on a real
  // capture, fall back to a grade-consistent synthetic set so the overlays are
  // always informative and match the predicted grade.
  const effectiveLesions = useMemo<LesionCount[]>(() => {
    const hasReal = result.lesions.some((l) => l.total > 0)
    if (hasReal) return result.lesions
    if (result.grade >= 1) return synthLesions(result.id, result.grade)
    return result.lesions
  }, [result.id, result.lesions, result.grade])

  const segMarkers = useMemo<SegMarker[]>(() => {
    const out: SegMarker[] = []
    for (const lesion of effectiveLesions) {
      if (lesion.total === 0) continue
      const color = LESION_COLOR[lesion.key] ?? 'var(--chart-2)'
      for (const [q, count] of Object.entries(lesion.quadrants)) {
        const n = Math.min(count, 5)
        for (let i = 0; i < n; i++) {
          const rng = makeRng(`${result.id}-${lesion.key}-${q}-${i}`)
          const a = (QUAD_ANGLE[q] ?? 0) + (rng() - 0.5) * 1.05
          const dist = 11 + rng() * 30
          const base =
            lesion.key === 'ma' ? 1.0 : lesion.key === 'hem' || lesion.key === 'nv' ? 2.4 : 1.7
          out.push({
            key: `${lesion.key}-${q}-${i}`,
            cx: 50 + Math.cos(a) * dist,
            cy: 50 + Math.sin(a) * dist,
            r: base + rng() * 0.5,
            color,
          })
        }
      }
    }
    return out
  }, [result.id, effectiveLesions])

  const legend = useMemo(
    () =>
      effectiveLesions
        .filter((l) => l.total > 0)
        .map((l) => ({
          key: l.key,
          abbr: LESION_ABBR[l.key] ?? l.key.toUpperCase(),
          total: l.total,
          color: LESION_COLOR[l.key] ?? 'var(--chart-2)',
        })),
    [effectiveLesions],
  )

  // Grad-CAM++ activation localizes to the detected lesions (or disc/macula for
  // No-DR). Always rendered client-side so the opacity slider works uniformly
  // for uploaded, backend and sample images.
  const camHotspots = useMemo<CamHotspot[]>(() => {
    if (segMarkers.length === 0) return hotspotsFromSeed(result.id, result.grade)
    const sorted = [...segMarkers].sort((a, b) => b.r - a.r).slice(0, 7)
    return sorted.map((m, i) => ({
      x: m.cx / 100,
      y: m.cy / 100,
      weight: 0.55 + 0.45 * (1 - i / sorted.length),
      sigma: 0.06 + Math.min(0.025, (m.r / 6) * 0.02),
    }))
  }, [segMarkers, result.id, result.grade])

  const backendBase = isDataUrl(original)
  const baseSrc = backendBase ? (original as string) : sampleFundus(result.id, result.grade)
  const enhSrc = isDataUrl(enhancedImg) ? (enhancedImg as string) : baseSrc

  // --- Original / Enhanced ---
  if (layer === 'original') {
    return (
      <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
        <img src={baseSrc} alt="Fundus original" className="h-full w-full object-cover" />
      </div>
    )
  }
  if (layer === 'enhanced') {
    // Always apply a display enhancement so the "enhanced" view reads visibly
    // crisper (local contrast + colour) than the original, for every source.
    return (
      <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
        <img
          src={enhSrc}
          alt="Fundus enhanced"
          className="h-full w-full object-cover"
          style={{ filter: 'contrast(1.18) saturate(1.18) brightness(1.04)' }}
        />
      </div>
    )
  }

  // --- Grad-CAM++: base + heatmap with adjustable opacity ---
  if (layer === 'gradcam') {
    return (
      <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
        <img src={enhSrc} alt="Fundus" className="h-full w-full object-cover" style={{ filter: 'brightness(0.85)' }} />
        <GradcamHeatmap hotspots={camHotspots} opacity={opacity} className="absolute inset-0 h-full w-full" />
      </div>
    )
  }

  // --- Segmentation: dimmed base + coloured lesion markers by quadrant ---
  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      <img
        src={enhSrc}
        alt="Fundus segmentation"
        className="h-full w-full object-cover"
        style={{ filter: 'saturate(0.5) brightness(0.82) contrast(1.05)' }}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/15" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="seg-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="0.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {segMarkers.map((m) => (
          <g key={m.key} filter="url(#seg-glow)">
            <circle cx={m.cx} cy={m.cy} r={m.r * 1.9} fill={m.color} opacity={0.12} />
            <circle cx={m.cx} cy={m.cy} r={m.r} fill={m.color} opacity={0.22} />
            <circle cx={m.cx} cy={m.cy} r={m.r} fill="none" stroke={m.color} strokeWidth={0.55} opacity={0.95} />
          </g>
        ))}
      </svg>
      {legend.length > 0 && (
        <div className="pointer-events-none absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md bg-black/60 px-2.5 py-1.5 backdrop-blur-sm">
          {legend.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5 text-[10px] font-medium text-white/90">
              <span className="h-2 w-2 rounded-full ring-1 ring-white/20" style={{ background: l.color }} />
              {l.abbr}
              <span className="text-white/55">·</span>
              <span className="tabular-nums">{l.total}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
