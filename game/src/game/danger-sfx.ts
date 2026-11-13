/** Short DANGER alarm sting via Web Audio. Respects SFX mute. */

import { readSfxPreference, type PreferenceStore } from "./music.ts"

let ctx: AudioContext | null = null

export function playDangerAlarm(store: PreferenceStore | null): boolean {
  try {
    if (!readSfxPreference(store).saved.enabled) return false
    const AC =
      (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return false
    if (!ctx) ctx = new AC()
    void ctx.resume()
    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "square"
    osc.frequency.setValueAtTime(880, t0)
    osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.28)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + 0.34)
    return true
  } catch {
    return false
  }
}
