import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { playableRegionIds, REGIONS, STORY_HOOKS, DAY_NIGHT } from "./canon.ts"
import { skyPhase } from "./daynight.ts"
import {
  applyInGameRewardDeathRule,
  DEATH_RULE,
  EARNED_PRACTICE_TRADING_BALANCE,
  FICTIONAL_ENERGY,
  FINAL_BOSS,
  LIQUIDATION,
  UNDEFINED_COMBAT_HOOKS,
  UPGRADES,
} from "./balances.ts"
import { RUNTIME_COUPLING, STORY_CHARACTERS } from "./coupling.ts"
import { bossRevealed, buildMinimap } from "./minimap.ts"
import { HATCH_TILE, WORLD, clampMove, inputFromKey, inputFromTouch, moveAlongRoute } from "./movement.ts"
import { createOpening, openingReducer } from "./opening.ts"
import {
  DRONE_ROWS,
  PILOT_ROWS,
  SIS_ROWS,
  XENO_ROWS,
  XOE_STORY_BOX,
  ZOE_ROWS,
  spriteWidthIssues,
  stageAlpha,
  xoeNavigateBox,
} from "./sprites.ts"

describe("movement", () => {
  it("keeps keyboard and touch on the one route and ignores off-route input", () => {
    const start = { ...WORLD.start }
    const right = { x: 1 as const, y: 0 as const }
    const byKey = moveAlongRoute(start, inputFromKey("ArrowRight") ?? right)
    const byTouch = moveAlongRoute(start, inputFromTouch("right"))
    expect(byKey).toEqual(byTouch)
    expect(byKey).toEqual({ x: 3, y: 4 })
    expect(moveAlongRoute(start, inputFromTouch("up"))).toEqual(start)
    expect(moveAlongRoute(start, inputFromKey("ArrowLeft") ?? right)).toEqual(start)
    expect(clampMove({ x: 0, y: 0 }, inputFromTouch("up"))).toEqual({ x: 0, y: 0 })
    expect(inputFromKey("q")).toBeNull()
  })

  it("treats keyboard and touch as the same step, and stays inside the terrace", () => {
    const start = { ...WORLD.start }
    const byKey = clampMove(start, inputFromKey("ArrowRight") ?? { x: 0, y: 0 })
    const byTouch = clampMove(start, inputFromTouch("right"))
    expect(byKey).toEqual(byTouch)
    expect(byKey).toEqual({ x: 3, y: 4 })
    expect(clampMove({ x: 0, y: 0 }, inputFromTouch("up"))).toEqual({ x: 0, y: 0 })
    expect(inputFromKey("q")).toBeNull()
  })

  it("moves only while navigating", () => {
    const start = createOpening()
    expect(openingReducer(start, { type: "move", input: { x: 1, y: 0 } })).toBe(start)
  })
})

describe("minimap", () => {
  it("hints a direction and does not reveal a boss position", () => {
    let state = createOpening()
    state = openingReducer(state, { type: "choose-character", characterId: "nia-okonkwo" })
    state = openingReducer(state, { type: "set-gender", gender: "male" })
    state = openingReducer(state, { type: "choose-class", className: "Recon" })
    state = openingReducer(state, { type: "confirm-disclaimer", confirmed: true })
    state = openingReducer(state, { type: "play-opening" })
    for (let i = 0; i < 4; i += 1) state = openingReducer(state, { type: "continue" })
    state = openingReducer(state, { type: "choose-cinematic", choice: "skip" })
    state = openingReducer(state, { type: "resume-practice" })
    for (const action of ["buy", "sell", "buy", "sell"] as const) {
      state = openingReducer(state, { type: "paper-action", action })
    }
    state = openingReducer(state, { type: "complete-paper" })
    state = openingReducer(state, { type: "continue" })
    state = openingReducer(state, { type: "continue" })
    const stayed = openingReducer(state, { type: "move", input: { x: 0, y: -1 } })
    expect(stayed).toBe(state)
    expect(openingReducer(state, { type: "inspect-hatch" })).toBe(state)
    state = openingReducer(state, { type: "move", input: { x: 1, y: 0 } })
    const model = buildMinimap(state.explored)
    expect(bossRevealed(model)).toBe(false)
    expect(model.fade).toBe("into-space")
    expect(model.boss.hint).toMatch(/spinward fog/i)
    expect(JSON.stringify(model.boss)).not.toMatch(/"x"|"y"|boss at/i)
    expect(state.explored.length).toBe(2)
    for (let step = 0; step < 8; step += 1) {
      state = openingReducer(state, { type: "move", input: { x: 1, y: 0 } })
    }
    for (let step = 0; step < 4; step += 1) {
      state = openingReducer(state, { type: "move", input: { x: 0, y: 1 } })
    }
    expect(state.pos).toEqual(HATCH_TILE)
    const noted = openingReducer(state, { type: "inspect-hatch" })
    expect(noted.hatchNoted).toBe(true)
    expect(noted.regionId).toBe("planet-x-terrace")
    expect(noted.phase).toBe("navigate")
  })
})

describe("canon, clock, and separated balances", () => {
  it("keeps later regions unplayable", () => {
    expect(playableRegionIds()).toEqual([
      "planet-x-terrace",
      "moon-pair-a",
      "moon-pair-b",
      "colony-route",
      "ragnarok-gate",
    ])
    expect(REGIONS.some((region) => region.id.startsWith("moon") && region.playable)).toBe(true)
    expect(STORY_HOOKS.zoeIsKey.revealedInOpening).toBe(false)
    expect(STORY_HOOKS.unsuccessfulRescue.sameAsOpeningSisRescue).toBe(false)
    expect(STORY_HOOKS.xenoEscapeMachine.escapeImplemented).toBe(false)
    expect(STORY_HOOKS.postGameVault.settlementFormula).toBeNull()
    expect(DAY_NIGHT.spaceOverworld).toBe(false)
    expect(DAY_NIGHT.hours).toBe(24)
  })

  it("maps a 24-hour clock without touching movement", () => {
    expect(skyPhase(0)).toBe("night")
    expect(skyPhase(4)).toBe("night")
    expect(skyPhase(5)).toBe("dawn")
    expect(skyPhase(8)).toBe("day")
    expect(skyPhase(16)).toBe("day")
    expect(skyPhase(17)).toBe("dusk")
    expect(skyPhase(20)).toBe("night")
    expect(skyPhase(23)).toBe("night")
    expect(() => skyPhase(24)).toThrow()
    expect(WORLD.start).toEqual({ x: 2, y: 4 })
  })

  it("applies 28% only to the in-game reward balance and deposits nothing", () => {
    expect(applyInGameRewardDeathRule(0)).toMatchObject({ remaining: 0, removed: 0, vaultDeposit: 0 })
    expect(applyInGameRewardDeathRule(100)).toEqual({
      remaining: 72,
      removed: 28,
      vaultDeposit: 0,
      touchedEarnedPracticeBalance: false,
      touchedEnergy: false,
    })
    expect(DEATH_RULE.appliesTo).toBe("in-game-reward-balance")
    expect(DEATH_RULE.appliesToVaultDeposit).toBe(false)
    expect(DEATH_RULE.appliesToEarnedPracticeBalance).toBe(false)
    expect(EARNED_PRACTICE_TRADING_BALANCE.notFrom).toBe("real-deposits")
    expect(FICTIONAL_ENERGY.depositCreatesEnergy).toBe(false)
    expect(FICTIONAL_ENERGY.consumption).toBeNull()
    expect(FICTIONAL_ENERGY.scaling).toBeNull()
    expect(LIQUIDATION.abc).toBeNull()
    expect(FINAL_BOSS.financialClaim).toBe(false)
    expect(FINAL_BOSS.usesMarketPrice).toBe(false)
    expect(FINAL_BOSS.ticker).toBeNull()
    expect(UPGRADES.implemented).toBe(false)
    expect(UNDEFINED_COMBAT_HOOKS.implemented).toBe(false)
    expect(UNDEFINED_COMBAT_HOOKS.licenseToExpandOpening).toBe(false)
  })
})

describe("roster independence and original sprites", () => {
  it("has no agent roster coupling", () => {
    expect(RUNTIME_COUPLING.assistantRosterIds).toEqual([])
    expect(RUNTIME_COUPLING.importsGrokBotRoster).toBe(false)
    expect(RUNTIME_COUPLING.callsTeamApi).toBe(false)
    expect(RUNTIME_COUPLING.storyCharactersAreRosterBots).toBe(false)
    expect(STORY_CHARACTERS).not.toContain("Grok Bot")
  })

  it("keeps hand-authored sprites on even rows", () => {
    expect(spriteWidthIssues("pilot", PILOT_ROWS)).toBeNull()
    expect(spriteWidthIssues("zoe", ZOE_ROWS)).toBeNull()
    expect(spriteWidthIssues("sis", SIS_ROWS)).toBeNull()
    expect(spriteWidthIssues("drone", DRONE_ROWS)).toBeNull()
    expect(spriteWidthIssues("xeno", XENO_ROWS)).toBeNull()
  })

  it("uses the weapons-v2 still and leaves the other character rows unchanged", () => {
    const still = readFileSync("src/assets/xoe-weapons.webp")
    expect(createHash("sha256").update(still).digest("hex")).toBe(
      "44e8a5ae163e50a94709ff2f5afedc03ded01718c545416cca3fc8549686c0e0",
    )
    expect(createHash("sha256").update(PILOT_ROWS.join("\n")).digest("hex")).toBe(
      "0ef7c9209c9c00e4b299ffb0fab4b92b1799d3bc299c01cec77b731d72ce490b",
    )
    expect(createHash("sha256").update(ZOE_ROWS.join("\n")).digest("hex")).toBe(
      "88759bea265d668231a075bc55674e2cfa23a28278c37fac54a712e82b3e82bc",
    )
    expect(createHash("sha256").update(SIS_ROWS.join("\n")).digest("hex")).toBe(
      "8f8d1189f56206c036ca6da80fb71ac6c967a538d5ee65cf83798df99c8ac835",
    )
    expect(createHash("sha256").update(DRONE_ROWS.join("\n")).digest("hex")).toBe(
      "5d1995ff28b40728bcd5cb2733b2a3c0b8992c0433ba3b56b0e1f2c6f487d4d0",
    )
    expect(createHash("sha256").update(XENO_ROWS.join("\n")).digest("hex")).toBe(
      "60a62301e3ae41fd446671636f4cd49fed79d8b01ac34e2340288ad4f223121f",
    )
    expect(XOE_STORY_BOX.w / XOE_STORY_BOX.h).toBeCloseTo(864 / 1152, 5)
    const onHatch = xoeNavigateBox(320, 180, HATCH_TILE)
    expect(onHatch.w / onHatch.h).toBeCloseTo(864 / 1152, 5)
    expect(onHatch.x).toBeGreaterThanOrEqual(2)
    expect(onHatch.y).toBeGreaterThanOrEqual(2)
    expect(onHatch.x + onHatch.w).toBeLessThanOrEqual(318)
    expect(onHatch.y + onHatch.h).toBeLessThanOrEqual(178)
    expect(stageAlpha(0, 0, 0)).toBe(0)
    expect(stageAlpha(22, 57, 77)).toBe(0)
    expect(stageAlpha(106, 196, 222)).toBe(255)
    expect(stageAlpha(16, 57, 89)).toBe(255)
    expect(stageAlpha(79, 73, 159)).toBe(255)
  })
})
