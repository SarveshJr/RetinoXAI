import { cn } from '@/lib/utils'

/** RetinoXAI mark: a stylised fundus/iris with a scan sweep. */
export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rx-g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-primary)" />
          <stop offset="1" stopColor="var(--color-sidebar-accent)" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" stroke="url(#rx-g)" strokeWidth="2.5" opacity="0.35" />
      <circle cx="20" cy="20" r="11.5" stroke="url(#rx-g)" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="4" fill="url(#rx-g)" />
      <path
        d="M20 2.5 A17.5 17.5 0 0 1 37.5 20"
        stroke="url(#rx-g)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="31.5" cy="8.5" r="2.4" fill="var(--color-sidebar-accent)" />
    </svg>
  )
}

export function Logo({
  className,
  onDark = false,
  size = 30,
}: {
  className?: string
  onDark?: boolean
  size?: number
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <div className="leading-none">
        <span
          className={cn(
            'text-[17px] font-semibold tracking-tight',
            onDark ? 'text-sidebar-foreground' : 'text-foreground',
          )}
        >
          Retino<span className="text-primary">XAI</span>
        </span>
        <span
          className={cn(
            'mt-0.5 block text-[10px] font-medium tracking-wide',
            onDark ? 'text-sidebar-muted' : 'text-muted-foreground',
          )}
        >
          Explainable DR Screening
        </span>
      </div>
    </div>
  )
}
