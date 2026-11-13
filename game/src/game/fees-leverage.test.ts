import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  FEES_LEVERAGE_ID,
  FEES_LEVERAGE_LABEL,
  FEES_LEVERAGE_STEPS,
  SIM_EXAMPLE,
  buildFeesLeverageStep,
  feesLeverageStepOf,
  isFeesLeverageId,
  leveragePreview,
  leveragePreviewLine,
} from "./fees-leverage.ts"
import { COLONIES, allColoniesCleared } from "./colonies.ts"
import { buildOverworldNodes } from "./overworld.ts"
import { createOpening, lessonById, moonGateOpen, openingReducer, type GameState } from "./opening.ts"
import { createBackupAI } from "./backup-ai.ts"
import { faqSection, wordCount } from "./faq.ts"

const onMap = (): GameState => ({ ...createOpening(), phase: "colony-map" })

describe("Fees and leverage: every number checks out", () => {
  const E = SIM_EXAMPLE
  it("sim example is self-consistent", () => {
    expect(E.margin * E.leverage).toBe(E.position)
    const openFee = (E.position * E.feePct) / 100
    expect(openFee).toBeCloseTo(0.12, 10)
    const roundTrip = openFee * 2
    expect(roundTrip).toBeCloseTo(0.24, 10)
    expect((roundTrip / E.position) * 100).toBeCloseTo(0.24, 10)
  })
  it("break-even ≈ 0.24% (exact solve with the close fee on the exit value is still ~0.24%)", () => {
    const f = E.feePct / 100
    const exact = ((2 * f) / (1 - f)) * 100
    expect(exact).toBeGreaterThan(0.24)
    expect(exact).toBeLessThan(0.241)
    expect(leveragePreview({ margin: 20, leverage: 5, movePct: 0 }).breakEvenPct).toBe(0.24)
  })
  it("5X: a 2% move is 10% of your money, both ways", () => {
    // v18.3: small friendly numbers — $20 at 5X controls $100
    const up = leveragePreview({ margin: 20, leverage: 5, movePct: 2 })
    const down = leveragePreview({ margin: 20, leverage: 5, movePct: -2 })
    expect(up.grossPnl).toBe(2)
    expect(down.grossPnl).toBe(-2)
    expect((up.grossPnl / 20) * 100).toBe(10)
    // after the $0.24 round trip the net is a bit less than 10%
    expect(up.netPnl).toBe(1.76)
    expect(down.netPnl).toBe(-2.24)
  })
  it("5X liquidation ≈ 20% drop; 10X ≈ 10%; 1X never before -100%", () => {
    expect(leveragePreview({ margin: 20, leverage: 5, movePct: -20 }).wipeOutDropPct).toBe(20)
    expect(leveragePreview({ margin: 20, leverage: 5, movePct: -20 }).wipedOut).toBe(true)
    expect(leveragePreview({ margin: 20, leverage: 5, movePct: -19 }).wipedOut).toBe(false)
    expect(leveragePreview({ margin: 10, leverage: 10, movePct: 0 }).wipeOutDropPct).toBe(10)
    expect(leveragePreview({ margin: 100, leverage: 1, movePct: -20 }).wipedOut).toBe(false)
  })
  it("a cushion delays liquidation (20% → 30%) but does not raise gains, and can be lost", () => {
    const plain = leveragePreview({ margin: 20, leverage: 5, movePct: 2 })
    const cushioned = leveragePreview({ margin: 20, leverage: 5, movePct: 2, cushion: 10 })
    expect(cushioned.wipeOutDropPct).toBe(30)
    expect(cushioned.grossPnl).toBe(plain.grossPnl)
    expect(cushioned.netPnl).toBe(plain.netPnl)
    const crash = leveragePreview({ margin: 20, leverage: 5, movePct: -30, cushion: 10 })
    expect(crash.wipedOut).toBe(true)
    expect(crash.netPnl).toBe(-30)
    expect(leveragePreview({ margin: 20, leverage: 5, movePct: -25, cushion: 10 }).wipedOut).toBe(false)
  })
  it("smaller trades are safer, not easier: same break-even %, smaller swings", () => {
    const big = leveragePreview({ margin: 20, leverage: 5, movePct: 2 })
    const small = leveragePreview({ margin: 10, leverage: 5, movePct: 2 })
    expect(small.position).toBe(50)
    expect(small.roundTripFees).toBe(0.12)
    expect(small.breakEvenPct).toBe(big.breakEvenPct)
    expect(Math.abs(small.grossPnl)).toBeLessThan(Math.abs(big.grossPnl))
  })
  it("lesson + FAQ copy states the same (small) numbers", () => {
    const all = Array.from({ length: FEES_LEVERAGE_STEPS }, (_, i) => buildFeesLeverageStep(i)!)
    const text = all.map((s) => `${s.lesson} ${s.teach}`).join(" ") + " " + faqSection("fees").lines.join(" ") + " " + faqSection("leverage").lines.join(" ")
    for (const n of ["$0.12", "$0.24", "0.24%", "5X", "10%", "20%", "30%", "$100", "$20", "$10", "$2", "$50"]) expect(text).toContain(n)
    expect(text).toContain("about 0.3% is a safer number")
    expect(text).toMatch(/fee to open and a fee to close/i)
    expect(text).toMatch(/safer, not easier/i)
    expect(text).toMatch(/does not raise your gains/i)
  })
  it("the old big example is gone from lessons, FAQ and the built-in AI", () => {
    const src = ["src/game/fees-leverage.ts", "src/game/faq.ts", "src/game/companion-corpus.ts"].map((f) => readFileSync(f, "utf8")).join("\n")
    expect(src).not.toMatch(/\$2\.40|\$1,000|\$1\.20|\$200\b/)
  })
  it("every lesson line is 12 words or fewer", () => {
    for (let i = 0; i < FEES_LEVERAGE_STEPS; i++) {
      const line = buildFeesLeverageStep(i)!.lesson.replace(` ${FEES_LEVERAGE_LABEL}.`, "")
      expect(wordCount(line), line).toBeLessThanOrEqual(12)
    }
  })
})

describe("Fees and leverage lesson structure", () => {
  it("6 arcade steps, each with one right gate in a distinct lane and the safety label", () => {
    expect(FEES_LEVERAGE_STEPS).toBe(6)
    for (let i = 0; i < FEES_LEVERAGE_STEPS; i++) {
      const s = buildFeesLeverageStep(i)!
      expect(s.gates.filter((g) => g.ok)).toHaveLength(1)
      expect(new Set(s.gates.map((g) => g.lane)).size).toBe(3)
      expect(s.choices.filter((c) => c.ok)).toHaveLength(1)
      expect(s.lesson).toContain(FEES_LEVERAGE_LABEL)
      expect(s.name).toContain(`${i + 1}/6`)
    }
    expect(FEES_LEVERAGE_LABEL).toMatch(/education only/i)
    expect(FEES_LEVERAGE_LABEL).toMatch(/sim and testnet/i)
    expect(FEES_LEVERAGE_LABEL).toMatch(/not financial advice/i)
  })
  it("never uses Eddie's real numbers from the notes", () => {
    const src = readFileSync("src/game/fees-leverage.ts", "utf8")
    expect(src).not.toMatch(/86\.10|36,?345/)
  })
  it("ids parse safely", () => {
    expect(isFeesLeverageId("fees-leverage")).toBe(true)
    expect(feesLeverageStepOf("fees-leverage:5")).toBe(5)
    expect(feesLeverageStepOf("fees-leverage:6")).toBeNull()
    expect(feesLeverageStepOf("fees")).toBeNull()
    expect(lessonById("fees-leverage:2")?.name).toMatch(/Leverage multiplies/)
  })
  it("keeps the locked 10 story colonies; the bonus dome is optional and never locked", () => {
    expect(COLONIES).toHaveLength(10)
    expect(COLONIES.some((c) => c.id === FEES_LEVERAGE_ID)).toBe(false)
    const node = buildOverworldNodes().find((n) => n.id === FEES_LEVERAGE_ID)
    expect(node?.kind).toBe("bonus")
    expect(node!.x).toBeGreaterThanOrEqual(40)
    expect(node!.x).toBeLessThanOrEqual(1160)
  })
  it("no real leverage trading: the preview is pure math and the module has no trade/network calls", () => {
    const src = readFileSync("src/game/fees-leverage.ts", "utf8") + readFileSync("src/ui/LeveragePreviewPanel.tsx", "utf8")
    expect(src).not.toMatch(/fetch\(|XMLHttpRequest|placeOrder|openPosition|applyPaperAction/)
    expect(leveragePreviewLine(leveragePreview({ margin: 20, leverage: 5, movePct: -20 }), { margin: 20, leverage: 5, movePct: -20 })).toMatch(/wiped out/)
  })
})

describe("Fees and leverage in the reducer", () => {
  it("fly the 6 right gates → back on the map, bonus cleared, story colonies and moons untouched", () => {
    let s = openingReducer(onMap(), { type: "enter-colony", colonyId: FEES_LEVERAGE_ID })
    expect(s.phase).toBe("colony-lesson")
    expect(s.activeColonyId).toBe("fees-leverage:0")
    for (let i = 0; i < FEES_LEVERAGE_STEPS; i++) {
      const lesson = lessonById(s.activeColonyId)!
      const wrong = lesson.gates.findIndex((g) => !g.ok)
      const afterWrong = openingReducer(s, { type: "arcade-fly-gate", gateIndex: wrong })
      expect(afterWrong.activeColonyId).toBe(s.activeColonyId)
      expect(afterWrong.colonyFeedback).toMatch(/^Wrong gate/)
      s = openingReducer(s, { type: "arcade-fly-gate", gateIndex: lesson.gates.findIndex((g) => g.ok) })
    }
    expect(s.phase).toBe("colony-map")
    expect(s.bonusLessonsCleared).toEqual([FEES_LEVERAGE_ID])
    expect(s.clearedColonies).toEqual([])
    expect(allColoniesCleared(s.clearedColonies)).toBe(false)
    expect(moonGateOpen(s)).toBe(false)
    expect(s.colonyFeedback).toMatch(/not financial advice/)
    expect(s.arcadeScore).toBeGreaterThan(0)
  })
  it("mic/choice answers advance too, and replay is always allowed", () => {
    let s = openingReducer(onMap(), { type: "enter-colony", colonyId: FEES_LEVERAGE_ID })
    s = openingReducer(s, { type: "answer-colony", choiceIndex: 0 })
    expect(s.activeColonyId).toBe("fees-leverage:1")
    const back = openingReducer({ ...onMap(), bonusLessonsCleared: [FEES_LEVERAGE_ID] }, { type: "enter-colony", colonyId: FEES_LEVERAGE_ID })
    expect(back.phase).toBe("colony-lesson")
  })
})

describe("Built-in AI answers fees and leverage offline", () => {
  const cases: [string, RegExp][] = [
    ["what is break even with fees", /0\.24%/],
    ["what does 5x leverage do to a 2% move", /10%/],
    ["does a cushion stop liquidation", /further away|delay/i],
    ["are smaller trades easier", /safer, not easier/i],
    ["when do I pay trading fees", /open and once to close/i],
    ["how far can price drop before liquidation at 5x", /20%/],
  ]
  for (const [q, want] of cases) {
    it(q, () => {
      const r = createBackupAI().ask(q)
      expect(r.reply).toMatch(want)
      expect(r.reply).toMatch(/not financial advice/)
    })
  }
})
