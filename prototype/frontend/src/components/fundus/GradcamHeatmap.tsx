import { useEffect, useRef } from 'react'
import { makeRng } from '@/lib/rng'
import { cn } from '@/lib/utils'

/** A single activation focus, all coordinates normalized to 0..1. */
export interface CamHotspot {
  x: number
  y: number
  weight: number
  sigma: number
}

/**
 * Classic JET colormap (the OpenCV COLORMAP_JET used in the original Grad-CAM /
 * Grad-CAM++ papers): low activation → deep blue, rising through cyan, green and
 * yellow to red at the highest activation. Input t is clamped to [0, 1].
 */
function jet(t: number): [number, number, number] {
  const v = t < 0 ? 0 : t > 1 ? 1 : t
  const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 3)))
  const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 2)))
  const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 1)))
  return [r * 255, g * 255, b * 255]
}

/** Deterministic hotspots for uploaded rasters where we have no lesion geometry. */
export function hotspotsFromSeed(seed: string, grade: number): CamHotspot[] {
  const rng = makeRng(seed + '-cam')
  const n = Math.min(7, Math.max(3, Math.round(grade * 1.6 + 2)))
  return Array.from({ length: n }, (_, i) => ({
    x: 0.3 + rng() * 0.4,
    y: 0.3 + rng() * 0.4,
    weight: 0.55 + 0.45 * (1 - i / n),
    sigma: 0.06 + rng() * 0.03,
  }))
}

interface Props {
  hotspots: CamHotspot[]
  /** 0..1 overall heatmap strength (driven by the opacity slider). */
  opacity?: number
  className?: string
}

/**
 * Canvas Grad-CAM++ heatmap. Builds a continuous activation field — a low
 * baseline plus Gaussian bumps at each hotspot — masks it to the fundus circle,
 * then colorizes every pixel through the JET colormap and blends it over the
 * image with per-pixel alpha scaled by activation. This reproduces the look of a
 * genuine Grad-CAM++ saliency overlay rather than a few flat glows.
 */
export function GradcamHeatmap({ hotspots, opacity = 0.75, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const N = 320
    canvas.width = N
    canvas.height = N
    const img = ctx.createImageData(N, N)
    const data = img.data
    const cx = N / 2
    const cy = N / 2
    const Rn = N / 2

    // Pre-scale hotspot params into pixel space once.
    const hs = hotspots.map((h) => ({
      hx: h.x * N,
      hy: h.y * N,
      w: h.weight,
      denom: 2 * (h.sigma * N) * (h.sigma * N),
    }))

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const idx = (y * N + x) * 4
        const rr = Math.hypot(x - cx, y - cy) / Rn
        if (rr > 1) {
          data[idx + 3] = 0
          continue
        }
        let a = 0.06 // faint baseline activation across the retina
        for (let k = 0; k < hs.length; k++) {
          const dx = x - hs[k].hx
          const dy = y - hs[k].hy
          a += hs[k].w * Math.exp(-(dx * dx + dy * dy) / hs[k].denom)
        }
        if (a > 1) a = 1
        const [r, g, b] = jet(a)
        // Fade toward the circle edge so the overlay melts into the bezel.
        const edge = rr < 0.82 ? 1 : Math.max(0, (1 - rr) / 0.18)
        const alpha = opacity * (0.15 + 0.85 * Math.pow(a, 1.2)) * edge
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = Math.round(alpha * 255)
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [hotspots, opacity])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none', className)}
    />
  )
}
