import { existsSync, readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length

describe("v12: one X Orbital menu (launch + pause)", () => {
  it("old Start/Setup, Pause menu and Settings drawer are gone (no duplicate UI)", () => {
    for (const f of ["StartSetupScreen", "PauseMenu", "SettingsDrawer", "LocalLaunch", "TitleFadeOverlay"]) {
      expect(existsSync(`src/ui/${f}.tsx`)).toBe(false)
    }
    const app = readFileSync("src/App.tsx", "utf8")
    expect(count(app, /<XOrbitalMenu\b/g)).toBe(1)
    expect(app).toMatch(/useState<MenuMode \| null>/)
    expect(app).toMatch(/setMenu\("launch"\)/)
    expect(app).toMatch(/setMenu\("pause"\)/)
    expect(app).not.toMatch(/screen === "setup"/)
  })

  it("Grok Bot key box / ON-OFF / Disconnect render in exactly one place in the UI", () => {
    const ui = readdirSync("src/ui").filter((f) => f.endsWith(".tsx") && f !== "ShotHarness.tsx")
    const users = (tag: string) => ui.filter((f) => readFileSync(`src/ui/${f}`, "utf8").includes(`<${tag}`))
    expect(users("GrokFirstRunPanel")).toEqual(["XOrbitalMenu.tsx"])
    expect(users("GrokConnectSettingsPanel")).toEqual(["XOrbitalMenu.tsx"])
    expect(users("GrokHudControls")).toEqual(["XOrbitalMenu.tsx"])
    const menu = readFileSync("src/ui/XOrbitalMenu.tsx", "utf8")
    expect(count(menu, /<GrokHudControls\b/g)).toBe(1)
  })

  it("holds everything from Start/Setup + pause + Upgrade & Shop", () => {
    const menu = readFileSync("src/ui/XOrbitalMenu.tsx", "utf8")
    for (const needle of [
      "{GAME_FULL_NAME}",
      "Now, in the palm of your hands.",
      "CoverArt",
      "<PilotMenu",
      "<MusicSettings",
      "<UpgradeMenu",
      "<ShopView",
      "<VoiceCommandMic",
      '"scores"',
      '"tutorial"',
      '"report"',
      '"paper"',
      '"market"',
      '"ask-grok"',
      '"wallet"',
      "Resume",
      "Quit to start",
    ]) {
      expect(menu).toContain(needle)
    }
  })
})
