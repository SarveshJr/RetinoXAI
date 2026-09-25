import { sampleFundus } from '@/lib/fundusSamples'
import { cn } from '@/lib/utils'

/** Small real-fundus thumbnail for lists (worklist rows, dashboard recents). */
export function FundusThumb({
  seed,
  grade,
  alt = 'Fundus',
  className,
}: {
  seed: string
  grade: number
  alt?: string
  className?: string
}) {
  return (
    <img
      src={sampleFundus(seed, grade)}
      alt={alt}
      loading="lazy"
      className={cn('h-full w-full object-cover', className)}
    />
  )
}
