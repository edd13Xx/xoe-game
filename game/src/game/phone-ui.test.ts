import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

describe("phone-friendly UI", () => {
  it("keeps 48px tap targets, >=16px base font, and safe-area insets", () => {
    const css = readFileSync("src/index.css", "utf8")
    expect(css).toMatch(/font-size:\s*18px/)
    expect(css).toMatch(/min-height:\s*48px/)
    expect(css).toMatch(/safe-area-inset/)
    expect(css).toMatch(/\.joy-base[\s\S]*112px/)
    expect(css).toMatch(/arcade-gate-node[\s\S]*min-height:\s*48px/)
  })

  it("uses play screen + one X Orbital menu with 48px pause control", () => {
    const css = readFileSync("src/index.css", "utf8")
    expect(css).toMatch(/pause-btn/)
    expect(css).toMatch(/xo-menu-overlay/)
    expect(css).toMatch(/safe-area-inset/)
    const app = readFileSync("src/App.tsx", "utf8")
    expect(app).toMatch(/XOrbitalMenu/)
    expect(app).toMatch(/pause-btn/)
  })
})
