import { describe, expect, it, vi } from "vitest"
import { DEFAULT_GROK_ENDPOINT, disconnectGrok, writeGrokConnectSettings, DEFAULT_GROK_CONNECT } from "./grok-connect-settings.ts"
import { sendLiveXaiGrokMessage } from "./grok-guest.ts"
import { fetchTickerSnapshot, fetchOpens } from "./live-ticker.ts"

const input = { text: "Who are you?", apiKey: "xai-test-fake-0000", model: "grok-4.7", endpoint: "https://unapproved.invalid/key-thief" }
const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })

describe("v19 network ceiling", () => {
  it("fetches only public XLM prices and stats, never the other coin pairs", async () => {
    const urls: string[] = []
    const fetcher = async (url: string) => { urls.push(url); return response({ data: { amount: "0.25" }, open: "0.24" }) }
    await fetchTickerSnapshot(fetcher)
    await fetchOpens(fetcher)
    expect(urls).toHaveLength(2)
    for (const url of urls) expect(url).toMatch(/^https:\/\/api\.(exchange\.)?coinbase\.com\/.*XLM-USD\//)
  })
  it("cannot leak a key to a custom endpoint or a redirect; caps output and omits cookies", async () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => response({ choices: [{ message: { content: "I'm XOE, Unknown Orbital Engine." } }] }))
    const r = await sendLiveXaiGrokMessage(input, fetcher)
    expect(r.ok).toBe(true)
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe(DEFAULT_GROK_ENDPOINT)
    expect(init.redirect).toBe("error")
    expect(init.credentials).toBe("omit")
    const body = JSON.parse(init.body as string)
    expect(body.max_tokens).toBe(256)
    expect(body.messages[0].content).toContain("I'm XOE, Unknown Orbital Engine.")
    expect(body.messages[1].content).not.toContain(input.apiKey)
  })
  it("aborts in-flight calls on Disconnect, without retaining the key", async () => {
    const m = new Map<string, string>()
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } }
    writeGrokConnectSettings(store, { ...DEFAULT_GROK_CONNECT, apiKey: input.apiKey })
    let signal: AbortSignal | null | undefined
    const pending = sendLiveXaiGrokMessage(input, async (_url, init) => {
      signal = init.signal
      return new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))
    })
    disconnectGrok(store)
    expect(signal?.aborted).toBe(true)
    expect((await pending).ok).toBe(false)
    expect([...m.values()].join()).not.toContain(input.apiKey)
  })
  it("shows actionable rate-limit feedback with no automatic retry", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 429 }))
    const r = await sendLiveXaiGrokMessage(input, f)
    expect(r.ok).toBe(false)
    expect(r.status).toMatch(/Wait a minute/)
    expect(f).toHaveBeenCalledTimes(1)
  })
})
