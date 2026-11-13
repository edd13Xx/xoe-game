import {
  disconnectGrok,
  setGrokEnabled,
  type GrokConnectSettings,
} from "../game/grok-connect-settings.ts"
import { getLocalStore } from "../game/safe-storage.ts"

/** One-tap Grok Bot ON/OFF + Disconnect from the HUD. */
export function GrokHudControls({
  settings,
  onChange,
}: {
  settings: GrokConnectSettings
  onChange: (next: GrokConnectSettings) => void
}) {

  function toggle() {
    const next = setGrokEnabled(getLocalStore(), !settings.enabled)
    onChange(next)
  }

  function disconnect() {
    const next = disconnectGrok(getLocalStore())
    onChange(next)
  }

  return (
    <div className="grok-hud-controls" role="group" aria-label="Grok Bot quick controls">
      <button
        type="button"
        className="touch-btn grok-toggle-btn"
        aria-pressed={settings.enabled}
        onClick={toggle}
      >
        Grok Bot {settings.enabled ? "ON" : "OFF"}
      </button>
      <button
        type="button"
        className="touch-btn ghost grok-disconnect-btn"
        onClick={disconnect}
        title="Delete saved xAI key on this device"
      >
        Disconnect Grok Bot
      </button>
      {settings.storageError ? <p role="alert">{settings.storageError}</p> : null}
    </div>
  )
}
