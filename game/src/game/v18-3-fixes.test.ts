import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { BACKUP_AI_LABEL } from "./backup-ai.ts"
import { AI_BUILTIN_INDICATOR } from "./brand.ts"
import { BUILD_VERSION } from "./error-log.ts"
import { MAP_NOT_HERE_SAY } from "./map-screen.ts"
import { MAP_OVERLAY_MAX_SHARE, enterChipName } from "./enter-chip.ts"

const css = readFileSync("src/index.css", "utf8")
const read = (p: string) => readFileSync(p, "utf8")
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
/** Player-facing strings only: string literals and JSX text, not code identifiers like XOrbitalMenu. */
const OLD_MENU_COPY = /["'`>][^"'`<]*\bX Orbital\b[^"'`<]*["'`<]/

describe("v18.3 QA fixes", () => {
  it("build id is v18.3", () => {
    expect(BUILD_VERSION).toBe("uoe-2026-11-10-v19")
  })

  it("fix 1: phone map uses a small Enter chip in the Buy/Sell row, not the big Enter bar", () => {
    expect(enterChipName("Colony Wallet")).toBe("Wallet")
    expect(enterChipName("Fees and leverage (bonus)")).toBe("Fees and leverage ★")
    expect(enterChipName("Daily practice")).toBe("Daily practice")
    expect(MAP_OVERLAY_MAX_SHARE).toBe(0.35)
    expect(read("src/ui/ColonyMapView.tsx")).toContain('className="touch-btn primary enter-chip"')
    expect(read("src/ui/LiveTradeHud.tsx")).toContain("{dockExtra}")
    expect(css).toMatch(/@media \(max-width: 480px\)[^{]*\{\s*\.mars-world-shell \.enter-prompt \{ display: none; \}/)
  })

  it("fix 2: pilot card never splits a word", () => {
    expect(css).toMatch(/\.class-name \{ white-space: nowrap; \}/)
    expect(css).toMatch(/\.roster-row\.xo-row \{\s*grid-template-columns: minmax\(0, 1fr\);/)
    expect(read("src/ui/PilotMenu.tsx")).toContain('" xo-row"')
  })

  it("fix 3 + XOE-004: no 'X Orbital' copy and no x-orbital ids anywhere in src", () => {
    for (const f of walk("src").filter((p) => /\.(tsx?|css)$/.test(p) && !p.endsWith(".test.ts"))) {
      const src = read(f)
      expect(OLD_MENU_COPY.test(src), f).toBe(false)
      expect(/x[-_]orbital/i.test(src), f).toBe(false)
    }
    expect(read("src/ui/XOrbitalMenu.tsx")).toContain('"XOE start menu" : "XOE pause menu"')
    expect(read("src/ui/CoverArt.tsx")).toContain('data-cover="unknown-orbital-engine-v6"')
  })

  it("fix 4: built-in answers say 'Built-in AI'", () => {
    expect(BACKUP_AI_LABEL).toBe(AI_BUILTIN_INDICATOR)
    expect(BACKUP_AI_LABEL).toBe("Built-in AI")
  })

  it("fix 5: settings explain the Sound chip vs Music and SFX", () => {
    const music = read("src/ui/MusicSettings.tsx")
    expect(music).toContain("The Sound chip in the header mutes everything. Music and SFX below turn each part on or off.")
    expect(music).not.toContain("Header Music on/off")
    expect(music).not.toContain("(same as header)")
  })

  it("fix 6: voice reminder sits in the page flow under the header, never over the scene", () => {
    const last = css.slice(css.indexOf("/* v18.3 (QA fix 6)"))
    expect(last).toMatch(/\*\/\s*\.voice-reminder \{\s*position: relative;/)
    const app = read("src/App.tsx")
    expect(app.indexOf("<VoiceReminderBanner")).toBeGreaterThan(app.indexOf("</header>"))
    expect(app.indexOf("<VoiceReminderBanner")).toBeLessThan(app.indexOf('id="scene"'))
  })

  it("fix 7: 48px tap targets", () => {
    for (const rule of [
      /\.voice-reminder-actions button \{ min-height: 48px; min-width: 48px; \}/,
      /\.map-open-btn \{ min-height: 48px;/,
      /\.drawer-head \.drawer-close \{ min-height: 48px; \}/,
      /input\[type="range"\] \{ height: 48px;/,
      /select \{ min-height: 48px;/,
      /a\.tap-link \{[^}]*min-height: 48px;/,
    ]) expect(css).toMatch(rule)
    expect(read("src/ui/AccountWalletDrawer.tsx")).toContain('className="tap-link"')
  })

  it("fix 8: map-off-colony line", () => {
    expect(MAP_NOT_HERE_SAY.startsWith("XO: The map works on the colony map. Go there first")).toBe(true)
    expect(MAP_NOT_HERE_SAY).toBe("XO: The map works on the colony map. Go there first, then say “open map.”")
  })
})

describe("XOE-004 lessons: one short line each", () => {
  it("every colony, exam and bonus lesson line is 12 words or fewer", async () => {
    const { COLONIES } = await import("./colonies.ts")
    const { buildPracticeExamLesson } = await import("./practice-exam.ts")
    const { buildFeesLeverageStep, FEES_LEVERAGE_STEPS, FEES_LEVERAGE_LABEL } = await import("./fees-leverage.ts")
    const { wordCount } = await import("./faq.ts")
    const lines = [
      ...COLONIES.map((c) => c.lesson),
      buildPracticeExamLesson().lesson,
      ...Array.from({ length: FEES_LEVERAGE_STEPS }, (_, i) => buildFeesLeverageStep(i)!.lesson.replace(` ${FEES_LEVERAGE_LABEL}.`, "")),
    ]
    expect(lines).toHaveLength(17)
    for (const l of lines) expect(wordCount(l), l).toBeLessThanOrEqual(12)
  })
  it("no in-trade loss nudge on the practice desk", () => {
    expect(read("src/ui/PracticeView.tsx")).not.toContain("Bad move")
  })
})
