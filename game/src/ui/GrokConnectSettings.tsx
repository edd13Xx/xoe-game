import { grokRequestEpoch } from "../game/grok-requests.ts"
import { useEffect, useState, useRef } from "react"
import {
  GROK_CONNECT_WARNING,
  XAI_CONSOLE_URL,
  disconnectGrok,
  maskApiKey,
  readGrokConnectSettings,
  setGrokEnabled,
  writeGrokConnectSettings,
  type GrokConnectSettings,
} from "../game/grok-connect-settings.ts"
import {
  readGrokVoiceSettings,
  writeGrokVoiceSettings,
  type GrokVoiceSettings,
} from "../game/xo-speech.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { probeLiveGrokDetail, xaiKeyProblem } from "../game/grok-live-probe.ts"
import { SAFARI_GROK_HINT, inRestrictedPreview } from "../game/sandbox.ts"
import { GROK_BOT_RELAY_BASE, GROK_BOT_RELAY_ENABLED, readTesterCode, relayReachableFromPage, writeTesterCode } from "../game/grok-bot-relay.ts"

function store() {
  return getLocalStore()
}

export function GrokConnectSettingsPanel({
  compact = false,
  initialNote = null,
  onChange,
}: {
  compact?: boolean
  /** v18: carries the first-run "Save and test" result over so it is not lost when the box swaps. */
  initialNote?: string | null
  onChange?: (next: GrokConnectSettings) => void
}) {
  const [settings, setSettings] = useState<GrokConnectSettings>(() => readGrokConnectSettings(null))
  const [voice, setVoice] = useState<GrokVoiceSettings>(() => readGrokVoiceSettings(null))
  const [showKey, setShowKey] = useState(false)
  const [probeNote, setProbeNote] = useState<string | null>(initialNote ?? (inRestrictedPreview() ? SAFARI_GROK_HINT : null))
  const [busy, setBusy] = useState(false)
  const probeGeneration = useRef(0)
  const [tester, setTester] = useState("")

  useEffect(() => {
    setSettings(readGrokConnectSettings(store()))
    setVoice(readGrokVoiceSettings(store()))
    setTester(readTesterCode(store()))
  }, [])

  function persist(next: GrokConnectSettings) {
    if (next.storageError) {
      setProbeNote(next.storageError)
    } else if (!writeGrokConnectSettings(store(), next)) {
      setProbeNote("Grok Bot could not save key settings. Clear site data before leaving a shared device.")
    }
    setSettings(next)
    onChange?.(next)
  }

  return (
    <section className={compact ? "grok-connect compact" : "grok-connect panel"} aria-label="Grok Bot settings">
      {!compact ? <h2>Grok Bot settings</h2> : <p className="fine">Grok Bot settings</p>}
      <div className="menu-row grok-quick-row">
        <button
          type="button"
          className="touch-btn grok-toggle-btn"
          aria-pressed={settings.enabled}
          onClick={() => persist(setGrokEnabled(store(), !settings.enabled))}
        >
          Grok Bot {settings.enabled ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          className="touch-btn ghost grok-disconnect-btn"
          onClick={() => { probeGeneration.current++; setBusy(false); persist(disconnectGrok(store())) }}
          disabled={!settings.apiKey.trim()}
        >
          Disconnect Grok Bot
        </button>
      </div>
      <p className="fine">
        {settings.enabled
          ? "ON = live Grok Bot when your key is saved. OFF = built-in AI only (key kept)."
          : "OFF = no xAI calls. Your key stays on this device until Disconnect."}
      </p>
      <div className="grok-connect-fields">
        {!compact ? (
          <p className="price-source-rule" role="note">
            {GROK_CONNECT_WARNING}
          </p>
        ) : null}
        <label className="name-field">
          API key (this device only)
          <input
            type={showKey ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={settings.apiKey}
            placeholder={settings.apiKey ? maskApiKey(settings.apiKey) : "xai-…"}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
            aria-label="xAI API key"
          />
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={settings.remember === true} onChange={(e) => setSettings({ ...settings, remember: e.target.checked })} />
          Remember on this device (not encrypted; trusted devices only)
        </label>
        <div className="menu-row">
          <button type="button" className="touch-btn ghost" onClick={() => setShowKey((v) => !v)}>
            {showKey ? "Hide key" : "Show key"}
          </button>
          <button
            type="button"
            className="touch-btn primary"
            disabled={busy || !settings.apiKey.trim()}
            onClick={async () => {
              const problem = xaiKeyProblem(settings.apiKey)
              if (problem) {
                setProbeNote(problem)
                return
              }
              if (inRestrictedPreview()) {
                setProbeNote(SAFARI_GROK_HINT)
                return
              }
              if (!writeGrokConnectSettings(store(), settings)) {
                setProbeNote("Grok Bot could not save this key. Try a private browser session.")
                return
              }
              onChange?.(settings)
              setBusy(true)
              const epoch = grokRequestEpoch()
    const generation = ++probeGeneration.current
              const detail = await probeLiveGrokDetail(settings)
              if (epoch !== grokRequestEpoch() || generation !== probeGeneration.current) { setBusy(false); return }
              setBusy(false)
              setProbeNote(detail.message)
            }}
          >
            {busy ? "Testing… (up to 45 s)" : "Save and test Grok Bot"}
          </button>
        </div>
        {probeNote ? (
          <p className="status-line" role="status">
            {probeNote}
          </p>
        ) : null}
        <p className="fine">
          Get a key at{" "}
          <a className="tap-link" href={XAI_CONSOLE_URL} target="_blank" rel="noopener noreferrer">
            console.x.ai
          </a>
          . Grok Bot sends the key directly to xAI over HTTPS. Session-only by default. Remember saves in browser storage, not encrypted. Disconnect clears it. Never included in reports. Stored mask:{" "}
          {maskApiKey(settings.apiKey) || "none"}
        </p>
        {GROK_BOT_RELAY_ENABLED && relayReachableFromPage(GROK_BOT_RELAY_BASE) ? (
          <label className="name-field">
            Grok Bot test code (testers only)
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={tester}
              placeholder="From Eddie"
              onChange={(e) => {
                setTester(e.target.value)
                writeTesterCode(store(), e.target.value)
              }}
              aria-label="Grok Bot test code"
            />
            <span className="fine">With a code and Grok Bot ON, XOE asks Grok Bot (about a minute). Otherwise built-in AI answers.</span>
          </label>
        ) : null}
        <details className="grok-advanced" open={!compact}>
          <summary>Advanced: endpoint, model, voice</summary>
        <label className="name-field">
          Endpoint
          <input
            value={settings.endpoint}
            readOnly
            aria-label="Grok Bot endpoint"
          />
        </label>
        <label className="name-field">
          Model
          <input
            value={settings.model}
            onChange={(e) => persist({ ...settings, model: e.target.value })}
            aria-label="Grok Bot model"
          />
        </label>
        <label className="toggle-row">
          <span>Grok Bot voice {voice.enabled ? "ON" : "OFF"} (TTS · network)</span>
          <button
            type="button"
            className="touch-btn"
            aria-pressed={voice.enabled}
            onClick={() => {
              const next = { ...voice, enabled: !voice.enabled }
              writeGrokVoiceSettings(store(), next)
              setVoice(next)
            }}
          >
            {voice.enabled ? "Voice off" : "Voice on"}
          </button>
        </label>
        {voice.enabled ? (
          <>
            <label className="name-field">
              TTS endpoint
              <input
                value={voice.ttsEndpoint}
                readOnly
                aria-label="Grok Bot TTS endpoint"
              />
            </label>
            <label className="name-field">
              Voice id
              <input
                value={voice.voiceId}
                onChange={(e) => {
                  const next = { ...voice, voiceId: e.target.value || "eve" }
                  writeGrokVoiceSettings(store(), next)
                  setVoice(next)
                }}
                aria-label="Grok Bot voice id"
              />
            </label>
            <p className="fine">Uses xAI TTS. Falls back to captions, or opted-in browser voice. Off by default.</p>
          </>
        ) : (
          <p className="fine">Voice off = captions or opted-in browser speech. TTS needs your key and Grok Bot ON.</p>
        )}
        </details>
      </div>
    </section>
  )
}
