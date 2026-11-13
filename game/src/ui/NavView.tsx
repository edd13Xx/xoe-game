import {
  BALANCE_IDS,
  DEATH_RULE,
  DEATH_RULE_SAMPLE_INPUT,
  EARNED_PRACTICE_TRADING_BALANCE,
  FICTIONAL_ENERGY,
  FINAL_BOSS,
  IN_GAME_REWARD_BALANCE,
  LIQUIDATION,
  UPGRADES,
  applyInGameRewardDeathRule,
} from "../game/balances.ts"
import { DAY_NIGHT, STORY_HOOKS } from "../game/canon.ts"
import type { SkyPhase } from "../game/daynight.ts"
import type { DialogueMode } from "../game/dialogue.ts"
import { bossRevealed, buildMinimap } from "../game/minimap.ts"
import { WORLD, terraceNextStep, type TouchControl } from "../game/movement.ts"
import type { GameState } from "../game/opening.ts"
import { DialogueMenu, GrokStatus } from "./DialogueMenu.tsx"
import { MinimapCanvas } from "./PixelStage.tsx"

const SAMPLE = applyInGameRewardDeathRule(DEATH_RULE_SAMPLE_INPUT)
const LIVE = applyInGameRewardDeathRule(IN_GAME_REWARD_BALANCE)

export function NavView({
  state,
  sky,
  hour,
  onMove,
  onHatch,
  onDepart,
  onMode,
  onGrok,
  onDecline,
}: {
  state: GameState
  sky: SkyPhase
  hour: number
  onMove: (control: TouchControl) => void
  onHatch: () => void
  onDepart: () => void
  onMode: (mode: DialogueMode) => void
  onGrok: () => void
  onDecline: () => void
}) {
  const minimap = buildMinimap(state.explored)
  const revealedBoss = bossRevealed(minimap)
  const step = terraceNextStep(state.pos, state.hatchNoted)
  const hint = (c: TouchControl) => (step.suggest === c ? "touch-btn suggest" : "touch-btn")
  return (
    <article className="copy-block has-action-bar">
      <h1 tabIndex={-1}>Planet X terrace</h1>
      <p className="narration">
        A small, safe terrace. Walk the lit path to the sealed hatch, then travel on to the colonies. Open-world
        Planet X, the underground, the moons, and deep space come in a later build.
      </p>
      <p aria-live="polite">
        You're on square {state.pos.x + 1} across, {state.pos.y + 1} down, of a {WORLD.width} × {WORLD.height} grid. One fixed
        route runs from the start pad to the sealed hatch. Off the route, movement does nothing.
        <span className="kbd-hint"> Arrow keys and WASD use that same route.</span>
      </p>
      <p>
        Terrace clock, hour {hour} of {DAY_NIGHT.hours} — {sky}. This preview is not the space overworld.
      </p>
      <div className="nav-grid">
        <figure className="map-card">
          <MinimapCanvas explored={state.explored} pos={state.pos} />
          <figcaption>
            Directional pixel minimap. Explored pads stay lit. The map fades into space. {minimap.boss.hint}. Boss
            marked: {revealedBoss ? "yes" : "no"}.
          </figcaption>
        </figure>
      </div>

      {state.hatchNoted ? (
        <p role="status">Underground story areas stay sealed. This hatch does not open a new region.</p>
      ) : null}
      <section className="ledger" aria-label="Separated balances">
        <h2>Separated balances</h2>
        <p className="fine">Local labels only. No wallet, no deposit, no market, no energy formula.</p>
        <fieldset>
          <legend>In-game reward balance</legend>
          <p>
            Your balance: {LIVE.remaining} {BALANCE_IDS.inGameReward}. This opening does not add to it.
          </p>
          <p>
            Recorded death rule: {DEATH_RULE.percent}% of the in-game reward balance only. It is not a vault deposit.
          </p>
          <p>
            Worked example, not your balance and not a settlement formula: {DEATH_RULE_SAMPLE_INPUT} practice units
            leave {SAMPLE.remaining}. Removed {SAMPLE.removed}. Vault deposit {SAMPLE.vaultDeposit}.
          </p>
        </fieldset>
        <fieldset>
          <legend>Earned practice-trading balance</legend>
          <p>Not computed. No formula is configured. The opening practice does not write this balance.</p>
          <p>
            Recorded source: {EARNED_PRACTICE_TRADING_BALANCE.recordedSource}. Not from{" "}
            {EARNED_PRACTICE_TRADING_BALANCE.notFrom}. Recorded uses, not built: upgrades and fictional energy, power,
            and life.
          </p>
          <p>The 28% death rule does not apply to this balance. Upgrades implemented: {UPGRADES.implemented ? "yes" : "no"}.</p>
        </fieldset>
        <fieldset>
          <legend>Fictional energy, power, and life</legend>
          <p>
            Unconfigured. No numeric bar. Recorded phrase, not a financial claim: {FICTIONAL_ENERGY.recordedPhrase}.
            Deposits do not create energy.
          </p>
          <p>
            {LIQUIDATION.recorded}. ABC is undefined and is not listed here.
          </p>
          <p>
            Future final boss: not revealed, not implemented, and not a market price. Minimap hint only.
            {FINAL_BOSS.ticker === null ? " No ticker is attached." : ""}
          </p>
        </fieldset>
        <fieldset>
          <legend>Vault</legend>
          <p>Stellar vault: not connected. Deposits, withdrawals, and transfers are not in this build.</p>
          <p>
            Story: rewards reach your vault only after you beat the game.{" "}
            {STORY_HOOKS.postGameVault.connectedToStellar ? "Connected." : "Not connected to a ledger yet."}
          </p>
        </fieldset>
      </section>

      {/* v18.2: developer canon notes (region ids, "escape-machine", "stay undefined") removed from the player screen */}

      <DialogueMenu mode={state.dialogueMode} onMode={onMode} onGrok={onGrok} />
      <GrokStatus open={state.grokOfferOpen} onDecline={onDecline} />
      {/* v18: moves + hatch + travel pinned at the bottom of short phone screens. */}
      <div className="action-bar nav-action-bar" data-action-bar="navigate">
        <p className="next-step" data-terrace-next="1" role="status">
          {step.text}
        </p>
        <div className="dpad action-bar-row" role="group" aria-label="Touch movement">
          <button type="button" className={hint("up")} onClick={() => onMove("up")}>
            Move up
          </button>
          <button type="button" className={hint("left")} onClick={() => onMove("left")}>
            Move left
          </button>
          <button type="button" className={hint("down")} onClick={() => onMove("down")}>
            Move down
          </button>
          <button type="button" className={hint("right")} onClick={() => onMove("right")}>
            Move right
          </button>
        </div>
        <div className="action-bar-row secondary">
          {state.hatchNoted ? (
            <button type="button" className="touch-btn primary" onClick={onDepart}>
              Travel to colonies
            </button>
          ) : (
            <button type="button" className={step.atHatch ? "touch-btn primary" : "touch-btn"} onClick={onHatch} disabled={!step.atHatch}>
              Inspect sealed hatch
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
