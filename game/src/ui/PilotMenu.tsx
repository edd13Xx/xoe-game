import { useEffect, useRef } from "react"
import {
  DEFAULT_NAME,
  GENDERS,
  PILOTS,
  PLAYER_CLASSES,
  ROLE,
  SUITS,
  characterClass,
  isUsablePlayerName,
  playerClassProfile,
  type Gender,
  type PlayerClassName,
} from "../game/content.ts"
import { displayCompanionCardClass, XO_CLASS_LINE, XO_STATS_CLASSIFIED } from "../game/companion-display.ts"
import { classCombatStats, defOffBarPercent, statsAtLevel } from "../game/class-stats.ts"
import xoeSprite from "../assets/xoe-sprite.png"
import { PILOT_PORTRAIT_SIZE, drawClassIcon, drawPilotPortrait } from "../game/sprites.ts"
import { canStart, type GameState } from "../game/opening.ts"

function HumanPortrait({ hull, visor, original }: { hull: string; visor: string; original: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (original) return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    drawPilotPortrait(ctx, hull, visor)
  }, [hull, visor, original])
  if (original) {
    return (
      <span className="xoe-float">
        <img src={xoeSprite} alt="" className="portrait xoe-sprite" width={16} height={16} />
        <span className="xoe-glimmer" aria-hidden="true" />
      </span>
    )
  }
  return (
    <canvas
      ref={ref}
      className="portrait"
      width={PILOT_PORTRAIT_SIZE}
      height={PILOT_PORTRAIT_SIZE}
      aria-hidden="true"
    />
  )
}

function ClassIcon({ name }: { name: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    drawClassIcon(ctx, name)
  }, [name])
  return <canvas ref={ref} className="class-icon" width={32} height={32} aria-hidden="true" />
}

export function PilotMenu({
  state,
  onCharacter,
  onName,
  onGender,
  onNa,
  onClass,
  onDisclaimer,
  onSuit,
  onBegin,
}: {
  state: GameState
  onCharacter: (id: string) => void
  onName: (name: string) => void
  onGender: (gender: Gender) => void
  onNa: (checked: boolean) => void
  onClass: (className: PlayerClassName) => void
  onDisclaimer: (confirmed: boolean) => void
  onSuit: (id: string) => void
  onBegin: () => void
}) {
  const ready = canStart(state)
  const hull = SUITS.find((suit) => suit.id === state.cosmeticId)?.hull ?? "#c4c0d4"
  const missing = [
    state.characterConfirmed ? null : "Confirm a character. XO can be confirmed without a rename.",
    state.gender === null && !state.genderUnspecified ? "Choose Female, Male, or NA." : null,
    state.chosenClass === null ? "Choose one class: Sentinel, Striker, or Recon." : null,
    state.disclaimerConfirmed ? null : "Confirm the simulation disclaimer.",
    isUsablePlayerName(state.playerName) ? null : `Enter a name. ${ROLE} stays the role and cannot be the name.`,
  ].filter((item): item is string => item !== null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        if (event.key === "Enter" && ready) onBegin()
        return
      }
      const index = PILOTS.findIndex((pilot) => pilot.id === state.characterId)
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const dir = event.key === "ArrowDown" ? 1 : -1
        const next = PILOTS[(index + dir + PILOTS.length) % PILOTS.length]
        if (next) onCharacter(next.id)
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault()
        const suitIndex = SUITS.findIndex((suit) => suit.id === state.cosmeticId)
        const dir = event.key === "ArrowRight" ? 1 : -1
        const next = SUITS[(suitIndex + dir + SUITS.length) % SUITS.length]
        if (next) onSuit(next.id)
      }
      if (event.key === "Enter" && ready) onBegin()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state.characterId, state.cosmeticId, ready, onCharacter, onSuit, onBegin])

  return (
    <div className="roster">
      <div className="roster-list" role="group" aria-label="Character">
        {PILOTS.map((pilot) => {
          const selected = pilot.id === state.characterId
          const confirmed = selected && state.characterConfirmed
          const profile = characterClass(pilot.id)
          return (
            <div key={pilot.id} className={selected ? "roster-card selected" : "roster-card"}>
              <div
                role="button"
                aria-pressed={confirmed}
                tabIndex={0}
                className={`roster-row${confirmed ? " selected" : ""}${pilot.id === "xoe" ? " xo-row" : ""}`}
                data-pilot={pilot.id}
                onClick={() => onCharacter(pilot.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onCharacter(pilot.id)
                  }
                }}
              >
                <HumanPortrait hull={hull} visor={pilot.visor} original={pilot.id === "xoe"} />
                <span className="pick-stack">
                  <span className="pick">
                    <span className="check" aria-hidden="true">
                      {confirmed ? "✓" : ""}
                    </span>
                    <span className="row-name">{pilot.name}</span>
                  </span>
                  {profile ? (
                    <span className="class-present" data-companion-class={pilot.id === "xoe" ? displayCompanionCardClass(profile.name) : profile.name}>
                      <ClassIcon name={profile.name} />
                      <span>
                        <span className="class-name">{pilot.id === "xoe" ? displayCompanionCardClass(profile.name) : profile.name}</span>
                        {pilot.id === "xoe" ? <span className="fine xo-classified">{XO_CLASS_LINE}</span> : null}
                        <span className="fine">{profile.profile}</span>
                        {pilot.id === "xoe" ? <span className="fine">{XO_STATS_CLASSIFIED}</span> : null}
                        <span className="def-off-bars" aria-label={`${profile.name} defense and offense`} hidden={pilot.id === "xoe"}>
                          {(() => {
                            if (pilot.id === "xoe") return null
                            const mapped = profile.name === "Sentinel" || profile.name === "Striker" || profile.name === "Recon" ? profile.name : null
                            if (!mapped) return null
                            const s = statsAtLevel(mapped, 1)
                            const row = classCombatStats(mapped)
                            return (
                              <>
                                <span className="stat-bar-row">
                                  <span className="stat-bar-label">DEF {s.def}</span>
                                  <span className="stat-bar-track"><span className="stat-bar-fill def" style={{ width: `${defOffBarPercent(s.def)}%` }} /></span>
                                </span>
                                <span className="stat-bar-row">
                                  <span className="stat-bar-label">OFF {s.off}</span>
                                  <span className="stat-bar-track"><span className="stat-bar-fill off" style={{ width: `${defOffBarPercent(s.off)}%` }} /></span>
                                </span>
                                <span className="fine">{row.blurb} Max HP {s.maxHealth}.</span>
                              </>
                            )
                          })()}
                        </span>
                        {profile.name === "Recon" ? (
                          <span className="recon-notice">Recon is for experienced players only.</span>
                        ) : null}
                      </span>
                    </span>
                  ) : null}
                </span>
              </div>
              {selected ? (
                <div className="selected-view" aria-label={`Selected view for ${pilot.name}`}>
                  <fieldset>
                    <legend>Gender</legend>
                    <div className="choice-row" role="radiogroup" aria-label="Gender">
                      {GENDERS.map((gender) => (
                        <label key={gender} className="check-row">
                          <input
                            type="radio"
                            name="player-gender"
                            checked={state.gender === gender}
                            onChange={() => onGender(gender)}
                          />
                          {gender === "female" ? "Female" : "Male"}
                        </label>
                      ))}
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={state.genderUnspecified}
                          onChange={(event) => onNa(event.target.checked)}
                        />
                        NA
                      </label>
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Class</legend>
                    <div className="choice-row" role="radiogroup" aria-label="Class">
                      {PLAYER_CLASSES.map((className) => (
                        <label key={className} className="check-row">
                          <input
                            type="radio"
                            name="player-class"
                            checked={state.chosenClass === className}
                            onChange={() => onClass(className)}
                          />
                          {className}
                          {className === "Recon" ? " — Recon is for experienced players only." : ""}
                        </label>
                      ))}
                    </div>
                    <p className="fine">
                      {state.chosenClass
                        ? playerClassProfile(state.chosenClass)
                        : "Choose one class. A character profile does not confirm it."}
                    </p>
                  </fieldset>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="roster-detail">
        <p className="fine">
          Role, Pilot, and Name are separate. Changing Name does not change Role or Pilot. Changing Pilot does not
          change Role or Name. {ROLE} is the role and cannot be used as the Name.
        </p>
        <p>
          <span className="fine">Role:</span> <strong>{ROLE}</strong>
          {" · "}
          <span className="fine">Pilot:</span>{" "}
          <strong>{PILOTS.find((p) => p.id === state.characterId)?.name ?? "—"}</strong>
          {" · "}
          <span className="fine">Name:</span> <strong>{state.playerName}</strong>
        </p>
        <label className="name-field">
          Name
          <input
            value={state.playerName}
            onChange={(event) => onName(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Character name"
          />
        </label>
        <p className="fine">Default companion name is {DEFAULT_NAME}.</p>
        <div className="menu-row" role="group" aria-label="Suit cosmetic">
          {SUITS.map((suit) => (
            <button
              key={suit.id}
              type="button"
              aria-pressed={state.cosmeticId === suit.id}
              onClick={() => onSuit(suit.id)}
            >
              {suit.label}
            </button>
          ))}
        </div>
        <p className="fine">Suit color is cosmetic. It does not change practice, rescue, or balances.</p>
        <div className="panel" role="region" aria-label="Simulation disclaimer">
          <p id="sim-disclaimer">
            Trading in this opening uses a testnet XOE/USD sim price. No real money moves. This is not a live account.
          </p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={state.disclaimerConfirmed}
              aria-describedby="sim-disclaimer"
              onChange={(event) => onDisclaimer(event.target.checked)}
            />
            I confirm I have seen the simulation disclaimer.
          </label>
        </div>
        {missing.length > 0 ? (
          <ul>
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p role="status">Choices confirmed. You can start when ready.</p>
        )}
        <button type="button" disabled={!ready} onClick={onBegin}>
          Start when ready
        </button>
      </div>
    </div>
  )
}
