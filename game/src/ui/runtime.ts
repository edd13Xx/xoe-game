import { useEffect, useState } from "react"
import { evaluateSpeech, type SpeechSupport } from "../game/dialogue.ts"

function readSpeech(): SpeechSupport {
  try {
    const synth = window.speechSynthesis
    if (!synth || typeof synth.speak !== "function") {
      return evaluateSpeech({ synthPresent: false, voiceCount: 0 })
    }
    return evaluateSpeech({ synthPresent: true, voiceCount: synth.getVoices().length })
  } catch {
    return evaluateSpeech({ synthPresent: false, voiceCount: 0 })
  }
}

export function useSpeechSupport(): SpeechSupport {
  const [support, setSupport] = useState(readSpeech)

  useEffect(() => {
    try {
      const synth = window.speechSynthesis
      if (!synth) return
      const read = () => setSupport(readSpeech())
      synth.addEventListener("voiceschanged", read)
      return () => synth.removeEventListener("voiceschanged", read)
    } catch {
      return
    }
  }, [])

  return support
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setReduced(query.matches)
    return onMediaChange(query, apply)
  }, [])
  return reduced
}

/** Older iOS Safari (before 14) only has MediaQueryList.addListener, not addEventListener("change"). */
export function onMediaChange(query: MediaQueryList, fn: () => void): () => void {
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", fn)
    return () => query.removeEventListener("change", fn)
  }
  const legacy = query as unknown as { addListener?: (f: () => void) => void; removeListener?: (f: () => void) => void }
  legacy.addListener?.(fn)
  return () => legacy.removeListener?.(fn)
}

/** Same test the colony map uses for its phone fit mode: a narrow screen or any touch-first screen. */
export const PHONE_MAP_QUERY = "(max-width: 480px), (pointer: coarse)"

export function usePhoneMapLayout(): boolean {
  const read = () => {
    try {
      return window.matchMedia(PHONE_MAP_QUERY).matches
    } catch {
      return false
    }
  }
  const [phone, setPhone] = useState(read)
  useEffect(() => {
    try {
      const query = window.matchMedia(PHONE_MAP_QUERY)
      return onMediaChange(query, () => setPhone(query.matches))
    } catch {
      return
    }
  }, [])
  return phone
}

export function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(() => document.hidden)
  useEffect(() => {
    const apply = () => setHidden(document.hidden)
    document.addEventListener("visibilitychange", apply)
    return () => document.removeEventListener("visibilitychange", apply)
  }, [])
  return hidden
}

export function playLocalScoff(): void {
  try {
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return
    const audio = new AudioContextCtor()
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = "square"
    oscillator.frequency.setValueAtTime(380, audio.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(140, audio.currentTime + 0.28)
    gain.gain.setValueAtTime(0.03, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.32)
    oscillator.connect(gain)
    gain.connect(audio.destination)
    void audio.resume?.()
    oscillator.start()
    oscillator.stop(audio.currentTime + 0.32)
    oscillator.onended = () => {
      void audio.close()
    }
  } catch {
    // Audio blocked in sandbox / autoplay policy
  }
}
