import { useCallback, useEffect, useState } from "react"
import {
  choicesFromTexts,
  parseSpokenAnswer,
  type SpeechChoice,
} from "../game/speech-answer.ts"
import { xoSpeak } from "../game/xo-speech.ts"

type RecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void) | null
  onerror: ((ev: { error?: string }) => void) | null
  onend: (() => void) | null
}

function getRecognition(): RecognitionLike | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike
    webkitSpeechRecognition?: new () => RecognitionLike
  }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) return null
  return new Ctor()
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}

/**
 * Mic for multiple-choice: tap to start listening (permission then).
 * Shows heard text via XO bubble/confirm; calls onSelect when matched.
 */
export function MicChoiceButton({
  options,
  onSelect,
}: {
  options: readonly string[] | readonly SpeechChoice[]
  onSelect: (index: number) => void
}) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    setSupported(speechRecognitionSupported())
  }, [])

  const listen = useCallback(() => {
    const choices: SpeechChoice[] =
      typeof options[0] === "string"
        ? choicesFromTexts(options as readonly string[])
        : (options as readonly SpeechChoice[]).slice()
    const rec = getRecognition()
    if (!rec) return
    rec.lang = "en-US"
    rec.interimResults = false
    rec.maxAlternatives = 3
    rec.continuous = false
    setListening(true)
    setStatus("Listening…")
    rec.onresult = (ev) => {
      const transcript = ev.results?.[0]?.[0]?.transcript ?? ""
      const parsed = parseSpokenAnswer(transcript, choices)
      setStatus(parsed.confirm)
      void xoSpeak(parsed.confirm)
      if (parsed.matchedIndex != null) onSelect(parsed.matchedIndex)
    }
    rec.onerror = () => {
      setStatus("XO: Mic error — tap an answer instead.")
      setListening(false)
    }
    rec.onend = () => setListening(false)
    try {
      rec.start()
    } catch {
      setListening(false)
      setStatus("XO: Couldn’t start mic.")
    }
  }, [onSelect, options])

  if (!supported) return null

  return (
    <div className="mic-choice">
      <button
        type="button"
        className="touch-btn mic-btn"
        aria-pressed={listening}
        title="Speak a gate label using your browser microphone service"
        onClick={listen}
        disabled={listening}
      >
        {listening ? "Listening…" : "🎤 Say gate"}
      </button>
      {status ? <p className="fine" role="status">{status}</p> : null}
    </div>
  )
}
