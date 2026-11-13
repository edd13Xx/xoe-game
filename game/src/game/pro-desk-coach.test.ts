import { describe, expect, it } from "vitest"
import { COACH_LABEL, coachTip, losingStreak, type CoachInput } from "./pro-desk.ts"

const base: CoachInput = { pos: "flat", entry: null, mark: 10, equity: 100, lots: 0, tp: null, sl: null, liq: null, trailPct: null, fills: [] }
const long = (o: Partial<CoachInput> = {}): CoachInput => ({ ...base, pos: "long", entry: 10, lots: 5, ...o })
const fill = (id: string, at: number, realized: number, action: "close" | "long" = "close") => ({ id, at, realized, fee: 0.01, action })

describe("Grok Bot desk coach (sim, rules only)", () => {
  it("is labelled as a sim tip", () => {
    expect(COACH_LABEL).toBe("Grok Bot tip (sim)")
  })
  it("explains a basic plan when flat", () => {
    const t = coachTip(base)
    expect(t.id).toBe("flat")
    expect(t.text).toMatch(/stop/)
  })
  it("asks for a stop on an open position without one", () => {
    expect(coachTip(long()).id).toBe("no-stop")
    expect(coachTip(long({ pos: "short" })).text).toMatch(/short has no stop loss/)
  })
  it("changes when a stop is added", () => {
    expect(coachTip(long({ sl: 9.9 })).id).toBe("plan-set")
  })
  it("flags a stop on the wrong side", () => {
    expect(coachTip(long({ sl: 10.2 })).id).toBe("stop-wrong")
    expect(coachTip({ ...base, form: { opening: "long", bracketOn: true, sl: 10.5, lots: 5 } }).id).toBe("form-stop-wrong")
    expect(coachTip({ ...base, form: { opening: "short", bracketOn: true, sl: 9.5, lots: 5 } }).text).toMatch(/sell it goes above/)
  })
  it("warns when risk at the stop is above 2% of sim equity", () => {
    // 50 lots * 0.1 * (10 - 9.5) = $2.5 = 2.5% of $100
    const t = coachTip(long({ lots: 50, sl: 9.5, tp: 10.5 }))
    expect(t.id).toBe("big-risk")
    expect(t.text).toMatch(/2\.5% of sim equity/)
    expect(coachTip({ ...base, form: { opening: "long", bracketOn: true, sl: 9.5, lots: 50 } }).id).toBe("form-big-risk")
    expect(coachTip({ ...base, form: { opening: "long", bracketOn: true, sl: 9.9, lots: 5 } }).id).toBe("form-ready")
  })
  it("reuses the SL→TP gauge for near-stop and near-target", () => {
    expect(coachTip(long({ sl: 9.9, tp: 11, mark: 9.95 })).id).toBe("near-sl")
    expect(coachTip(long({ sl: 9.9, tp: 11, mark: 10.9 })).id).toBe("near-tp")
    expect(coachTip(long({ sl: 9.9, tp: 11, mark: 10.4 })).id).toBe("plan-set")
  })
  it("explains a trailing stop and cautions near sim liquidation", () => {
    expect(coachTip(long({ sl: 9.9, trailPct: 1 })).text).toMatch(/Trailing 1% is on/)
    expect(coachTip(long({ sl: 9.9, liq: 9.7 })).id).toBe("liq-near")
    // a liquidation level on the wrong side of a long is ignored
    expect(coachTip(long({ sl: 9.9, liq: 10.2 })).id).toBe("plan-set")
  })
  it("suggests smaller size after a closed losing streak", () => {
    const fills = [fill("a", 1, 0.5), fill("b", 2, -0.2), fill("c", 3, -0.1), fill("d", 4, 0, "long")]
    expect(losingStreak(fills)).toBe(2)
    const t = coachTip({ ...base, fills })
    expect(t.id).toBe("streak")
    expect(t.text).toMatch(/last 2 closed trades lost/)
    expect(losingStreak([fill("a", 1, -0.5), fill("b", 2, 0.5)])).toBe(0)
  })
  it("is deterministic, plain, and never mentions XRP or placing orders for you", () => {
    const states: CoachInput[] = [base, long(), long({ sl: 9.9 }), long({ sl: 10.2 }), long({ lots: 50, sl: 9.5 }), long({ sl: 9.9, trailPct: 2 })]
    for (const s of states) {
      const a = coachTip(s)
      expect(coachTip(s)).toEqual(a)
      expect(a.text).not.toMatch(/xrp/i)
      expect(a.text.length).toBeLessThan(140)
    }
  })
})
