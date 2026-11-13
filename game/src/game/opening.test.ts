import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { CHARACTER_CLASSES, DEFAULT_NAME, GENDERS, LINES, PILOTS, PLAYER_CLASSES, ROLE, characterClass } from "./content.ts"
import { XOE_SPRITE_STORY_BOX, xoeUsesCombatStill } from "./sprites.ts"
import { DIALOGUE_MENU, GROK_STATUS, presentDialogue, shouldAnimate, evaluateSpeech } from "./dialogue.ts"
import { canStart, createOpening, openingReducer, type Action, type GameState } from "./opening.ts"
import {
  PAPER_FIXTURE,
  paperFormulaLine,
  paperResult,
  practiceRulesForCosmetic,
  initialPractice,
  runPractice,
  DEFAULT_TEST_PRICES,
  type PaperAction,
} from "./practice.ts"
import {
  BALANCE_IDS,
  EARNED_PRACTICE_TRADING_BALANCE,
  FICTIONAL_ENERGY,
  IN_GAME_REWARD_BALANCE,
} from "./balances.ts"

const ORDER = [
  "pilot-select",
  "wake",
  "missing-pilot",
  "auto-battle",
  "cockpit-invite",
  "cinematic-choice",
  "practice-pause",
  "practice",
  "near-loss",
  "sis-rescue",
  "navigate",
] as const

function act(state: GameState, action: Action) {
  return openingReducer(state, action)
}

function arm(state: GameState) {
  let next = act(state, { type: "choose-character", characterId: state.characterId })
  next = act(next, { type: "set-gender", gender: "female" })
  next = act(next, { type: "choose-class", className: "Sentinel" })
  next = act(next, { type: "confirm-disclaimer", confirmed: true })
  return next
}

function toCinematicChoice() {
  let state = act(arm(createOpening()), { type: "play-opening" })
  state = act(state, { type: "continue" })
  state = act(state, { type: "continue" })
  state = act(state, { type: "continue" })
  state = act(state, { type: "continue" })
  return state
}

function toPause() {
  return act(toCinematicChoice(), { type: "choose-cinematic", choice: "skip" })
}

const PAPER_UP: PaperAction[] = ["buy", "sell", "buy", "sell"]
const PAPER_DOWN: PaperAction[] = ["sell", "buy", "sell", "buy"]

function playPaper(state: GameState, actions: PaperAction[], prices: readonly number[] = DEFAULT_TEST_PRICES) {
  let next = act(state, { type: "resume-practice" })
  for (let i = 0; i < actions.length; i += 1) {
    next = act(next, { type: "paper-action", action: actions[i]!, price: prices[i] ?? 10 })
    const tick = prices[i + 1]
    if (tick != null) next = act(next, { type: "practice-tick", price: tick })
  }
  return next
}

function finishPractice(state: GameState, actions: PaperAction[]) {
  let next = playPaper(state, actions)
  next = act(next, { type: "complete-paper" })
  next = act(next, { type: "continue" })
  next = act(next, { type: "continue" })
  return next
}

describe("visible names", () => {
  it("uses XOE for the character, Unknown Orbital Engine for the title, and no Zeno in the demo", () => {
    const files = [
      "index.html",
      "src/App.tsx",
      "src/ui/XOrbitalMenu.tsx",
      "src/ui/PilotMenu.tsx",
      "src/ui/Cinematic.tsx",
      "src/ui/StoryView.tsx",
      "src/ui/VoiceSettings.tsx",
      "src/ui/NavView.tsx",
      "src/ui/PracticeView.tsx",
      "src/game/content.ts",
      "src/game/voices.ts",
      "src/game/canon.ts",
    ]
    const combined = files.map((file) => readFileSync(file, "utf8")).join("\n")
    expect(combined).not.toMatch(/zeno/i)
    expect(combined).not.toMatch(/\bXeno\b/)
    expect(readFileSync("index.html", "utf8")).toContain("<title>XOE: Unknown Orbital Engine</title>")
    expect(readFileSync("src/App.tsx", "utf8")).toContain("GAME_FULL_NAME")
    expect(readFileSync("src/game/brand.ts", "utf8")).toContain("Unknown Orbital Engine")
    expect(LINES.wake.text).toBe(
      "You wake in a battle already involving XO. Drones are closing in to kill you. You sense danger.",
    )
    expect(LINES.missing.text).toBe("XO's original pilot is missing — not dead.")
    expect(combined).not.toMatch(/Xeno/)
    expect(PILOTS.filter((pilot) => pilot.id === "xoe")).toHaveLength(1)
    expect(PILOTS.map((pilot) => pilot.name).filter((name) => name === "XO")).toHaveLength(1)
    expect(characterClass("xoe")?.name).toBe("Sentinel")
    expect(characterClass("xoe")?.profile).not.toMatch(/DEF|OFF/) // v18.2: XO stats are classified
    void CHARACTER_CLASSES
    expect(xoeUsesCombatStill("wake")).toBe(true)
    expect(xoeUsesCombatStill("auto-battle")).toBe(true)
    expect(xoeUsesCombatStill("practice")).toBe(false)
    expect(xoeUsesCombatStill("navigate")).toBe(false)
    const sprite = readFileSync("src/assets/xoe-sprite.png")
    expect(sprite.readUInt32BE(16)).toBe(16)
    expect(sprite.readUInt32BE(20)).toBe(16)
    expect(createHash("sha256").update(sprite).digest("hex")).toBe(
      "35839f4d1d9a1d5fdd18af655e8ee382808d4c46db0e7c5fa96e16231fba64de",
    )
    expect(XOE_SPRITE_STORY_BOX).toEqual({ x: 28, y: 96, w: 32, h: 32 })
    const ui = ["src/ui/XOrbitalMenu.tsx", "src/ui/PilotMenu.tsx", "src/index.css", "src/game/sprites.ts"]
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")
    expect(ui).not.toMatch(/xoe-plasma/)
    expect(ui).not.toMatch(/sword glow|short sword/)
    const coverSrc = readFileSync("src/ui/CoverArt.tsx", "utf8")
    expect(coverSrc).toContain("Unknown Orbital Engine")
    expect(coverSrc).not.toMatch(/Project X/i)
  })
})

describe("pregame", () => {
  it("blocks start until character, gender or NA, class, and the disclaimer are explicit", () => {
    const start = createOpening()
    expect(start.playerName).toBe(DEFAULT_NAME)
    expect(start.characterId).toBe("xoe")
    expect(start.characterConfirmed).toBe(false)
    expect(start.gender).toBeNull()
    expect(start.genderUnspecified).toBe(false)
    expect(start.chosenClass).toBeNull()
    expect(canStart(start)).toBe(false)
    expect(act(start, { type: "begin" })).toBe(start)
    const confirmedOnly = act(start, { type: "choose-character", characterId: "xoe" })
    expect(confirmedOnly.characterConfirmed).toBe(true)
    expect(DEFAULT_NAME).toBe("XO")
    expect(confirmedOnly.playerName).toBe(DEFAULT_NAME)
    expect(act(confirmedOnly, { type: "begin" }).phase).toBe("pilot-select")
    const withGender = act(confirmedOnly, { type: "set-gender", gender: "female" })
    expect(act(withGender, { type: "begin" }).phase).toBe("pilot-select")
    const withClass = act(withGender, { type: "choose-class", className: "Sentinel" })
    expect(act(withClass, { type: "begin" }).phase).toBe("pilot-select")
    const ready = act(withClass, { type: "confirm-disclaimer", confirmed: true })
    expect(canStart(ready)).toBe(true)
    expect(act(ready, { type: "begin" }).phase).toBe("colony-map")
    expect(act(ready, { type: "play-opening" }).phase).toBe("wake")
  })

  it("keeps gender, NA, and class as single choices independent of the character", () => {
    let state = createOpening()
    for (const characterId of ["mara-venn", "elias-cho", "nia-okonkwo"] as const) {
      for (const gender of GENDERS) {
        for (const className of PLAYER_CLASSES) {
          state = act(createOpening(), { type: "choose-character", characterId })
          state = act(state, { type: "set-gender", gender: "female" })
          state = act(state, { type: "set-gender", gender: "male" })
          state = act(state, { type: "set-gender-na", checked: true })
          expect(state.gender).toBeNull()
          expect(state.genderUnspecified).toBe(true)
          state = act(state, { type: "set-gender", gender })
          expect(state.gender).toBe(gender)
          expect(state.genderUnspecified).toBe(false)
          state = act(state, { type: "choose-class", className: "Sentinel" })
          state = act(state, { type: "choose-class", className })
          expect(state.chosenClass).toBe(className)
          expect(state.characterId).toBe(characterId)
          expect(characterClass(characterId)?.name).toBe(
            characterId === "mara-venn" ? "Sentinel" : characterId === "elias-cho" ? "Striker" : "Recon",
          )
          expect(CHARACTER_CLASSES[characterId].profile.length).toBeGreaterThan(10)
          state = act(state, { type: "confirm-disclaimer", confirmed: true })
          const landed = act(state, { type: "begin" })
          expect(landed.phase).toBe("colony-map")
          expect(act(landed, { type: "play-opening" }).phase).toBe("wake")
          expect(landed.playerName).toBe(DEFAULT_NAME)
          expect(landed.chosenClass).toBe(className)
          expect(landed.gender).toBe(gender)
        }
      }
    }
    const named = act(createOpening(), { type: "set-player-name", name: "Pilot" })
    expect(canStart(arm(named))).toBe(false)
    expect(ROLE).toBe("Pilot")
  })
})

describe("opening order", () => {
  it("follows the authorized beats, with auto-battle before the cockpit invitation", () => {
    const state = toPause()
    expect(state.seen).toEqual(ORDER.slice(0, ORDER.indexOf("practice-pause") + 1))
    expect(state.seen.indexOf("auto-battle")).toBeLessThan(state.seen.indexOf("cockpit-invite"))
    expect(state.paused).toBe(true)
    expect(state.phase).toBe("practice-pause")
    expect(LINES.missing.text).toBe("XO's original pilot is missing — not dead.")
    expect(LINES.auto.text).toContain("before any invitation")
    expect(LINES.zoeInvite.text).toBe("Jump in if you want to survive.")
  })

  it("skips the cinematic without playing it", () => {
    const state = toPause()
    expect(state.seen).not.toContain("cinematic")
  })

  it("can play and then skip the cinematic", () => {
    let state = act(toCinematicChoice(), { type: "choose-cinematic", choice: "play" })
    expect(state.phase).toBe("cinematic")
    state = act(state, { type: "skip-cinematic" })
    expect(state.phase).toBe("practice-pause")
    expect(state.seen).toContain("cinematic")
  })

  it("advances cinematic panels and then pauses practice", () => {
    let state = act(toCinematicChoice(), { type: "choose-cinematic", choice: "play" })
    state = act(state, { type: "next-panel" })
    state = act(state, { type: "next-panel" })
    expect(state.phase).toBe("cinematic")
    state = act(state, { type: "next-panel" })
    expect(state.phase).toBe("practice-pause")
    expect(state.paused).toBe(true)
  })
})

describe("pause, practice, rescue", () => {
  it("ignores practice input until an explicit resume", () => {
    const paused = toPause()
    const ignored = act(paused, { type: "paper-action", action: "buy" })
    expect(ignored).toBe(paused)
    expect(act(paused, { type: "continue" })).toBe(paused)
    const live = act(paused, { type: "resume-practice" })
    expect(live.phase).toBe("practice")
    expect(live.paused).toBe(false)
  })

  it("sends a paper gain and a paper loss through the same rescue", () => {
    const won = finishPractice(toPause(), PAPER_UP)
    const lost = finishPractice(toPause(), PAPER_DOWN)
    expect(runPractice(PAPER_UP).outcome).toBe("paper-up")
    expect(["paper-down", "liquidated"]).toContain(runPractice(PAPER_DOWN).outcome)
    expect(paperResult(runPractice(PAPER_UP))).toBeGreaterThan(0)
    const flat = runPractice(["buy", "buy", "sell", "sell"])
    expect(["paper-down", "paper-up", "liquidated", null]).toContain(flat.outcome)
    expect(paperFormulaLine(runPractice(PAPER_UP))).toMatch(/P\/L \+/)
    expect(paperFormulaLine(runPractice(PAPER_UP))).toMatch(/Testnet XOE/)
    const sold = runPractice(["sell"])
    expect(["paper-down", "paper-up", "liquidated", null]).toContain(sold.outcome)
    expect(paperFormulaLine(sold)).toMatch(/P\/L /)
    expect(won.practiceOutcome).toBe("paper-up")
    expect(["paper-down", "liquidated"]).toContain(lost.practiceOutcome)
    expect(won.phase).toBe("navigate")
    expect(lost.phase).toBe("navigate")
    expect(won.rescued).toBe(true)
    expect(lost.rescued).toBe(true)
    expect(won.seen.slice(-3)).toEqual(["near-loss", "sis-rescue", "navigate"])
    expect(lost.seen.slice(-3)).toEqual(won.seen.slice(-3))
  })

  it("does not write balances or energy from either practice result", () => {
    const won = finishPractice(toPause(), PAPER_UP)
    expect(won.practice.outcome).toBe("paper-up")
    expect(IN_GAME_REWARD_BALANCE).toBe(0)
    expect(EARNED_PRACTICE_TRADING_BALANCE.value).toBeNull()
    expect(EARNED_PRACTICE_TRADING_BALANCE.writesInThisOpening).toBe(false)
    expect(FICTIONAL_ENERGY.numericBar).toBe(false)
    expect(practiceRulesForCosmetic("dusk")).toEqual(practiceRulesForCosmetic("ceramic"))
  })
})

describe("grok decline and dialogue menu", () => {
  it("keeps decline on the same story path and never marks a connection", () => {
    let state = toPause()
    state = act(state, { type: "open-grok" })
    expect(state.phase).toBe("practice-pause")
    expect(state.grokConnected).toBe(false)
    expect(GROK_STATUS).toMatch(/Grok Bot is ready/)
    state = act(state, { type: "decline-grok" })
    expect(state.grokDeclined).toBe(true)
    expect(state.grokConnected).toBe(false)
    state = finishPractice(state, PAPER_DOWN)
    expect(state.phase).toBe("navigate")
    expect(state.rescued).toBe(true)
    expect(state.grokConnected).toBe(false)
  })

  it("offers exactly three dialogue menu options", () => {
    expect(DIALOGUE_MENU.map((item) => item.id)).toEqual(["bubble", "audio-only", "grok"])
    const line = LINES.sis.text
    const available = { available: true, reason: null }
    const missing = evaluateSpeech({ synthPresent: false, voiceCount: 0 })
    expect(presentDialogue(line, "bubble", missing).text).toBe(line)
    expect(presentDialogue(line, "audio-only", available).text).toBeNull()
    expect(presentDialogue(line, "audio-only", available).speak).toBe(line)
    expect(presentDialogue(line, "audio-only", missing).text).toBeNull()
    expect(presentDialogue(line, "audio-only", missing).status).toMatch(/unavailable/i)
  })
})

describe("paper sequence", () => {
  it("returns to a fresh opening from play", () => {
    let state = arm(createOpening())
    state = act(state, { type: "begin" })
    state = act(state, { type: "return-to-front" })
    expect(state.phase).toBe("pilot-select")
    expect(state.playerName).toBe(DEFAULT_NAME)
    expect(state.characterConfirmed).toBe(false)
    expect(state.practice.cash).toBe(20)
    expect(state.practice.position).toBe(0)
  })

  it("restarts the fixture and can exit without writing rewards", () => {
    let state = playPaper(toPause(), ["buy"])
    expect(state.practice.cash).toBe(19)
    expect(state.practice.position).toBe(1)
    const livePrice = state.practice.price
    state = act(state, { type: "restart-paper" })
    expect(state.phase).toBe("practice")
    expect(state.practice).toEqual(initialPractice({ price: livePrice }))
    state = act(state, { type: "paper-action", action: "sell" })
    state = act(state, { type: "exit-paper" })
    expect(state.phase).toBe("near-loss")
    expect(state.practiceOutcome).toBe("paper-exit")
    expect(IN_GAME_REWARD_BALANCE).toBe(0)
    expect(EARNED_PRACTICE_TRADING_BALANCE.value).toBeNull()
    expect(state.practice.cash).not.toBe(IN_GAME_REWARD_BALANCE)
  })

  it("keeps the mock prints off the canonical balances", () => {
    expect(PAPER_FIXTURE.canonicalPrice).toBe(false)
    expect(PAPER_FIXTURE.marketQuote).toBe(false)
    expect(PAPER_FIXTURE.realFunds).toBe(false)
    expect(practiceRulesForCosmetic("dusk")).toBe(PAPER_FIXTURE)
    const finished = runPractice(PAPER_UP)
    expect(paperResult(finished)).toBeGreaterThan(0)
    expect(finished.outcome).toBe("paper-up")
    expect(finished.cash).not.toBe(IN_GAME_REWARD_BALANCE)
  })
})

describe("live actions and animation pause", () => {
  it("rejects trades, combat, and vault deposits without changing the phase", () => {
    let state = finishPractice(toPause(), PAPER_UP)
    const phase = state.phase
    state = act(state, { type: "attempt-live-trade" })
    state = act(state, { type: "attempt-combat" })
    state = act(state, { type: "attempt-vault-deposit" })
    expect(state.phase).toBe(phase)
    expect(state.rejectedLiveActions).toBe(3)
    expect(state.regionId).toBe("planet-x-terrace")
    expect(BALANCE_IDS.vaultDeposit).not.toBe(BALANCE_IDS.inGameReward)
  })

  it("pauses animation when the story is paused, the tab is hidden, or motion is reduced", () => {
    expect(shouldAnimate({ hidden: false, reducedMotion: false, storyPaused: false })).toBe(true)
    expect(shouldAnimate({ hidden: true, reducedMotion: false, storyPaused: false })).toBe(false)
    expect(shouldAnimate({ hidden: false, reducedMotion: true, storyPaused: false })).toBe(false)
    expect(shouldAnimate({ hidden: false, reducedMotion: false, storyPaused: true })).toBe(false)
  })
})
