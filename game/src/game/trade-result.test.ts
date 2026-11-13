import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  EMPTY_TRACKER,
  LEARN_MORE,
  TIP_MAX_WORDS,
  breakdown,
  detailLines,
  dollars,
  grokTipPrompt,
  FEES_SO_FAR_KEY,
  addFeesSoFar,
  lossTip,
  nextFeesSoFar,
  pct,
  readFeesSoFar,
  resultLines,
  resultTip,
  signedPct,
  winTip,
  trackDesk,
  validateGrokTip,
  type ClosedTrade,
} from "./trade-result.ts"
import { FAQ_SECTIONS, FAQ_REQUIRED_TOPICS, faqForLesson, wordCount } from "./faq.ts"
import { applyPaperAction, applyPracticeTick, initialPractice } from "./practice.ts"

const base: ClosedTrade = {
  side: "long",
  entryCents: 10_000,
  exitCents: 10_000,
  openFeeCents: 0,
  closeFeeCents: 0,
  fundingCents: 0,
  leverage: 1,
  liquidated: false,
  hadStopLoss: false,
  sizeLabel: "10",
  entryPriceMills: 10000,
  exitPriceMills: 10000,
}
const T = (o: Partial<ClosedTrade>): ClosedTrade => ({ ...base, ...o })

describe("trade result: exact cents", () => {
  it("formats cents exactly, no float drift", () => {
    expect(dollars(-24)).toBe("$0.24")
    expect(dollars(10_005)).toBe("$100.05")
    expect(pct(200)).toBe("2%")
    expect(pct(125)).toBe("1.25%")
    expect(pct(60)).toBe("0.6%")
    // 0.1 + 0.2 style drift never reaches the card: everything is integer cents
    const b = breakdown(T({ exitCents: 9_990, openFeeCents: 12, closeFeeCents: 12, fundingCents: 6 }))
    expect(b.netCents).toBe(-10 - 30)
    expect(b.moveAt1xCents + b.leverageEffectCents - b.roundTripFeeCents - b.fundingCents).toBe(b.netCents)
  })
  it("the breakdown adds up with leverage", () => {
    const b = breakdown(T({ leverage: 5, exitCents: 9_800, exitPriceMills: 9800, openFeeCents: 12, closeFeeCents: 12 }))
    expect(b.marginCents).toBe(2_000)
    expect(b.moveCents).toBe(-200)
    expect(b.moveAt1xCents).toBe(-40)
    expect(b.leverageEffectCents).toBe(-160)
    expect(b.moveAt1xCents + b.leverageEffectCents - b.feesCents).toBe(b.netCents)
    expect(b.moveBps).toBe(200)
  })
})

describe("loss tip: Eddie's 4 rules, in order", () => {
  it("(1) fees ≥ 50% of the loss", () => {
    // $100 trade, price flat-ish (−$0.10), fees $0.24 round trip + $0.06 funding = $0.30 of a $0.40 loss
    const tip = lossTip(T({ exitCents: 9_990, exitPriceMills: 9990, openFeeCents: 12, closeFeeCents: 12, fundingCents: 6 }))!
    expect(tip.cause).toBe("fees")
    expect(tip.faq).toBe("fees")
    expect(tip.text).toBe("Fees ate $0.30 of your $0.40 loss.")
  })
  it("(2) mostly the move, leverage above 1x", () => {
    const tip = lossTip(T({ leverage: 5, exitCents: 9_800, exitPriceMills: 9800, openFeeCents: 12, closeFeeCents: 12 }))!
    expect(tip.cause).toBe("leverage")
    expect(tip.faq).toBe("leverage")
    expect(tip.text).toBe("Leverage (borrowed, bigger swings) made a 2% move cost $2.24.")
  })
  it("(3) liquidated (no fees, 1x)", () => {
    const tip = lossTip(T({ liquidated: true, exitCents: 9_560, exitPriceMills: 9560 }))!
    expect(tip.cause).toBe("liquidation")
    expect(tip.faq).toBe("liquidation")
    expect(tip.text).toBe("Liquidated (the game closed it): the move hit your limit.")
  })
  it("(4) no stop loss and loss over 5%", () => {
    const tip = lossTip(T({ exitCents: 9_400, exitPriceMills: 9400 }))!
    expect(tip.cause).toBe("stop-loss")
    expect(tip.faq).toBe("stop-loss")
    expect(tip.text).toBe("A stop loss (auto-sells at limit) could have capped this.")
    // exactly 5% is not "over 5%"
    expect(lossTip(T({ exitCents: 9_500, exitPriceMills: 9500 }))!.cause).toBe("move")
    // with a stop loss, rule 4 does not fire
    expect(lossTip(T({ exitCents: 9_400, hadStopLoss: true }))!.cause).toBe("move")
  })
  it("order: a liquidated trade where fees are ≥ 50% gets the fees tip (rule 1 first)", () => {
    const tip = lossTip(T({ liquidated: true, exitCents: 9_990, openFeeCents: 20, closeFeeCents: 20 }))!
    expect(tip.cause).toBe("fees")
  })
  it("profit or break-even: no LOSS tip; the card says You won / broke even with the win tip", () => {
    const win = T({ exitCents: 10_050, exitPriceMills: 10050 })
    expect(lossTip(win)).toBeNull()
    expect(resultLines(win)).toEqual(["You won $0.50", "The price moved your way; this desk has no fees. Learn more."])
    expect(lossTip(T({}))).toBeNull()
    expect(resultLines(T({}))).toEqual(["You broke even: $0.00", "No gain, no loss: the price ended where it started. Learn more."])
  })
  it("fallback (none of the 4 rules) is exactly XO's line, for longs and shorts", () => {
    const long = lossTip(T({ exitCents: 9_990, exitPriceMills: 9990 }))!
    const short = lossTip(T({ side: "short", exitCents: 10_010, exitPriceMills: 10010 }))!
    for (const tip of [long, short]) {
      expect(tip.cause).toBe("move")
      expect(`${tip.text} ${LEARN_MORE}`).toBe("The price moved against your trade. Learn more.")
    }
  })
  it("every tip + Learn more is 12 words or fewer", () => {
    const cases = [
      T({ exitCents: 9_990, openFeeCents: 12, closeFeeCents: 12, fundingCents: 6 }),
      T({ leverage: 10, exitCents: 1_000, exitPriceMills: 1000, entryPriceMills: 10000 }),
      T({ liquidated: true, exitCents: 9_560 }),
      T({ exitCents: 9_000 }),
      T({ exitCents: 9_990 }),
    ]
    for (const c of cases) {
      const tip = lossTip(c)!
      expect(wordCount(`${tip.text} ${LEARN_MORE}`), tip.text).toBeLessThanOrEqual(TIP_MAX_WORDS)
    }
  })
})

describe("result card", () => {
  const loss = T({ exitCents: 9_400, exitPriceMills: 9400 })
  it("collapsed = exactly 2 lines: net result + one tip", () => {
    const lines = resultLines(loss, lossTip(loss)!)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe("You lost $6.00")
    expect(lines[1]).toBe("A stop loss (auto-sells at limit) could have capped this. Learn more.")
  })
  it("Details shows the full breakdown and it adds up", () => {
    const d = detailLines(T({ leverage: 5, exitCents: 9_800, exitPriceMills: 9800, openFeeCents: 12, closeFeeCents: 12, fundingCents: 6 }))
    const txt = d.join("\n")
    expect(txt).toContain("Entry price: $10.000 avg (bought for $100.00).")
    expect(txt).toContain("Exit price: $9.800 avg (sold for $98.00).")
    expect(txt).toContain("Price move: −$2.00 (2% down).")
    expect(txt).toContain("Position size: 10 XOE long, $100.00 at entry.")
    expect(txt).toContain("Leverage used (borrowed power, bigger swings): 5x. Your money in: $20.00.")
    expect(txt).toContain("Move at 1x: −$0.40 · leverage effect: −$1.60.")
    expect(txt).toContain("Round-trip fees (open + close): −$0.24.")
    expect(txt).toContain("Funding fees (holding fee): −$0.06.")
    expect(txt).toContain("Liquidated (the game closed it): no.")
    expect(txt).toContain("Stop loss (auto-sells at a set loss): none.")
    expect(txt).toContain("Take profit (auto-sells at a set win): none.")
    expect(txt).toContain("Net: −$2.30 (−11.5% of your money in) = −$0.40 −$1.60 −$0.24 −$0.06.")
    expect(txt).toContain("Fees so far: $0.30.")
    expect(txt).toContain("Testnet XOE · no real money.")
    expect(txt).not.toMatch(/paper trading|paper only/i)
  })
  it("the card component is collapsed by default, renders 2 lines, and Details toggles", () => {
    const src = readFileSync("src/ui/TradeResultCard.tsx", "utf8")
    expect(src).toContain("const [open, setOpen] = useState(false)")
    expect((src.match(/data-line="\d"/g) ?? []).length).toBe(2)
    expect(src).toContain('{open ? "Hide" : "Details"}')
    expect(src).toContain("{open ? (")
    expect(src).toContain('data-trade-details="1"')
  })
})

describe("close detection on the sim desk", () => {
  it("no card while the trade is open; exactly one when it closes; one tip max", () => {
    let d = initialPractice({ unclaimedStroops: 0, price: 10 })
    let tr = EMPTY_TRACKER
    const step = (next: typeof d) => {
      const r = trackDesk(tr, d, next)
      tr = r.tracker
      d = next
      return r.closed
    }
    expect(step(applyPaperAction(d, "buy", 10))).toBeNull()
    expect(tr.lots).toBe(1)
    // price drops 1% while open: nothing fires
    expect(step(applyPracticeTick(d, 9.9))).toBeNull()
    expect(step(applyPracticeTick(d, 9.92))).toBeNull()
    const closed = step(applyPaperAction(d, "sell", 9.92))!
    expect(closed).toBeTruthy()
    expect(closed.entryCents).toBe(100)
    expect(closed.exitCents).toBe(99)
    expect(resultLines(closed)[0]).toBe("You lost $0.01")
    // nothing else fires after the close (one card / one tip per trade)
    expect(step(applyPracticeTick(d, 9.5))).toBeNull()
    expect(tr).toEqual(EMPTY_TRACKER)
  })
  it("liquidation closes the trade with the liquidated flag", () => {
    let d = initialPractice({ unclaimedStroops: 0, price: 10 })
    let tr = EMPTY_TRACKER
    let r = trackDesk(tr, d, (d = applyPaperAction(d, "buy", 10)))
    tr = r.tracker
    const prev = d
    const next = applyPracticeTick(d, 9.5, 1)
    r = trackDesk(tr, prev, next)
    expect(r.closed?.liquidated).toBe(true)
    expect(lossTip(r.closed!)!.cause).toBe("liquidation")
  })
})

describe("Grok Bot reword (when connected)", () => {
  const tip = lossTip(T({ exitCents: 9_990, openFeeCents: 12, closeFeeCents: 12, fundingCents: 6 }))!
  it("prompt says new player, 1 short sentence, same cause and numbers", () => {
    const p = grokTipPrompt(tip)
    expect(p).toMatch(/new to trading/i)
    expect(p).toMatch(/Explain like they are new, in 1 short sentence/)
    expect(p).toContain("$0.30")
    expect(p).toContain("$0.40")
    expect(p).toMatch(/same cause \(fees\)/)
  })
  it("accepts a 1-sentence reword with the same cause and numbers", () => {
    expect(validateGrokTip("Fees took $0.30 of your $0.40 loss.", tip)).toBe("Fees took $0.30 of your $0.40 loss.")
  })
  it("falls back when numbers change or drop, cause changes, 2 sentences, or too long", () => {
    expect(validateGrokTip("Fees took $0.31 of your $0.40 loss.", tip)).toBeNull()
    expect(validateGrokTip("Fees took most of your loss.", tip)).toBeNull()
    expect(validateGrokTip("Leverage cost $0.30 of your $0.40.", tip)).toBeNull()
    expect(validateGrokTip("Fees took $0.30. Your loss was $0.40.", tip)).toBeNull()
    expect(validateGrokTip("Fees quietly took a whopping $0.30 out of your total $0.40 loss today.", tip)).toBeNull()
    expect(validateGrokTip("", tip)).toBeNull()
    expect(validateGrokTip(null, tip)).toBeNull()
  })
})

describe("FAQ", () => {
  it("has the 5 required topics plus stop loss and liquidation", () => {
    const ids = FAQ_SECTIONS.map((s) => s.id)
    for (const t of [...FAQ_REQUIRED_TOPICS, "stop-loss", "liquidation"]) expect(ids).toContain(t)
  })
  it("fees section keeps the exact funding phrase and the small example", () => {
    const fees = FAQ_SECTIONS.find((s) => s.id === "fees")!.lines.join(" ")
    expect(fees).toContain("about 0.3% is a safer number")
    expect(fees).toContain("$100")
    expect(fees).toContain("$0.24")
    expect(fees).toContain("0.24%")
    expect(fees).not.toContain("$2.40 on $1,000")
  })
  it("moons say exactly what Eddie asked", () => {
    const m = FAQ_SECTIONS.find((s) => s.id === "moons")!.lines.join(" ")
    expect(m).toContain("Sol has Flare Dash, a burst of speed.")
    expect(m).toContain("Xelm has Frost Lock, which freezes time for 3s.")
    expect(m).toContain("Powers are optional.")
  })
  it("rewards use only spec §9 numbers", () => {
    const r = FAQ_SECTIONS.find((s) => s.id === "rewards")!.lines.join(" ")
    for (const n of ["0.2222", "1.1110", "0.0444", "0.4444", "888", "200 / 150 / 120 / 100 / 80 / 70 / 60 / 45 / 35 / 28", "75"]) expect(r).toContain(n)
  })
  it("Learn more maps lessons to the right section", () => {
    expect(faqForLesson("fees-leverage:0")).toBe("fees")
    expect(faqForLesson("fees-leverage:2")).toBe("leverage")
    expect(faqForLesson("fees-leverage:3")).toBe("liquidation")
    expect(faqForLesson("wallet")).toBe("basics")
  })
  it("no paper-trading wording", () => {
    const all = FAQ_SECTIONS.map((s) => s.lines.join(" ")).join(" ")
    expect(all).not.toMatch(/paper trading|paper only/i)
  })
})

// ---------------------------------------------------------------------------
// Eddie 11:38 AM CT (locked): Details always lists everything, exact and adding up; win tip; fees so far.
// ---------------------------------------------------------------------------
const money = (m: string) => (m.startsWith("−") ? -1 : 1) * Math.round(Number(m.replace(/[^\d.]/g, "")) * 100)
/** Parse "Net: ±$N (±P% …) = ±$A ±$B −$C −$D." and check N = A + B − C − D. */
function netAddsUp(lines: string[]): { net: number; parts: number[]; pctText: string } {
  const l = lines.find((x) => x.startsWith("Net: "))!
  const m = l.match(/^Net: ([+−]\$\d+\.\d\d) \(([+−][\d.]+%) of your money in\) = ([+−]\$\d+\.\d\d) ([+−]\$\d+\.\d\d) (−\$\d+\.\d\d) (−\$\d+\.\d\d)\.$/)!
  expect(m, l).toBeTruthy()
  const parts = [m[3], m[4], m[5], m[6]].map(money)
  expect(parts.reduce((a, b) => a + b, 0)).toBe(money(m[1]))
  return { net: money(m[1]), parts, pctText: m[2] }
}
const ALWAYS = [/^Entry price: \$\d+\.\d{3} /, /^Exit price: \$\d+\.\d{3} /, /^Price move: /, /^Position size: /, /^Leverage used /, /^Round-trip fees /, /^Funding fees /, /^Liquidated \(the game closed it\): (yes|no)\.$/, /^Stop loss .*: (none|hit|set, not hit)\.$/, /^Take profit .*: (none|hit|set, not hit)\.$/, /^Net: /, /^Fees so far: \$\d+\.\d\d\.$/]

describe("11:38: Details always includes everything, and it adds up", () => {
  const cases: [string, ClosedTrade][] = [
    ["win", T({ leverage: 2, exitCents: 10_300, exitPriceMills: 10300, openFeeCents: 12, closeFeeCents: 12, fundingCents: 6 })],
    ["loss", T({ leverage: 5, exitCents: 9_800, exitPriceMills: 9800, openFeeCents: 12, closeFeeCents: 12, fundingCents: 6 })],
    ["liquidation", T({ liquidated: true, exitCents: 9_560, exitPriceMills: 9560 })],
    ["fees-only (flat price)", T({ openFeeCents: 12, closeFeeCents: 12, fundingCents: 6 })],
  ]
  for (const [name, t] of cases) {
    it(`${name}: every line is there and the net adds up`, () => {
      const d = detailLines(t, 123)
      for (const re of ALWAYS) expect(d.some((l) => re.test(l)), String(re)).toBe(true)
      const b = breakdown(t)
      const r = netAddsUp(d)
      expect(r.net).toBe(b.netCents)
      expect(b.moveAt1xCents + b.leverageEffectCents - b.roundTripFeeCents - b.fundingCents).toBe(b.netCents)
      expect(d).toContain("Fees so far: $1.23.")
    })
  }
  it("exact numbers per case", () => {
    const [win, loss, liq, flat] = cases.map(([, t]) => breakdown(t))
    expect([win.netCents, win.marginCents, win.netBps]).toEqual([270, 5_000, 540]) // +$2.70 on $50.00 in = +5.4%
    expect([loss.netCents, loss.marginCents, loss.netBps]).toEqual([-230, 2_000, -1150]) // −$2.30 on $20.00 = −11.5%
    expect([liq.netCents, liq.netBps]).toEqual([-440, -440]) // −$4.40 on $100.00 = −4.4%
    expect([flat.moveCents, flat.netCents, flat.netBps]).toEqual([0, -30, -30]) // fees only: −$0.30 = −0.3%
    expect(detailLines(cases[2][1])).toContain("Liquidated (the game closed it): yes.")
    expect(detailLines(cases[2][1])[1]).toBe("Exit price: $9.560 avg (closed by liquidation for $95.60).")
  })
  it("net % is the net over your own money in, signed", () => {
    expect(signedPct(540)).toBe("+5.4%")
    expect(signedPct(-1150)).toBe("−11.5%")
    expect(signedPct(-30)).toBe("−0.3%")
    const d = detailLines(cases[0][1])
    expect(netAddsUp(d).pctText).toBe("+5.4%")
    // short side: price down is a win for a short
    const s = breakdown(T({ side: "short", exitCents: 9_900, exitPriceMills: 9900 }))
    expect([s.moveCents, s.netCents, s.netBps]).toEqual([100, 100, 100])
  })
  it("stop loss / take profit lines say hit, set-not-hit, or none", () => {
    const d = detailLines(T({ hadStopLoss: true, stopLossHit: true, hadTakeProfit: true, exitCents: 9_500 }))
    expect(d).toContain("Stop loss (auto-sells at a set loss): hit.")
    expect(d).toContain("Take profit (auto-sells at a set win): set, not hit.")
  })
})

describe("11:38: running fee total across trades", () => {
  it("adds each trade's round trip + funding, stored under the new xoe.* key", () => {
    const mem = new Map<string, string>()
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    expect(FEES_SO_FAR_KEY).toBe("xoe.feesSoFar.v1")
    expect(readFeesSoFar(store)).toBe(0)
    const a = T({ openFeeCents: 12, closeFeeCents: 12, fundingCents: 6 }) // $0.30
    const b = T({ exitCents: 10_200, exitPriceMills: 10200, openFeeCents: 6, closeFeeCents: 7 }) // $0.13
    expect(addFeesSoFar(store, a)).toBe(30)
    expect(addFeesSoFar(store, b)).toBe(43)
    expect(readFeesSoFar(store)).toBe(43)
    expect(mem.get("xoe.feesSoFar.v1")).toBe("43")
    expect(nextFeesSoFar(43, T({}))).toBe(43) // the map desk has no fees: total unchanged
    expect(detailLines(b, 43)).toContain("Fees so far: $0.43.")
    // bad stored value never breaks the card
    mem.set(FEES_SO_FAR_KEY, "not json")
    expect(readFeesSoFar(store)).toBe(0)
  })
})

describe("11:38: win tip names the biggest cause (max 1 tip)", () => {
  it("fees > 0 → Fees took $X of your $Y win (Y before fees)", () => {
    const t = T({ exitCents: 10_100, exitPriceMills: 10100, openFeeCents: 12, closeFeeCents: 12 })
    const tip = winTip(t)!
    expect(tip.cause).toBe("win-fees")
    expect(resultLines(t)).toEqual(["You won $0.76", "Fees took $0.24 of your $1.00 win. Learn more."])
    expect(tip.numbers).toEqual(["$0.24", "$1.00"])
  })
  it("no fees + leverage → leverage line; no fees at 1x → the honest beginner line", () => {
    expect(resultTip(T({ leverage: 5, exitCents: 10_200, exitPriceMills: 10200 })).text).toBe("Leverage (borrowed, bigger swings) made a 2% move win $2.00.")
    const plain = resultTip(T({ exitCents: 10_050, exitPriceMills: 10050 }))
    expect(plain.cause).toBe("win")
    expect(`${plain.text} ${LEARN_MORE}`).not.toMatch(/^Nice trade/)
  })
  it("every win/loss tip + Learn more is 12 words or fewer, and exactly one per trade", () => {
    const all = [
      T({ exitCents: 10_100, openFeeCents: 12, closeFeeCents: 12 }),
      T({ leverage: 5, exitCents: 10_200, exitPriceMills: 10200 }),
      T({ exitCents: 10_050 }),
      T({}),
      T({ exitCents: 9_990 }),
      T({ side: "short", exitCents: 10_010 }),
    ]
    for (const t of all) {
      const lines = resultLines(t)
      expect(lines).toHaveLength(2)
      expect(lines[1].match(/Learn more\./g)).toHaveLength(1)
      expect(wordCount(lines[1]), lines[1]).toBeLessThanOrEqual(TIP_MAX_WORDS)
    }
  })
  it("Grok reword of a win tip keeps the cause and numbers", () => {
    const tip = winTip(T({ exitCents: 10_100, openFeeCents: 12, closeFeeCents: 12 }))!
    expect(validateGrokTip("Fees took $0.24 from your $1.00 win.", tip)).toBe("Fees took $0.24 from your $1.00 win.")
    expect(validateGrokTip("Fees took $0.25 from your $1.00 win.", tip)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// QA bug (1:08 PM): at 1x with $0 fees, net % must equal move % (same fill-weighted cent amounts).
// Root cause was (1) move % from the avg prices instead of the card's cents, and (2) each $1 lot was
// rounded to whole cents (up to 0.5% error per fill). Now fills sum exactly and round once at the close.
// ---------------------------------------------------------------------------
function rng(seed: number) {
  let x = seed >>> 0
  return () => ((x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0), x / 2 ** 32)
}
const r3 = (n: number) => Math.round(n * 1000) / 1000
const pctOf = (l: string, re: RegExp) => Number((l.match(re) || ["", "NaN"])[1])

function playTrade(fills: { buy: number[]; sell: number[] }) {
  let d = initialPractice({ unclaimedStroops: 0, price: fills.buy[0] })
  let tr = EMPTY_TRACKER
  let closed: ClosedTrade | null = null
  const got = { buy: [] as number[], sell: [] as number[] } // the fills the desk actually made
  const step = (next: typeof d) => {
    if (next.step > d.step && next.lastFillPrice != null && !closed && (next.lastAction === "buy" || (next.lastAction === "sell" && tr.lots > 0))) got[next.lastAction].push(next.lastFillPrice)
    const r = trackDesk(tr, d, next)
    tr = r.tracker
    d = next
    if (r.closed) closed = r.closed
  }
  for (const p of fills.buy) step(applyPaperAction(applyPracticeTick(d, p), "buy", p))
  for (const p of fills.sell) step(applyPaperAction(applyPracticeTick(d, p), "sell", p))
  return { t: closed as ClosedTrade | null, got }
}

describe("QA 1:08 PM: net % = move % at 1x with $0 fees", () => {
  it("the reported case: 5 lots bought ~$10.124, sold ~$10.382 → move % and net % match", () => {
    const { t } = playTrade({ buy: [10.11, 10.12, 10.124, 10.13, 10.136], sell: [10.38, 10.381, 10.382, 10.383, 10.384] })
    if (!t) throw new Error("no close")
    expect(t).toBeTruthy()
    const d = detailLines(t)
    const move = pctOf(d.find((l) => l.startsWith("Price move:"))!, /\(([\d.]+)% (?:up|down)\)/)
    const net = pctOf(d.find((l) => l.startsWith("Net:"))!, /\([+−]([\d.]+)% of your money in\)/)
    expect(Math.abs(net - move)).toBeLessThanOrEqual(0.01)
    // totals are within half a cent of the exact fill sums (rounded once, not per fill)
    const exactIn = (10.11 + 10.12 + 10.124 + 10.13 + 10.136) * 0.1 * 100
    const exactOut = (10.38 + 10.381 + 10.382 + 10.383 + 10.384) * 0.1 * 100
    expect(Math.abs(t.entryCents - exactIn)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(t.exitCents - exactOut)).toBeLessThanOrEqual(0.5)
  })
  it("property: 500 random multi-fill 1x / $0-fee trades (fixed seed) → |net% − move%| ≤ 0.01 points", () => {
    const rand = rng(1138)
    let checked = 0
    for (let i = 0; i < 500; i++) {
      const lots = 1 + Math.floor(rand() * 12)
      const start = 5 + rand() * 15 // the sim price is clamped to $5–$20
      const buy = Array.from({ length: lots }, () => r3(Math.min(20, Math.max(5, start * (1 + (rand() - 0.5) * 0.02)))))
      const drift = (rand() - 0.5) * 0.08 // stays inside the −4.4% Total Liquidation line most of the time
      const sell = Array.from({ length: lots }, () => r3(Math.min(20, Math.max(5, start * (1 + drift + (rand() - 0.5) * 0.02)))))
      const { t, got } = playTrade({ buy, sell })
      if (!t || t.liquidated) continue
      const b = breakdown(t)
      expect(b.feesCents).toBe(0)
      expect(t.leverage).toBe(1)
      const d = detailLines(t)
      const move = pctOf(d.find((l) => l.startsWith("Price move:"))!, /\(([\d.]+)% (?:up|down)\)/)
      const netLine = d.find((l) => l.startsWith("Net:"))!
      const net = pctOf(netLine, /\([+−]([\d.]+)% of your money in\)/)
      expect(Math.abs(net - move), `${netLine} vs move ${move}%`).toBeLessThanOrEqual(0.01)
      // and the $ figures agree: net $ = move $ at 1x with $0 fees
      expect(b.netCents).toBe(b.moveCents)
      // dollars are within half a cent of the exact fill sums
      const exactIn = got.buy.reduce((a, p) => a + p * 10, 0)
      const exactOut = got.sell.reduce((a, p) => a + p * 10, 0)
      expect(Math.abs(t.entryCents - exactIn)).toBeLessThanOrEqual(0.5 + 1e-6)
      expect(Math.abs(t.exitCents - exactOut)).toBeLessThanOrEqual(0.5 + 1e-6)
      checked++
    }
    expect(checked).toBeGreaterThan(300)
  })
})
