import { isSoundMuted } from "./audio-unlock.ts"
import { trackGrokRequest } from "./grok-requests.ts"
/**
 * XO speech: on-screen bubble + voice at the same time.
 * Bubble stays until speech ends + 1s (even if voice muted / fails).
 * Optional Grok Bot TTS (xAI /v1/tts) when Connect + Grok Bot voice are ON.
 * Doc: docs.x.ai/docs/guides/voice
 */

import { readGrokConnectSettings } from "./grok-connect-settings.ts"
import { speakDeviceLine, setChosenVoiceURI } from "./device-speech.ts"
import { spokenForm } from "./sis-speech.ts"
import { getLocalStore } from "./safe-storage.ts"

export const XO_BUBBLE_HOLD_AFTER_MS = 1000
export const DEFAULT_GROK_TTS_ENDPOINT = ["https", "://", "api.x.ai/v1/tts"].join("")
export const GROK_VOICE_STORAGE_KEY = "xoe.grokVoice.v1"

export interface GrokVoiceSettings {
  enabled: boolean
  ttsEndpoint: string
  voiceId: string
}

export const DEFAULT_GROK_VOICE: GrokVoiceSettings = {
  enabled: false,
  ttsEndpoint: DEFAULT_GROK_TTS_ENDPOINT,
  voiceId: "eve",
}

type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }

export function readGrokVoiceSettings(store: Store | null): GrokVoiceSettings {
  if (!store) return { ...DEFAULT_GROK_VOICE }
  try {
    const raw = store.getItem(GROK_VOICE_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_GROK_VOICE }
    const parsed = JSON.parse(raw) as Partial<GrokVoiceSettings>
    return {
      enabled: parsed.enabled === true,
      ttsEndpoint: DEFAULT_GROK_TTS_ENDPOINT,
      voiceId: typeof parsed.voiceId === "string" && parsed.voiceId.trim() ? parsed.voiceId : "eve",
    }
  } catch {
    return { ...DEFAULT_GROK_VOICE }
  }
}

export function writeGrokVoiceSettings(store: Store | null, next: GrokVoiceSettings): boolean {
  if (!store) return false
  try {
    store.setItem(GROK_VOICE_STORAGE_KEY, JSON.stringify({ ...next, ttsEndpoint: DEFAULT_GROK_TTS_ENDPOINT }))
    return true
  } catch {
    return false
  }
}

export type BubbleListener = (text: string | null) => void

let bubbleListener: BubbleListener | null = null
let bubbleTimer: ReturnType<typeof setTimeout> | null = null

export function setXoBubbleListener(listener: BubbleListener | null): void {
  bubbleListener = listener
}

function showBubble(text: string): void {
  if (bubbleTimer) clearTimeout(bubbleTimer)
  bubbleListener?.(text)
}

function holdBubbleThenClear(extraMs = XO_BUBBLE_HOLD_AFTER_MS): void {
  if (bubbleTimer) clearTimeout(bubbleTimer)
  bubbleTimer = setTimeout(() => {
    bubbleListener?.(null)
    bubbleTimer = null
  }, extraMs)
}

/** Estimate duration when speech API gives no end event (muted / failed). */
function estimateMs(text: string): number {
  return Math.max(1200, Math.min(12000, text.split(/\s+/).length * 380))
}

export async function tryGrokTts(text: string, apiKey: string, _endpoint: string, voiceId: string): Promise<boolean> {
  const controller = new AbortController()
  const untrack = trackGrokRequest(controller)
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(DEFAULT_GROK_TTS_ENDPOINT, {
      redirect: "error",
      credentials: "omit",
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ text, voice_id: voiceId || "eve", language: "en" }),
      signal: controller.signal,
    })
    if (!res.ok) return false
    const buf = await res.arrayBuffer()
    clearTimeout(timer)
    if (controller.signal.aborted || !buf.byteLength) return false
    const blob = new Blob([buf], { type: res.headers.get("content-type") || "audio/mpeg" })
    const url = URL.createObjectURL(blob)
    let played = false
    await new Promise<void>((resolve) => {
      const audio = new Audio(url)
      const finish = () => {
        clearTimeout(playbackTimer)
        controller.signal.removeEventListener("abort", abortPlayback)
        URL.revokeObjectURL(url)
        resolve()
      }
      const abortPlayback = () => { audio.pause(); finish() }
      const playbackTimer = setTimeout(abortPlayback, 20000)
      controller.signal.addEventListener("abort", abortPlayback, { once: true })
      audio.onended = finish
      audio.onerror = finish
      void audio.play().then(() => (played = true)).catch(() => {
        // iOS blocks play() outside a tap: fall back to device speech instead of staying silent
        finish()
      })
    })
    return played
  } catch {
    return false
  } finally {
    clearTimeout(timer)
    untrack()
  }
}

function speakDeviceWithEnd(text: string): Promise<void> {
  return new Promise((resolve) => {
    let synth: SpeechSynthesis | null = null
    try {
      synth = typeof window !== "undefined" ? window.speechSynthesis : null
    } catch {
      synth = null
    }
    if (!synth) {
      setTimeout(resolve, estimateMs(text))
      return
    }
    const ok = speakDeviceLine(text)
    if (!ok) {
      setTimeout(resolve, estimateMs(text))
      return
    }
    // Poll speaking flag — utterance.onend is unreliable across browsers
    const started = Date.now()
    const poll = () => {
      if (!synth.speaking && Date.now() - started > 200) {
        resolve()
        return
      }
      if (Date.now() - started > 20000) {
        resolve()
        return
      }
      setTimeout(poll, 120)
    }
    setTimeout(poll, 200)
  })
}


/**
 * Show XO bubble + speak. Bubble always shows; voice may use Grok Bot TTS or device.
 */
export async function xoSpeak(line: string): Promise<void> {
  const text = spokenForm(line.trim())
  if (!text) return
  showBubble(text)

  let usedGrok = false
  try {
    const store = getLocalStore()
    const connect = readGrokConnectSettings(store)
    const voice = readGrokVoiceSettings(store)
    if (connect.enabled && connect.apiKey && voice.enabled && !isSoundMuted()) {
      usedGrok = await tryGrokTts(text, connect.apiKey, voice.ttsEndpoint, voice.voiceId)
    }
  } catch {
    usedGrok = false
  }

  if (!usedGrok) {
    await speakDeviceWithEnd(text)
  }
  holdBubbleThenClear(XO_BUBBLE_HOLD_AFTER_MS)
}

// re-export for settings UI convenience
export { setChosenVoiceURI }
