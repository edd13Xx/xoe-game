/** XOE Grok Bot-assist voice reminder — first start + sparse cadence. */

export const VOICE_REMINDER_PREF_KEY = "xoe.voiceReminder.v1"
export const VOICE_REMINDER_MIN_MS = 10 * 60 * 1000
export const VOICE_REMINDER_COLONIES = 3

export const VOICE_REMINDER_TEXT =
  "XO: I’m here to help. Say a voice command anytime — like “turn the music down,” “open the order book,” or “make it easier.”"

export interface VoiceReminderPref {
  dontRemind: boolean
  lastShownAtMs: number
  coloniesSinceShow: number
  shownFirstStart: boolean
  shownFirstPlay: boolean
}

type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }

const FALLBACK: VoiceReminderPref = {
  dontRemind: false,
  lastShownAtMs: 0,
  coloniesSinceShow: 0,
  shownFirstStart: false,
  shownFirstPlay: false,
}

export function readVoiceReminderPref(store: Store | null): VoiceReminderPref {
  if (!store) return { ...FALLBACK }
  try {
    const raw = store.getItem(VOICE_REMINDER_PREF_KEY)
    if (!raw) return { ...FALLBACK }
    const p = JSON.parse(raw) as Partial<VoiceReminderPref>
    return {
      dontRemind: p.dontRemind === true,
      lastShownAtMs: typeof p.lastShownAtMs === "number" ? p.lastShownAtMs : 0,
      coloniesSinceShow: Math.max(0, Math.floor(Number(p.coloniesSinceShow) || 0)),
      shownFirstStart: p.shownFirstStart === true,
      shownFirstPlay: p.shownFirstPlay === true,
    }
  } catch {
    return { ...FALLBACK }
  }
}

export function writeVoiceReminderPref(store: Store | null, pref: VoiceReminderPref): boolean {
  if (!store) return false
  try {
    store.setItem(VOICE_REMINDER_PREF_KEY, JSON.stringify(pref))
    return true
  } catch {
    return false
  }
}

export function setDontRemind(store: Store | null, dont: boolean): VoiceReminderPref {
  const next = { ...readVoiceReminderPref(store), dontRemind: dont === true }
  writeVoiceReminderPref(store, next)
  return next
}

export function noteColonyClearForVoiceReminder(store: Store | null): VoiceReminderPref {
  const prev = readVoiceReminderPref(store)
  const next = { ...prev, coloniesSinceShow: prev.coloniesSinceShow + 1 }
  writeVoiceReminderPref(store, next)
  return next
}

export type ReminderContext = {
  screen: "setup" | "play"
  inFight: boolean
  dangerMode: boolean
  nowMs?: number
}

/** Whether to show the reminder now (caller still renders UI). */
export function shouldShowVoiceReminder(store: Store | null, ctx: ReminderContext): boolean {
  const pref = readVoiceReminderPref(store)
  if (pref.dontRemind) return false
  if (ctx.inFight || ctx.dangerMode) return false
  if (ctx.screen === "setup" && !pref.shownFirstStart) return true
  if (ctx.screen === "play" && !pref.shownFirstPlay) return true
  const now = ctx.nowMs ?? Date.now()
  if (pref.coloniesSinceShow >= VOICE_REMINDER_COLONIES) return true
  if (pref.lastShownAtMs > 0 && now - pref.lastShownAtMs >= VOICE_REMINDER_MIN_MS) return true
  return false
}

export function markVoiceReminderShown(
  store: Store | null,
  screen: "setup" | "play",
  nowMs: number = Date.now(),
): VoiceReminderPref {
  const prev = readVoiceReminderPref(store)
  const next: VoiceReminderPref = {
    ...prev,
    lastShownAtMs: nowMs,
    coloniesSinceShow: 0,
    shownFirstStart: screen === "setup" ? true : prev.shownFirstStart,
    shownFirstPlay: screen === "play" ? true : prev.shownFirstPlay,
  }
  writeVoiceReminderPref(store, next)
  return next
}
