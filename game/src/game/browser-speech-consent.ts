import { getLocalStore } from "./safe-storage.ts"
export const BROWSER_SPEECH_KEY = "xoe.browserSpeechConsent.v1"
export const BROWSER_SPEECH_NOTE = "Browser voice is optional and may use your browser vendor's servers."
let tabConsent: boolean | null = null
export function browserSpeechEnabled(): boolean {
  if (tabConsent !== null) return tabConsent
  try { return getLocalStore()?.getItem(BROWSER_SPEECH_KEY) === "1" } catch { return false }
}
export function setBrowserSpeechEnabled(enabled: boolean): boolean {
  tabConsent = enabled
  let persisted = true
  try { getLocalStore().setItem(BROWSER_SPEECH_KEY, enabled ? "1" : "0") } catch { persisted = false }
  if (!enabled && typeof window !== "undefined") { try { window.speechSynthesis?.cancel() } catch { /* unavailable */ } }
  return persisted
}
