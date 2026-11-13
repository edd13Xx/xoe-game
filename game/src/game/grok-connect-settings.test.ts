
import { describe, expect, it } from "vitest"
import {
  DEFAULT_GROK_CONNECT,
  canAttemptLiveGrok,
  disconnectGrok,
  readGrokConnectSettings,
  setGrokEnabled,
  shouldShowGrokFirstRunPanel,
  writeGrokConnectSettings,
  writeGrokFirstRunDismissed,
} from "./grok-connect-settings.ts"

function mem() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, v) },
    removeItem: (k: string) => { m.delete(k) },
  }
}

describe("grok toggle and disconnect", () => {
  it("defaults enabled true with empty key", () => {
    expect(DEFAULT_GROK_CONNECT.enabled).toBe(true)
    expect(DEFAULT_GROK_CONNECT.apiKey).toBe("")
    expect(canAttemptLiveGrok(DEFAULT_GROK_CONNECT)).toBe(false)
  })

  it("toggle off keeps key but blocks live calls", () => {
    const store = mem()
    writeGrokConnectSettings(store, {
      enabled: true,
      apiKey: "xai-test-key",
      endpoint: "https://api.x.ai/v1/chat/completions",
      model: "grok-3",
    })
    const off = setGrokEnabled(store, false)
    expect(off.enabled).toBe(false)
    expect(off.apiKey).toBe("xai-test-key")
    expect(canAttemptLiveGrok(off)).toBe(false)
    const again = readGrokConnectSettings(store)
    expect(again.apiKey).toBe("xai-test-key")
    expect(again.enabled).toBe(false)
  })

  it("disconnect deletes the key from storage", () => {
    const store = mem()
    writeGrokConnectSettings(store, {
      enabled: true,
      apiKey: "xai-secret-should-clear",
      endpoint: "https://api.x.ai/v1/chat/completions",
      model: "grok-3",
    })
    const cleared = disconnectGrok(store)
    expect(cleared.apiKey).toBe("")
    expect(canAttemptLiveGrok(cleared)).toBe(false)
    expect(readGrokConnectSettings(store).apiKey).toBe("")
  })

  it("shows first-run until dismissed or key saved", () => {
    const store = mem()
    expect(shouldShowGrokFirstRunPanel(store)).toBe(true)
    writeGrokFirstRunDismissed(store, true)
    expect(shouldShowGrokFirstRunPanel(store)).toBe(false)
    const store2 = mem()
    writeGrokConnectSettings(store2, {
      enabled: true,
      apiKey: "xai-test",
      endpoint: "https://api.x.ai/v1/chat/completions",
      model: "grok-3",
    })
    expect(shouldShowGrokFirstRunPanel(store2)).toBe(false)
  })
})
