import { LESSON_BANNERS } from "../game/lesson-copy.ts"
import { XOE_SIM_SAFETY } from "../game/xoe-sim-price.ts"
import { useEffect, useRef, useState } from "react"
import { lessonById, type GameState } from "../game/opening.ts"
import { contextLine, tipsForColony, type XoeTip } from "../game/xoe-guide.ts"
import { XoeGuidePanel } from "./XoeGuidePanel.tsx"
import { MicChoiceButton } from "./MicChoiceButton.tsx"
import { clamp } from "../game/overworld.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { hapticCorrectGate } from "../game/haptics.ts"
import {
  readRaceGhost,
  recordRaceGhost,
  shouldShowGhost,
  type GhostPoint,
} from "../game/race-ghost.ts"
import { PRACTICE_EXAM_ID, recordPracticeExamBest } from "../game/practice-exam.ts"
import { useDocumentHidden, usePrefersReducedMotion } from "./runtime.ts"
import { FEES_LEVERAGE_LABEL, isFeesLeverageId } from "../game/fees-leverage.ts"
import { LeveragePreviewPanel } from "./LeveragePreviewPanel.tsx"
import { faqForLesson } from "../game/faq.ts"
import { requestOpenFaq } from "../game/faq-nav.ts"
import { biomeFor } from "../game/colony-env.ts"
import { ColonyBiomeBackdrop } from "./ColonyBiome.tsx"

const FIELD_W = 320
const FIELD_H = 248
const SPEED = 180
const GATE_Y = 34
const TICKER_Y = 92
const TICKER_GAP = 52
const PICKUP_Y = 200
const XO_START = { x: 22, y: 232 }

/** Stack items that share a lane, keeping each row in its own band. */
const bandTop = (items: readonly { lane: number }[], index: number, base: number, gap: number) => {
  const lane = items[index]?.lane
  const slot = items.slice(0, index).filter((it) => it.lane === lane).length
  return base + slot * gap
}

/** Arcade lesson: tap/click to fly XO; reach gate by moving there. Mic answers kept. */
export function ColonyLessonView({
  state,
  onAnswer,
  onLeave,
  onToggleGuide,
  onAsk,
  onSetLane,
  onCollectPickup,
  onTicker,
  onFlyGate,
  paused = false,
}: {
  state: GameState
  paused?: boolean
  onAnswer: (index: number) => void
  onLeave: () => void
  onToggleGuide: () => void
  onAsk: (tip: XoeTip) => void
  onSetLane?: (lane: number) => void
  onCollectPickup?: (pickupIndex: number) => void
  onTicker?: (id: string, how: "touch" | "shield") => void
  onFlyGate?: (gateIndex: number) => void
}) {
  const colony = lessonById(state.activeColonyId)
  const companion = state.playerName
  const lane = state.arcadeLane ?? 1
  const fieldRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(XO_START)
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null)
  const [flashGate, setFlashGate] = useState<number | null>(null)
  const hold = useRef(false)
  const activePointer = useRef<number | null>(null)
  const pathRef = useRef<GhostPoint[]>([XO_START])
  const startedAt = useRef(Date.now())
  const reducedMotion = usePrefersReducedMotion()
  const hidden = useDocumentHidden()
  const articleRef = useRef<HTMLElement>(null)
  // v18 phone fit: each lesson (and each Fees and leverage step) starts with its title at the top of the
  // screen, so the lesson text, question, and gates sit in the first screen on a 393x659 iPhone view.
  useEffect(() => {
    if (window.innerWidth > 480) return
    try {
      articleRef.current?.scrollIntoView({ block: "start" })
    } catch {
      /* old browsers */
    }
  }, [state.activeColonyId])
  const ghost =
    colony && colony.id !== PRACTICE_EXAM_ID && !isFeesLeverageId(colony.id) && shouldShowGhost(getLocalStore(), reducedMotion)
      ? readRaceGhost(getLocalStore(), colony.id)
      : null

  useEffect(() => {
    pathRef.current = [XO_START]
    startedAt.current = Date.now()
    setPos(XO_START)
    setTarget(null)
    setFlashGate(null)
  }, [state.activeColonyId])

  useEffect(() => {
    if (paused || hidden) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      setPos((p) => {
        if (!target) return p
        const dx = target.x - p.x
        const dy = target.y - p.y
        const dist = Math.hypot(dx, dy)
        if (dist < 5) return p
        const next = {
          x: clamp(p.x + (dx / dist) * SPEED * dt, 16, FIELD_W - 16),
          y: clamp(p.y + (dy / dist) * SPEED * dt, 16, FIELD_H - 16),
        }
        const trail = pathRef.current
        const prev = trail[trail.length - 1]
        if (!prev || Math.hypot(next.x - prev.x, next.y - prev.y) >= 8) {
          trail.push(next)
          if (trail.length > 120) trail.shift()
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, paused, hidden])

  useEffect(() => {
    if (!colony) return
    const laneX = [60, 160, 260]
    let bestLane = lane
    let bestD = 999
    laneX.forEach((x, i) => {
      // v18: lane follows XO's x only, so flying straight up to a gate also lines XO up with it
      const d = Math.abs(pos.x - x)
      if (d < bestD) {
        bestD = d
        bestLane = i
      }
    })
    if (bestD < 36 && bestLane !== lane) onSetLane?.(bestLane)
  }, [pos, colony, lane, onSetLane])

  // v18: tapping a gate in another lane flies XO over to it, then on through it once lined up.
  const [pendingGate, setPendingGate] = useState<number | null>(null)
  useEffect(() => {
    setPendingGate(null)
  }, [state.activeColonyId])
  useEffect(() => {
    if (pendingGate == null || !colony) return
    const g = colony.gates[pendingGate]
    if (!g || g.lane !== lane) return
    setPendingGate(null)
    flyGate(pendingGate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lane, pendingGate])

  useEffect(() => {
    if (paused || hidden) return
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]")) return
      const key = event.key.toLowerCase()
      if (!["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"].includes(key)) return
      event.preventDefault()
      const dx = ["a", "arrowleft"].includes(key) ? -100 : ["d", "arrowright"].includes(key) ? 100 : 0
      const dy = ["w", "arrowup"].includes(key) ? -80 : ["s", "arrowdown"].includes(key) ? 80 : 0
      setTarget({ x: clamp(pos.x + dx, 16, FIELD_W - 16), y: clamp(pos.y + dy, 16, FIELD_H - 16) })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pos, paused, hidden])

  if (!colony) return null

  const laneX = [60, 160, 260]
  const isExam = colony.id === PRACTICE_EXAM_ID
  const isBonus = isFeesLeverageId(colony.id)
  // One Gestalt or Enemy per lane so the mid band stays readable; queued items appear after a collect or shield.
  const visibleTickers = state.tickerItems.filter((it, i, all) => all.findIndex((other) => other.lane === it.lane) === i)

  function pointerToLocal(clientX: number, clientY: number) {
    const el = fieldRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      x: clamp(((clientX - r.left) / r.width) * FIELD_W, 16, FIELD_W - 16),
      y: clamp(((clientY - r.top) / r.height) * FIELD_H, 16, FIELD_H - 16),
    }
  }

  function flyGate(index: number) {
    const gate = colony!.gates[index]
    if (!gate) return
    if (gate.ok) {
      setFlashGate(index)
      hapticCorrectGate(getLocalStore())
      const elapsed = Math.max(1, Date.now() - startedAt.current)
      if (isBonus) {
        // optional bonus lesson: no race ghost
      } else if (!isExam) {
        recordRaceGhost(getLocalStore(), colony!.id, elapsed, pathRef.current)
      } else if ((state.arcadeCombo ?? 0) + 1 >= 3) {
        const bonus = 50 + state.arcadeCombo * 10
        recordPracticeExamBest(getLocalStore(), state.arcadeScore + bonus)
      }
    }
    if (onFlyGate) onFlyGate(index)
    else onAnswer(index)
  }

  const ghostPath = ghost?.path?.length
    ? ghost.path.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
    : null

  return (
    <article ref={articleRef} className={`copy-block arcade-lesson lesson-tight${isBonus ? " bonus-lesson" : ""}`}>
      <h1 tabIndex={-1}>{colony.name}</h1>
      <p className="speaker lesson-speaker">{companion}</p>
      {isBonus ? <p className="banner edu-label">{FEES_LEVERAGE_LABEL}</p> : null}
      <p className="bubble lesson-bubble">{LESSON_BANNERS[colony.id] ?? (isBonus ? colony.lesson.replace(` ${FEES_LEVERAGE_LABEL}.`, "").replace(` ${FEES_LEVERAGE_LABEL}`, "") : colony.lesson)}</p>

      {/* v18.3 (XOE-004): one short line here; the full explanation lives in the FAQ */}
      {!isBonus ? <p className="fine lesson-safety">{XOE_SIM_SAFETY}</p> : null}
      <button type="button" className="link-btn learn-more" data-learn-more={faqForLesson(colony.id)} onClick={() => requestOpenFaq(faqForLesson(colony.id))}>
        Learn more
      </button>
      <p className="narration lesson-hint">Tap a lane to fly · fly into the right gate{isExam ? " · 3 hits" : ""} · tap Gestalt in your lane</p>
      <p className="fine">
        Score {state.arcadeScore} · Combo x{state.arcadeCombo}
        {isExam ? ` · Exam ${Math.min(3, state.arcadeCombo)}/3` : ""} · Lane {lane + 1}
        {state.tickerScore ? ` · Ticker ${state.tickerScore} pts` : ""}
      </p>

      <div
        ref={fieldRef}
        className={`arcade-field has-biome biome-field-${biomeFor(colony.id).id}`}
        data-biome={biomeFor(colony.id).id}
        aria-label={`Arcade flight field, ${biomeFor(colony.id).name}`}
        onPointerDown={(e) => {
          if (paused || hidden || activePointer.current !== null) return
          activePointer.current = e.pointerId
          const p = pointerToLocal(e.clientX, e.clientY)
          if (!p) return
          hold.current = true
          setTarget(p)
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!hold.current || activePointer.current !== e.pointerId) return
          const p = pointerToLocal(e.clientX, e.clientY)
          if (p) setTarget(p)
        }}
        onPointerCancel={() => { activePointer.current = null; hold.current = false; setTarget(null) }}
        onLostPointerCapture={() => { activePointer.current = null; hold.current = false }}
        onPointerUp={() => {
          activePointer.current = null
          hold.current = false
        }}
      >
        <ColonyBiomeBackdrop colonyId={colony.id} reducedMotion={reducedMotion} />
        {ghostPath ? (
          <svg className="race-ghost-svg" width={FIELD_W} height={FIELD_H} aria-hidden="true">
            <path d={ghostPath} className="race-ghost-path" />
          </svg>
        ) : null}
        {[0, 1, 2].map((l) => (
          <div key={l} className={`arcade-lane-mark${lane === l ? " active" : ""}`} style={{ left: laneX[l] }}>
            L{l + 1}
          </div>
        ))}
        {colony.gates.map((gate, index) => (
          <button
            key={`${gate.label}-${index}`}
            type="button"
            className={`arcade-gate-node${flashGate === index ? " gate-flash" : ""}`}
            style={{ left: laneX[gate.lane], top: GATE_Y + (isExam ? (index % 3) * 4 : 0) }}
            aria-disabled={gate.lane !== lane}
            onClick={(e) => {
              e.stopPropagation()
              if (gate.lane !== lane) {
                setTarget({ x: laneX[gate.lane], y: 60 })
                setPendingGate(index)
                return
              }
              flyGate(index)
            }}
          >
            {gate.label}
          </button>
        ))}
        {colony.pickups.map((pickup, index) => {
          const taken = state.arcadePickupCollected.includes(index)
          return (
            <button
              key={`${pickup.label}-${index}`}
              type="button"
              className="arcade-pickup-node"
              style={{ left: laneX[pickup.lane], top: bandTop(colony.pickups, index, PICKUP_Y, TICKER_GAP) }}
              disabled={taken || pickup.lane !== lane}
              onClick={(e) => {
                e.stopPropagation()
                onCollectPickup?.(index)
              }}
            >
              {taken ? "✓" : pickup.label}
            </button>
          )
        })}
        {visibleTickers.map((it) => (
          <button
            key={it.id}
            type="button"
            className={`arcade-ticker-node ticker-${it.kind}${it.size ? ` size-${it.size}` : ""}`}
            data-ticker={it.kind === "orb" ? "coin" : "hazard"}
            style={{ left: laneX[it.lane], top: TICKER_Y }}
            disabled={it.lane !== lane}
            aria-label={it.kind === "orb" ? "Gestalt, tap to collect" : "Enemy unit, tap to shield"}
            onClick={(e) => {
              e.stopPropagation()
              onTicker?.(it.id, it.kind === "orb" ? "touch" : "shield")
            }}
          >
            {it.kind === "orb" ? "Gestalt" : "Enemy"}
          </button>
        ))}
        {state.tickerPop ? (
          <div key={state.tickerPop.id} className={`coin-pop${state.tickerPop.good ? "" : " bad"}`} style={{ left: laneX[state.tickerPop.lane], top: TICKER_Y }} aria-hidden="true">
            {state.tickerPop.text}
          </div>
        ) : null}
        <div className={`arcade-xo${flashGate != null ? " gate-flash" : ""}`} style={{ left: pos.x, top: pos.y }}>
          XO
        </div>
      </div>

      {/* v18: feedback lines sit under the field so the gates stay in the first phone screen */}
      {state.tickerNote ? <p className="fine ticker-note" role="status">{state.tickerNote}</p> : null}
      {state.colonyFeedback ? (
        <p className={state.colonyFeedback.startsWith("Wrong") ? "bad" : "ok"} role="status">
          {state.colonyFeedback}
        </p>
      ) : null}
      <MicChoiceButton options={colony.gates.map((g) => g.label)} onSelect={(index) => flyGate(index)} />

      {isBonus ? <LeveragePreviewPanel /> : null}
      <div className="action-bar" data-action-bar="lesson">
        <button type="button" className="touch-btn ghost" onClick={onLeave}>
          Back to colony map
        </button>
      </div>
      <XoeGuidePanel
        companionName={companion}
        context={contextLine({
          companionName: companion,
          phase: "colony-lesson",
          colonyId: isExam || isBonus ? null : colony.id,
          bossStep: 0,
        })}
        tips={tipsForColony(isExam || isBonus ? null : colony.id)}
        open={state.xoeGuideOpen}
        reply={state.xoeGuideReply}
        onToggle={onToggleGuide}
        onAsk={onAsk}
        compact
      />
    </article>
  )
}
