/** v18.2: one place that knows whether live Grok Bot is really answering on this device. */
import { AI_BUILTIN_INDICATOR, AI_LIVE_INDICATOR, AI_NAME } from "./brand.ts"
import { canAttemptLiveGrok, readGrokConnectSettings } from "./grok-connect-settings.ts"
import { getLocalStore } from "./safe-storage.ts"

export type LiveState = "live" | "untested" | "error" | "builtin"
let last: { state: "live" | "error"; detail: string } | null = null
const subs = new Set<() => void>()

export function reportLiveResult(ok: boolean, detail: string): void {
  last = { state: ok ? "live" : "error", detail }
  subs.forEach((f) => f())
}
export function resetLiveResult(): void {
  last = null
  subs.forEach((f) => f())
}
export function onLiveStatus(fn: () => void): () => void {
  subs.add(fn)
  return () => subs.delete(fn)
}

export function liveState(): { state: LiveState; label: string; detail: string } {
  let settings
  try {
    settings = readGrokConnectSettings(getLocalStore())
  } catch {
    settings = readGrokConnectSettings(null)
  }
  if (!canAttemptLiveGrok(settings)) {
    return { state: "builtin", label: AI_BUILTIN_INDICATOR, detail: settings.enabled ? `No ${AI_NAME} key saved.` : `${AI_NAME} is OFF.` }
  }
  if (last?.state === "error") return { state: "error", label: `${AI_NAME}: problem · tap Test`, detail: last.detail }
  if (last?.state === "live") return { state: "live", label: AI_LIVE_INDICATOR, detail: last.detail }
  // key saved and ON: live Grok Bot is used by default; it shows "connected" once a call works
  return { state: "untested", label: `${AI_NAME}: key saved`, detail: "Key saved. Not tested yet." }
}
