// useCountUp.js — 숫자 카운트업 애니메이션 훅
import { useEffect, useRef, useState } from 'react'

export function useCountUp(value, duration = 600) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const frameRef = useRef(null)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return
    const t0 = performance.now()
    function step(t) {
      const p = Math.min((t - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      const current = Math.round(from + (to - from) * eased)
      setDisplay(current)
      if (p < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = to
      }
    }
    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return display
}
