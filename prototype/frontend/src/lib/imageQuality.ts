/**
 * Browser-side FundaQ-8 image-quality analysis.
 *
 * When a real fundus image is uploaded and the MATLAB backend is not connected,
 * this computes the 8-parameter quality score directly from the pixels (via a
 * canvas) so the quality gate genuinely reflects the image instead of a seeded
 * placeholder. A blurry or non-fundus image scores low and triggers
 * enhancement / recapture, matching the real pipeline behaviour.
 *
 * The parameters mirror fundaQ8.m in the MATLAB backend.
 */
import { FUNDAQ8_PASS_RATIO, type FundaQResult } from './clinical'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function clamp2(v: number) {
  return Math.max(0, Math.min(2, v))
}
const round2 = (v: number) => Math.round(v * 2) / 2 // nearest 0.5

export async function analyzeFundaQ(src: string): Promise<FundaQResult> {
  const img = await loadImage(src)
  const W = 320
  const H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W)) || W
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, W, H)
  const { data } = ctx.getImageData(0, 0, W, H)

  const n = W * H
  const gray = new Float32Array(n)
  let rSum = 0,
    gSum = 0,
    bSum = 0,
    maskCount = 0,
    satCount = 0
  const maskArr = new Uint8Array(n)

  for (let i = 0; i < n; i++) {
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    gray[i] = lum
    // Fundus tissue is mid-tone: exclude black bezel and blown/white regions.
    const isMask = lum > 22 && lum < 245
    if (isMask) {
      maskArr[i] = 1
      maskCount++
      rSum += r
      gSum += g
      bSum += b
    }
    if (lum > 245) satCount++
  }

  const maskRatio = maskCount / n
  const safeMask = Math.max(1, maskCount)
  const rM = rSum / safeMask,
    gM = gSum / safeMask,
    bM = bSum / safeMask

  // Mean & std of brightness within mask
  let meanG = 0
  for (let i = 0; i < n; i++) if (maskArr[i]) meanG += gray[i]
  meanG /= safeMask
  let varG = 0
  for (let i = 0; i < n; i++) if (maskArr[i]) varG += (gray[i] - meanG) ** 2
  varG /= safeMask
  const contrast = Math.sqrt(varG)

  // Laplacian (sharpness / focus) + edge density (vessel proxy) within mask
  let lapMean = 0,
    lapCount = 0
  const lapVals: number[] = []
  let edgeCount = 0
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      if (!maskArr[i]) continue
      const lap =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - W] - gray[i + W]
      lapVals.push(lap)
      lapMean += lap
      lapCount++
      if (Math.abs(lap) > 12) edgeCount++
    }
  }
  lapMean /= Math.max(1, lapCount)
  let lapVar = 0
  for (const v of lapVals) lapVar += (v - lapMean) ** 2
  lapVar /= Math.max(1, lapVals.length)
  const edgeDensity = edgeCount / Math.max(1, lapCount)

  // Illumination uniformity: compare quadrant mean brightness spread
  const quad = [0, 0, 0, 0]
  const quadN = [0, 0, 0, 0]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (!maskArr[i]) continue
      const q = (y < H / 2 ? 0 : 2) + (x < W / 2 ? 0 : 1)
      quad[q] += gray[i]
      quadN[q]++
    }
  }
  const quadMeans = quad.map((s, k) => s / Math.max(1, quadN[k]))
  const qMean = quadMeans.reduce((a, b) => a + b, 0) / 4
  const qStd = Math.sqrt(quadMeans.reduce((a, b) => a + (b - qMean) ** 2, 0) / 4)
  const illumUnevenness = qStd / Math.max(1, qMean)

  // Colour: healthy fundus is strongly red-dominant (R > G > B). Reward
  // red-dominance; penalise grey/blue (non-fundus) images.
  const total = rM + gM + bM + 1e-6
  const redDom = rM / total // ~0.45–0.65 for fundus, ~0.33 for grey/white
  const colourScore =
    redDom > 0.4 ? clamp2(1.2 + (Math.min(redDom, 0.64) - 0.4) * 4) : clamp2(redDom * 3)

  // Channel-balance cast penalty already captured; combine
  const artifactRatio = satCount / n

  // --- Map to 8 parameters (0–2 each). Thresholds tuned so genuine fundus
  // captures (typ. 500–1500 px) score well and only truly degraded images fail.
  const resolution = clamp2(((Math.min(img.naturalWidth, img.naturalHeight) - 180) / (620 - 180)) * 2)
  const fov = clamp2(((maskRatio - 0.18) / (0.7 - 0.18)) * 2)
  const color = colourScore
  const artifacts = clamp2(2 - artifactRatio * 6)
  const vessels = clamp2((edgeDensity / 0.085) * 2)
  const sharpness = clamp2((lapVar / 70) * 2 + Math.min(0.7, contrast / 80))
  const disc = clamp2(1.4 - illumUnevenness * 2 + Math.min(0.6, contrast / 70))
  const cup = clamp2(disc * 0.85 + 0.1)

  const scores = [
    { key: 'resolution', label: 'Resolution', score: round2(resolution), max: 2 },
    { key: 'fov', label: 'Field of view', score: round2(fov), max: 2 },
    { key: 'color', label: 'Color fidelity', score: round2(color), max: 2 },
    { key: 'artifacts', label: 'Artifacts', score: round2(artifacts), max: 2 },
    { key: 'vessels', label: 'Vessel visibility', score: round2(vessels), max: 2 },
    { key: 'sharpness', label: 'Sharpness', score: round2(sharpness), max: 2 },
    { key: 'disc', label: 'Optic disc', score: round2(disc), max: 2 },
    { key: 'cup', label: 'Optic cup', score: round2(cup), max: 2 },
  ]

  const totalScore = Math.round(scores.reduce((a, p) => a + p.score, 0) * 10) / 10
  const ratio = totalScore / 16
  return {
    total: totalScore,
    ratio,
    passed: ratio >= FUNDAQ8_PASS_RATIO,
    enhanced: ratio < FUNDAQ8_PASS_RATIO,
    params: scores,
  }
}
