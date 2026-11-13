import { recordEarn } from "../game/reward-plan.ts"
import { useEffect, useState } from "react"
import {
  awardSideMissionPoints,
  type SideMissionDef,
  isDangerInputLocked,
  markSideMissionOffered,
} from "../game/side-missions.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { usePrefersReducedMotion } from "./runtime.ts"
import { playDangerAlarm } from "../game/danger-sfx.ts"
import { FightView } from "./FightView.tsx"

type Phase = "intro" | "play" | "danger" | "fight" | "done"

export function SideMissionView({
  mission,
  onClose,
  onAwarded,
}: {
  mission: SideMissionDef
  onClose: () => void
  onAwarded?: (points: number) => void
}) {
  const reducedMotion = usePrefersReducedMotion()
  const [phase, setPhase] = useState<Phase>(mission.kind === "remote-hack" ? "danger" : "intro")
  const [beat, setBeat] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [awarded, setAwarded] = useState(false)
  const dangerLocked = isDangerInputLocked(mission.kind, phase)

  useEffect(() => {
    markSideMissionOffered(getLocalStore())
  }, [mission.id])

  useEffect(() => {
    if (mission.kind !== "remote-hack" || phase !== "danger") return
    playDangerAlarm(getLocalStore())
    const beats = mission.dangerBeats ?? ["DANGER — XOE has control", "Threat destroyed."]
    if (reducedMotion) {
      setBeat(beats.length - 1)
      const t = window.setTimeout(() => setPhase("fight"), 900)
      return () => clearTimeout(t)
    }
    setBeat(0)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      if (i >= beats.length) {
        clearInterval(id)
        setPhase("fight")
      } else {
        setBeat(i)
      }
    }, 700)
    return () => clearInterval(id)
  }, [mission.id, phase, reducedMotion, mission.kind, mission.dangerBeats])

  function finish(success: boolean) {
    if (success && !awarded) {
      const board = awardSideMissionPoints(getLocalStore(), mission)
      setAwarded(true)
      recordEarn(getLocalStore(), "side_mission")
      onAwarded?.(mission.points)
      setFeedback(`${mission.xoeAfter} · +${mission.points} pts (device only). Total ${board.totalPoints}.`)
    }
    setPhase("done")
  }

  function onPhishPick(ok: boolean) {
    if (dangerLocked) return
    if (!ok) {
      setFeedback("XO: That was the trap. Try the safe reject — never share seeds or tap lookalikes.")
      return
    }
    finish(true)
  }

  const beats = mission.dangerBeats ?? []

  return (
    <section
      className={`side-mission panel overlay-card${mission.kind === "remote-hack" ? " danger-mode" : ""}`}
      role="dialog"
      aria-label={mission.title}
      data-side-mission={mission.id}
      data-kind={mission.kind}
      data-phase={phase}
      data-input-locked={dangerLocked ? "1" : "0"}
    >
      <p className="fine">Side mission · testnet · skippable</p>
      <h2>{mission.title}</h2>
      {phase === "danger" ? (
        <div className="danger-cinematic" aria-live="assertive">
          <p className="danger-banner">DANGER — XOE has control</p>
          <div className="danger-stage" aria-hidden="true">
            <div className="danger-signal" style={{ ["--beat" as string]: String(beat) }} />
            <div className="danger-mech" aria-label="XO"><span className="xo-energy-craft" aria-hidden="true" /><span className="sr-only">XO</span></div>
            <div className="danger-source">◉</div>
          </div>
          <p className="narration">{beats[Math.min(beat, beats.length - 1)]}</p>
          <p className="fine">Tap/click/keyboard ignored while XOE auto-pilots.</p>
          <button type="button" className="touch-btn ghost" onClick={() => setPhase("fight")}>
            Skip
          </button>
        </div>
      ) : null}

      {phase === "fight" ? (
        <FightView
          mode="post-danger"
          onDone={(r) => r.won && finish(true)}
        />
      ) : null}

      {phase === "intro" || phase === "play" ? (
        <>
          <p className="narration">{mission.blurb}</p>
          <div className="choice-col">
            {(mission.choices ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                className="touch-btn primary"
                disabled={dangerLocked}
                onClick={() => onPhishPick(c.ok)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button type="button" className="touch-btn ghost" onClick={onClose}>
            Skip side mission
          </button>
        </>
      ) : null}

      {phase === "done" ? (
        <>
          <p className="ok" role="status">
            {feedback ?? mission.xoeAfter}
          </p>
          <button type="button" className="touch-btn primary" onClick={onClose}>
            Back to map
          </button>
        </>
      ) : null}

      {feedback && phase !== "done" ? (
        <p className="bad" role="status">
          {feedback}
        </p>
      ) : null}
    </section>
  )
}
