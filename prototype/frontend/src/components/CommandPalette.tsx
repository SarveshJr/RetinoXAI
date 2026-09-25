import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import {
  LayoutDashboard,
  ScanEye,
  ListChecks,
  BarChart3,
  Workflow,
  Settings,
  Moon,
  Sun,
  UserRound,
  Search,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { GRADES } from '@/lib/clinical'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const worklist = useAppStore((s) => s.worklist)
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const go = (path: string) => {
    onOpenChange(false)
    navigate(path)
  }

  const patients = useMemo(() => worklist.slice(0, 40), [worklist])

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command menu"
      className="fixed left-1/2 top-[18%] z-[100] w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
      overlayClassName="fixed inset-0 z-[99] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0"
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Command.Input
          placeholder="Search patients or jump to a section…"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
          ESC
        </kbd>
      </div>
      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
          No results found.
        </Command.Empty>

        <Command.Group heading="Navigate" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <Item icon={LayoutDashboard} label="Dashboard" onSelect={() => go('/')} />
          <Item icon={ScanEye} label="New Screening" onSelect={() => go('/screening')} />
          <Item icon={ListChecks} label="Worklist" onSelect={() => go('/worklist')} />
          <Item icon={BarChart3} label="Analytics & Digital Twin" onSelect={() => go('/analytics')} />
          <Item icon={Workflow} label="Pipeline & Model" onSelect={() => go('/pipeline')} />
          <Item icon={Settings} label="Settings" onSelect={() => go('/settings')} />
        </Command.Group>

        <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <Item
            icon={theme === 'dark' ? Sun : Moon}
            label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onSelect={() => {
              toggleTheme()
              onOpenChange(false)
            }}
          />
        </Command.Group>

        <Command.Group heading="Patients" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          {patients.map((c) => (
            <Command.Item
              key={c.id}
              value={`${c.patient.name} ${c.patient.id} ${c.patient.village}`}
              onSelect={() => go(`/case/${c.id}`)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
            >
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">
                {c.patient.name}
                <span className="ml-2 text-xs text-muted-foreground">{c.patient.id} · {c.eye}</span>
              </span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: `color-mix(in srgb, var(--grade-${c.grade}) 14%, transparent)`,
                  color: `var(--grade-${c.grade})`,
                }}
              >
                {GRADES[c.grade].short}
              </span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}

function Item({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: typeof LayoutDashboard
  label: string
  onSelect: () => void
}) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </Command.Item>
  )
}
