import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { pilotHeaderLabel } from "./pilot-label.ts"
import { HATCH_TILE, WORLD, terraceNextStep } from "./movement.ts"
import { formatChipPrice, tickerModeLine } from "./live-ticker.ts"
import { XOE_SIM_LABEL } from "./xoe-sim-price.ts"
import { LINES } from "./content.ts"

describe("v18 phone-fit helpers", () => {
  it("header never reads 'XO · XO'", () => {
    expect(pilotHeaderLabel("XO", "XO")).toBe("XO")
    expect(pilotHeaderLabel("XO", "xo ")).toBe("XO")
    expect(pilotHeaderLabel("Sentinel", "Eddie")).toBe("Sentinel · Eddie")
    expect(pilotHeaderLabel("XO", "")).toBe("XO")
  })
  it("terrace always names the next step", () => {
    expect(terraceNextStep(WORLD.start, false)).toMatchObject({ suggest: "right" })
    expect(terraceNextStep(WORLD.start, false).text).toMatch(/Move right 9 more times/)
    expect(terraceNextStep({ x: HATCH_TILE.x, y: WORLD.start.y }, false)).toMatchObject({ suggest: "down" })
    expect(terraceNextStep(HATCH_TILE, false)).toMatchObject({ atHatch: true, suggest: null })
    expect(terraceNextStep(HATCH_TILE, false).text).toMatch(/Inspect sealed hatch/)
    expect(terraceNextStep(HATCH_TILE, true).text).toMatch(/Travel to colonies/)
  })
  it("ticker chips fit a 393px row", () => {
    expect(formatChipPrice(75009.24)).toBe("75.0k")
    expect(formatChipPrice(2090.83)).toBe("2,091")
    expect(formatChipPrice(0.28761)).toBe("0.288")
    expect(formatChipPrice(12.345)).toBe("12.35")
    expect(formatChipPrice(0)).toBe("—")
  })
  it("mode line does not double 'testnet'", () => {
    const line = tickerModeLine(XOE_SIM_LABEL, "Simulated walk · offline · testnet")
    expect(line.match(/testnet/g)).toHaveLength(1)
    expect(tickerModeLine(null, "Live · testnet")).toBe("Live · testnet")
  })
  it("QA copy fixes are in", () => {
    expect(LINES.wake.text).toContain("You sense danger.")
    expect(LINES.missing.text).toBe("XO's original pilot is missing — not dead.")
    const report = readFileSync("src/ui/ReportProblemPanel.tsx", "utf8")
    expect(report).toContain('"XOE bug report"')
    expect(report).not.toContain("UOE bug report")
    const pilot = readFileSync("src/ui/PilotMenu.tsx", "utf8")
    expect(pilot).toContain("Start when ready")
    const moon = readFileSync("src/ui/MoonChoiceView.tsx", "utf8")
    expect(moon).toContain("Choosing no power is allowed.")
  })
  it("launch has ONE Grok Bot ON/Disconnect row", () => {
    const menu = readFileSync("src/ui/XOrbitalMenu.tsx", "utf8")
    expect(menu.match(/<GrokHudControls/g)).toHaveLength(1)
  })
})
