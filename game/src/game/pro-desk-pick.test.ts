import { describe, expect, it } from "vitest"
import { pickPrice } from "./pro-desk.ts"

describe("click-to-price on the trade desk (sim)", () => {
  it("switches Market to Limit and fills the price", () => {
    const p = pickPrice(9.95, "bid", "market", "sell", 10)
    expect(p.otype).toBe("limit")
    expect(p.text).toBe("9.950")
    expect(p.side).toBe("buy")
    expect(p.problem).toBeNull()
    expect(p.note).toMatch(/^Limit price set to 9\.950 from the bid\. Buy limit/)
  })
  it("makes an ask above the price a sell limit", () => {
    const p = pickPrice(10.05, "ask", "limit", "buy", 10)
    expect(p).toMatchObject({ otype: "limit", side: "sell", text: "10.050", problem: null })
  })
  it("keeps Stop and fills the trigger with a valid side", () => {
    const up = pickPrice(10.2, "ask", "stop", "sell", 10)
    expect(up).toMatchObject({ otype: "stop", side: "buy", problem: null })
    expect(up.note).toMatch(/^Stop trigger set to 10\.200/)
    const down = pickPrice(9.8, "bid", "stop", "buy", 10)
    expect(down).toMatchObject({ otype: "stop", side: "sell", problem: null })
  })
  it("works for trades-tape prints", () => {
    const p = pickPrice(9.9, "sell", "market", "buy", 10)
    expect(p.note).toMatch(/from the sell print/)
    expect(p.side).toBe("buy")
  })
  it("leaves the side alone at the exact price and explains the problem", () => {
    const p = pickPrice(10, "buy", "limit", "buy", 10)
    expect(p.side).toBe("buy")
    expect(p.problem).toMatch(/below the market/)
    expect(p.note).toMatch(/Use Market/)
  })
  it("uses the book decimals", () => {
    expect(pickPrice(9.95, "bid", "limit", "buy", 10, 2).text).toBe("9.95")
    expect(pickPrice(9.123456, "bid", "limit", "buy", 10, 6).text).toBe("9.123456")
  })
  it("never mentions real money products", () => {
    expect(pickPrice(9.9, "bid", "market", "buy", 10).note).not.toMatch(/xrp/i)
  })
})
