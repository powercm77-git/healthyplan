// Feedback.jsx — 토스트 + 컨페티 (앱 전역 공유, prefers-reduced-motion 존중)
import { createContext, useCallback, useContext, useRef, useState } from 'react'

const FeedbackContext = createContext(null)

const CF_COLORS = ['#FF9F45', '#FF4E7B', '#8B5CF6', '#3EE9A4', '#5AC8FA', '#FFC53D']

export function FeedbackProvider({ children }) {
  const [toastMsg, setToastMsg] = useState('')
  const [toastShow, setToastShow] = useState(false)
  const [pieces, setPieces] = useState([])
  const timerRef = useRef(null)
  const pieceIdRef = useRef(0)

  const toast = useCallback((msg) => {
    setToastMsg(msg)
    setToastShow(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setToastShow(false), 2200)
  }, [])

  const burst = useCallback((n = 20) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const newPieces = Array.from({ length: n }, () => ({
      id: pieceIdRef.current++,
      left: Math.random() * 100,
      color: CF_COLORS[Math.floor(Math.random() * CF_COLORS.length)],
      delay: Math.random() * 0.3,
      duration: 1.1 + Math.random() * 0.8,
    }))
    setPieces((prev) => [...prev, ...newPieces])
    newPieces.forEach((p) => {
      setTimeout(() => {
        setPieces((prev) => prev.filter((x) => x.id !== p.id))
      }, 2200)
    })
  }, [])

  return (
    <FeedbackContext.Provider value={{ toast, burst }}>
      {children}
      <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>
      <div className="confetti">
        {pieces.map((p) => (
          <div
            key={p.id}
            className="cf"
            style={{
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider')
  return ctx
}
