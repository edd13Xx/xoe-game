import { describe, expect, it } from "vitest"
import {
  LIVE_GROK_TIMEOUT_MS,
  XAI_KEY_NOT_VALID,
  XAI_NETWORK,
  XAI_NO_CREDITS,
  XAI_RATE_LIMIT,
  XAI_TIMEOUT,
  describeXaiFailure,
  liveStatusText,
  sendLiveXaiGrokMessage,
  xaiErrorText,
} from "./grok-guest.ts"
import { CompanionBrainRouter } from "./companion-brain.ts"
import { relayReachableFromPage } from "./grok-bot-relay.ts"
import { readGrokConnectSettings, writeGrokConnectSettings, DEFAULT_GROK_CONNECT } from "./grok-connect-settings.ts"

const FAKE = "xai-test-fake-0000"
const input = { text: "hi", apiKey: FAKE, endpoint: "https://example.invalid/v1/chat/completions", model: "grok-4.7" }

describe("v18.1 live Grok Bot from a phone", () => {
  it("waits long enough for grok-4.7 (45 s, not 12 s)", () => {
    expect(LIVE_GROK_TIMEOUT_MS).toBe(45_000)
  })

  it("a timeout says 'took too long', not 'network blocked'", async () => {
    const slow = ((_u: string, init: RequestInit) =>
      new Promise((_r, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
      })) as never
    const r = await sendLiveXaiGrokMessage({ ...input, timeoutMs: 20 }, slow)
    expect(r.status).toBe("timeout")
    expect(liveStatusText(r.status)).toBe(XAI_TIMEOUT)
  })

  it("a fetch TypeError reads as a network problem", async () => {
    const down = (async () => {
      throw new TypeError("Load failed")
    }) as never
    const r = await sendLiveXaiGrokMessage(input, down)
    expect(liveStatusText(r.status)).toBe(XAI_NETWORK)
  })

  it("names the real xAI reason: bad key, no credits, rate limit, model", () => {
    expect(describeXaiFailure(400, { code: "invalid-argument", error: "Incorrect API key provided. You can obtain an API key from https://console.x.ai." })).toMatch(
      new RegExp(`^${XAI_KEY_NOT_VALID.replace(/\./g, "\\.")}`),
    )
    expect(describeXaiFailure(403, { error: "Your team has no credits or licenses yet." })).toMatch(/^xAI accepted the key but refused/)
    expect(describeXaiFailure(403, {})).toBe(XAI_NO_CREDITS)
    expect(describeXaiFailure(429, {})).toBe(XAI_RATE_LIMIT)
    // v18.2 (QA N1): a 402 means no credits even when the body never says "credit"
    expect(describeXaiFailure(402, {})).toBe(XAI_NO_CREDITS)
    expect(describeXaiFailure(402, { error: "Payment required" })).toMatch(/^xAI accepted the key but refused/)
    expect(describeXaiFailure(404, { error: "Model not found" })).toMatch(/model/)
    expect(describeXaiFailure(503, {})).toMatch(/trouble/)
  })

  it("never echoes a key or a link from xAI's error text", () => {
    const t = xaiErrorText({ error: `Incorrect API key provided: ${FAKE} see https://console.x.ai/x` })
    expect(t).not.toContain(FAKE)
    expect(t).not.toMatch(/https?:/)
  })

  it("the chat status says why live Grok Bot failed", async () => {
    const brain = new CompanionBrainRouter(
      undefined,
      undefined,
      () => ({ ...DEFAULT_GROK_CONNECT, apiKey: FAKE }),
      async () => ({ ok: false, reply: null, status: "timeout" }),
    )
    const r = await brain.ask("what is leverage")
    expect(r.source).toBe("backup-ai")
    expect(r.liveError).toBe(XAI_TIMEOUT)
    expect(r.status).toContain("Why:")
  })

  it("an https page never tries the http://127.0.0.1 test relay", () => {
    expect(relayReachableFromPage("http://127.0.0.1:18791", "https:")).toBe(false)
    expect(relayReachableFromPage("http://127.0.0.1:18791", "file:")).toBe(true)
    expect(relayReachableFromPage("https://relay.example", "https:")).toBe(true)
  })

  it("a saved key is read back after reload", () => {
    const m = new Map<string, string>()
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
    writeGrokConnectSettings(store, { ...DEFAULT_GROK_CONNECT, apiKey: FAKE })
    expect(readGrokConnectSettings(store).apiKey).toBe(FAKE)
  })
})
