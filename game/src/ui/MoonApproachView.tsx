import { moonById, powerById, variantById } from "../game/moons.ts"
import type { GameState } from "../game/opening.ts"
import { moonSceneFor, moonSceneLabel } from "../game/moon-scenes.ts"
import { MoonScene } from "./MoonScene.tsx"

/** Short playable approach on the chosen moon before the Ragnarok gate. */
export function MoonApproachView({
  state,
  onAbility,
  onEnterGate,
}: {
  state: GameState
  onAbility: () => void
  onEnterGate: () => void
}) {
  const moon = state.moonId ? moonById(state.moonId) : null
  const power = powerById(state.moonPowerId)
  const variant = variantById(state.moonPowerId, state.moonPowerVariantId)
  if (!moon) return null
  const powered = state.moonAbilityUsed
  const powerName = variant?.label ?? power?.label ?? "power"
  return (
    <article
      className={`copy-block moon-approach is-${moon.id}${powered ? " is-powered" : ""}`}
      aria-label={`${moon.name} approach`}
      data-moon-powered={powered ? "1" : "0"}
    >
      <figure className="moon-path" data-moon-env={moon.id} role="img" aria-label={moonSceneLabel(moon.id, powered)}>
        <MoonScene moonId={moon.id} powered={powered} />
        <span className="moon-place-tag" aria-hidden="true">{moon.name} · {moonSceneFor(moon.id).place}</span>
        <div className={`moon-path-gate${powered ? " is-open" : ""}`} aria-hidden="true">{powered ? "Gate open" : "Gate"}</div>
      </figure>
      <h1 tabIndex={-1}>{moon.name} approach</h1>
      <p className="narration">{moon.look}</p>
      <p className="bubble">{moon.xoeLine}</p>
      <p className="fine">Use a power if you brought one, then take the gate. Irreversible. Practice only.</p>
      {power && power.id !== "none" ? (
        <button type="button" className="touch-btn" onClick={onAbility} disabled={powered}>
          {powered ? `${powerName} used` : `Use ${powerName}`}
        </button>
      ) : (
        <p className="fine">No moon power on this run — fly it clean.</p>
      )}
      {powered ? (
        <p className="ok" role="status">
          {powerName} lights the path. The Ragnarok gate is open.
        </p>
      ) : (
        <p className="fine">Power is optional. Enter when you are ready.</p>
      )}
      <button type="button" className="touch-btn primary" onClick={onEnterGate}>
        Enter the Ragnarok gate
      </button>
    </article>
  )
}
