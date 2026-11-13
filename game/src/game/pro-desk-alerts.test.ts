import { describe, expect, it } from "vitest"
import { MAX_ALERTS, alertLine, checkAlerts, makeAlert, type PriceAlert } from "./pro-desk.ts"

describe("sim price alerts", () => {
  it("picks direction from the current mark", () => {
    expect(makeAlert(1, "10.5", 10, [])).toMatchObject({ price: 10.5, dir: "above", hit: false })
    expect(makeAlert(2, "9.5", 10, [])).toMatchObject({ price: 9.5, dir: "below" })
  })
  it("refuses bad input, the current price, duplicates and too many", () => {
    expect(makeAlert(1, "", 10, [])).toMatch(/above 0/)
    expect(makeAlert(1, "abc", 10, [])).toMatch(/above 0/)
    expect(makeAlert(1, "10", 10, [])).toMatch(/current price/)
    const one = makeAlert(1, "11", 10, []) as PriceAlert
    expect(makeAlert(2, "11", 10, [one])).toMatch(/already/)
    const many = Array.from({ length: MAX_ALERTS }, (_, i) => makeAlert(i, String(11 + i), 10, []) as PriceAlert)
    expect(makeAlert(9, "20", 10, many)).toMatch(/up to/)
  })
  it("fires once when price reaches the level", () => {
    const up = makeAlert(1, "10.5", 10, []) as PriceAlert
    const down = makeAlert(2, "9.5", 10, []) as PriceAlert
    let r = checkAlerts([up, down], 10.2)
    expect(r.fired).toHaveLength(0)
    r = checkAlerts(r.alerts, 10.6)
    expect(r.fired.map((a) => a.id)).toEqual([1])
    r = checkAlerts(r.alerts, 10.7)
    expect(r.fired).toHaveLength(0)
    r = checkAlerts(r.alerts, 9.4)
    expect(r.fired.map((a) => a.id)).toEqual([2])
    expect(alertLine(r.fired[0]!, 9.4)).toMatch(/fell to .* sim/)
  })
})
