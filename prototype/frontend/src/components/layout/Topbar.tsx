import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Moon, Sun, WifiOff, Cpu, Plus, Bell, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store/useAppStore'
import { checkHealth, STRICT_MATLAB_MODE, type BackendHealth } from '@/lib/api'
import { CURRENT_DOCTOR } from '@/lib/demoData'
import { cn } from '@/lib/utils'

export function Topbar({
  onMenu,
  onSearch,
  title,
}: {
  onMenu: () => void
  onSearch: () => void
  title: string
}) {
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  const worklist = useAppStore((s) => s.worklist)
  const navigate = useNavigate()
  const [health, setHealth] = useState<BackendHealth | null>(null)

  useEffect(() => {
    checkHealth().then(setHealth)
  }, [])

  const flagged = worklist.filter((c) => c.decision === 'flagged').length
  const isLive = health?.source === 'live'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onMenu}
        className="rounded-md p-2 text-muted-foreground hover:bg-secondary lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">
          {CURRENT_DOCTOR.facility}
        </p>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Command palette trigger */}
        <button
          onClick={onSearch}
          className="hidden items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary md:flex"
          aria-label="Open command menu"
        >
          <Search className="h-3.5 w-3.5" />
          Search
          <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
        </button>
        <Button variant="ghost" size="icon" onClick={onSearch} className="md:hidden" aria-label="Search">
          <Search className="h-4.5 w-4.5" />
        </Button>

        {/* Engine status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium md:flex',
                isLive
                  ? 'border-safe/30 bg-safe/10 text-safe'
                  : STRICT_MATLAB_MODE
                    ? 'border-destructive/30 bg-destructive/10 text-destructive'
                    : 'border-warn/30 bg-warn/10 text-warn',
              )}
            >
              <Cpu className="h-3.5 w-3.5" />
              {isLive
                ? 'MATLAB engine'
                : STRICT_MATLAB_MODE
                  ? 'MATLAB required (offline)'
                  : 'Demo simulation'}
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isLive
                    ? 'bg-safe'
                    : STRICT_MATLAB_MODE
                      ? 'bg-destructive'
                      : 'bg-warn',
                  'animate-pulse-ring',
                )}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {isLive
              ? `Live inference · ${health?.engine} · ${health?.modelVersion}`
              : STRICT_MATLAB_MODE
                ? 'Strict MATLAB mode active: MATLAB REST backend (port 8080) is required for inference.'
                : 'MATLAB backend not reachable — running the deterministic clinical simulation with the frozen ensemble config.'}
          </TooltipContent>
        </Tooltip>

        {/* Offline-first indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground sm:flex">
              <WifiOff className="h-3.5 w-3.5" />
              Offline-first
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Pipeline runs fully on local hardware. Reports sync to the district server when
            connectivity is restored.
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => navigate('/worklist')}
              aria-label="Flagged cases"
            >
              <Bell className="h-4.5 w-4.5" />
              {flagged > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warn" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{flagged} cases awaiting review</TooltipContent>
        </Tooltip>

        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </Button>

        <Button onClick={() => navigate('/screening')} className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Screening</span>
        </Button>
      </div>
    </header>
  )
}
