import { useEffect, useState } from "react"

/**
 * One-shot “show me” demo on the How to fly step: XO auto-flies through a sample gate.
 * Skippable via Skip demo / advancing the tutorial.
 */
export function TutorialDemo({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<"idle" | "flying" | "done">("idle")
  const [skipped, setSkipped] = useState(false)
  const [x, setX] = useState(36)
  const [y, setY] = useState(110)

  useEffect(() => {
    if (!active) {
      setPhase("idle")
      setSkipped(false)
      setX(36)
      setY(110)
      return
    }
    if (skipped) return
    setPhase("flying")
    setX(36)
    setY(110)
    const start = performance.now()
    const duration = 1400
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // Ease toward the correct middle gate
      setX(36 + (160 - 36) * t)
      setY(110 + (40 - 110) * t)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setPhase("done")
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, skipped])

  if (!active) return null

  return (
    <div className="tutorial-demo" data-tutorial-demo={phase} aria-label="Show me how to fly">
      <p className="fine">Show me · tap/click fly through one sample gate (skippable)</p>
      <div className="tutorial-demo-field" aria-hidden={skipped}>
        {!skipped ? (
          <>
            <button type="button" className="arcade-gate-node demo-wrong" style={{ left: 60, top: 40 }} disabled>
              Wrong lane
            </button>
            <button
              type="button"
              className={`arcade-gate-node demo-correct${phase === "done" ? " gate-flash" : ""}`}
              style={{ left: 160, top: 40 }}
              disabled
            >
              Correct gate
            </button>
            <button type="button" className="arcade-gate-node demo-wrong" style={{ left: 260, top: 40 }} disabled>
              Trap
            </button>
            <div className={`arcade-xo${phase === "done" ? " gate-flash" : ""}`} style={{ left: x, top: y }}>
              XO
            </div>
          </>
        ) : (
          <p className="fine">Demo skipped — tap Next when you’re ready.</p>
        )}
      </div>
      {phase !== "done" && !skipped ? (
        <button type="button" className="touch-btn ghost" onClick={() => setSkipped(true)}>
          Skip demo
        </button>
      ) : null}
      {phase === "done" && !skipped ? <p className="ok">That’s the idea — tap/click to fly the correct gate.</p> : null}
    </div>
  )
}
