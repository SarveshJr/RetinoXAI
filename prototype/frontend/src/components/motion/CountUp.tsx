import { useEffect, useState } from 'react'
import NumberFlow from '@number-flow/react'
import { useReducedMotion } from 'framer-motion'

interface Props {
  value: number
  className?: string
  decimals?: number
}

/** Animated number that counts up from 0 on mount (respects reduced motion). */
export function CountUp({ value, className, decimals = 0 }: Props) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      setDisplay(value)
      return
    }
    const id = requestAnimationFrame(() => setDisplay(value))
    return () => cancelAnimationFrame(id)
  }, [value, reduce])

  return (
    <NumberFlow
      value={display}
      className={className}
      format={{ maximumFractionDigits: decimals, minimumFractionDigits: decimals }}
      transformTiming={{ duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      willChange
    />
  )
}
