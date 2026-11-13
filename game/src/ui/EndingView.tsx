import { ENDING_LINES } from "../game/colonies.ts"
import { moonById, powerById, variantById } from "../game/moons.ts"
import { TOWNS } from "../game/towns.ts"
import type { GameState } from "../game/opening.ts"
import { contextLine } from "../game/xoe-guide.ts"

export function EndingView({ state, onNext, onSkipToCredits }: { state: GameState; onNext: () => void; onSkipToCredits?: () => void }) {
  if (state.phase === "blackout") {
    return (
      <article className="blackout-panel" aria-label="Cut to black">
        <h1 tabIndex={-1}>Cut to black</h1>
        <p>End of this practice run. No real money moved.</p>
      </article>
    )
  }
  if (state.endingIndex >= 5) {
    const preview = state.creditsPreview === true
    const moon = state.moonId ? moonById(state.moonId) : preview ? moonById("moon-pair-a") : null
    const powerId = preview && (!state.moonPowerId || state.moonPowerId === "none") ? "frost-lock" : state.moonPowerId
    const variantId = preview && (!state.moonPowerVariantId || state.moonPowerVariantId === "none") ? "freeze" : state.moonPowerVariantId
    const power = powerById(powerId)
    const variant = variantById(powerId, variantId)
    const towns = (preview ? TOWNS : TOWNS.filter((t) => state.visitedTowns.includes(t.id))).map((t) => t.name)
    const cleared = preview ? 10 : state.clearedColonies.length
    return (
      <article className="copy-block ending-credits" aria-label="Credits">
        <div className="credits-moons" aria-hidden="true">
          <span className="credits-moon is-xelm" />
          <span className="credits-moon is-sol" />
        </div>
        <h1 tabIndex={-1}>Credits</h1>
        <p className="narration">XOE: Unknown Orbital Engine</p>
        <p className="fine">A practice game for Eddie Rivera. Paper / sim / testnet only. No real money.</p>
        <p className="ok">Thank you for flying, {state.playerName}.</p>
        <ul className="credits-list">
          <li>Pilot {state.playerName}</li>
          <li>Colonies cleared {cleared}/10</li>
          <li>
            Moon path {moon ? moon.name : "none"}
            {power && power.id !== "none" ? ` · ${power.label}${variant ? ` / ${variant.label}` : ""}` : " · no power"}
          </li>
          <li>Towns {towns.length ? towns.join(" · ") : "not visited"}</li>
          <li>Arcade {preview ? "—" : state.arcadeScore} · ticker pts {preview ? "—" : state.tickerScore}</li>
          <li>Worlds, red days, and this roll are original. The vault is still a story hook, not a payout.</li>
        </ul>
        <p className="fine">Music by section, paper desk, and a quiet cut to black. Come back and fly it again.</p>
        <div className="ending-actions">
          <button type="button" className="touch-btn primary" onClick={onNext}>
            Cut to black
          </button>
        </div>
      </article>
    )
  }
  const line = ENDING_LINES[state.endingIndex] ?? ENDING_LINES[ENDING_LINES.length - 1]
  const text = line.replace("XOE", state.playerName)
  const step = Math.min(state.endingIndex + 1, 5)
  return (
    <article className="copy-block ending-scene">
      <h1 tabIndex={-1}>Ending</h1>
      <p className="fine">Close {step} / 5</p>
      <p className="speaker">{state.playerName}</p>
      <p className="bubble">
        {contextLine({
          companionName: state.playerName,
          phase: "ending",
          colonyId: null,
          bossStep: 0,
        })}
      </p>
      <p className="narration">{text}</p>
      <div className="menu-row ending-actions">
        <button type="button" className="touch-btn primary" onClick={onNext}>
          Continue
        </button>
        {onSkipToCredits ? (
          <button type="button" className="touch-btn ghost" onClick={onSkipToCredits}>
            Skip to credits
          </button>
        ) : null}
      </div>
    </article>
  )
}
