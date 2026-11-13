import { AI_BUILTIN_INDICATOR, AI_LIVE_INDICATOR } from "./brand.ts"
import { reportLiveResult } from "./live-status.ts"
import { MAP_NOT_HERE_SAY, MAP_OPENED_SAY, OPEN_MAP_PATTERN, requestOpenMap } from "./map-screen.ts"
/**
 * CompanionBrain provider chain.
 * Order: live Grok Bot (player key) → Grok Bot relay (Grok Bot ON + relay set up) → local hook (off) → Backup AI.
 * Grok Bot OFF: no xAI and no relay calls; built-in AI only.
 */

import { BackupAI, createBackupAI, BACKUP_AI_LABEL } from "./backup-ai.ts"
import {
  canAttemptLiveGrok,
  readGrokConnectSettings,
  type GrokConnectSettings,
} from "./grok-connect-settings.ts"
import { liveStatusText, sendLiveXaiGrokMessage } from "./grok-guest.ts"
import {
  createGrokLocalHook,
  GROK_OFFLINE_PRACTICE_LABEL,
  GrokLocalHookProvider,
  LOCAL_GROK_HOOK_ENABLED,
} from "./grok-local-hook.ts"
import { getLocalStore } from "./safe-storage.ts"
import { GROK_BOT_BUSY_STATUS, GROK_BOT_LABEL, GROK_BOT_TIMEOUT_REPLY, createGrokBotRelay, GrokBotRelayProvider } from "./grok-bot-relay.ts"

export type BrainSource = "grok-live" | "grok-local" | "backup-ai" | "grok-bot"

export interface CompanionAskResult {
  ok: boolean
  reply: string
  source: BrainSource
  label: string
  status: string
  matchedId: string | null
  score: number
  /** v18.1: plain reason live Grok Bot failed (only set when a player key was tried). */
  liveError?: string
}

export interface CompanionBrain {
  ask(question: string): Promise<CompanionAskResult>
  resetMemory(): void
  grokHookEnabled: boolean
}

export const GROK_UNAVAILABLE_BACKUP_STATUS =
  "XOE built-in AI answering"

export const GROK_LIVE_STATUS = "XOE: live Grok Bot reply"
export const GROK_LIVE_FALLBACK_STATUS = "Live Grok Bot unavailable — XOE built-in AI answering"

export const ASK_GROK_PANEL_TITLE = "Ask XOE"
export const ASK_GROK_SUBTITLE =
  "Ask anytime. Grok Bot defaults ON. Paste your key for live replies. Toggle OFF pauses xAI (keeps key). Disconnect deletes the key."

export const HEADER_SUBTITLE_OFFLINE = AI_BUILTIN_INDICATOR
export const HEADER_SUBTITLE_GROK = AI_LIVE_INDICATOR

/** Friendly HUD when the player has not connected their own xAI key. */
export const GROK_HUD_BUILTIN = AI_BUILTIN_INDICATOR
/** Friendly HUD when Connect is ON and a player key is present. */
export const GROK_HUD_LIVE = AI_LIVE_INDICATOR
/** @deprecated alias — kept so older tests/call sites keep compiling */
export const GROK_HUD_CONNECT_HINT = GROK_HUD_BUILTIN
export const GROK_HUD_NEED_KEY = GROK_HUD_BUILTIN
export const GROK_HUD_LIVE_READY = GROK_HUD_LIVE

/** Status line under the Grok Bot integration button. No nagging when offline. */
export function describeGrokHudStatus(settings: GrokConnectSettings): string {
  if (canAttemptLiveGrok(settings)) return GROK_HUD_LIVE
  return GROK_HUD_BUILTIN
}


type SettingsReader = () => GrokConnectSettings
type LiveCaller = typeof sendLiveXaiGrokMessage

export class CompanionBrainRouter implements CompanionBrain {
  readonly grok: GrokLocalHookProvider
  readonly grokBot: GrokBotRelayProvider
  readonly backup: BackupAI
  private readSettings: SettingsReader
  private liveCaller: LiveCaller

  constructor(
    grok = createGrokLocalHook(),
    backup = createBackupAI(),
    readSettings: SettingsReader = defaultReadSettings,
    liveCaller: LiveCaller = sendLiveXaiGrokMessage,
    grokBot = createGrokBotRelay(),
  ) {
    this.grok = grok
    this.grokBot = grokBot
    this.backup = backup
    this.readSettings = readSettings
    this.liveCaller = liveCaller
  }

  get grokHookEnabled(): boolean {
    return LOCAL_GROK_HOOK_ENABLED && this.grok.enabled
  }

  resetMemory(): void {
    this.backup.resetMemory()
  }

  async ask(question: string): Promise<CompanionAskResult> {
    const trimmed = question.trim()
    if (!trimmed) {
      return {
        ok: false,
        reply: "XO: Type a question first, Pilot.",
        source: "backup-ai",
        label: BACKUP_AI_LABEL,
        status: GROK_UNAVAILABLE_BACKUP_STATUS,
        matchedId: null,
        score: 0,
      }
    }

    // v18.2: "open map" is a local command — answered on the device, never sent to xAI.
    if (OPEN_MAP_PATTERN.test(trimmed)) {
      const opened = requestOpenMap()
      return {
        ok: true,
        reply: opened ? MAP_OPENED_SAY : MAP_NOT_HERE_SAY,
        source: "backup-ai",
        label: BACKUP_AI_LABEL,
        status: "XOE command (on this device)",
        matchedId: "open-map",
        score: 1,
      }
    }

    const settings = this.readSettings()
    if (canAttemptLiveGrok(settings)) {
      const live = await this.liveCaller({
        text: trimmed,
        apiKey: settings.apiKey,
        endpoint: settings.endpoint,
        model: settings.model,
      })
      reportLiveResult(Boolean(live.ok && live.reply), live.ok ? "Live answer received." : liveStatusText(live.status))
      if (live.ok && live.reply) {
        return {
          ok: true,
          reply: live.reply,
          source: "grok-live",
          label: "Grok Bot (connected)",
          status: GROK_LIVE_STATUS,
          matchedId: null,
          score: 1,
        }
      }
      const backup = this.backup.ask(trimmed)
      return {
        ok: true,
        reply: backup.reply,
        source: "backup-ai",
        label: BACKUP_AI_LABEL,
        // v18.1: say WHY live Grok Bot failed (key, credits, timeout, network) instead of a vague "unavailable"
        status: `${GROK_LIVE_FALLBACK_STATUS}. Why: ${liveStatusText(live.status)}`,
        liveError: liveStatusText(live.status),
        matchedId: backup.matchedId,
        score: backup.score,
      }
    }

    let relayNote: string | null = null
    if (settings.enabled && this.grokBot.enabled) {
      const bot = await this.grokBot.ask(trimmed)
      if (bot.ok && bot.reply) {
        return {
          ok: true,
          reply: bot.reply,
          source: "grok-bot",
          label: GROK_BOT_LABEL,
          status: "XOE: Grok Bot reply",
          matchedId: null,
          score: 1,
        }
      }
      relayNote = bot.reason === "busy" ? GROK_BOT_BUSY_STATUS : bot.reason === "timeout" ? GROK_BOT_TIMEOUT_REPLY : null
    }

    const grokResult = await this.grok.ask(trimmed)
    if (grokResult.ok && grokResult.reply) {
      return {
        ok: true,
        reply: grokResult.reply,
        source: "grok-local",
        label: GROK_OFFLINE_PRACTICE_LABEL,
        status: `${GROK_OFFLINE_PRACTICE_LABEL} answered.`,
        matchedId: null,
        score: 1,
      }
    }

    const backup = this.backup.ask(trimmed)
    return {
      ok: true,
      reply: backup.reply,
      source: "backup-ai",
      label: BACKUP_AI_LABEL,
      status: relayNote ?? GROK_UNAVAILABLE_BACKUP_STATUS,
      matchedId: backup.matchedId,
      score: backup.score,
    }
  }
}

function defaultReadSettings(): GrokConnectSettings {
  try {
    return readGrokConnectSettings(getLocalStore())
  } catch {
    return readGrokConnectSettings(null)
  }
}

let shared: CompanionBrainRouter | null = null

export function getCompanionBrain(): CompanionBrainRouter {
  if (!shared) shared = new CompanionBrainRouter()
  return shared
}

export function createCompanionBrain(
  readSettings?: SettingsReader,
  liveCaller?: LiveCaller,
): CompanionBrainRouter {
  return new CompanionBrainRouter(createGrokLocalHook(), createBackupAI(), readSettings, liveCaller)
}
