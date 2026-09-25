import { create } from 'zustand'
import type { DRGrade, DataSource, ScreeningResult } from '@/lib/clinical'
import { buildDemoWorklist } from '@/lib/demoData'

type Theme = 'light' | 'dark'

interface AppState {
  theme: Theme
  dataSource: DataSource
  worklist: ScreeningResult[]
  toggleTheme: () => void
  setTheme: (t: Theme) => void
  setDataSource: (s: DataSource) => void
  addResult: (r: ScreeningResult) => void
  signOffCase: (id: string, finalGrade: DRGrade, note: string, reviewedBy: string) => void
  getCase: (id: string) => ScreeningResult | undefined
}

function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem('retinoxai-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(t: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', t === 'dark')
  try {
    localStorage.setItem('retinoxai-theme', t)
  } catch {
    /* ignore */
  }
}

const seedTheme = initialTheme()
if (typeof document !== 'undefined') applyTheme(seedTheme)

export const useAppStore = create<AppState>((set, get) => ({
  theme: seedTheme,
  dataSource: 'demo',
  worklist: buildDemoWorklist(),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light'
      applyTheme(next)
      return { theme: next }
    }),
  setTheme: (t) => {
    applyTheme(t)
    set({ theme: t })
  },
  setDataSource: (dataSource) => set({ dataSource }),
  addResult: (r) => set((s) => ({ worklist: [r, ...s.worklist] })),
  signOffCase: (id, finalGrade, note, reviewedBy) =>
    set((s) => ({
      worklist: s.worklist.map((c) =>
        c.id === id
          ? { ...c, decision: 'signed-off', finalGrade, reviewNote: note, reviewedBy }
          : c,
      ),
    })),
  getCase: (id) => get().worklist.find((c) => c.id === id),
}))
