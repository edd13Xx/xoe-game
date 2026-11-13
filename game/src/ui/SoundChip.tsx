import { useEffect, useState } from "react"
import { isSoundMuted, onSoundChange, setSoundMuted, soundState, unlockAudioInGesture } from "../game/audio-unlock.ts"
import type { MusicController } from "../game/music.ts"

/** v18.2: always-visible sound indicator. iPhone needs one tap before music or XO's voice can play. */
export function SoundChip({ music, long = false }: { music: MusicController; long?: boolean }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const off = onSoundChange(() => setTick((n) => n + 1))
    const id = window.setInterval(() => setTick((n) => n + 1), 1500)
    return () => {
      off()
      window.clearInterval(id)
    }
  }, [])
  const st = soundState(music)
  const text = st === "tap" ? (long ? "🔇 Tap for sound" : "🔇 Tap") : st === "on" ? (long ? "🔊 Sound on" : "🔊 On") : long ? "🔈 Sound off" : "🔈 Off"
  return (
    <button
      type="button"
      className={`touch-btn sound-chip sound-${st}`}
      data-sound={st}
      aria-label={st === "tap" ? "Tap for sound" : st === "on" ? "Sound on. Tap to mute." : "Sound off. Tap to turn on."}
      onClick={() => {
        if (st === "on") {
          setSoundMuted(true)
          music.setEnabled(false)
        } else {
          if (isSoundMuted()) setSoundMuted(false)
          music.setEnabled(true)
          unlockAudioInGesture(music)
        }
        setTick((n) => n + 1)
      }}
    >
      {text}
    </button>
  )
}
