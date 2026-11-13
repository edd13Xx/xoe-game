import { browserSpeechEnabled } from "./browser-speech-consent.ts"
/**
 * v18.2 iPhone sound fix.
 *
 * iOS Safari plays nothing until a real tap:
 *  - an AudioContext stays "suspended" unless resume() runs inside touchend/click (pointerdown does not count);
 *  - Web Audio follows the ring/silent switch unless the page's audio session is "playback";
 *  - speechSynthesis drops every utterance until one speak() has run inside a tap.
 * So on every tap until sound is running we: resume the music context, set the audio session to playback
 * (and play a tiny silent <audio>, which does the same on older iOS), and prime speech with a silent utterance.
 */
import type { MusicController } from "./music.ts"
import { getLocalStore } from "./safe-storage.ts"

export const SOUND_MUTED_STORAGE_KEY = "xoe.soundMuted.v1"
export type SoundState = "tap" | "on" | "muted"

let speechPrimed = false
let sessionSet = false
let silentUrl: string | null = null
let installed = false
const listeners = new Set<() => void>()

export function isSoundMuted(store = getLocalStore()): boolean {
  try {
    return store?.getItem(SOUND_MUTED_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function setSoundMuted(muted: boolean, store = getLocalStore()): void {
  try {
    store?.setItem(SOUND_MUTED_STORAGE_KEY, muted ? "1" : "0")
  } catch {
    /* storage blocked: session-only */
  }
  if (muted) {
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* ignore */
    }
  }
  notify()
}

export function soundState(music: MusicController): SoundState {
  if (isSoundMuted()) return "muted"
  return music.isRunning() ? "on" : "tap"
}

export function onSoundChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify() {
  for (const fn of listeners) fn()
}

/** Tiny silent WAV (0.05 s) as a blob URL. */
function silentWavUrl(): string | null {
  if (silentUrl) return silentUrl
  try {
    const rate = 8000
    const samples = 400
    const buf = new ArrayBuffer(44 + samples)
    const v = new DataView(buf)
    const w = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
    w(0, "RIFF")
    v.setUint32(4, 36 + samples, true)
    w(8, "WAVE")
    w(12, "fmt ")
    v.setUint32(16, 16, true)
    v.setUint16(20, 1, true)
    v.setUint16(22, 1, true)
    v.setUint32(24, rate, true)
    v.setUint32(28, rate, true)
    v.setUint16(32, 1, true)
    v.setUint16(34, 8, true)
    w(36, "data")
    v.setUint32(40, samples, true)
    for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128)
    silentUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }))
    return silentUrl
  } catch {
    return null
  }
}

function setPlaybackSession() {
  if (sessionSet) return
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = "playback"
  } catch {
    /* older iOS */
  }
  try {
    const url = silentWavUrl()
    if (url) {
      const a = new Audio(url)
      a.setAttribute("playsinline", "")
      const p = a.play()
      if (p && typeof p.then === "function") p.then(() => (sessionSet = true)).catch(() => {})
    }
  } catch {
    /* ignore */
  }
}

function primeSpeech() {
  if (speechPrimed || !browserSpeechEnabled()) return
  try {
    const synth = window.speechSynthesis
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") return
    const u = new SpeechSynthesisUtterance(" ")
    u.volume = 0
    u.lang = "en-US"
    synth.speak(u)
    synth.getVoices()
    speechPrimed = true
  } catch {
    /* ignore */
  }
}

/** Call from inside a real tap/click/key handler. Safe to call often. */
export function unlockAudioInGesture(music: MusicController): void {
  if (isSoundMuted()) return
  music.unlock()
  setPlaybackSession()
  primeSpeech()
  // the context flips to "running" a moment after resume()
  setTimeout(notify, 120)
  setTimeout(notify, 600)
}

export function speechReady(): boolean {
  return speechPrimed
}

/** Listen for the first real taps anywhere (touchend/click/keydown count on iOS; pointerdown does not). */
export function installFirstTapAudioUnlock(music: MusicController): () => void {
  if (installed || typeof document === "undefined") return () => {}
  installed = true
  const handler = () => {
    unlockAudioInGesture(music)
    if (music.isRunning() && (!browserSpeechEnabled() || speechPrimed)) {
      // keep listening briefly in case iOS needed a second tap
      setTimeout(() => {
        if (music.isRunning()) remove()
      }, 1000)
    }
  }
  const opts = { capture: true, passive: true } as AddEventListenerOptions
  const events = ["touchend", "click", "keydown"] as const
  events.forEach((e) => document.addEventListener(e, handler, opts))
  const remove = () => {
    events.forEach((e) => document.removeEventListener(e, handler, opts))
    installed = false
  }
  return remove
}
