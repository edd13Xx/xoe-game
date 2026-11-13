import { describe, expect, it } from "vitest"
import { formatRsi, priceVolatility, rsi14, rsiBand } from "./rsi.ts"

describe("rsi14", () => {
  it("needs a full window before scoring", () => {
    expect(rsi14([10, 11, 12])).toBeNull()
    expect(rsiBand(null)).toBe("warming")
    expect(formatRsi(null)).toBe("—")
  })

  it("returns 100 for a pure rise and 0 for a pure fall", () => {
    const up = Array.from({ length: 15 }, (_, i) => 8 + i)
    const down = Array.from({ length: 15 }, (_, i) => 20 - i)
    expect(rsi14(up)).toBe(100)
    expect(rsi14(down)).toBe(0)
    expect(rsiBand(100)).toBe("high")
    expect(rsiBand(0)).toBe("low")
  })

  it("measures recent volatility without inventing prices", () => {
    expect(priceVolatility([10, 10, 10])).toBe(0)
    expect(priceVolatility([10, 12, 10])).toBe(2)
  })
})
