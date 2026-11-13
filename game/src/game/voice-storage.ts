import type { SavedVoicePreference } from "./voices.ts"

export const VOICE_STORAGE_KEY = "xeno.deviceVoice.v1"

export interface PreferenceStore {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export function readVoicePreference(store: PreferenceStore | null): {
  saved: SavedVoicePreference | null
  storageBlocked: boolean
} {
  if (!store) return { saved: null, storageBlocked: true }
  try {
    const raw = store.getItem(VOICE_STORAGE_KEY)
    if (!raw) return { saved: null, storageBlocked: false }
    const parsed = JSON.parse(raw) as Partial<SavedVoicePreference>
    if (typeof parsed.name !== "string" || typeof parsed.lang !== "string") {
      return { saved: null, storageBlocked: false }
    }
    return {
      saved: {
        voiceURI: typeof parsed.voiceURI === "string" ? parsed.voiceURI : "",
        name: parsed.name,
        lang: parsed.lang,
      },
      storageBlocked: false,
    }
  } catch {
    return { saved: null, storageBlocked: true }
  }
}

export function writeVoicePreference(store: PreferenceStore | null, saved: SavedVoicePreference): boolean {
  if (!store) return false
  try {
    store.setItem(VOICE_STORAGE_KEY, JSON.stringify(saved))
    return true
  } catch {
    return false
  }
}

export function clearVoicePreference(store: PreferenceStore | null): boolean {
  if (!store) return false
  try {
    store.removeItem(VOICE_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
