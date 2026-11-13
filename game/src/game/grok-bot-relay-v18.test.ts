import { describe, expect, it } from "vitest"
import {
  GROK_BOT_TIMEOUT_MS,
  createGrokBotRelay,
  isLocalRelayBase,
  relayBaseAllowed,
  readTesterCode,
  writeTesterCode,
  deviceId,
} from "./grok-bot-relay.ts"
import { CompanionBrainRouter } from "./companion-brain.ts"
import { createBackupAI } from "./backup-ai.ts"
import { createGrokLocalHook } from "./grok-local-hook.ts"
import { DEFAULT_GROK_CONNECT, type GrokConnectSettings } from "./grok-connect-settings.ts"
import { qaModeFromUrl } from "./qa-flags.ts"
import { createOpening, moonGateOpen, openingReducer } from "./opening.ts"
import { xaiKeyProblem, KEY_TOO_SHORT, KEY_WRONG_PREFIX } from "./grok-live-probe.ts"
import { sendLiveXaiGrokMessage, XAI_KEY_NOT_VALID } from "./grok-guest.ts"

function mem() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

/** Fake relay over fetch: returns a ticket, then pending N times, then the answer. */
function fakeRelayFetch(script: { ask: number | "throw"; polls: { status: string; reply?: string }[] }) {
  const calls: { url: string; body?: unknown }[] = []
  let i = 0
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (url.endsWith("/v1/ask")) {
      if (script.ask === "throw") throw new TypeError("Failed to fetch")
      return new Response(JSON.stringify(script.ask === 200 ? { requestId: "xoe-1", pollMs: 4000 } : { error: "busy" }), { status: script.ask })
    }
    const p = script.polls[Math.min(i++, script.polls.length - 1)]
    return new Response(JSON.stringify(p), { status: 200 })
  }) as unknown as typeof fetch
  return { impl, calls }
}

function relay(fetchImpl: typeof fetch, over: Record<string, unknown> = {}) {
  let t = 0
  return createGrokBotRelay({
    enabled: true,
    base: "http://127.0.0.1:18791",
    testerCode: () => "xoe-local-test",
    device: () => "dev-test-0001",
    fetchImpl,
    sleep: async (ms) => void (t += ms),
    now: () => t,
    ...over,
  })
}

describe("v18 Grok Bot relay client", () => {
  it("asks, gets a ticket, polls, and returns the answer", async () => {
    const f = fakeRelayFetch({ ask: 200, polls: [{ status: "pending" }, { status: "done", reply: "Sol is the fire moon." }] })
    const r = await relay(f.impl).ask("What is Sol?")
    expect(r).toMatchObject({ ok: true, reply: "Sol is the fire moon.", reason: "ready" })
    expect(f.calls[0]!.body).toEqual({ message: "What is Sol?", deviceId: "dev-test-0001", testerCode: "xoe-local-test" })
    expect(f.calls[1]!.url).toBe("http://127.0.0.1:18791/v1/reply/xoe-1")
  })

  it("never sends more than 300 characters", async () => {
    const f = fakeRelayFetch({ ask: 200, polls: [{ status: "done", reply: "ok" }] })
    await relay(f.impl).ask("x".repeat(900))
    expect((f.calls[0]!.body as { message: string }).message.length).toBe(300)
  })

  it("is off without a tester code, a build flag, or an allowed base", async () => {
    const f = fakeRelayFetch({ ask: 200, polls: [] })
    expect((await relay(f.impl, { testerCode: () => "" }).ask("hi")).reason).toBe("disabled")
    expect((await relay(f.impl, { enabled: false }).ask("hi")).reason).toBe("disabled")
    expect((await relay(f.impl, { base: "https://relay.example.com" }).ask("hi")).reason).toBe("disabled")
    expect(f.calls.length).toBe(0)
    expect(isLocalRelayBase("http://127.0.0.1:18791")).toBe(true)
    expect(relayBaseAllowed("https://relay.example.com")).toBe(false)
    expect(relayBaseAllowed("https://relay.example.com", true)).toBe(false)
    expect(relayBaseAllowed("http://relay.example.com", true)).toBe(false)
  })

  it("maps busy, unreachable, timeout and error so the router can fall back", async () => {
    expect((await relay(fakeRelayFetch({ ask: 429, polls: [] }).impl).ask("hi")).reason).toBe("busy")
    expect((await relay(fakeRelayFetch({ ask: 503, polls: [] }).impl).ask("hi")).reason).toBe("busy")
    expect((await relay(fakeRelayFetch({ ask: "throw", polls: [] }).impl).ask("hi")).reason).toBe("unreachable")
    expect((await relay(fakeRelayFetch({ ask: 200, polls: [{ status: "timeout" }] }).impl).ask("hi")).reason).toBe("timeout")
    expect((await relay(fakeRelayFetch({ ask: 200, polls: [{ status: "error" }] }).impl).ask("hi")).reason).toBe("error")
    const slow = await relay(fakeRelayFetch({ ask: 200, polls: [{ status: "pending" }] }).impl).ask("hi")
    expect(slow.reason).toBe("timeout")
    expect(GROK_BOT_TIMEOUT_MS).toBe(180_000)
  })

  it("keeps the tester code and device id on this device only", () => {
    const s = mem()
    expect(readTesterCode(s)).toBe("")
    writeTesterCode(s, "  code-1 ")
    expect(readTesterCode(s)).toBe("code-1")
    writeTesterCode(s, "")
    expect(readTesterCode(s)).toBe("")
    const id = deviceId(s)
    expect(id).toMatch(/^dev-/)
    expect(deviceId(s)).toBe(id)
  })
})

describe("v18 router: Grok Bot ON uses the relay, Grok Bot OFF never does, built-in AI is the fallback", () => {
  const settings = (over: Partial<GrokConnectSettings> = {}) => () => ({ ...DEFAULT_GROK_CONNECT, ...over })
  const noLive = (async () => ({ ok: false, reply: null, status: "x" })) as never

  it("Grok Bot defaults ON and answers through Grok Bot", async () => {
    expect(DEFAULT_GROK_CONNECT.enabled).toBe(true)
    const f = fakeRelayFetch({ ask: 200, polls: [{ status: "done", reply: "Grok Bot says hi." }] })
    const brain = new CompanionBrainRouter(createGrokLocalHook(), createBackupAI(), settings(), noLive, relay(f.impl))
    const r = await brain.ask("hello")
    expect(r.source).toBe("grok-bot")
    expect(r.label).toBe("XOE: Grok Bot")
  })

  it("Grok Bot OFF: no relay call, built-in AI answers", async () => {
    const f = fakeRelayFetch({ ask: 200, polls: [{ status: "done", reply: "nope" }] })
    const brain = new CompanionBrainRouter(createGrokLocalHook(), createBackupAI(), settings({ enabled: false }), noLive, relay(f.impl))
    const r = await brain.ask("What is Sol?")
    expect(r.source).toBe("backup-ai")
    expect(f.calls.length).toBe(0)
  })

  it("busy relay falls back to built-in AI with the busy note", async () => {
    const brain = new CompanionBrainRouter(createGrokLocalHook(), createBackupAI(), settings(), noLive, relay(fakeRelayFetch({ ask: 429, polls: [] }).impl))
    const r = await brain.ask("What is Sol?")
    expect(r.source).toBe("backup-ai")
    expect(r.status).toMatch(/busy/)
    expect(r.reply.length).toBeGreaterThan(0)
  })
})

describe("v18 QA fixes", () => {
  it("?qa=1 opens only the moon gate; off by default; adds no colonies", () => {
    expect(qaModeFromUrl("")).toBe(false)
    expect(qaModeFromUrl("?qa=0")).toBe(false)
    expect(qaModeFromUrl("?qa=1")).toBe(true)
    const s0 = createOpening()
    expect(moonGateOpen(s0)).toBe(false)
    const s1 = openingReducer(s0, { type: "qa-unlock-moons" })
    expect(moonGateOpen(s1)).toBe(true)
    expect(s1.clearedColonies).toEqual([])
  })

  it("key check gives separate messages for a wrong start and a short key", () => {
    expect(xaiKeyProblem("sk-abcdefghijk")).toBe(KEY_WRONG_PREFIX)
    expect(xaiKeyProblem("xai-test")).toBe(KEY_TOO_SHORT)
    expect(xaiKeyProblem("xai-test-fake")).toBeNull()
  })

  it("an api.x.ai 400 for a bad key reads 'xAI said the key is not valid'", async () => {
    const bad = (async () => new Response(JSON.stringify({ error: "Incorrect API key provided: xa***ke." }), { status: 400 })) as never
    const r = await sendLiveXaiGrokMessage({ text: "hi", apiKey: "xai-test-fake", endpoint: "https://example.invalid", model: "grok-4.7" }, bad)
    // v18.1: the key message now also quotes xAI's own words
    expect(r.status.startsWith(XAI_KEY_NOT_VALID)).toBe(true)
    expect(XAI_KEY_NOT_VALID).toMatch(/^xAI said the key is not valid/)
    const model = (async () => new Response(JSON.stringify({ error: "Model not found" }), { status: 400 })) as never
    const m = await sendLiveXaiGrokMessage({ text: "hi", apiKey: "xai-test-fake", endpoint: "https://example.invalid", model: "nope" }, model)
    expect(m.status).toMatch(/model/)
  })
})
