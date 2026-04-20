import { useEffect, useRef, useState } from 'react'

export default function AnimatedNumber({ value, formatter, duration = 700, className = '' }) {
  const [displayed, setDisplayed] = useState(value)
  const prev = useRef(value)
  const raf  = useRef(null)

  useEffect(() => {
    const start    = prev.current
    const end      = value
    const t0       = performance.now()

    cancelAnimationFrame(raf.current)

    if (start === end) return

    const tick = (now) => {
      const p      = Math.min((now - t0) / duration, 1)
      const eased  = 1 - Math.pow(1 - p, 3)          // ease-out cubic
      setDisplayed(start + (end - start) * eased)
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else        prev.current = end
    }

    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])

  return (
    <span className={`numeric-reveal ${className}`}>
      {formatter ? formatter(displayed) : Math.round(displayed).toLocaleString()}
    </span>
  )
}
