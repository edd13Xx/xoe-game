import { describe, expect, it } from "vitest"
import {
  fetchTickerSnapshot,
  parseSpotAmount,
  readTickerPref,
  writeTickerPref,
  formatTickerPrice,
} from "./live-ticker.ts"

function mem() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v)
    },
  }
}

describe("live ticker", () => {
  it("parses spot and falls back offline without throwing", async () => {
    expect(parseSpotAmount({ data: { amount: "0.42" } })).toBe(0.42)
    expect(parseSpotAmount({})).toBeNull()
    const store = mem()
    writeTickerPref(store, false)
    expect(readTickerPref(store)).toBe(false)
    writeTickerPref(store, true)
    const failing = async () => {
      throw new Error("CORS")
    }
    const snap = await fetchTickerSnapshot(failing as unknown as typeof fetch, store)
    expect(snap.live).toBe(false)
    expect(snap.message).toMatch(/offline/i)
    expect(formatTickerPrice(12345.6)).toMatch(/12/)
  })
})
