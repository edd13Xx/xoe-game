import { describe, expect, it, vi } from "vitest"
import { buildCoachContext, cleanGrokText, coachDecisionKey, requestGrokCoach } from "./grok-coach.ts"
import { coachTip, type CoachInput } from "./pro-desk.ts"

const base: CoachInput = { pos: "long", entry: 10, mark: 10.2, equity: 1000, lots: 5, tp: 11, sl: 9.5, liq: 6, trailPct: null, fills: [] }

/** Fake window pair: `child.parent` is a fake host that can answer. */
function makeWin(answer?: (msg: any, reply: (d: unknown, source?: unknown) => void) => void) {
  const listeners = new Set<(e: any) => void>()
  const parent = {
    postMessage: (msg: any) => answer?.(msg, (d, source) => queueMicrotask(() => listeners.forEach((l) => l({ source: source ?? parent, data: d })))),
  }
  const win: any = { parent, addEventListener: (_: string, f: any) => listeners.add(f), removeEventListener: (_: string, f: any) => listeners.delete(f) }
  return { win, listeners }
}

describe("grok-coach: context", () => {
  it("sends only trade context and computes risk, pnl and last result", () => {
    const ctx = buildCoachContext({ ...base, fills: [{ id: "a", action: "close", realized: -2, fee: 0.1, at: 5 } as any] }, coachTip(base))
    expect(Object.keys(ctx).sort()).toEqual(["emaFast9", "emaSlow21", "entry", "indicatorSignal", "lastResult", "losingStreak", "mark", "priceVsEmaFast", "riskPctOfEquity", "rsi14", "rsiState", "ruleTip", "side", "sizeLots", "state", "stopLoss", "takeProfit", "timeframe", "unrealizedPnlPct"])
    expect(ctx.side).toBe("long"); expect(ctx.state).toBe("open-position")
    expect(ctx.unrealizedPnlPct).toBeCloseTo(2, 5)
    expect(ctx.lastResult).toBe("loss")
    expect(ctx.riskPctOfEquity).not.toBeNull()
    expect(JSON.stringify(ctx)).not.toMatch(/xai|key|XRP/i)
  })
  it("flat desk with order form still builds a context", () => {
    const flat: CoachInput = { ...base, pos: "flat", entry: null, lots: 0, tp: null, sl: null, form: { opening: "short", bracketOn: true, sl: 10.8, lots: 3 } }
    const ctx = buildCoachContext(flat, coachTip(flat))
    expect(ctx.state).toBe("planning-order"); expect(ctx.side).toBe("short"); expect(ctx.entry).toBeNull(); expect(ctx.stopLoss).toBe(10.8)
  })
  it("decision key ignores price ticks but changes with a decision", () => {
    expect(coachDecisionKey({ ...base, mark: 10.2 }, "plan-set")).toBe(coachDecisionKey({ ...base, mark: 10.9 }, "plan-set"))
    expect(coachDecisionKey({ ...base, sl: 9 }, "plan-set")).not.toBe(coachDecisionKey(base, "plan-set"))
  })
})

describe("grok-coach: request and fallbacks (no key, no network)", () => {
  const ctx = buildCoachContext(base, coachTip(base))
  it("standalone (not embedded): no request, resolves null at once", async () => {
    const w: any = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
    w.parent = w
    expect(await requestGrokCoach(ctx, { win: w })).toBeNull()
    expect(w.addEventListener).not.toHaveBeenCalled()
    expect(await requestGrokCoach(ctx, { win: undefined as any })).toBeNull()
  })
  it("embedded host answers: returns the cleaned text", async () => {
    const { win, listeners } = makeWin((msg, reply) => { expect(msg.type).toBe("xoe:coach-request"); reply({ source: "xoe-host", type: "xoe:coach-reply", id: msg.id, ok: true, text: "  Keep your stop.  " }) })
    expect(await requestGrokCoach(ctx, { win })).toBe("Keep your stop.")
    expect(listeners.size).toBe(0)
  })
  it("host says no key (ok:false): null", async () => {
    const { win } = makeWin((msg, reply) => reply({ source: "xoe-host", type: "xoe:coach-reply", id: msg.id, ok: false }))
    expect(await requestGrokCoach(ctx, { win })).toBeNull()
  })
  it("no answer: times out to null", async () => {
    const { win, listeners } = makeWin(() => {})
    expect(await requestGrokCoach(ctx, { win, timeoutMs: 20 })).toBeNull()
    expect(listeners.size).toBe(0)
  })
  it("ignores replies with the wrong id, wrong source or wrong sender", async () => {
    const { win } = makeWin((msg, reply) => {
      reply({ source: "xoe-host", type: "xoe:coach-reply", id: "other", ok: true, text: "nope" })
      reply({ source: "evil", type: "xoe:coach-reply", id: msg.id, ok: true, text: "nope" })
      reply({ source: "xoe-host", type: "xoe:coach-reply", id: msg.id, ok: true, text: "nope" }, {})
    })
    expect(await requestGrokCoach(ctx, { win, timeoutMs: 30 })).toBeNull()
  })
  it("postMessage throwing falls back", async () => {
    const { win } = makeWin(); win.parent.postMessage = () => { throw new Error("blocked") }
    expect(await requestGrokCoach(ctx, { win })).toBeNull()
  })
  it("rejects replies that mention XRP and caps long text", () => {
    expect(cleanGrokText("Try XRP")).toBeNull()
    expect(cleanGrokText(7)).toBeNull()
    expect(cleanGrokText("word ".repeat(100))!.length).toBeLessThanOrEqual(280)
  })
})
