import { browserSpeechEnabled, setBrowserSpeechEnabled, BROWSER_SPEECH_NOTE } from "../game/browser-speech-consent.ts"
import { xoSpeak } from "../game/xo-speech.ts"
import { useEffect, useMemo, useState } from "react"
import { speakDeviceLine, speakVoiceReminderIfIdle, setChosenVoiceURI } from "../game/device-speech.ts"
import { getCompanionBrain } from "../game/companion-brain.ts"
import { GROK_UNAVAILABLE } from "../game/grok-guest.ts"
import {
  clearVoicePreference,
  readVoicePreference,
  writeVoicePreference,
} from "../game/voice-storage.ts"
import {
  VOICE_PREVIEW_LINE,
  VOICE_REMINDER,
  listDeviceVoices,
  resolveVoiceChoice,
  type ListedVoice,
} from "../game/voices.ts"
import { getLocalStore } from "../game/safe-storage.ts"


function browserStore() {
  return getLocalStore()
}

function readVoices(): SpeechSynthesisVoice[] {
  try {
    const synth = window.speechSynthesis
    if (!synth || typeof synth.getVoices !== "function") return []
    return synth.getVoices()
  } catch {
    return []
  }
}

export function VoiceSettings() {
  const [browserVoice, setBrowserVoice] = useState(browserSpeechEnabled)
  const [voices, setVoices] = useState<ListedVoice[]>([])
  const [selectedUri, setSelectedUri] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [storageNote, setStorageNote] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [grokStatus, setGrokStatus] = useState(GROK_UNAVAILABLE)
  const [grokReply, setGrokReply] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const listed = useMemo(() => voices, [voices])

  useEffect(() => {
    if (!browserVoice) return
    const apply = () => {
      const next = listDeviceVoices(
        readVoices().map((voice) => ({
          voiceURI: voice.voiceURI,
          name: voice.name,
          lang: voice.lang,
          default: voice.default,
          localService: voice.localService,
        })),
      )
      const stored = readVoicePreference(browserStore())
      const resolved = resolveVoiceChoice(next, stored.saved)
      setVoices(next)
      setSelectedUri(resolved.selected?.voiceURI ?? null)
      setChosenVoiceURI(resolved.selected?.voiceURI ?? null)
      setNotice(resolved.notice)
      setStorageNote(stored.storageBlocked ? "Device voice preference storage is blocked in this browser." : null)
    }
    apply()
    let synth: SpeechSynthesis | null = null
    try {
      synth = window.speechSynthesis
    } catch {
      return
    }
    if (!synth) return
    synth.addEventListener("voiceschanged", apply)
    return () => synth.removeEventListener("voiceschanged", apply)
  }, [browserVoice])

  function selectVoice(voice: ListedVoice) {
    setSelectedUri(voice.voiceURI)
    setChosenVoiceURI(voice.voiceURI)
    setNotice(null)
    const saved = writeVoicePreference(browserStore(), {
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
    })
    if (!saved) setStorageNote("Device voice preference storage is blocked in this browser.")
  }

  function resetVoice() {
    clearVoicePreference(browserStore())
    const resolved = resolveVoiceChoice(listed, null)
    setSelectedUri(resolved.selected?.voiceURI ?? null)
    setChosenVoiceURI(resolved.selected?.voiceURI ?? null)
    setNotice("Voice reset to the browser default.")
  }

  async function sendGrok() {
    if (sending) return
    setSending(true)
    setGrokReply(null)
    // Uses Connect-to-Grok (player key → api.x.ai) when ON; otherwise Backup AI.
    // Guest /api/grok proxy is not used here so standalone file:// builds still talk.
    const result = await getCompanionBrain().ask(draft)
    setGrokStatus(result.status)
    setGrokReply(result.reply)
    if (result.ok && result.reply) void xoSpeak(result.reply)
    setSending(false)
  }

  return (
    <details
      className="voice-settings"
      onToggle={(event) => {
        if (event.currentTarget.open) speakVoiceReminderIfIdle()
      }}
    >
      <summary>Voice settings</summary>
      <p role="note">{VOICE_REMINDER}</p>
      <label className="browser-voice-consent"><input type="checkbox" checked={browserVoice} onChange={e => { const saved = setBrowserSpeechEnabled(e.target.checked); setBrowserVoice(e.target.checked); if (!saved) setNotice("Browser voice preference could not be saved. This tab respects your choice; check it again after reloading.") }} /> Enable browser voice (off by default)</label>
      <p className="fine">{BROWSER_SPEECH_NOTE}</p>
      <p className="fine">
        These are speech voices reported by this browser. None is labeled as a character call voice. A saved choice is
        kept on this device when storage works.
      </p>
      {notice ? <p role="status">{notice}</p> : null}
      {storageNote ? <p role="status">{storageNote}</p> : null}
      {listed.length === 0 ? (
        <p role="status">{browserVoice ? "This browser reported no speech voices. Story text still shows." : "Browser voice is off. Story captions still show."}</p>
      ) : (
        <ul className="voice-list">
          {listed.map((voice) => (
            <li key={`${voice.voiceURI}-${voice.label}`}>
              <label>
                <input
                  type="radio"
                  name="device-voice"
                  checked={selectedUri === voice.voiceURI}
                  onChange={() => selectVoice(voice)}
                />
                {voice.label}
                {voice.isDefault ? " (browser default)" : ""}
              </label>
              <button type="button" disabled={!browserVoice} onClick={() => { selectVoice(voice); speakDeviceLine(VOICE_PREVIEW_LINE) }}>
                Preview
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={resetVoice}>
        Reset to browser default
      </button>
      <section aria-label="Ask Grok Bot from voice settings">
        <h2>Ask Grok Bot</h2>
        <p>
          Same path as Grok Bot integration: Connect to Grok Bot with your xAI key for a live reply, or the built-in AI offline.
          Playback uses Grok Bot voice when enabled with your key; browser voice needs separate opt-in.
        </p>
        <p role="status">{grokStatus}</p>
        {grokReply ? <p>{grokReply}</p> : null}
        <label>
          Message
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} maxLength={500} />
        </label>
        <button type="button" onClick={() => void sendGrok()} disabled={sending}>
          Send to Grok Bot
        </button>
      </section>
    </details>
  )
}
