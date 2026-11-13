import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

describe("cover art v6", () => {
  it("is in-code SVG titled Unknown Orbital Engine with no Project X or vendor logos", () => {
    const src = readFileSync("src/ui/CoverArt.tsx", "utf8")
    expect(src).toContain("Unknown Orbital Engine")
    expect(src).toContain("XOE")
    expect(src).toContain("#7c5cff")
    expect(src).toContain("#0b0d12")
    expect(src).toContain("#a78bfa")
    // visible copy / attrs only (strip block comments)
    const visible = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    expect(visible).not.toMatch(/Project X|ProjectX/i)
    expect(visible).not.toMatch(/xAI|Grok Bot logo|X Corp/i)
    const launch = readFileSync("src/ui/XOrbitalMenu.tsx", "utf8")
    expect(launch).toContain("CoverArt")
    expect(launch).not.toMatch(/xo-front-page-owner/)
  })
})
