import { useState } from "react"
import { RAGNAROK_NOTE, RAGNAROK_QUESTIONS } from "../game/colonies.ts"
import { moonById, powerById, variantById } from "../game/moons.ts"
import type { GameState } from "../game/opening.ts"
import { contextLine, tipsForRagnarok, type XoeTip } from "../game/xoe-guide.ts"
import { XoeGuidePanel } from "./XoeGuidePanel.tsx"
import { BossFlightGates } from "./BossFlightGates.tsx"
import { FightView } from "./FightView.tsx"

export function RagnarokView({
  state,
  onAnswer,
  onAbility,
  onToggleGuide,
  onAsk,
  paused = false,
}: {
  paused?: boolean
  state: GameState
  onAnswer: (index: number) => void
  onAbility: () => void
  onToggleGuide: () => void
  onAsk: (tip: XoeTip) => void
}) {
  const [showFight, setShowFight] = useState(true)
  const item = RAGNAROK_QUESTIONS[state.bossStep]
  const moon = state.moonId ? moonById(state.moonId) : null
  const power = powerById(state.moonPowerId)
  const variant = variantById(state.moonPowerId, state.moonPowerVariantId)
  const companion = state.playerName
  if (!item) return null
  return (
    <article className="copy-block ragnarok-one-screen">
      <h1 tabIndex={-1}>Ragnarok</h1>
      <p className="fine">{RAGNAROK_NOTE}</p>
      <div className="bars" aria-label="Boss meters">
        <p>
          Threat <b>{state.bossThreat}</b>
        </p>
        <div className="barwrap">
          <div className="bar" style={{ width: `${state.bossThreat}%` }} />
        </div>
        <p>
          Focus <b>{state.bossFocus}</b>
        </p>
        <div className="barwrap">
          <div className="bar focus" style={{ width: `${state.bossFocus}%` }} />
        </div>
      </div>
      {showFight ? (
        <FightView paused={paused} mode="boss" onDone={(r) => r.won && setShowFight(false)} />
      ) : (
        <p className="ok">Mech wave cleared — fly through the safe gate.</p>
      )}
      {moon ? (
        <p className="bubble">
          {moon.xoeLine} Power: {power?.label ?? "No power"}
          {variant && power?.id !== "none" ? ` / ${variant.label}` : ""}.
        </p>
      ) : null}
      {moon && power && power.id !== "none" ? (
        <button type="button" className="touch-btn" onClick={onAbility}>
          Use {variant?.label ?? power.label}
        </button>
      ) : null}
      {state.bossFeedback ? <p role="status">{state.bossFeedback}</p> : null}
      {!showFight ? <BossFlightGates labels={item.choices.map(c => c.text)} step={state.bossStep} paused={paused} onGate={onAnswer} /> : null}
      <XoeGuidePanel
        companionName={companion}
        context={contextLine({
          companionName: companion,
          phase: "ragnarok",
          colonyId: null,
          bossStep: state.bossStep,
        })}
        tips={tipsForRagnarok()}
        open={state.xoeGuideOpen}
        reply={state.xoeGuideReply}
        onToggle={onToggleGuide}
        onAsk={onAsk}
        compact
      />
    </article>
  )
}
