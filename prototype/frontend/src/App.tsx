import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { ScreeningPage } from '@/pages/ScreeningPage'
import { WorklistPage } from '@/pages/WorklistPage'
import { CasePage } from '@/pages/CasePage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { PipelinePage } from '@/pages/PipelinePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useAppStore } from '@/store/useAppStore'

export default function App() {
  const theme = useAppStore((s) => s.theme)
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={200}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/screening" element={<ScreeningPage />} />
            <Route path="/worklist" element={<WorklistPage />} />
            <Route path="/case/:id" element={<CasePage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
        <Toaster
          theme={theme}
          position="top-right"
          richColors
          toastOptions={{ style: { fontFamily: 'var(--font-sans)' } }}
        />
      </TooltipProvider>
    </BrowserRouter>
  )
}
