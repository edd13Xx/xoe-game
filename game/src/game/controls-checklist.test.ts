import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { GAMEPAD_LEGEND, readGamepadPreference } from "./gamepad-controls.ts"
import { WALK_AWAY_MS } from "./walk-away.ts"
import { DEFAULT_LIVES, RESPAWN_INVINCIBILITY_SEC, TOTAL_LIQUIDATION_MARKER } from "./xoe-lifeblood.ts"
import { PURCHASE_LINES, SHOP_LINE_INTERVAL_MS } from "./shop-lines.ts"
import { CLASS_COMBAT_TABLE } from "./class-stats.ts"

describe("Eddie fix checklist 4–6 + related", () => {
  it("upgrade menu has no + buttons; stats are auto on level-up", () => {
    const src = readFileSync("src/ui/UpgradeMenu.tsx", "utf8")
    expect(src).not.toMatch(/>\s*\+\s*</)
    expect(src).toMatch(/count-up|stat-countup|animateToLevel|automatically/i)
    expect(src).not.toMatch(/onPlus/)
  })

  it("gamepad is off by default with legend; walk-away is 20s", () => {
    expect(readGamepadPreference(null).enabled).toBe(false)
    expect(GAMEPAD_LEGEND.length).toBeGreaterThanOrEqual(4)
    expect(WALK_AWAY_MS).toBe(20_000)
  })

  it("arcade lesson uses click/tap field movement", () => {
    const src = readFileSync("src/ui/ColonyLessonView.tsx", "utf8")
    expect(src).toMatch(/arcade-field/)
    expect(src).toMatch(/setTarget/)
    expect(src).toMatch(/MicChoiceButton/)
  })

  it("two-attempt flow, shield 2s, Total Liquidation marker, shop line", () => {
    expect(DEFAULT_LIVES).toBe(2)
    expect(RESPAWN_INVINCIBILITY_SEC).toBe(2.0)
    expect(TOTAL_LIQUIDATION_MARKER).toBe("Total Liquidation -4.4%")
    expect(PURCHASE_LINES[0]).toBe("Here you go, pilot.")
    expect(SHOP_LINE_INTERVAL_MS).toBe(10000)
    expect(CLASS_COMBAT_TABLE.Recon.healthBase).toBe(75)
    expect(CLASS_COMBAT_TABLE.Sentinel.healthBase).toBe(120)
    expect(CLASS_COMBAT_TABLE.Striker.healthBase).toBe(100)
  })

  it("pilot cards show no stat bars for XO and no spaced X O pronunciation", () => {
    const src = readFileSync("src/ui/PilotMenu.tsx", "utf8")
    // v18.2: XO's class line is CLASSIFIED (Eddie); the old dossier block stays gone
    expect(src).not.toMatch(/CLASSIFIED dossier/)
    expect(src).not.toMatch(/spaced-name/)
    expect(src).not.toMatch(/Spoken as separate letters/)
    const launch = readFileSync("src/ui/XOrbitalMenu.tsx", "utf8")
    expect(launch).not.toMatch(/Spoken X\. O\./)
    expect(launch).not.toMatch(/spaced-name/)
  })
})
