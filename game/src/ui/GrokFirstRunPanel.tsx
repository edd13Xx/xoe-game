import { cancelGrokRequests, grokRequestEpoch } from "../game/grok-requests.ts"
import { useState, useRef } from "react"
import {
  XAI_CONSOLE_URL,
  readGrokConnectSettings,
  writeGrokConnectSettings,
  writeGrokFirstRunDismissed,
  type GrokConnectSettings,
} from "../game/grok-connect-settings.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { probeLiveGrokDetail, xaiKeyProblem } from "../game/grok-live-probe.ts"
import { SAFARI_GROK_HINT, inRestrictedPreview } from "../game/sandbox.ts"

/**
 * Small skippable first-load panel: paste xAI key, test it, Save, device-only note, console link.
 * Never logs or displays the full key.
 */
export function GrokFirstRunPanel({
  onSaved,
  onSkip,
  bare = false,
}: {
  /** v18: inside the XOE menu the section already has the heading + intro, so skip them. */
  bare?: boolean
  onSaved: (next: GrokConnectSettings, note?: string) => void
  onSkip: () => void
}) {
  const initial = readGrokConnectSettings(getLocalStore())
  const [remember, setRemember] = useState(initial.remember === true)
  const [draft, setDraft] = useState(initial.apiKey)
  const [savedNote, setSavedNote] = useState<string | null>(
    initial.storageError ?? (inRestrictedPreview() ? SAFARI_GROK_HINT : null),
  )
  const [busy, setBusy] = useState(false)
  const probeGeneration = useRef(0)

  async function saveAndTest() {
    const key = draft.trim()
    const problem = key ? xaiKeyProblem(key) : null
    if (problem) {
      setSavedNote(problem)
      return
    }
    const next: GrokConnectSettings = {
      ...initial,
      enabled: true,
      apiKey: key,
      remember,
    }
    if (!writeGrokConnectSettings(getLocalStore(), next)) {
      setSavedNote("Grok Bot could not save key settings. Try a private browser session.")
      return
    }
    writeGrokFirstRunDismissed(getLocalStore(), true)
    if (!key) {
      setSavedNote("Saved. Built-in AI stays available.")
      onSaved(next, "Saved. Built-in AI stays available.")
      return
    }
    if (inRestrictedPreview()) {
      setSavedNote(SAFARI_GROK_HINT)
      onSaved(next, SAFARI_GROK_HINT)
      return
    }
    setBusy(true)
    const epoch = grokRequestEpoch()
    const generation = ++probeGeneration.current
    const detail = await probeLiveGrokDetail(next)
    if (epoch !== grokRequestEpoch() || generation !== probeGeneration.current) { setBusy(false); return }
    setBusy(false)
    setSavedNote(detail.message)
    onSaved(next, detail.message)
  }

  function skip() {
    probeGeneration.current++
    setBusy(false)
    cancelGrokRequests()
    writeGrokFirstRunDismissed(getLocalStore(), true)
    onSkip()
  }

  return (
    <section className="panel grok-first-run" role="region" aria-label="Grok Bot key setup">
      {!bare ? <h2>Grok Bot is ready</h2> : null}
      {!bare ? (
        <p className="fine">Paste your xAI key (it starts with xai-) to turn on live Grok Bot. Skip anytime — XOE uses the built-in AI until then.</p>
      ) : null}
      <label className="name-field">
        xAI API key
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          placeholder="xai-…"
          onChange={(e) => setDraft(e.target.value)}
          aria-label="xAI API key"
        />
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Remember on this device (not encrypted; trusted devices only)
      </label>
      <div className="menu-row grok-first-run-actions">
        <button type="button" className="touch-btn primary" onClick={() => void saveAndTest()} disabled={busy}>
          {busy ? "Testing…" : "Save and test"}
        </button>
        {busy ? <p className="fine" role="status">Testing… live Grok Bot can take up to 45 seconds.</p> : null}
        <button type="button" className="touch-btn ghost" onClick={skip}>
          Skip for now
        </button>
      </div>
      {savedNote ? (
        <p className="status-line" role="status">
          {savedNote}
        </p>
      ) : null}
      <p className="fine">Grok Bot sends your key directly to xAI over HTTPS. Session-only by default. Remember saves in this browser, not encrypted. Use a limited key on a trusted device; Disconnect deletes it. Never included in reports.</p>
      <p className="fine">
        Get a key:{" "}
        <a className="tap-link" href={XAI_CONSOLE_URL} target="_blank" rel="noopener noreferrer">
          console.x.ai
        </a>
      </p>
    </section>
  )
}
