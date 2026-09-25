import { useMemo } from 'react'
import { makeRng } from '@/lib/rng'
import type { DRGrade, LesionCount } from '@/lib/clinical'
import { LESION_CLASSES } from '@/lib/clinical'
import { GradcamHeatmap, type CamHotspot } from './GradcamHeatmap'
import { cn } from '@/lib/utils'

export type FundusLayer = 'original' | 'enhanced' | 'gradcam' | 'segmentation'

interface Props {
  seed: string
  layer: FundusLayer
  grade: DRGrade
  lesions?: LesionCount[]
  className?: string
  eye?: 'OD' | 'OS'
  /** Grad-CAM++ heatmap opacity (0..1); only used on the gradcam layer. */
  opacity?: number
}

interface Vessel {
  d: string
  w: number
}

interface Dot {
  x: number
  y: number
  r: number
  color: string
  key: string
}

const SIZE = 512
const CX = SIZE / 2
const CY = SIZE / 2
const R = SIZE / 2 - 6

function buildVessels(rng: () => number, discX: number, discY: number): Vessel[] {
  const vessels: Vessel[] = []
  const trunks = 5
  for (let t = 0; t < trunks; t++) {
    const baseAngle = (Math.PI * 2 * t) / trunks + rng() * 0.5
    grow(discX, discY, baseAngle, 3.4, 0)
  }
  function grow(x: number, y: number, angle: number, width: number, depth: number) {
    if (depth > 4 || width < 0.5) return
    const len = 46 + rng() * 40 - depth * 6
    const curve = (rng() - 0.5) * 0.9
    const midAngle = angle + curve * 0.5
    const nx = x + Math.cos(angle) * len
    const ny = y + Math.sin(angle) * len
    const mx = x + Math.cos(midAngle) * len * 0.5
    const my = y + Math.sin(midAngle) * len * 0.5
    // Keep within fundus circle.
    if (Math.hypot(nx - CX, ny - CY) > R - 12) return
    vessels.push({ d: `M ${x} ${y} Q ${mx} ${my} ${nx} ${ny}`, w: width })
    const branches = depth < 2 ? 2 : rng() > 0.4 ? 2 : 1
    for (let b = 0; b < branches; b++) {
      const spread = (b === 0 ? -1 : 1) * (0.25 + rng() * 0.4)
      grow(nx, ny, angle + spread, width * (0.62 + rng() * 0.18), depth + 1)
    }
  }
  return vessels
}

function buildLesionDots(rng: () => number, lesions: LesionCount[]): Dot[] {
  const dots: Dot[] = []
  const quadAngles: Record<string, number> = { ST: -0.8, SN: -2.35, IT: 0.8, IN: 2.35 }
  const colorByKey = Object.fromEntries(LESION_CLASSES.map((l) => [l.key, l.colorVar]))
  for (const lesion of lesions) {
    for (const [q, count] of Object.entries(lesion.quadrants)) {
      for (let i = 0; i < count; i++) {
        const baseA = quadAngles[q] ?? 0
        const a = baseA + (rng() - 0.5) * 1.1
        const dist = 40 + rng() * (R - 70)
        const x = CX + Math.cos(a) * dist
        const y = CY + Math.sin(a) * dist
        const r =
          lesion.key === 'ma'
            ? 2 + rng() * 1.2
            : lesion.key === 'hem'
              ? 3.5 + rng() * 3
              : lesion.key === 'nv'
                ? 4 + rng() * 3
                : 2.5 + rng() * 2.5
        dots.push({ x, y, r, color: colorByKey[lesion.key] || 'var(--grade-4)', key: `${lesion.key}-${q}-${i}` })
      }
    }
  }
  return dots
}

export function FundusImage({ seed, layer, grade, lesions = [], className, eye = 'OD', opacity = 0.75 }: Props) {
  const uid = useMemo(() => seed.replace(/[^a-z0-9]/gi, '') + layer, [seed, layer])
  const { vessels, dots, discX, discY, maculaX } = useMemo(() => {
    const rng = makeRng(seed + '-geo')
    const temporalSign = eye === 'OD' ? -1 : 1
    const dX = CX + temporalSign * 118
    const dY = CY - 10 + (rng() - 0.5) * 20
    const mX = CX - temporalSign * 40
    return {
      vessels: buildVessels(rng, dX, dY),
      dots: buildLesionDots(makeRng(seed + '-les'), lesions),
      discX: dX,
      discY: dY,
      maculaX: mX,
    }
  }, [seed, lesions, eye])

  const enhanced = layer === 'enhanced'
  const isSeg = layer === 'segmentation'
  const isCam = layer === 'gradcam'

  // Grad-CAM++ activation focuses cluster around the denser lesion regions;
  // fall back to the disc/macula axis when there are no lesions (No DR).
  const camHotspots = useMemo<CamHotspot[]>(() => {
    if (!isCam) return []
    const sorted = [...dots].sort((a, b) => b.r - a.r)
    const n = Math.min(7, Math.max(3, Math.round(grade * 1.8 + 2)))
    const picks = sorted.slice(0, n)
    if (picks.length === 0) {
      return [{ x: maculaX / SIZE, y: CY / SIZE, weight: 0.35, sigma: 0.12 }]
    }
    return picks.map((d, i) => ({
      x: d.x / SIZE,
      y: d.y / SIZE,
      weight: 0.55 + 0.45 * (1 - i / picks.length),
      sigma: 0.055 + Math.min(0.03, (d.r / 6) * 0.02),
    }))
  }, [dots, isCam, grade, maculaX])

  const baseFill = isSeg ? `url(#seg-bg-${uid})` : `url(#retina-${uid})`

  const svg = (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={isCam ? 'absolute inset-0 h-full w-full' : className}
      role="img"
      aria-label={`Synthesized fundus (${layer})`}
    >
      <defs>
        <radialGradient id={`retina-${uid}`} cx="50%" cy="48%" r="62%">
          {enhanced ? (
            <>
              <stop offset="0%" stopColor="#c85a2a" />
              <stop offset="55%" stopColor="#a23c17" />
              <stop offset="100%" stopColor="#4c1608" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#b5581f" />
              <stop offset="55%" stopColor="#8a3a12" />
              <stop offset="100%" stopColor="#3d1406" />
            </>
          )}
        </radialGradient>
        <radialGradient id={`seg-bg-${uid}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#0b1220" />
          <stop offset="100%" stopColor="#05070d" />
        </radialGradient>
        <radialGradient id={`disc-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={enhanced ? '#fff7e6' : '#f4e4b8'} />
          <stop offset="65%" stopColor={enhanced ? '#f6d98a' : '#e6c878'} />
          <stop offset="100%" stopColor="#c99b3e" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id={`macula-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3d1206" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#3d1206" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`fundus-clip-${uid}`}>
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
        <filter id={`soft-${uid}`}>
          <feGaussianBlur stdDeviation={isCam ? 3 : 0.4} />
        </filter>
      </defs>

      {/* Bezel */}
      <circle cx={CX} cy={CY} r={R + 4} fill="#05070d" />

      <g clipPath={`url(#fundus-clip-${uid})`}>
        <circle cx={CX} cy={CY} r={R} fill={baseFill} />

        {/* Macula shadow */}
        {!isSeg && <circle cx={maculaX} cy={CY} r={46} fill={`url(#macula-${uid})`} />}

        {/* Vessels */}
        <g
          fill="none"
          stroke={isSeg ? '#38bdf8' : enhanced ? '#7c1d0d' : '#6d1a0b'}
          strokeLinecap="round"
          opacity={isSeg ? 0.95 : enhanced ? 0.9 : 0.78}
          filter={`url(#soft-${uid})`}
        >
          {vessels.map((v, i) => (
            <path key={i} d={v.d} strokeWidth={v.w} />
          ))}
        </g>

        {/* Optic disc */}
        {!isSeg ? (
          <circle cx={discX} cy={discY} r={30} fill={`url(#disc-${uid})`} />
        ) : (
          <circle cx={discX} cy={discY} r={30} fill="none" stroke="#facc15" strokeWidth={2.5} strokeDasharray="4 3" />
        )}

        {/* Lesions */}
        {!isCam &&
          dots.map((d) => (
            <circle
              key={d.key}
              cx={d.x}
              cy={d.y}
              r={d.r}
              fill={isSeg ? d.color : d.color}
              opacity={isSeg ? 0.95 : 0.82}
              stroke={isSeg ? '#00000055' : 'none'}
              strokeWidth={0.5}
            />
          ))}

        {/* Vignette */}
        <radialGradient id={`vig-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="72%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity={isSeg ? 0.15 : 0.55} />
        </radialGradient>
        <circle cx={CX} cy={CY} r={R} fill={`url(#vig-${uid})`} />
      </g>
    </svg>
  )

  if (isCam) {
    return (
      <div className={cn('relative overflow-hidden', className)}>
        {svg}
        <GradcamHeatmap
          hotspots={camHotspots}
          opacity={opacity}
          className="absolute inset-0 h-full w-full"
        />
      </div>
    )
  }

  return svg
}
