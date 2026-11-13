import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { AI_NAME, GAME_FULL_NAME, XOE_IDENTITY_LINE, XOE_SYSTEM_PROMPT } from "./brand.ts"
import { sendLiveXaiGrokMessage } from "./grok-guest.ts"
import { createBackupAI } from "./backup-ai.ts"

describe("v18.2 XOE identity (Grok Bot under the hood, XOE in-game)", () => {
  it("names are single swappable constants", () => {
    expect(GAME_FULL_NAME).toBe("XOE: Unknown Orbital Engine")
    expect(AI_NAME).toBe("Grok Bot")
    expect(XOE_IDENTITY_LINE).toBe("I'm XOE, Unknown Orbital Engine.")
  })

  it("the live Grok system prompt makes it identify as XOE, Unknown Orbital Engine", async () => {
    expect(XOE_SYSTEM_PROMPT).toContain(XOE_IDENTITY_LINE)
    expect(XOE_SYSTEM_PROMPT).toMatch(/Never call yourself Grok, Grok Bot, xAI/)
    let sent = ""
    const fake = (async (_u: string, init: RequestInit) => {
      sent = String(init.body)
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 })
    }) as never
    await sendLiveXaiGrokMessage({ text: "who are you", apiKey: "xai-test-fake", endpoint: "https://example.invalid", model: "grok-4.7" }, fake)
    const body = JSON.parse(sent) as { messages: { role: string; content: string }[] }
    expect(body.messages[0]).toEqual({ role: "system", content: XOE_SYSTEM_PROMPT })
  })

  it("built-in AI answers 'who are you' with the identity line and no stats", () => {
    const ai = createBackupAI()
    for (const q of ["who are you", "what are you?", "Who is XO?"]) {
      const r = ai.ask(q).reply
      expect(r).toContain(XOE_IDENTITY_LINE)
      expect(r).not.toMatch(/\bDEF\b|\bOFF\b|Sentinel|Grok Bot/)
    }
  })

  it("XO's card and stats panel show CLASSIFIED, never stat numbers", () => {
    const menu = readFileSync("src/ui/PilotMenu.tsx", "utf8")
    expect(menu).toContain("XO_CLASS_LINE")
    expect(menu).toContain('if (pilot.id === "xoe") return null')
    const up = readFileSync("src/ui/UpgradeMenu.tsx", "utf8")
    expect(up).toContain("XO_STATS_CLASSIFIED")
  })
})
