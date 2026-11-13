import { useCallback, useEffect, useState } from "react"
import { speechRecognitionSupported } from "./MicChoiceButton.tsx"
import { parseVoiceCommand, applyVoiceCommand } from "../game/voice-commands.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { xoSpeak } from "../game/xo-speech.ts"
import { inRestrictedPreview } from "../game/sandbox.ts"
import { getCompanionBrain } from "../game/companion-brain.ts"
import type { DrawerId } from "../game/drawer.ts"
import type { MusicController } from "../game/music.ts"

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
  return Ctor ? new Ctor() : null
}

/** Mic is usable only when Web Speech exists and we are not in a sandboxed preview. */
export function micUsable(): boolean {
  return speechRecognitionSupported() && !inRestrictedPreview()
}

export function VoiceCommandMic({
  music,
  onOpenDrawer,
  compact = false,
}: {
  music?: MusicController
  onOpenDrawer?: (id: DrawerId) => void
  compact?: boolean
}) {
  const [usable, setUsable] = useState(false)
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  // v18.1: XO's spoken answers stay up long enough to read; command confirmations still clear in 3 s.
  const [statusMs, setStatusMs] = useState(3000)

  useEffect(() => {
    setUsable(micUsable())
  }, [])

  useEffect(() => {
    if (!status) return
    const id = window.setTimeout(() => setStatus(null), statusMs)
    return () => window.clearTimeout(id)
  }, [status, statusMs])

  const listen = useCallback(() => {
    const rec = getRecognition()
    if (!rec) {
      setStatus("Voice is not available here.")
      return
    }
    rec.lang = "en-US"
    rec.interimResults = false
    rec.maxAlternatives = 2
    rec.continuous = false
    setListening(true)
    setStatus("Listening… ask XO anything, or say a command.")
    rec.onresult = (ev) => {
      const transcript = ev.results?.[0]?.[0]?.transcript ?? ""
      const action = parseVoiceCommand(transcript, getLocalStore())
      setListening(false)
      // v18.1: anything that is not a game command is a question for XO (live Grok Bot with the player's key,
      // else the built-in AI). Before this, questions only got the "Try 'turn the music down'…" hint.
      if (action.type === "none" && transcript.trim().length >= 2) {
        setStatusMs(60_000)
        setStatus(`You: “${transcript.trim().slice(0, 80)}” · XO is thinking…`)
        void getCompanionBrain()
          .ask(transcript)
          .then((r) => {
            setStatusMs(r.liveError ? 20_000 : 12_000)
            setStatus(r.liveError ? `${r.reply} · Live Grok Bot problem: ${r.liveError}` : r.reply)
            void xoSpeak(r.reply)
          })
          .catch(() => {
            setStatusMs(8000)
            setStatus("XO could not answer that one. Try again.")
          })
        return
      }
      const applied = applyVoiceCommand(action, getLocalStore(), music)
      setStatusMs(3000)
      setStatus(applied.say)
      void xoSpeak(applied.say)
      if (applied.openDrawer) onOpenDrawer?.(applied.openDrawer)
    }
    rec.onerror = () => {
      setStatus("Mic error — try again or use the pause menu.")
      setListening(false)
    }
    rec.onend = () => setListening(false)
    try {
      rec.start()
    } catch {
      setStatus("Could not start the mic.")
      setListening(false)
    }
  }, [music, onOpenDrawer])

  // Sandbox / no Web Speech: hide the button and never show an error at load.
  if (!usable) return null

  return (
    <div className={`mic-choice${compact ? " compact" : ""}`}>
      <button type="button" className="touch-btn mic-btn" onClick={listen} disabled={listening} aria-pressed={listening}>
        {listening ? "Listening…" : "Voice"}
      </button>
      {status ? (
        <p className="voice-toast" role="status">
          {status}
        </p>
      ) : null}
    </div>
  )
}
