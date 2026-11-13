import {
  FEES_LEVERAGE_DONE,
  FEES_LEVERAGE_ID,
  FEES_LEVERAGE_LABEL,
  FEES_LEVERAGE_STEPS,
  buildFeesLeverageStep,
  feesLeverageStepId,
  feesLeverageStepOf,
  isFeesLeverageId,
} from "./fees-leverage.ts"
import {
  DEFAULT_CHARACTER_ID,
  DEFAULT_NAME,
  GENDERS,
  isUsablePlayerName,
  pilotById,
  suitById,
  type Gender,
  type PlayerClassName,
} from "./content.ts"
import {
  allColoniesCleared,
  COLONIES,
  colonyById,
  isColonyLocked,
  RAGNAROK_QUESTIONS,
} from "./colonies.ts"
import { buildPracticeExamLesson, PRACTICE_EXAM_ID } from "./practice-exam.ts"
import { abilityReady, flareDashActive, flareShieldActive, frostLockActive, moonById, powerById, slowMoActive, variantById, type MoonId, type MoonPowerId } from "./moons.ts"
import { isTownId } from "./towns.ts"
import { readQaTown } from "./qa-flags.ts"
import { formatPlay, formatXoe7 } from "./economy.ts"
import { TICKER_SHIELD_BONUS, mergeTickerItems, type TickerItem } from "./ticker-play.ts"
import { HATCH_TILE, WORLD, moveAlongRoute, tileKey, type Input, type Pos } from "./movement.ts"
import {
  applyPaperAction,
  applyPracticeTick,
  finalizePractice,
  initialPractice,
  type PaperAction,
  type PaperOutcome,
  type PracticeState,
} from "./practice.ts"
import type { DialogueMode } from "./dialogue.ts"

export const OPENING_PHASES = [
  "pilot-select",
  "wake",
  "missing-pilot",
  "auto-battle",
  "cockpit-invite",
  "cinematic-choice",
  "cinematic",
  "practice-pause",
  "practice",
  "near-loss",
  "sis-rescue",
  "navigate",
  "colony-map",
  "colony-lesson",
  "moon-choice",
  "moon-approach",
  "ragnarok",
  "ending",
  "blackout",
] as const

export type Phase = (typeof OPENING_PHASES)[number]

export const CINEMATIC_PANELS = 3

export type RegionId =
  | "planet-x-terrace"
  | "colony-route"
  | "moon-pair-a"
  | "moon-pair-b"
  | "ragnarok-gate"
  | "ending"
  | "harbor-commons"
  | "aurora-port"

export interface GameState {
  phase: Phase
  seen: Phase[]
  pilotId: string | null
  playerName: string
  characterId: string
  characterConfirmed: boolean
  gender: Gender | null
  genderUnspecified: boolean
  chosenClass: PlayerClassName | null
  disclaimerConfirmed: boolean
  cosmeticId: string
  paused: boolean
  dialogueMode: DialogueMode
  grokOfferOpen: boolean
  grokDeclined: boolean
  grokConnected: false
  grokConfigured: false
  practice: PracticeState
  practiceOutcome: PaperOutcome | null
  rescued: boolean
  pos: Pos
  explored: string[]
  rejectedLiveActions: number
  hatchNoted: boolean
  cinematicIndex: number
  regionId: RegionId
  clearedColonies: string[]
  activeColonyId: string | null
  colonyFeedback: string | null
  moonId: MoonId | null
  activeTownId: string | null
  visitedTowns: string[]
  /** v18: ?qa=1 test switch — opens the moon gate only. Never saved, adds nothing. */
  qaMoons: boolean
  /** v18: optional bonus lessons cleared (e.g. Fees and leverage). Never counts toward the 10 story colonies. */
  bonusLessonsCleared: string[]
  moonPowerId: MoonPowerId
  moonPowerVariantId: string
  moonAbilityUsed: boolean
  moonAbilityUsedAtMs: number | null
  frostLockUntilMs: number | null
  flareDashUntilMs: number | null
  slowMoUntilMs: number | null
  flareShieldCharges: number
  flareShieldUntilMs: number | null
  arcadeLane: number
  arcadeScore: number
  arcadeCombo: number
  arcadePickupCollected: number[]
  /** v13 ticker gameplay: live/simulated price moves on the field (Testnet XOE · no real money). */
  tickerItems: TickerItem[]
  tickerScore: number
  tickerNote: string | null
  /** v15: floating "+$0.025 sim" over the last coin picked up. */
  tickerPop: { id: string; wx: number; wy: number; lane: number; text: string; good: boolean } | null
  bossThreat: number
  bossFocus: number
  bossStep: number
  bossFeedback: string | null
  endingIndex: number
  /** Review-only credits jump. Display labels only — never written to the ledger. */
  creditsPreview: boolean
  xoeGuideOpen: boolean
  xoeGuideReply: string | null
}

export type Action =
  | { type: "set-player-name"; name: string }
  | { type: "choose-character"; characterId: string }
  | { type: "set-gender"; gender: Gender }
  | { type: "set-gender-na"; checked: boolean }
  | { type: "choose-class"; className: PlayerClassName }
  | { type: "confirm-disclaimer"; confirmed: boolean }
  | { type: "begin" }
  | { type: "play-opening" }
  | { type: "choose-suit"; cosmeticId: string }
  | { type: "continue" }
  | { type: "choose-cinematic"; choice: "play" | "skip" }
  | { type: "skip-cinematic" }
  | { type: "next-panel" }
  | { type: "set-dialogue-mode"; mode: DialogueMode }
  | { type: "open-grok" }
  | { type: "decline-grok" }
  | { type: "resume-practice" }
  | { type: "paper-action"; action: PaperAction; price?: number }
  | { type: "practice-tick"; price: number }
  | { type: "prime-practice"; unclaimedStroops?: number; price?: number }
  | { type: "complete-paper"; price?: number }
  | { type: "restart-paper" }
  | { type: "return-to-front" }
  | { type: "exit-paper" }
  | { type: "move"; input: Input }
  | { type: "inspect-hatch" }
  | { type: "depart-colonies" }
  | { type: "enter-colony"; colonyId: string; replay?: boolean }
  | { type: "start-practice-exam" }
  | { type: "answer-colony"; choiceIndex: number }
  | { type: "leave-colony" }
  | { type: "open-moon-choice" }
  | { type: "qa-unlock-moons" }
  | { type: "choose-moon"; moonId: MoonId; powerId: MoonPowerId; variantId: string }
  | { type: "start-ragnarok" }
  | { type: "enter-town"; townId: string }
  | { type: "leave-town" }
  | { type: "answer-ragnarok"; choiceIndex: number }
  | { type: "use-moon-ability"; nowMs?: number }
| { type: "arcade-fly-gate"; gateIndex: number }
| { type: "arcade-collect-pickup"; pickupIndex: number }
| { type: "arcade-set-lane"; lane: number }
  | { type: "ticker-spawn"; items: TickerItem[]; now: number }
  | { type: "ticker-collect"; id: string; how: "touch" | "shield"; credited?: number }
  | { type: "ending-next" }
  | { type: "ending-skip-to-credits" }
  | { type: "qa-jump-credits" }
  | { type: "toggle-xoe-guide" }
  | { type: "ask-xoe"; tipId: string; reply: string }
  | { type: "attempt-live-trade" }
  | { type: "attempt-combat" }
  | { type: "attempt-vault-deposit" }

const CONTINUE: Partial<Record<Phase, Phase>> = {
  wake: "missing-pilot",
  "missing-pilot": "auto-battle",
  "auto-battle": "cockpit-invite",
  "cockpit-invite": "cinematic-choice",
  "near-loss": "sis-rescue",
  "sis-rescue": "navigate",
}

export function lessonById(id: string | null) {
  if (!id) return null
  if (id === PRACTICE_EXAM_ID) return buildPracticeExamLesson()
  const step = feesLeverageStepOf(id)
  if (step != null) return buildFeesLeverageStep(step)
  return colonyById(id)
}

export function createOpening(): GameState {
  const pos = { x: WORLD.start.x, y: WORLD.start.y }
  return {
    phase: "pilot-select",
    seen: ["pilot-select"],
    pilotId: null,
    playerName: DEFAULT_NAME,
    characterId: DEFAULT_CHARACTER_ID,
    characterConfirmed: false,
    gender: null,
    genderUnspecified: false,
    chosenClass: null,
    disclaimerConfirmed: false,
    cosmeticId: "ceramic",
    paused: false,
    dialogueMode: "bubble",
    grokOfferOpen: false,
    grokDeclined: false,
    grokConnected: false,
    grokConfigured: false,
    practice: initialPractice(),
    practiceOutcome: null,
    rescued: false,
    pos,
    explored: [tileKey(pos)],
    rejectedLiveActions: 0,
    hatchNoted: false,
    cinematicIndex: 0,
    regionId: "planet-x-terrace",
    clearedColonies: [],
    activeColonyId: null,
    colonyFeedback: null,
    moonId: null,
    activeTownId: null,
    visitedTowns: [],
    qaMoons: false,
    bonusLessonsCleared: [],
    moonPowerId: "none",
    moonPowerVariantId: "none",
    moonAbilityUsed: false,
    moonAbilityUsedAtMs: null,
    frostLockUntilMs: null,
    flareDashUntilMs: null,
    slowMoUntilMs: null,
    flareShieldCharges: 0,
    flareShieldUntilMs: null,
    arcadeLane: 1,
    arcadeScore: 0,
    arcadeCombo: 0,
    arcadePickupCollected: [],
    tickerItems: [],
    tickerScore: 0,
    tickerNote: null,
    tickerPop: null,
    bossThreat: 100,
    bossFocus: 100,
    bossStep: 0,
    bossFeedback: null,
    endingIndex: 0,
    creditsPreview: false,
    xoeGuideOpen: false,
    xoeGuideReply: null,
  }
}

function enter(state: GameState, phase: Phase, patch?: Partial<GameState>): GameState {
  const qaTown = phase === "colony-map" && !patch?.activeTownId && !state.activeTownId ? readQaTown() : null
  const townPatch: Partial<GameState> | null =
    qaTown && isTownId(qaTown)
      ? {
          activeTownId: qaTown,
          visitedTowns: state.visitedTowns.includes(qaTown) ? state.visitedTowns : [...state.visitedTowns, qaTown],
          regionId: qaTown,
        }
      : null
  const regionId: RegionId =
    townPatch?.regionId ??
    patch?.regionId ??
    (phase === "colony-map" || phase === "colony-lesson"
      ? "colony-route"
      : phase === "moon-choice" || phase === "moon-approach"
        ? state.moonId ?? "colony-route"
        : phase === "ragnarok"
          ? "ragnarok-gate"
          : phase === "ending" || phase === "blackout"
            ? "ending"
            : phase === "navigate" ||
                phase === "sis-rescue" ||
                phase === "near-loss" ||
                phase === "practice" ||
                phase === "practice-pause"
              ? "planet-x-terrace"
              : state.regionId)
  return {
    ...state,
    ...patch,
    ...townPatch,
    phase,
    seen: [...state.seen, phase],
    grokConnected: false,
    grokConfigured: false,
    regionId,
    xoeGuideOpen: false,
    xoeGuideReply: null,
  }
}

function rejectLive(state: GameState): GameState {
  return { ...state, rejectedLiveActions: state.rejectedLiveActions + 1 }
}

function pauseForPractice(state: GameState): GameState {
  return enter(state, "practice-pause", {
    paused: true,
    practice: initialPractice(),
    practiceOutcome: null,
  })
}

export function genderChoiceReady(state: GameState): boolean {
  const named = state.gender !== null
  return named !== state.genderUnspecified
}

export function canStart(state: GameState): boolean {
  return (
    state.phase === "pilot-select" &&
    state.characterConfirmed &&
    genderChoiceReady(state) &&
    state.chosenClass !== null &&
    state.disclaimerConfirmed &&
    isUsablePlayerName(state.playerName) &&
    pilotById(state.characterId) !== null &&
    suitById(state.cosmeticId) !== null
  )
}

function beginEnding(state: GameState): GameState {
  return enter(state, "ending", {
    endingIndex: 0,
    creditsPreview: false,
    bossFeedback: null,
    regionId: "ending",
  })
}

/** Moon picker opens after all 10 colonies, or in the ?qa=1 test mode. */
export function moonGateOpen(state: Pick<GameState, "clearedColonies" | "qaMoons">): boolean {
  return state.qaMoons || allColoniesCleared(state.clearedColonies)
}

export function openingReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "set-player-name": {
      if (state.phase !== "pilot-select") return state
      return { ...state, playerName: action.name }
    }
    case "choose-character": {
      if (state.phase !== "pilot-select" || !pilotById(action.characterId)) return state
      return { ...state, characterId: action.characterId, characterConfirmed: true }
    }
    case "choose-class": {
      if (state.phase !== "pilot-select") return state
      return { ...state, chosenClass: action.className }
    }
    case "set-gender": {
      if (state.phase !== "pilot-select" || !GENDERS.includes(action.gender)) return state
      return { ...state, gender: action.gender, genderUnspecified: false }
    }
    case "set-gender-na": {
      if (state.phase !== "pilot-select") return state
      if (action.checked) return { ...state, gender: null, genderUnspecified: true }
      return { ...state, genderUnspecified: false }
    }
    case "confirm-disclaimer": {
      if (state.phase !== "pilot-select") return state
      return { ...state, disclaimerConfirmed: action.confirmed }
    }
    case "begin": {
      if (!canStart(state)) return state
      // Land on the colony map first. The opening story stays available via play-opening
      // (first-steps / pause menu) so practice remains a skippable story beat.
      return enter(state, "colony-map", {
        pilotId: state.characterId,
        playerName: state.playerName.trim(),
        paused: false,
        regionId: "colony-route",
        activeColonyId: null,
        colonyFeedback: null,
      })
    }
    case "play-opening": {
      if (state.phase === "pilot-select" && !canStart(state)) return state
      if (state.phase !== "pilot-select" && state.phase !== "colony-map") return state
      return enter(state, "wake", {
        pilotId: state.characterId ?? state.pilotId,
        playerName: state.playerName.trim(),
        paused: false,
      })
    }
    case "choose-suit": {
      if (state.phase !== "pilot-select" || !suitById(action.cosmeticId)) return state
      return { ...state, cosmeticId: action.cosmeticId }
    }
    case "continue": {
      const next = CONTINUE[state.phase]
      if (!next) return state
      if (next === "navigate") {
        return enter(state, next, { rescued: true, paused: false, regionId: "planet-x-terrace" })
      }
      return enter(state, next, { paused: false })
    }
    case "choose-cinematic": {
      if (state.phase !== "cinematic-choice") return state
      if (action.choice === "skip") return pauseForPractice(state)
      return enter(state, "cinematic", { cinematicIndex: 0, paused: false })
    }
    case "skip-cinematic": {
      if (state.phase !== "cinematic") return state
      return pauseForPractice(state)
    }
    case "next-panel": {
      if (state.phase !== "cinematic") return state
      if (state.cinematicIndex < CINEMATIC_PANELS - 1) {
        return { ...state, cinematicIndex: state.cinematicIndex + 1 }
      }
      return pauseForPractice(state)
    }
    case "set-dialogue-mode":
      return { ...state, dialogueMode: action.mode }
    case "open-grok":
      return { ...state, grokOfferOpen: true, grokConnected: false, grokConfigured: false }
    case "decline-grok":
      return {
        ...state,
        grokOfferOpen: false,
        grokDeclined: true,
        grokConnected: false,
        grokConfigured: false,
      }
    case "resume-practice": {
      if (state.phase !== "practice-pause" || !state.paused) return state
      return enter(state, "practice", { paused: false })
    }
    case "prime-practice": {
      if (state.phase !== "practice-pause" && state.phase !== "practice") return state
      if (state.practice.step > 0 || state.practice.lastAction) return state
      return {
        ...state,
        practice: initialPractice({ unclaimedStroops: action.unclaimedStroops, price: action.price }),
      }
    }
    case "practice-tick": {
      if (state.phase !== "practice" || state.paused) return state
      const practice = applyPracticeTick(state.practice, action.price)
      return { ...state, practice, practiceOutcome: practice.outcome }
    }
    case "paper-action": {
      if (state.phase !== "practice" || state.paused) return state
      const practice = applyPaperAction(state.practice, action.action, action.price)
      return { ...state, practice, practiceOutcome: practice.outcome }
    }
    case "restart-paper": {
      if (state.phase !== "practice" || state.paused) return state
      return { ...state, practice: initialPractice({ price: state.practice.price, unclaimedStroops: state.practice.startXoeStroops - state.practice.practiceLot }), practiceOutcome: null }
    }
    case "return-to-front":
      return createOpening()
    case "exit-paper": {
      if (state.phase !== "practice" || state.paused) return state
      const practice = state.practice.outcome
        ? state.practice
        : { ...state.practice, outcome: "paper-exit" as const }
      return enter(state, "near-loss", {
        practice,
        practiceOutcome: practice.outcome,
        paused: false,
      })
    }
    case "complete-paper": {
      if (state.phase !== "practice" || state.paused) return state
      const practice =
        state.practice.outcome === "liquidated" ||
        state.practice.outcome === "paper-up" ||
        state.practice.outcome === "paper-down"
          ? state.practice
          : finalizePractice(state.practice, action.price)
      return enter(state, "near-loss", {
        practice,
        practiceOutcome: practice.outcome,
        paused: false,
      })
    }
    case "move": {
      if (state.phase !== "navigate") return state
      const pos = moveAlongRoute(state.pos, action.input)
      if (pos.x === state.pos.x && pos.y === state.pos.y) return state
      const key = tileKey(pos)
      const explored = state.explored.includes(key) ? state.explored : [...state.explored, key]
      return { ...state, pos, explored }
    }
    case "inspect-hatch": {
      if (state.phase !== "navigate") return state
      if (state.pos.x !== HATCH_TILE.x || state.pos.y !== HATCH_TILE.y) return state
      return { ...state, hatchNoted: true }
    }
    case "depart-colonies": {
      if (state.phase !== "navigate") return state
      if (!state.hatchNoted) return state
      return enter(state, "colony-map", { regionId: "colony-route", activeColonyId: null, colonyFeedback: null })
    }
    case "enter-colony": {
      if (state.phase !== "colony-map") return state
      if (isFeesLeverageId(action.colonyId)) {
        // Optional bonus lesson: never locked, always replayable, starts at step 1.
        return enter(state, "colony-lesson", {
          activeColonyId: feesLeverageStepId(0),
          colonyFeedback: `${FEES_LEVERAGE_LABEL}. Fly into the right gate · ${FEES_LEVERAGE_STEPS} short steps.`,
          regionId: "colony-route",
          arcadeLane: 1,
          arcadeScore: 0,
          arcadeCombo: 0,
          arcadePickupCollected: [],
        })
      }
      if (!colonyById(action.colonyId)) return state
      const clearedAlready = state.clearedColonies.includes(action.colonyId)
      if (clearedAlready && !action.replay) return state
      if (!clearedAlready && isColonyLocked(action.colonyId, state.clearedColonies)) return state
      return enter(state, "colony-lesson", {
        activeColonyId: action.colonyId,
        colonyFeedback: clearedAlready ? "Replay · race ghost on if enabled." : null,
        regionId: "colony-route",
        arcadeLane: 1,
        arcadeScore: 0,
        arcadeCombo: 0,
        arcadePickupCollected: [],
      })
    }
    case "start-practice-exam": {
      if (state.phase !== "colony-map") return state
      if (!allColoniesCleared(state.clearedColonies)) return state
      return enter(state, "colony-lesson", {
        activeColonyId: PRACTICE_EXAM_ID,
        colonyFeedback: "Practice exam · fly 3 correct mixed gates. Testnet XOE · no real money.",
        regionId: "colony-route",
        arcadeLane: 1,
        arcadeScore: 0,
        arcadeCombo: 0,
        arcadePickupCollected: [],
      })
    }
    case "answer-colony": {
      if (state.phase !== "colony-lesson" || !state.activeColonyId) return state
      if (isFeesLeverageId(state.activeColonyId)) {
        const step = buildFeesLeverageStep(feesLeverageStepOf(state.activeColonyId) ?? 0)
        const choice = step?.choices[action.choiceIndex]
        if (!step || !choice) return state
        if (!choice.ok) return { ...state, colonyFeedback: `Not that one. ${step.teach}` }
        return advanceFeesLeverage(state, 0)
      }
      const colony = colonyById(state.activeColonyId)
      if (!colony) return state
      const choice = colony.choices[action.choiceIndex]
      if (!choice) return state
      if (!choice.ok) {
        return { ...state, colonyFeedback: `Not that one. ${colony.teach}` }
      }
      const cleared = state.clearedColonies.includes(colony.id)
        ? state.clearedColonies
        : [...state.clearedColonies, colony.id]
      return enter(state, "colony-map", {
        clearedColonies: cleared,
        activeColonyId: null,
        colonyFeedback: colony.teach,
        regionId: "colony-route",
      })
    }

    case "ticker-spawn": {
      if (state.phase !== "colony-map" && state.phase !== "colony-lesson") return state
      if (action.items.length === 0 && state.tickerItems.length === 0) return state
      return { ...state, tickerItems: mergeTickerItems(state.tickerItems, action.items, action.now) }
    }
    case "ticker-collect": {
      const item = state.tickerItems.find((it) => it.id === action.id)
      if (!item) return state
      const rest = state.tickerItems.filter((it) => it.id !== action.id)
      const move = `${item.symbol} ${item.pct > 0 ? "+" : ""}${item.pct.toFixed(3)}%`
      let gain = item.points
      let pop: string
      let note: string
      if (item.kind === "orb") {
        const c = action.credited ?? 0
        pop = c > 0 ? formatPlay(c, true) : "cap reached"
        note = c > 0 ? `${move} · Gestalt ${formatPlay(c, true)} · ${formatXoe7(c, true)} testnet` : `${move} · Gestalt · today's cap reached (+${gain} pts)`
      } else if (action.how === "shield") {
        gain = TICKER_SHIELD_BONUS
        pop = "shielded"
        note = `${move} enemy shielded · +${gain} pts. Stay calm in a dip.`
      } else {
        pop = `${gain} pts`
        note = `${move} enemy hit · ${gain} pts. Your XOE is safe. Red units engage.`
      }
      const lesson = state.phase === "colony-lesson"
      return {
        ...state,
        tickerItems: rest,
        tickerScore: Math.max(0, state.tickerScore + gain),
        arcadeScore: lesson ? Math.max(0, state.arcadeScore + gain) : state.arcadeScore,
        tickerNote: note,
        tickerPop: { id: item.id, wx: item.wx, wy: item.wy, lane: item.lane, text: pop, good: item.kind === "orb" || action.how === "shield" },
      }
    }
    case "arcade-set-lane": {
      if (state.phase !== "colony-lesson") return state
      const lane = Math.max(0, Math.min(2, action.lane))
      return { ...state, arcadeLane: lane }
    }
    case "arcade-collect-pickup": {
      if (state.phase !== "colony-lesson" || !state.activeColonyId) return state
      const colony = lessonById(state.activeColonyId)
      if (!colony) return state
      const pickup = colony.pickups[action.pickupIndex]
      if (!pickup) return state
      if (state.arcadePickupCollected.includes(action.pickupIndex)) return state
      return {
        ...state,
        arcadePickupCollected: [...state.arcadePickupCollected, action.pickupIndex],
        arcadeScore: state.arcadeScore + 25,
        arcadeCombo: state.arcadeCombo + 1,
        colonyFeedback: pickup.xoeLine,
      }
    }
    case "arcade-fly-gate": {
      if (state.phase !== "colony-lesson" || !state.activeColonyId) return state
      const colony = lessonById(state.activeColonyId)
      if (!colony) return state
      const gate = colony.gates[action.gateIndex]
      if (!gate) return state
      if (!gate.ok) {
        return {
          ...state,
          arcadeCombo: 0,
          arcadeScore: Math.max(0, state.arcadeScore - 5),
          colonyFeedback: `Wrong gate. ${colony.teach}`,
        }
      }
      const bonus = 50 + state.arcadeCombo * 10
      const nextScore = state.arcadeScore + bonus
      const nextCombo = state.arcadeCombo + 1
      if (isFeesLeverageId(colony.id)) return advanceFeesLeverage(state, bonus)
      if (colony.id === PRACTICE_EXAM_ID) {
        if (nextCombo < 3) {
          return {
            ...state,
            arcadeScore: nextScore,
            arcadeCombo: nextCombo,
            colonyFeedback: `Exam hit ${nextCombo}/3 · +${bonus}. Testnet XOE · no real money.`,
          }
        }
        return enter(state, "colony-map", {
          activeColonyId: null,
          arcadeScore: nextScore,
          arcadeCombo: nextCombo,
          colonyFeedback: `${colony.teach} Exam clear +${bonus}.`,
          regionId: "colony-route",
        })
      }
      const cleared = state.clearedColonies.includes(colony.id)
        ? state.clearedColonies
        : [...state.clearedColonies, colony.id]
      return enter(state, "colony-map", {
        clearedColonies: cleared,
        activeColonyId: null,
        arcadeScore: nextScore,
        arcadeCombo: nextCombo,
        colonyFeedback: `${colony.teach} Arcade clear +${bonus}.`,
        regionId: "colony-route",
      })
    }
    case "leave-colony": {
      if (state.phase !== "colony-lesson") return state
      return enter(state, "colony-map", {
        activeColonyId: null,
        colonyFeedback: null,
        regionId: "colony-route",
      })
    }
    case "qa-unlock-moons":
      return state.qaMoons ? state : { ...state, qaMoons: true }
    case "enter-town": {
      if (state.phase !== "colony-map") return state
      if (!isTownId(action.townId)) return state
      const visited = state.visitedTowns.includes(action.townId)
        ? state.visitedTowns
        : [...state.visitedTowns, action.townId]
      return { ...state, activeTownId: action.townId, visitedTowns: visited, colonyFeedback: null, regionId: action.townId }
    }
    case "leave-town": {
      if (state.phase !== "colony-map") return state
      return { ...state, activeTownId: null, regionId: "colony-route" }
    }
    case "qa-jump-credits": {
      if (state.phase === "blackout") return state
      return enter(state, "ending", {
        endingIndex: 5,
        creditsPreview: true,
        regionId: "ending",
        activeTownId: null,
      })
    }
    case "open-moon-choice": {
      if (state.phase !== "colony-map") return state
      if (!moonGateOpen(state)) return state
      if (state.moonId) {
        return enter(state, "ragnarok", {
          bossThreat: 100,
          bossFocus: 100,
          bossStep: 0,
          bossFeedback: null,
          moonAbilityUsed: false,
          regionId: "ragnarok-gate",
        })
      }
      return enter(state, "moon-choice", { regionId: "colony-route" })
    }
    case "choose-moon": {
      if (state.phase !== "moon-choice") return state
      if (state.moonId) return state
      if (!moonById(action.moonId)) return state
      const powerId = powerById(action.powerId)?.id ?? "none"
      const variant = variantById(powerId, action.variantId)
      const variantId = variant?.id ?? "none"
      return enter(state, "moon-approach", {
        moonId: action.moonId,
        moonPowerId: powerId,
        moonPowerVariantId: variantId,
        moonAbilityUsed: false,
        moonAbilityUsedAtMs: null,
        frostLockUntilMs: null,
        flareDashUntilMs: null,
        slowMoUntilMs: null,
        flareShieldCharges: 0,
        flareShieldUntilMs: null,
        bossThreat: 100,
        bossFocus: 100,
        bossStep: 0,
        bossFeedback: null,
        regionId: action.moonId,
      })
    }
    case "start-ragnarok": {
      if (state.phase !== "colony-map" && state.phase !== "moon-choice" && state.phase !== "moon-approach") return state
      if (!moonGateOpen(state)) return state
      if (!state.moonId) return enter(state, "moon-choice", { regionId: "colony-route" })
      return enter(state, "ragnarok", {
        bossThreat: 100,
        bossFocus: 100,
        bossStep: 0,
        bossFeedback: null,
        moonAbilityUsed: false,
        moonAbilityUsedAtMs: null,
        frostLockUntilMs: null,
        flareDashUntilMs: null,
        slowMoUntilMs: null,
        flareShieldCharges: 0,
        flareShieldUntilMs: null,
        regionId: "ragnarok-gate",
      })
    }
    case "use-moon-ability": {
      if ((state.phase !== "ragnarok" && state.phase !== "moon-approach") || !state.moonId) return state
      const power = powerById(state.moonPowerId)
      const variant = variantById(state.moonPowerId, state.moonPowerVariantId)
      if (!power || !variant || power.id === "none") {
        return { ...state, bossFeedback: "No power equipped for this run." }
      }
      const nowMs = action.nowMs ?? Date.now()
      if (!abilityReady({ power, variant, lastUsedAtMs: state.moonAbilityUsedAtMs, nowMs })) {
        return { ...state, bossFeedback: `${variant.label} cooling down.` }
      }
      if (variant.id === "freeze") {
        return {
          ...state,
          moonAbilityUsed: true,
          moonAbilityUsedAtMs: nowMs,
          frostLockUntilMs: nowMs + variant.durationMs,
          bossFeedback: `Freeze — ${variant.durationMs / 1000}s. Cooldown ${variant.cooldownMs / 1000}s.`,
        }
      }
      if (variant.id === "slow-mo") {
        return {
          ...state,
          moonAbilityUsed: true,
          moonAbilityUsedAtMs: nowMs,
          slowMoUntilMs: nowMs + variant.durationMs,
          bossFeedback: `Slow-Mo — ${variant.durationMs / 1000}s. Cooldown ${variant.cooldownMs / 1000}s.`,
        }
      }
      if (variant.id === "blink") {
        const threat = Math.max(0, state.bossThreat - 20)
        return {
          ...state,
          moonAbilityUsed: true,
          moonAbilityUsedAtMs: nowMs,
          bossThreat: threat,
          bossFeedback: `Blink — skip ahead. Threat drops. Cooldown ${variant.cooldownMs / 1000}s.`,
        }
      }
      if (variant.id === "flare-shield") {
        return {
          ...state,
          moonAbilityUsed: true,
          moonAbilityUsedAtMs: nowMs,
          flareShieldCharges: 1,
          flareShieldUntilMs: nowMs + variant.durationMs,
          bossFeedback: `Flare Shield — blocks one hit. Cooldown ${variant.cooldownMs / 1000}s.`,
        }
      }
      // speed-burst default flare
      return {
        ...state,
        moonAbilityUsed: true,
        moonAbilityUsedAtMs: nowMs,
        flareDashUntilMs: nowMs + variant.durationMs,
        bossFeedback: `Speed Burst — ${variant.durationMs / 1000}s. Cooldown ${variant.cooldownMs / 1000}s.`,
      }
    }
    case "answer-ragnarok": {
      if (state.phase !== "ragnarok") return state
      const item = RAGNAROK_QUESTIONS[state.bossStep]
      if (!item) return beginEnding(state)
      const choice = item.choices[action.choiceIndex]
      if (!choice) return state
      if (choice.ok) {
        const nowMs = Date.now()
        const flared = flareDashActive(state.flareDashUntilMs, nowMs)
        const hit = flared ? 48 : 34
        const threat = Math.max(0, state.bossThreat - hit)
        const step = state.bossStep + 1
        if (threat <= 0 || step >= RAGNAROK_QUESTIONS.length) return beginEnding(state)
        return {
          ...state,
          bossThreat: threat,
          bossStep: step,
          flareDashUntilMs: flared ? null : state.flareDashUntilMs,
          bossFeedback: flared
            ? "Flare Dash strike! Clean hit hits harder."
            : "Clean hit. Keep your keys close, Pilot.",
        }
      }
      const nowMs = Date.now()
      if (frostLockActive(state.frostLockUntilMs, nowMs)) {
        return { ...state, bossFeedback: "Freeze holds — hazards frozen. No focus drain." }
      }
      if (flareShieldActive(state.flareShieldUntilMs, nowMs) && state.flareShieldCharges > 0) {
        return {
          ...state,
          flareShieldCharges: 0,
          flareShieldUntilMs: null,
          bossFeedback: "Flare Shield blocked the hit.",
        }
      }
      const drain = slowMoActive(state.slowMoUntilMs, nowMs) ? 14 : 28
      const focus = Math.max(0, state.bossFocus - drain)
      if (focus <= 0) {
        return { ...state, bossFocus: 40, bossFeedback: "Focus broke. Steady, Pilot." }
      }
      return {
        ...state,
        bossFocus: focus,
        bossFeedback: slowMoActive(state.slowMoUntilMs, nowMs)
          ? "Slow-Mo softens the hit. Focus dips less."
          : "Wrong move. Focus dips.",
      }
    }
    case "ending-next": {
      if (state.phase === "ending") {
        if (state.endingIndex < 5) return { ...state, endingIndex: state.endingIndex + 1 }
        return enter(state, "blackout", { regionId: "ending" })
      }
      return state
    }
    case "ending-skip-to-credits": {
      if (state.phase === "ending" && state.endingIndex < 5) return { ...state, endingIndex: 5 }
      return state
    }
    case "toggle-xoe-guide":
      return { ...state, xoeGuideOpen: !state.xoeGuideOpen, xoeGuideReply: state.xoeGuideOpen ? null : state.xoeGuideReply }
    case "ask-xoe":
      return { ...state, xoeGuideOpen: true, xoeGuideReply: action.reply }
    case "attempt-live-trade":
    case "attempt-combat":
    case "attempt-vault-deposit":
      return rejectLive(state)
    default: {
      const neverAction: never = action
      throw new Error(`Unknown action: ${String(neverAction)}`)
    }
  }
}

/**
 * v18: right answer in the Fees and leverage bonus lesson. Next step, or back to the map when done.
 * Arcade points only; never touches clearedColonies, XOE balances, or the moon gate.
 */
function advanceFeesLeverage(state: GameState, bonus: number): GameState {
  const step = feesLeverageStepOf(state.activeColonyId) ?? 0
  const current = buildFeesLeverageStep(step)
  const teach = current?.teach ?? ""
  const arcadeScore = state.arcadeScore + bonus
  const arcadeCombo = state.arcadeCombo + 1
  if (step + 1 < FEES_LEVERAGE_STEPS) {
    return {
      ...state,
      activeColonyId: feesLeverageStepId(step + 1),
      arcadeScore,
      arcadeCombo,
      arcadeLane: 1,
      arcadePickupCollected: [],
      colonyFeedback: `Step ${step + 1}/${FEES_LEVERAGE_STEPS} right. ${teach}`,
    }
  }
  return enter(state, "colony-map", {
    activeColonyId: null,
    arcadeScore,
    arcadeCombo,
    bonusLessonsCleared: state.bonusLessonsCleared.includes(FEES_LEVERAGE_ID)
      ? state.bonusLessonsCleared
      : [...state.bonusLessonsCleared, FEES_LEVERAGE_ID],
    colonyFeedback: FEES_LEVERAGE_DONE,
    regionId: "colony-route",
  })
}

export function coloniesRemaining(state: GameState): number {
  return COLONIES.length - state.clearedColonies.length
}
