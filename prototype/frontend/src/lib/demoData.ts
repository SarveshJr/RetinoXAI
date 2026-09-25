import type { DRGrade, PatientRef, ScreeningResult } from './clinical'
import { simulateScreening } from './mockEngine'

/** Locale-appropriate demo roster for a district PHC screening camp. */
export const DEMO_PATIENTS: PatientRef[] = [
  { id: 'PHC-24817', name: 'Lakshmi Narayanan', age: 58, sex: 'F', diabetesYears: 11, village: 'Tiruvannamalai' },
  { id: 'PHC-24818', name: 'Rukmini Devi', age: 64, sex: 'F', diabetesYears: 16, village: 'Vellore Rural' },
  { id: 'PHC-24819', name: 'Abdul Rahman', age: 51, sex: 'M', diabetesYears: 7, village: 'Ambur' },
  { id: 'PHC-24820', name: 'Selvakumar Perumal', age: 47, sex: 'M', diabetesYears: 5, village: 'Gudiyatham' },
  { id: 'PHC-24821', name: 'Meenakshi Sundaram', age: 69, sex: 'F', diabetesYears: 21, village: 'Arni' },
  { id: 'PHC-24822', name: 'Karthik Raja', age: 43, sex: 'M', diabetesYears: 4, village: 'Cheyyar' },
  { id: 'PHC-24823', name: 'Fatima Begum', age: 55, sex: 'F', diabetesYears: 13, village: 'Vaniyambadi' },
  { id: 'PHC-24824', name: 'Govindaraj Pillai', age: 61, sex: 'M', diabetesYears: 18, village: 'Polur' },
  { id: 'PHC-24825', name: 'Anjali Krishnan', age: 39, sex: 'F', diabetesYears: 3, village: 'Kalasapakkam' },
  { id: 'PHC-24826', name: 'Ramesh Babu', age: 66, sex: 'M', diabetesYears: 20, village: 'Chetpet' },
  { id: 'PHC-24827', name: 'Saraswathi Amma', age: 72, sex: 'F', diabetesYears: 24, village: 'Vandavasi' },
  { id: 'PHC-24828', name: 'Iqbal Ahmed', age: 49, sex: 'M', diabetesYears: 8, village: 'Pernambut' },
]

const PLAN: { grade: DRGrade; eye: 'OD' | 'OS'; low?: boolean }[] = [
  { grade: 3, eye: 'OD' },
  { grade: 4, eye: 'OS' },
  { grade: 2, eye: 'OD' },
  { grade: 0, eye: 'OD' },
  { grade: 3, eye: 'OS' },
  { grade: 1, eye: 'OD' },
  { grade: 2, eye: 'OS', low: true },
  { grade: 0, eye: 'OD' },
  { grade: 1, eye: 'OS' },
  { grade: 4, eye: 'OD' },
  { grade: 2, eye: 'OD' },
  { grade: 0, eye: 'OS' },
]

/** Build the seed worklist for "today's" camp. */
export function buildDemoWorklist(): ScreeningResult[] {
  const results = DEMO_PATIENTS.map((p, i) => {
    const plan = PLAN[i % PLAN.length]
    const r = simulateScreening(p, { targetGrade: plan.grade, eye: plan.eye, lowQuality: plan.low })
    // Stagger capture times across the morning session.
    const capturedAt = new Date(Date.now() - (i * 7 + 3) * 60 * 1000).toISOString()
    return { ...r, capturedAt, processedAt: capturedAt }
  })
  // A couple of already signed-off cases for realism.
  if (results[3]) {
    results[3].decision = 'signed-off'
    results[3].reviewedBy = 'Dr. Priya Anand'
    results[3].finalGrade = results[3].grade
  }
  if (results[7]) {
    results[7].decision = 'signed-off'
    results[7].reviewedBy = 'Dr. Priya Anand'
    results[7].finalGrade = results[7].grade
  }
  return results
}

export const CURRENT_DOCTOR = {
  name: 'Dr. Priya Anand',
  role: 'Ophthalmologist · Teleretinal reviewer',
  facility: 'Tiruvannamalai District PHC',
  regNo: 'TN-OPH-40912',
}
