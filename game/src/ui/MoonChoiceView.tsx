import { useEffect, useMemo, useState } from "react"
import {
  MOON_PATHS,
  MOON_POWERS,
  powerById,
  readStoredMoonPower,
  readStoredMoonVariant,
  suggestedPowerForMoon,
  suggestedVariantForMoon,
  variantById,
  writeStoredMoonPower,
  type MoonId,
  type MoonPowerId,
} from "../game/moons.ts"
import type { GameState } from "../game/opening.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { MoonScene } from "./MoonScene.tsx"

function browserStore() {
  return getLocalStore()
}

export function MoonChoiceView({
  state,
  onChoose,
}: {
  state: GameState
  onChoose: (moonId: MoonId, powerId: MoonPowerId, variantId: string) => void
}) {
  const [moonId, setMoonId] = useState<MoonId | null>(null)
  const [powerId, setPowerId] = useState<MoonPowerId>("frost-lock")
  const [variantId, setVariantId] = useState<string>("freeze")

  useEffect(() => {
    const storedP = readStoredMoonPower(browserStore())
    const storedV = readStoredMoonVariant(browserStore())
    if (storedP) setPowerId(storedP)
    if (storedV) setVariantId(storedV)
  }, [])

  const power = powerById(powerId)
  const variants = useMemo(() => power?.variants ?? [], [power])

  function selectMoon(id: MoonId) {
    setMoonId(id)
    const storedP = readStoredMoonPower(browserStore())
    if (!storedP) {
      const sp = suggestedPowerForMoon(id)
      setPowerId(sp)
      setVariantId(suggestedVariantForMoon(id))
    }
  }

  function selectPower(id: MoonPowerId) {
    setPowerId(id)
    const p = powerById(id)
    const nextVariant = p?.defaultVariantId ?? "none"
    setVariantId(nextVariant)
    writeStoredMoonPower(browserStore(), id, nextVariant)
  }

  function selectVariant(id: string) {
    setVariantId(id)
    writeStoredMoonPower(browserStore(), powerId, id)
  }

  const moon = moonId ? MOON_PATHS.find((m) => m.id === moonId) : null
  const variant = variantById(powerId, variantId)

  return (
    <article className="copy-block">
      <h1 tabIndex={-1}>Choose a moon path</h1>
      <p className="narration">
        Irreversible for this run. Pick a moon. A power is optional — each path shows a suggestion. Choosing no power is allowed.
      </p>
      <p className="fine">{state.playerName} frames the path. Your power pick is saved on this device.</p>

      <div className="choice-col" role="group" aria-label="Moon path">
        {MOON_PATHS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={moonId === m.id ? "touch-btn primary" : "touch-btn"}
            aria-pressed={moonId === m.id}
            onClick={() => selectMoon(m.id)}
          >
            <span className="moon-choice-preview" data-moon-preview={m.id} aria-hidden="true">
              <MoonScene moonId={m.id} compact />
            </span>
            <strong>{m.name}</strong>
            <span className="fine">{m.look}</span>
            <span className="fine">
              Suggested: {powerById(m.suggestedPowerId)?.label} / {variantById(m.suggestedPowerId, m.suggestedVariantId)?.label}
            </span>
          </button>
        ))}
      </div>

      <section className="panel moon-power-picker" aria-label="Moon power picker">
        <h2>Power (optional)</h2>
        <div className="choice-col" role="radiogroup" aria-label="Power family">
          {MOON_POWERS.map((p) => (
            <label key={p.id} className="check-row touch-btn">
              <input type="radio" name="moon-power" checked={powerId === p.id} onChange={() => selectPower(p.id)} />
              <span>
                <strong>{p.label}</strong>
                <span className="fine">{p.help}</span>
              </span>
            </label>
          ))}
        </div>

        {power && power.id !== "none" ? (
          <div className="choice-col" role="radiogroup" aria-label="Power variant">
            <p className="fine">Variant for {power.label}</p>
            {variants.map((v) => (
              <label key={v.id} className="check-row touch-btn">
                <input
                  type="radio"
                  name="moon-variant"
                  checked={variantId === v.id}
                  onChange={() => selectVariant(v.id)}
                />
                <span>
                  <strong>{v.label}</strong>
                  {moon && moon.suggestedPowerId === power.id && moon.suggestedVariantId === v.id
                    ? " · suggested"
                    : ""}
                  <span className="fine">
                    {v.help} · {v.durationMs}ms / cd {v.cooldownMs / 1000}s
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : null}
      </section>

      {moon ? <p className="bubble">{moon.xoeLine}</p> : null}
      <p className="fine">
        Selected: {power?.label ?? "—"}
        {variant && power?.id !== "none" ? ` / ${variant.label}` : ""}
      </p>

      <button
        type="button"
        className="touch-btn primary"
        disabled={!moonId}
        onClick={() => {
          if (!moonId) return
          writeStoredMoonPower(browserStore(), powerId, variantId)
          onChoose(moonId, powerId, variantId)
        }}
      >
        Lock moon path{moon ? ` · ${moon.name}` : ""}
      </button>
    </article>
  )
}
