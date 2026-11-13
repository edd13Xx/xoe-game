import { describe, expect, it } from "vitest"
import { COLONIES, allColoniesCleared, RAGNAROK_QUESTIONS } from "./colonies.ts"
import { MOON_PATHS } from "./moons.ts"
import { createOpening, openingReducer, type GameState } from "./opening.ts"
import { HATCH_TILE } from "./movement.ts"
import { themeForPhase } from "./music.ts"
import { XOE_SCRIPTED_LABEL, rosterLine, tipsForColony } from "./xoe-guide.ts"

function startToTerrace(): GameState {
  let s = createOpening()
  s = openingReducer(s, { type: "choose-character", characterId: "xoe" })
  s = openingReducer(s, { type: "set-gender", gender: "female" })
  s = openingReducer(s, { type: "choose-class", className: "Sentinel" })
  s = openingReducer(s, { type: "confirm-disclaimer", confirmed: true })
  s = openingReducer(s, { type: "play-opening" })
  // wake -> missing -> auto -> invite
  s = openingReducer(s, { type: "continue" })
  s = openingReducer(s, { type: "continue" })
  s = openingReducer(s, { type: "continue" })
  s = openingReducer(s, { type: "continue" })
  s = openingReducer(s, { type: "choose-cinematic", choice: "skip" })
  s = openingReducer(s, { type: "resume-practice" })
  // four paper actions
  s = openingReducer(s, { type: "paper-action", action: "buy" })
  s = openingReducer(s, { type: "paper-action", action: "sell" })
  s = openingReducer(s, { type: "paper-action", action: "buy" })
  s = openingReducer(s, { type: "paper-action", action: "sell" })
  s = openingReducer(s, { type: "complete-paper" })
  s = openingReducer(s, { type: "continue" }) // near-loss -> sis
  s = openingReducer(s, { type: "continue" }) // sis -> navigate
  return s
}

describe("integrated journey", () => {
  it("labels XOE as scripted offline and keeps roster lines", () => {
    expect(XOE_SCRIPTED_LABEL).toMatch(/built-in AI|live Grok Bot/i)
    expect(rosterLine("mara-venn")).toMatch(/Mara Venn/)
    expect(rosterLine("elias-cho")).toMatch(/Elias Cho/)
    expect(rosterLine("nia-okonkwo")).toMatch(/Nia Okonkwo/)
    expect(tipsForColony("wallet").some((t) => t.id === "hint")).toBe(true)
  })

  it("plays colonies, irreversible moon, ragnarok quiz, cut to black", () => {
    let s = startToTerrace()
    expect(s.phase).toBe("navigate")
    // walk to hatch
    while (s.pos.x < HATCH_TILE.x) s = openingReducer(s, { type: "move", input: { x: 1, y: 0 } })
    while (s.pos.y < HATCH_TILE.y) s = openingReducer(s, { type: "move", input: { x: 0, y: 1 } })
    s = openingReducer(s, { type: "inspect-hatch" })
    expect(s.hatchNoted).toBe(true)
    s = openingReducer(s, { type: "depart-colonies" })
    expect(s.phase).toBe("colony-map")

    for (const colony of COLONIES) {
      s = openingReducer(s, { type: "enter-colony", colonyId: colony.id })
      expect(s.phase).toBe("colony-lesson")
      const okGate = colony.gates.findIndex((g) => g.ok)
      s = openingReducer(s, { type: "arcade-set-lane", lane: colony.gates[okGate]!.lane })
      s = openingReducer(s, { type: "arcade-fly-gate", gateIndex: okGate })
      expect(s.clearedColonies.includes(colony.id)).toBe(true)
    }
    expect(allColoniesCleared(s.clearedColonies)).toBe(true)
    s = openingReducer(s, { type: "open-moon-choice" })
    expect(s.phase).toBe("moon-choice")
    const first = MOON_PATHS[0]!
    s = openingReducer(s, { type: "choose-moon", moonId: first.id, powerId: "frost-lock", variantId: "freeze" })
    expect(s.moonId).toBe(first.id)
    expect(s.moonPowerId).toBe("frost-lock")
    expect(s.moonPowerVariantId).toBe("freeze")
    expect(s.phase).toBe("moon-approach")
    s = openingReducer(s, { type: "start-ragnarok" })
    expect(s.phase).toBe("ragnarok")
    // irreversible
    const blocked = openingReducer(s, { type: "choose-moon", moonId: MOON_PATHS[1]!.id, powerId: "none", variantId: "none" })
    expect(blocked.moonId).toBe(first.id)

    for (let step = 0; step < RAGNAROK_QUESTIONS.length; step += 1) {
      const q = RAGNAROK_QUESTIONS[s.bossStep]!
      const okIndex = q.choices.findIndex((c) => c.ok)
      s = openingReducer(s, { type: "answer-ragnarok", choiceIndex: okIndex })
    }
    expect(s.phase).toBe("ending")
    for (let i = 0; i < 6; i += 1) s = openingReducer(s, { type: "ending-next" })
    expect(s.phase).toBe("blackout")
    expect(themeForPhase("blackout", true)).toBe("silence")
  })

  it("marks Sol/Xelm approved and optional power variants with suggestions", () => {
    const names = MOON_PATHS.map((m) => m.name).sort()
    expect(names).toEqual(["Sol", "Xelm"])
    for (const moon of MOON_PATHS) {
      expect(moon.nameStatus).toBe("approved by Eddie")
    }
    expect(MOON_PATHS.find((m) => m.name === "Xelm")?.suggestedPowerId).toBe("frost-lock")
    expect(MOON_PATHS.find((m) => m.name === "Xelm")?.suggestedVariantId).toBe("freeze")
    expect(MOON_PATHS.find((m) => m.name === "Sol")?.suggestedPowerId).toBe("flare-dash")
    expect(MOON_PATHS.find((m) => m.name === "Sol")?.suggestedVariantId).toBe("speed-burst")
  })

  it("lets a review jump land on credits without changing colony or ledger state", () => {
    let s = createOpening()
    const cleared = s.clearedColonies.slice()
    s = openingReducer(s, { type: "qa-jump-credits" })
    expect(s.phase).toBe("ending")
    expect(s.endingIndex).toBe(5)
    expect(s.creditsPreview).toBe(true)
    expect(s.clearedColonies).toEqual(cleared)
    const after = openingReducer(s, { type: "ending-next" })
    expect(after.phase).toBe("blackout")
  })

  it("skips remaining ending beats to the credits roll without leaving the run", () => {
    let s = openingReducer(createOpening(), { type: "qa-jump-credits" })
    s = { ...s, endingIndex: 0, creditsPreview: false }
    s = openingReducer(s, { type: "ending-skip-to-credits" })
    expect(s.phase).toBe("ending")
    expect(s.endingIndex).toBe(5)
    expect(s.creditsPreview).toBe(false)
  })
})
