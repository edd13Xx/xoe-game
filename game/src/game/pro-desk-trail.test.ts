import { describe, expect, it } from "vitest"
import { moveBracketStop, trailLine, trailStopPrice } from "./pro-desk.ts"

describe("sim trailing stop", () => {
  it("places a first stop the trail distance away", () => {
    expect(trailStopPrice("long", 10, null, 1)).toBe(9.9)
    expect(trailStopPrice("short", 10, null, 2)).toBe(10.2)
  })
  it("ratchets only in the trader's favour", () => {
    expect(trailStopPrice("long", 10.5, 9.9, 1)).toBe(10.395)
    expect(trailStopPrice("long", 9.8, 9.9, 1)).toBeNull()
    expect(trailStopPrice("short", 9.5, 10.2, 2)).toBe(9.69)
    expect(trailStopPrice("short", 10.4, 10.2, 2)).toBeNull()
  })
  it("does nothing when flat or with a bad distance", () => {
    expect(trailStopPrice("flat", 10, null, 1)).toBeNull()
    expect(trailStopPrice("long", 10, null, 0)).toBeNull()
    expect(trailStopPrice("long", Number.NaN, null, 1)).toBeNull()
  })
  it("moves only the open OCO stop leg", () => {
    const book = {
      orders: [
        { id: "a", status: "open", oco: "g", type: "take-profit", price: 11 },
        { id: "b", status: "open", oco: "g", type: "stop", price: 9.9 },
        { id: "c", status: "canceled", oco: "h", type: "stop", price: 9 },
      ],
    }
    const next = moveBracketStop(book, 10.1)
    expect(next.orders.map((o) => o.price)).toEqual([11, 10.1, 9])
    expect(moveBracketStop({ orders: [] }, 10)).toEqual({ orders: [] })
  })
  it("explains itself in plain words", () => {
    expect(trailLine("long", 1)).toMatch(/follows XOE up/)
  })
})
