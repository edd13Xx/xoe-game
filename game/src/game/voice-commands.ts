import { MAP_NOT_HERE_SAY, MAP_OPENED_SAY, OPEN_MAP_PATTERN, requestOpenMap } from "./map-screen.ts"
/**
 * Built-in AI parser for spoken XOE settings commands (live Grok Bot later).
 * Examples: turn the music down, open the order book, make it easier.
 */

import { writeMusicPreference, readMusicPreference, writeSfxPreference, readSfxPreference, clampVolume } from "./music.ts"
import { writeFightDifficulty, readFightDifficulty, type FightDifficulty } from "./combat.ts"
import type { DrawerId } from "./drawer.ts"

type Store = {
  getItem: (k: string) => string | null
  setItem: (k: string, v: string) => void
  removeItem: (k: string) => void
}

export type VoiceCommandAction =
  | { type: "music-volume"; volume: number; say: string }
  | { type: "music-mute"; enabled: boolean; say: string }
  | { type: "sfx-toggle"; enabled: boolean; say: string }
  | { type: "difficulty"; difficulty: FightDifficulty; say: string }
  | { type: "open-drawer"; drawer: DrawerId; say: string }
  | { type: "open-map"; say: string }
  | { type: "none"; say: string }

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

export function parseVoiceCommand(transcript: string, store: Store | null = null): VoiceCommandAction {
  const t = norm(transcript)
  if (!t) return { type: "none", say: "XO: I didn’t catch that." }

  if (OPEN_MAP_PATTERN.test(t)) return { type: "open-map", say: MAP_OPENED_SAY }
  if (/(open|show).*(order book|paper|advanced|trade desk)/.test(t) || t.includes("order book")) {
    return { type: "open-drawer", drawer: "paper", say: "XO: Opening the XOE trade desk." }
  }
  if (/(open|show).*(market|prices|ticker panel)/.test(t)) {
    return { type: "open-drawer", drawer: "market", say: "XO: Opening Market." }
  }
  if (/(open|show).*(settings|options)/.test(t)) {
    return { type: "open-drawer", drawer: "settings", say: "XO: Opening Settings." }
  }
  if (/(open|show).*(score|leaderboard)/.test(t)) {
    return { type: "open-drawer", drawer: "scores", say: "XO: Opening scores." }
  }
  if (/(open|show).*(wallet|account|stellar)/.test(t)) {
    return { type: "open-drawer", drawer: "wallet", say: "XO: Opening Account & Wallet." }
  }
  if (/(ask|open).*(grok|xoe)/.test(t)) {
    return { type: "open-drawer", drawer: "ask-grok", say: "XO: Opening Ask XOE." }
  }

  if (/(music|volume).*(down|lower|quieter)|turn.*(music|volume).*down|quieter/.test(t)) {
    const cur = readMusicPreference(store).saved.volume
    const volume = clampVolume(cur - 0.15)
    return { type: "music-volume", volume, say: `XO: Music down to ${Math.round(volume * 100)}%.` }
  }
  if (/(music|volume).*(up|higher|louder)|turn.*(music|volume).*up|louder/.test(t)) {
    const cur = readMusicPreference(store).saved.volume
    const volume = clampVolume(cur + 0.15)
    return { type: "music-volume", volume, say: `XO: Music up to ${Math.round(volume * 100)}%.` }
  }
  if (/mute music|music off|silence music/.test(t)) {
    return { type: "music-mute", enabled: false, say: "XO: Music muted." }
  }
  if (/unmute music|music on/.test(t)) {
    return { type: "music-mute", enabled: true, say: "XO: Music on." }
  }
  if (/sfx off|mute (sfx|sound effects)/.test(t)) {
    return { type: "sfx-toggle", enabled: false, say: "XO: SFX off." }
  }
  if (/sfx on|sound effects on/.test(t)) {
    return { type: "sfx-toggle", enabled: true, say: "XO: SFX on." }
  }

  if (/make it easier|easier|easy mode|set easy/.test(t)) {
    return { type: "difficulty", difficulty: "easy", say: "XO: Fighting set to Easy." }
  }
  if (/make it harder|harder|hard mode|set hard/.test(t)) {
    return { type: "difficulty", difficulty: "hard", say: "XO: Fighting set to Hard." }
  }
  if (/normal (mode|difficulty)|set normal/.test(t)) {
    return { type: "difficulty", difficulty: "normal", say: "XO: Fighting set to Normal." }
  }

  void readFightDifficulty
  void readSfxPreference
  return { type: "none", say: "XO: Try “turn the music down,” “open the order book,” or “make it easier.”" }
}

/** Apply a parsed command to device prefs. Returns say-line. */
export function applyVoiceCommand(
  action: VoiceCommandAction,
  store: Store | null,
  music?: { setVolume: (v: number) => void; setEnabled?: (on: boolean) => void },
): { say: string; openDrawer: DrawerId | null } {
  if (action.type === "music-volume") {
    const cur = readMusicPreference(store)
    writeMusicPreference(store, { ...cur.saved, volume: action.volume, enabled: true })
    music?.setVolume(action.volume)
    return { say: action.say, openDrawer: null }
  }
  if (action.type === "music-mute") {
    const cur = readMusicPreference(store)
    writeMusicPreference(store, { ...cur.saved, enabled: action.enabled })
    music?.setEnabled?.(action.enabled)
    return { say: action.say, openDrawer: null }
  }
  if (action.type === "sfx-toggle") {
    writeSfxPreference(store, { enabled: action.enabled })
    return { say: action.say, openDrawer: null }
  }
  if (action.type === "difficulty") {
    writeFightDifficulty(store, action.difficulty)
    return { say: action.say, openDrawer: null }
  }
  if (action.type === "open-drawer") {
    return { say: action.say, openDrawer: action.drawer }
  }
  if (action.type === "open-map") {
    return { say: requestOpenMap() ? MAP_OPENED_SAY : MAP_NOT_HERE_SAY, openDrawer: null }
  }
  return { say: action.say, openDrawer: null }
}
