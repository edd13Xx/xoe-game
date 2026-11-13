import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("DrawerShell a11y + close paths", () => {
  it("supports Esc, backdrop, swipe, close button, and dialog role", () => {
    const src = readFileSync("src/ui/DrawerShell.tsx", "utf8")
    expect(src).toMatch(/Escape/)
    expect(src).toMatch(/aria-modal/)
    expect(src).toMatch(/role="dialog"/)
    expect(src).toMatch(/drawer-close|Close/)
    expect(src).toMatch(/onMouseDown/)
    expect(src).toMatch(/TouchEnd|onTouchEnd/)
    expect(src).toMatch(/focus/)
  })

  it("cover art lives in the unified X Orbital menu (launch mode)", () => {
    const src = readFileSync("src/ui/XOrbitalMenu.tsx", "utf8")
    expect(src).toMatch(/CoverArt/)
    expect(src).toMatch(/launch \? <CoverArt/)
  })

  it("App uses single drawer state from pause menu on play", () => {
    const app = readFileSync("src/App.tsx", "utf8")
    expect(app).toMatch(/openOne/)
    expect(app).toMatch(/XOrbitalMenu/)
    expect(app).not.toMatch(/SettingsDrawer|PauseMenu|StartSetupScreen/)
    expect(app).toMatch(/AccountWalletDrawer/)
    expect(app).toMatch(/drawer === "scores"/)
    expect(app).toMatch(/drawer === "report"/)
    expect(app).not.toMatch(/setScoresOpen/)
    expect(app).not.toMatch(/setReportOpen/)
  })
})
