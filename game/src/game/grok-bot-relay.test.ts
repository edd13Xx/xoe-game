import { describe, expect, it } from "vitest"
import { GROK_BOT_RELAY_ENABLED, createGrokBotRelay } from "./grok-bot-relay.ts"
import { GROK_STATUS } from "./dialogue.ts"
import { looksLikeXaiKey } from "./grok-live-probe.ts"
import { inRestrictedPreview } from "./sandbox.ts"
import { DEFAULT_GROK_MODEL } from "./grok-connect-settings.ts"
import { tickerStatusText } from "./live-ticker.ts"
import { micUsable } from "../ui/VoiceCommandMic.tsx"

describe("v16 hooks and player-facing copy", () => {
  it("leaves the Grok Bot relay disabled so v16 does not wake it", async () => {
    expect(GROK_BOT_RELAY_ENABLED).toBe(false)
    const r = await createGrokBotRelay().ask("hello")
    expect(r.ok).toBe(false)
    expect(r.reason).toBe("disabled")
    expect(r.reply).toBeNull()
  })

  it("rewrites the Grok Bot card in plain words and expects xai- keys", () => {
    expect(GROK_STATUS).toMatch(/Grok Bot is ready/)
    expect(GROK_STATUS).toMatch(/built-in AI/)
    expect(looksLikeXaiKey("xai-abcdefghij")).toBe(true)
    expect(looksLikeXaiKey("sk-nope")).toBe(false)
    expect(DEFAULT_GROK_MODEL).toBe("grok-4.7")
  })

  it("hides the voice mic in this environment and never flags a load error", () => {
    // jsdom / node: no Web Speech, so the compact HUD button stays hidden
    expect(micUsable()).toBe(false)
    expect(inRestrictedPreview()).toBe(false)
  })

  it("uses a friendlier offline ticker line with a Safari hint when needed", () => {
    expect(tickerStatusText("sim", true, true)).toMatch(/Open in Safari for live prices/)
    expect(tickerStatusText("sim", true, false)).toMatch(/testnet/)
    expect(tickerStatusText("cached", false, true)).toMatch(/Prices paused/)
  })
})
