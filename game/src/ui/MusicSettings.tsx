import { useEffect, useState } from "react"
import {
  MUSIC_STORAGE_KEY,
  readMusicPreference,
  readSfxPreference,
  writeMusicPreference,
  writeSfxPreference,
  type MusicController,
} from "../game/music.ts"
import {
  GAMEPAD_LEGEND,
  readGamepadPreference,
  writeGamepadPreference,
} from "../game/gamepad-controls.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { resetTutorialForReplay } from "../game/tutorial.ts"
import { readHapticsPreference, writeHapticsPreference } from "../game/haptics.ts"
import { readGhostPreference, writeGhostPreference } from "../game/race-ghost.ts"
import { readSideMissionPref, writeSideMissionPref } from "../game/side-missions.ts"
import { readTickerPref, writeTickerPref } from "../game/live-ticker.ts"
import {
  readFightDifficulty,
  writeFightDifficulty,
  type FightDifficulty,
} from "../game/combat.ts"
import { readVoiceReminderPref, setDontRemind } from "../game/voice-reminder.ts"

export function MusicSettings({
  music,
  reducedMotion,
  onReplayTutorial,
  onOpenScores,
  onOpenPaperDesk,
  forceOpen = false,
}: {
  music: MusicController
  reducedMotion: boolean
  onReplayTutorial?: () => void
  onOpenScores?: () => void
  onOpenPaperDesk?: () => void
  forceOpen?: boolean
}) {
  const [enabled, setEnabled] = useState(true)
  const [volume, setVolume] = useState(0.35)
  const [ambientVolume, setAmbientVolume] = useState(0.45)
  const [sfxEnabled, setSfxEnabled] = useState(true)
  const [padEnabled, setPadEnabled] = useState(false)
  const [hapticsOn, setHapticsOn] = useState(true)
  const [ghostOn, setGhostOn] = useState(true)
  const [sideOn, setSideOn] = useState(true)
  const [tickerOn, setTickerOn] = useState(true)
  const [fightDiff, setFightDiff] = useState<FightDifficulty>("normal")
  const [dontRemind, setDontRemindUi] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const store = getLocalStore()
    const musicPref = readMusicPreference(store)
    const sfxPref = readSfxPreference(store)
    // v18.2: Reduce Motion only changes the DEFAULT; once the player picks Music on, it plays.
    let explicit = false
    try {
      explicit = store?.getItem(MUSIC_STORAGE_KEY) != null
    } catch {
      explicit = false
    }
    const musicOn = musicPref.saved.enabled && (!reducedMotion || explicit)
    setEnabled(musicOn)
    setVolume(musicPref.saved.volume)
    setAmbientVolume(musicPref.saved.ambientVolume ?? 0.45)
    setSfxEnabled(sfxPref.saved.enabled)
    setPadEnabled(readGamepadPreference(store).enabled)
    setHapticsOn(readHapticsPreference(store).saved.enabled)
    setGhostOn(readGhostPreference(store).enabled)
    setSideOn(readSideMissionPref(store).enabled)
    setTickerOn(readTickerPref(store))
    setFightDiff(readFightDifficulty(store))
    setDontRemindUi(readVoiceReminderPref(store).dontRemind)
    setBlocked(musicPref.storageBlocked || sfxPref.storageBlocked)
    music.setEnabled(musicOn)
    music.setVolume(musicPref.saved.volume)
    music.setAmbientVolume(musicPref.saved.ambientVolume ?? 0.45)
  }, [music, reducedMotion])

  function persistMusic(nextEnabled: boolean, nextVolume: number, nextAmbient: number) {
    const store = getLocalStore()
    const ok = writeMusicPreference(store, {
      enabled: nextEnabled,
      volume: nextVolume,
      ambientVolume: nextAmbient,
    })
    setBlocked(!ok)
  }

  function persistSfx(next: boolean) {
    const store = getLocalStore()
    const ok = writeSfxPreference(store, { enabled: next })
    setBlocked(!ok)
  }

  return (
    <details className="music-settings" open={forceOpen || undefined}>
      <summary>Music & SFX settings</summary>
      <p className="fine">
        The Sound chip in the header mutes everything. Music and SFX below turn each part on or off.
      </p>
      <label className="toggle-row">
        <span>Music {enabled ? "on" : "off"}</span>
        <button
          type="button"
          className="touch-btn"
          aria-pressed={enabled}
          onClick={() => {
            music.unlock()
            const next = !enabled
            setEnabled(next)
            music.setEnabled(next)
            persistMusic(next, volume, ambientVolume)
          }}
        >
          Music {enabled ? "on" : "off"}
        </button>
      </label>
      <label className="vol-row">
        <span>Melody volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          aria-label="Melody volume"
          onChange={(event) => {
            music.unlock()
            const next = Number(event.target.value)
            setVolume(next)
            music.setVolume(next)
            persistMusic(enabled, next, ambientVolume)
          }}
        />
      </label>
      <label className="vol-row">
        <span>Mars ambient volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={ambientVolume}
          aria-label="Mars ambient volume"
          data-ambient-volume="1"
          onChange={(event) => {
            music.unlock()
            const next = Number(event.target.value)
            setAmbientVolume(next)
            music.setAmbientVolume(next)
            persistMusic(enabled, volume, next)
          }}
        />
      </label>
      <p className="fine">Ambient is the soft bed under the Mars melody. Mute/off still silences both.</p>
      <label className="toggle-row">
        <span>SFX {sfxEnabled ? "on" : "off"}</span>
        <button
          type="button"
          className="touch-btn"
          aria-pressed={sfxEnabled}
          aria-label={sfxEnabled ? "SFX on" : "SFX off"}
          data-sfx={sfxEnabled ? "on" : "off"}
          onClick={() => {
            const next = !sfxEnabled
            setSfxEnabled(next)
            persistSfx(next)
          }}
        >
          SFX {sfxEnabled ? "on" : "off"}
        </button>
      </label>
      <p className="fine">XO voice uses Voice settings, not Music or SFX.</p>
      <label className="toggle-row">
        <span>Controller {padEnabled ? "ON" : "OFF"} (optional)</span>
        <button
          type="button"
          className="touch-btn"
          aria-pressed={padEnabled}
          onClick={() => {
            const next = !padEnabled
            setPadEnabled(next)
            writeGamepadPreference(getLocalStore(), { enabled: next })
          }}
        >
          Controller {padEnabled ? "on" : "off"}
        </button>
      </label>
      {padEnabled ? (
        <ul className="fine">
          {GAMEPAD_LEGEND.map((row) => (
            <li key={row.button}>
              {row.button}: {row.action}
            </li>
          ))}
        </ul>
      ) : (
        <p className="fine">Off by default. Left stick moves; face buttons map to trade actions.</p>
      )}
      <label className="toggle-row">
        <span>Phone haptic {hapticsOn ? "on" : "off"}</span>
        <button
          type="button"
          className="touch-btn"
          aria-pressed={hapticsOn}
          onClick={() => {
            const next = !hapticsOn
            setHapticsOn(next)
            writeHapticsPreference(getLocalStore(), { enabled: next })
          }}
        >
          Haptic {hapticsOn ? "on" : "off"}
        </button>
      </label>
      <p className="fine">Short buzz on a correct gate when the phone supports it. Off with reduced motion.</p>
      <label className="toggle-row">
        <span>Race ghost {ghostOn ? "on" : "off"}</span>
        <button
          type="button"
          className="touch-btn"
          aria-pressed={ghostOn}
          onClick={() => {
            const next = !ghostOn
            setGhostOn(next)
            writeGhostPreference(getLocalStore(), { enabled: next })
          }}
        >
          Ghost {ghostOn ? "on" : "off"}
        </button>
      </label>
      <p className="fine">Faint path of your fastest clear when replaying a colony. Device-only. Off with reduced motion.</p>
      <label className="toggle-row">
        <span>Side missions {sideOn ? "on" : "off"}</span>
        <button
          type="button"
          className="touch-btn"
          aria-pressed={sideOn}
          data-side-missions={sideOn ? "on" : "off"}
          onClick={() => {
            const next = !sideOn
            setSideOn(next)
            writeSideMissionPref(getLocalStore(), { enabled: next })
          }}
        >
          Side missions {sideOn ? "on" : "off"}
        </button>
      </label>
      <p className="fine">Occasional phishing (you play) or remote-hack DANGER (XOE auto-pilots). Default on.</p>
      {reducedMotion ? <p className="fine">Reduce Motion starts with music off. Tap Music on to hear it.</p> : null}
      {blocked ? <p className="fine">Audio preference could not be saved in this browser.</p> : null}
      <label className="toggle-row">
        <span>Live ticker {tickerOn ? "on" : "off"}</span>
        <button
          type="button"
          className="touch-btn"
          aria-pressed={tickerOn}
          data-ticker={tickerOn ? "on" : "off"}
          onClick={() => {
            const next = !tickerOn
            setTickerOn(next)
            writeTickerPref(getLocalStore(), next)
          }}
        >
          Ticker {tickerOn ? "on" : "off"}
        </button>
      </label>
      <p className="fine">Slim Coinbase public prices plus the XOE/USD sim ticker. Offline uses a stand-in walk. Testnet only.</p>
      <label className="vol-row">
        <span>Fighting difficulty</span>
        <select
          value={fightDiff}
          aria-label="Fighting difficulty"
          onChange={(e) => {
            const next = e.target.value as FightDifficulty
            setFightDiff(next)
            writeFightDifficulty(getLocalStore(), next)
          }}
        >
          <option value="easy">Easy</option>
          <option value="normal">Normal</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      {onOpenPaperDesk ? (
        <button type="button" className="touch-btn ghost" onClick={onOpenPaperDesk}>
          XOE trade desk
        </button>
      ) : null}
      {onReplayTutorial ? (
        <button
          type="button"
          className="touch-btn ghost"
          onClick={() => {
            resetTutorialForReplay(getLocalStore())
            onReplayTutorial()
          }}
        >
          Replay tutorial
        </button>
      ) : null}
      {onOpenScores ? (
        <button type="button" className="touch-btn ghost" onClick={onOpenScores}>
          High scores
        </button>
      ) : null}
      <label className="toggle-row">
        <span>Grok Bot voice reminder</span>
        <button
          type="button"
          className="touch-btn"
          aria-pressed={!dontRemind}
          data-voice-remind={dontRemind ? "off" : "on"}
          onClick={() => {
            const next = !dontRemind
            setDontRemindUi(next)
            setDontRemind(getLocalStore(), next)
          }}
        >
          {dontRemind ? "Don’t remind" : "Remind"}
        </button>
      </label>
      <p className="fine">When on, XOE sparingly reminds you that Grok Bot can take voice commands.</p>
    </details>
  )
}
