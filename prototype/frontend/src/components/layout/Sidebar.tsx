import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  ScanEye,
  ListChecks,
  BarChart3,
  Workflow,
  Gauge,
  Settings,
  LifeBuoy,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/clinical/Logo'
import { useAppStore } from '@/store/useAppStore'
import { CURRENT_DOCTOR } from '@/lib/demoData'
import { initials } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** Optional hash used to distinguish two links that share a pathname. */
  hash?: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const GROUPS: NavGroup[] = [
  {
    title: 'Clinical',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/screening', label: 'New Screening', icon: ScanEye },
      { to: '/worklist', label: 'Worklist', icon: ListChecks },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'AI System',
    items: [
      { to: '/pipeline', label: 'Pipeline', icon: Workflow, end: true },
      { to: '/pipeline', label: 'Model Performance', icon: Gauge, hash: '#model-performance' },
    ],
  },
  {
    title: 'System',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
]

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const worklist = useAppStore((s) => s.worklist)
  const flagged = worklist.filter((c) => c.decision === 'flagged').length
  const location = useLocation()

  /** Single-active resolution for links that may share a pathname via hash. */
  const isItemActive = (item: NavItem, routeActive: boolean) => {
    if (!routeActive) return false
    if (item.hash) return location.hash === item.hash
    // A plain link on a hashed pathname is active only when no hash is set.
    const siblingHashed = GROUPS.some((g) =>
      g.items.some((i) => i.to === item.to && i.hash),
    )
    if (siblingHashed) return location.hash === '' || location.hash === '#'
    return true
  }

  const content = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Logo onDark />
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-border hover:text-sidebar-foreground lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {GROUPS.map((group, gi) => (
          <div key={group.title} className={cn(gi > 0 && 'pt-2')}>
            <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
              {group.title}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.label}
                to={item.hash ? { pathname: item.to, hash: item.hash } : item.to}
                end={item.end}
                onClick={onClose}
                className="block"
              >
                {({ isActive: routeActive }) => {
                  const active = isItemActive(item, routeActive)
                  return (
                    <span
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'text-sidebar-accent'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-border/60 hover:text-sidebar-foreground',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="absolute inset-0 -z-0 rounded-lg bg-sidebar-accent/15"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        />
                      )}
                      <item.icon className="relative z-10 h-4.5 w-4.5 shrink-0" />
                      <span className="relative z-10 flex-1">{item.label}</span>
                      {item.to === '/worklist' && flagged > 0 && (
                        <span className="relative z-10 rounded-full bg-warn/20 px-1.5 py-0.5 text-[10px] font-semibold text-warn">
                          {flagged}
                        </span>
                      )}
                    </span>
                  )
                }}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-border/30 p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-accent/20 text-sm font-semibold text-sidebar-accent">
              {initials(CURRENT_DOCTOR.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {CURRENT_DOCTOR.name}
              </p>
              <p className="truncate text-[11px] text-sidebar-muted">Reg. {CURRENT_DOCTOR.regNo}</p>
            </div>
          </div>
        </div>
        <a
          href="#"
          className="mt-2 flex items-center gap-2 px-3 py-1.5 text-[11px] text-sidebar-muted hover:text-sidebar-foreground"
        >
          <LifeBuoy className="h-3.5 w-3.5" /> Support · SIH26038
        </a>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border lg:block">
        <div className="fixed h-screen w-64">{content}</div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <div className="absolute left-0 top-0 h-full w-72 shadow-xl">{content}</div>
        </div>
      )}
    </>
  )
}
