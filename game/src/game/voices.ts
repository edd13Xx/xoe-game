export interface DeviceVoiceInput {
  voiceURI: string
  name: string
  lang: string
  default: boolean
  localService: boolean
}

export interface ListedVoice {
  voiceURI: string
  name: string
  lang: string
  localService: boolean
  isDefault: boolean
  label: string
}

export interface SavedVoicePreference {
  voiceURI: string
  name: string
  lang: string
}

export const VOICE_REMINDER =
  "Pilot, you can change this voice in Voice settings or reset it to the browser default."

export const VOICE_PREVIEW_LINE = "Device voice preview."

/** Max voices shown in Voice settings (Eddie). */
export const VOICE_LIST_LIMIT = 10

/**
 * Ranking for the top-10 voice list (higher score first):
 * 1) XO / companion-friendly name match (Samantha, Zoe-like, female English often used as default XO voice)
 * 2) Browser default
 * 3) English (en*)
 * 4) localService / on-device
 * 5) Higher-quality markers: Enhanced, Premium, Natural, Neural, Superstar
 * Then de-duplicate by name+lang (keep best-scoring URI).
 */
export function voiceQualityScore(voice: DeviceVoiceInput): number {
  const name = voice.name.toLowerCase()
  const lang = voice.lang.toLowerCase()
  let score = 0
  if (/\b(samantha|karen|moira|tessa|fiona|veena|serena|zira|susan)\b/.test(name)) score += 100
  if (voice.default) score += 80
  if (lang.startsWith("en")) score += 50
  if (voice.localService) score += 40
  if (/(enhanced|premium|natural|neural|superstar|compact)/i.test(voice.name)) score += 30
  if (/female|woman/i.test(name)) score += 5
  return score
}

function dedupeVoices(voices: readonly DeviceVoiceInput[]): DeviceVoiceInput[] {
  const best = new Map<string, DeviceVoiceInput>()
  for (const voice of voices) {
    const key = `${voice.name.trim().toLowerCase()}\n${voice.lang.trim().toLowerCase()}`
    const prev = best.get(key)
    if (!prev || voiceQualityScore(voice) > voiceQualityScore(prev)) best.set(key, voice)
  }
  return [...best.values()]
}

export function listDeviceVoices(voices: readonly DeviceVoiceInput[]): ListedVoice[] {
  const deduped = dedupeVoices(voices)
  const ranked = [...deduped].sort((a, b) => {
    const diff = voiceQualityScore(b) - voiceQualityScore(a)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })
  const top = ranked.slice(0, VOICE_LIST_LIMIT)
  return top.map((voice, index) => {
    const name = voice.name.trim() || "Unnamed voice"
    const lang = voice.lang.trim() || "unknown language"
    const base = `${name} (${lang})`
    const uri = voice.voiceURI.trim()
    const sameNameCount = top.filter((v) => v.name === voice.name && v.lang === voice.lang).length
    const label = sameNameCount > 1 ? `${base} — ${uri || `entry ${index + 1}`}` : base
    return {
      voiceURI: uri,
      name,
      lang,
      localService: voice.localService,
      isDefault: voice.default,
      label,
    }
  })
}

export function resolveVoiceChoice(
  voices: readonly ListedVoice[],
  saved: SavedVoicePreference | null,
): { selected: ListedVoice | null; notice: string | null } {
  if (voices.length === 0) {
    return { selected: null, notice: "This browser reported no speech voices." }
  }
  const browserDefault = voices.find((voice) => voice.isDefault) ?? voices[0] ?? null
  if (!saved) return { selected: browserDefault, notice: null }
  const byUri = saved.voiceURI ? voices.find((voice) => voice.voiceURI === saved.voiceURI) : undefined
  if (byUri) return { selected: byUri, notice: null }
  const byName = voices.filter((voice) => voice.name === saved.name && voice.lang === saved.lang)
  if (byName.length === 1) return { selected: byName[0] ?? null, notice: null }
  return {
    selected: browserDefault,
    notice: "Saved device voice is unavailable. Using another voice reported by this browser.",
  }
}
