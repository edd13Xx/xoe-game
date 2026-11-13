import { browserSpeechEnabled } from "./browser-speech-consent.ts"
import { isSoundMuted } from "./audio-unlock.ts"
import { VOICE_REMINDER } from "./voices.ts"

let chosenVoiceURI: string | null = null
let reminderSpoken = false

export function setChosenVoiceURI(voiceURI: string | null): void {
  chosenVoiceURI = voiceURI
}

export function speakDeviceLine(text: string): boolean {
  if (!browserSpeechEnabled()) return false
  const synth = speechSynth()
  if (!synth) return false
  if (isSoundMuted()) return false
  // v18.2 iOS: cancel() right before speak() can swallow the new line, so only cancel when something is queued.
  if (synth.speaking || synth.pending) synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = "en-US"
  const voices = synth.getVoices()
  const match = chosenVoiceURI ? voices.find((voice) => voice.voiceURI === chosenVoiceURI) : undefined
  // iOS lists dozens of voices and voices[0] is often not English; prefer the English default.
  const english = voices.filter((voice) => /^en(-|_|$)/i.test(voice.lang))
  const fallback = english.find((voice) => voice.default) ?? english.find((voice) => /en-US/i.test(voice.lang)) ?? english[0] ?? voices.find((voice) => voice.default)
  const selected = match ?? fallback
  if (selected) utterance.voice = selected
  try {
    synth.resume()
  } catch {
    /* ignore */
  }
  synth.speak(utterance)
  return true
}

export function speakVoiceReminderIfIdle(): boolean {
  if (reminderSpoken) return false
  const synth = speechSynth()
  if (!synth || synth.speaking) return false
  const spoken = speakDeviceLine(VOICE_REMINDER)
  if (spoken) reminderSpoken = true
  return spoken
}

function speechSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null
  try {
    const synth = window.speechSynthesis
    if (!synth || typeof synth.speak !== "function") return null
    return synth
  } catch {
    return null
  }
}
