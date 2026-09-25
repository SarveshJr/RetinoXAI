/**
 * Real fundus photographs used across the app for demo/sample cases.
 *
 * These are openly-licensed retinal images bundled with the app so the
 * clinician platform shows genuine fundus photography (not a synthetic render)
 * wherever the live MATLAB backend has not supplied its own per-layer images.
 *
 * Sources (Wikimedia Commons):
 *  - Normal retina — U.S. National Eye Institute (public domain) + Mikael
 *    Häggström (CC0).
 *  - NPDR / diabetic retinopathy — U.S. National Eye Institute (public domain).
 *  - Diabetic retinopathy with exudates — CC-BY 4.0.
 *  - Proliferative retinopathy — U.S. National Eye Institute (public domain).
 */
import { makeRng } from './rng'
import normalEda06 from '@/assets/fundus/grade0_normal_eda06.jpg'
import normalRight from '@/assets/fundus/grade0_normal_right.jpg'
import normalLeft from '@/assets/fundus/grade0_normal_left.jpg'
import npdrEda03 from '@/assets/fundus/grade1_npdr_eda03.jpg'
import drExudates from '@/assets/fundus/grade3_dr.png'
import pdrEda01 from '@/assets/fundus/grade4_pdr_eda01.jpg'

/** Candidate real photos per ICDR grade (0 = No DR … 4 = Proliferative DR). */
const BY_GRADE: Record<number, string[]> = {
  0: [normalEda06, normalRight, normalLeft],
  1: [npdrEda03],
  2: [drExudates],
  3: [pdrEda01, drExudates],
  4: [pdrEda01],
}

/**
 * Pick a real fundus photograph for a case, chosen deterministically from the
 * seed so a given case always maps to the same image.
 */
export function sampleFundus(seed: string, grade: number): string {
  const list = BY_GRADE[grade] ?? BY_GRADE[0]
  if (list.length === 1) return list[0]
  const rng = makeRng(seed + '-sample')
  return list[Math.floor(rng() * list.length)] ?? list[0]
}
