import { describe, expect, it } from "vitest"
import { FAQ_SECTIONS } from "./faq.ts"
import { COLONIES, colonyById } from "./colonies.ts"
import { buildOverworldNodes, chapterLockLabel } from "./overworld.ts"

// v18.3 (XOE-004): lessons are one short line; the full explanation moved to the in-game FAQ.
const FAQ_TEXT = FAQ_SECTIONS.map((s) => s.lines.join(" ")).join(" ")

describe("v7 phishing colony", () => {
  it("adds phishing arcade lesson with paper-only language", () => {
    expect(COLONIES.length).toBeGreaterThanOrEqual(9)
    const c = colonyById("phishing")
    expect(c).toBeTruthy()
    expect(c!.name).toMatch(/Phishing/i)
    expect(c!.gates.some((g) => g.ok)).toBe(true)
    expect(c!.gates.some((g) => !g.ok)).toBe(true)
    const blob = `${c!.lesson} ${c!.teach} ${c!.gates.map((g) => g.label).join(" ")} ${FAQ_TEXT}`
    expect(blob).toMatch(/seed|key/i)
    expect(blob).toMatch(/support|lookalike|URL|phishing/i)
    expect(blob).toMatch(/[Pp]aper|[Pp]ractice/)
    expect(blob).not.toMatch(/TODO|placeholder/i)
  })

  it("fits overworld chapters (last colonies are Ch3)", () => {
    const colonies = buildOverworldNodes().filter((n) => n.kind === "colony")
    expect(colonies.length).toBe(COLONIES.length)
    const phishing = colonies.find((n) => n.id === "phishing")
    expect(phishing).toBeTruthy()
    expect(chapterLockLabel(phishing!)).toMatch(/Ch3 L5/)
  })
})
