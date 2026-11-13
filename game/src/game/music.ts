/** Original chiptune loops via Web Audio. No files, no copyrighted tracks. */

export type MusicTheme = "title" | "colony" | "mars" | "trade" | "combat" | "story" | "ragnarok" | "ending" | "moon" | "town" | "credits" | "silence"

export const MUSIC_STORAGE_KEY = "xeno.deviceMusic.v1"

export interface MusicPreference {
  enabled: boolean
  volume: number
  /** Mars ambient bed level, separate from melody volume. */
  ambientVolume: number
}

export interface PreferenceStore {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0.35
  return Math.min(1, Math.max(0, value))
}

export function readMusicPreference(store: PreferenceStore | null): {
  saved: MusicPreference
  storageBlocked: boolean
} {
  const fallback: MusicPreference = { enabled: true, volume: 0.35, ambientVolume: 0.45 }
  if (!store) return { saved: fallback, storageBlocked: true }
  try {
    const raw = store.getItem(MUSIC_STORAGE_KEY)
    if (!raw) return { saved: fallback, storageBlocked: false }
    const parsed = JSON.parse(raw) as Partial<MusicPreference>
    return {
      saved: {
        enabled: parsed.enabled !== false,
        volume: clampVolume(typeof parsed.volume === "number" ? parsed.volume : 0.35),
        ambientVolume: clampVolume(
          typeof parsed.ambientVolume === "number" ? parsed.ambientVolume : 0.45,
        ),
      },
      storageBlocked: false,
    }
  } catch {
    return { saved: fallback, storageBlocked: true }
  }
}

export function writeMusicPreference(store: PreferenceStore | null, saved: MusicPreference): boolean {
  if (!store) return false
  try {
    store.setItem(
      MUSIC_STORAGE_KEY,
      JSON.stringify({
        enabled: saved.enabled,
        volume: clampVolume(saved.volume),
        ambientVolume: clampVolume(
          typeof saved.ambientVolume === "number" ? saved.ambientVolume : 0.45,
        ),
      }),
    )
    return true
  } catch {
    return false
  }
}

export const SFX_STORAGE_KEY = "xeno.deviceSfx.v1"

export interface SfxPreference {
  enabled: boolean
}

export function readSfxPreference(store: PreferenceStore | null): {
  saved: SfxPreference
  storageBlocked: boolean
} {
  const fallback: SfxPreference = { enabled: true }
  if (!store) return { saved: fallback, storageBlocked: true }
  try {
    const raw = store.getItem(SFX_STORAGE_KEY)
    if (!raw) return { saved: fallback, storageBlocked: false }
    const parsed = JSON.parse(raw) as Partial<SfxPreference>
    return {
      saved: { enabled: parsed.enabled !== false },
      storageBlocked: false,
    }
  } catch {
    return { saved: fallback, storageBlocked: true }
  }
}

export function writeSfxPreference(store: PreferenceStore | null, saved: SfxPreference): boolean {
  if (!store) return false
  try {
    store.setItem(SFX_STORAGE_KEY, JSON.stringify({ enabled: saved.enabled === true }))
    return true
  } catch {
    return false
  }
}


/** Pattern: [midi-ish degree or null rest, duration in sixteenths] */
type Step = readonly [number | null, number]

const THEMES: Record<Exclude<MusicTheme, "silence">, { bpm: number; wave: OscillatorType; steps: readonly Step[] }> = {
  title: {
    bpm: 96,
    wave: "square",
    steps: [
      [0, 2], [2, 2], [4, 2], [7, 2], [4, 2], [2, 2], [0, 4],
      [0, 2], [4, 2], [7, 2], [9, 2], [7, 2], [4, 2], [0, 4],
      [null, 2], [2, 2], [5, 2], [7, 2], [5, 2], [2, 2], [0, 4],
      [7, 2], [5, 2], [4, 2], [2, 2], [0, 4], [null, 4],
    ],
  },
  colony: {
    bpm: 110,
    wave: "triangle",
    steps: [
      [0, 2], [4, 2], [7, 2], [4, 2], [9, 2], [7, 2], [4, 2], [0, 2],
      [2, 2], [5, 2], [9, 2], [5, 2], [7, 2], [4, 2], [2, 2], [0, 2],
      [0, 2], [null, 2], [4, 2], [7, 2], [12, 2], [7, 2], [4, 2], [0, 2],
    ],
  },
  /** Dusty Mars overworld — slower, sparse, warm triangle bed. */
  mars: {
    bpm: 88,
    wave: "triangle",
    steps: [
      [0, 4], [3, 2], [5, 2], [7, 4], [5, 2], [3, 2],
      [0, 4], [null, 2], [2, 2], [5, 4], [3, 4],
      [7, 2], [5, 2], [3, 2], [0, 4], [null, 4],
      [2, 4], [0, 4], [3, 2], [5, 6], [null, 2],
    ],
  },
  ragnarok: {
    bpm: 140,
    wave: "sawtooth",
    steps: [
      [0, 1], [0, 1], [3, 2], [0, 1], [0, 1], [6, 2],
      [0, 1], [3, 1], [6, 1], [8, 1], [6, 2], [3, 2],
      [0, 1], [0, 1], [3, 2], [8, 2], [6, 2], [3, 2],
      [0, 2], [null, 1], [0, 1], [3, 2], [6, 4],
    ],
  },
  trade: {
    bpm: 84,
    wave: "triangle",
    steps: [
      [0, 4], [null, 2], [4, 2], [7, 4], [4, 2], [2, 2],
      [0, 4], [5, 4], [4, 2], [2, 2], [0, 6], [null, 2],
      [7, 4], [5, 2], [4, 2], [0, 8],
    ],
  },
  combat: {
    bpm: 140,
    wave: "sawtooth",
    steps: [
      [0, 1], [0, 1], [7, 2], [0, 1], [3, 1], [8, 2],
      [0, 1], [0, 1], [6, 2], [3, 1], [6, 1], [10, 2],
      [0, 1], [7, 1], [0, 1], [8, 1], [6, 2], [3, 2],
      [0, 2], [null, 2], [0, 1], [0, 1], [7, 4],
    ],
  },
  story: {
    bpm: 68,
    wave: "sine",
    steps: [
      [0, 8], [4, 8], [7, 8], [4, 8],
      [2, 8], [5, 8], [0, 8], [null, 8],
      [7, 6], [5, 6], [4, 4], [0, 8],
    ],
  },
  ending: {
    bpm: 76,
    wave: "sine",
    steps: [
      [0, 4], [2, 4], [4, 4], [7, 4], [4, 4], [2, 4], [0, 8],
      [0, 4], [4, 4], [7, 4], [9, 4], [7, 4], [4, 4], [0, 8],
      [7, 4], [5, 4], [4, 4], [2, 4], [0, 8], [null, 4],
    ],
  },
  /** Quiet approach bed — root shifts colder on Xelm, warmer on Sol. */
  moon: {
    bpm: 60,
    wave: "sine",
    steps: [
      [0, 8], [7, 8], [4, 8], [null, 4],
      [2, 8], [9, 8], [0, 8], [null, 4],
      [7, 6], [4, 6], [0, 8], [null, 4],
    ],
  },
  /** Dock-side walking bed for Harbor and Aurora. */
  town: {
    bpm: 78,
    wave: "triangle",
    steps: [
      [0, 4], [2, 2], [4, 2], [5, 4], [4, 2], [2, 2],
      [0, 4], [null, 2], [4, 2], [7, 4], [5, 4],
      [4, 2], [2, 2], [0, 6], [null, 2],
    ],
  },
  credits: {
    bpm: 70,
    wave: "sine",
    steps: [
      [0, 8], [4, 8], [7, 8], [9, 8],
      [7, 8], [4, 8], [2, 8], [0, 8],
      [4, 6], [2, 6], [0, 8], [null, 4],
    ],
  },
}

function midiToHz(degree: number, root = 55): number {
  // pentatonic-ish degrees from root A1-ish
  const scale = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 22]
  const semitone = scale[((degree % scale.length) + scale.length) % scale.length]! + 12 * Math.floor(degree / scale.length)
  return root * Math.pow(2, semitone / 12)
}

export interface MusicController {
  unlock: () => void
  setTheme: (theme: MusicTheme) => void
  setEnabled: (enabled: boolean) => void
  setVolume: (volume: number) => void
  setAmbientVolume: (volume: number) => void
  getAmbientVolume: () => number
  stop: () => void
  getTheme: () => MusicTheme
  isUnlocked: () => boolean
  /** v18.2: true only when the AudioContext is really running (iOS keeps it "suspended" until a real tap). */
  isRunning: () => boolean
  setMutedBySystem: (muted: boolean) => void
  /** Map region id for a light timbre shift on exploration music. */
  setRegion: (id: string | null) => void
  /** Ragnarok layering (0–3) as the boss powers up. */
  setBossLayer: (layer: number) => void
  /** Darker red-day variant under a solar flare. */
  setFlareLayer: (on: boolean) => void
}

export function createMusicController(options?: {
  audioContext?: AudioContext
  mutedBySystem?: boolean
}): MusicController {
  let ctx: AudioContext | null = options?.audioContext ?? null
  let master: GainNode | null = null
  let theme: MusicTheme = "silence"
  let enabled = true
  let volume = 0.35
  let ambientVolume = 0.45
  let unlocked = false
  let ambientGainNodes: { bed: GainNode; noise: GainNode } | null = null
  let timer: number | null = null
  let stepIndex = 0
  let mutedBySystem = options?.mutedBySystem === true
  let ambientNodes: { stop: () => void } | null = null
  let regionId = "open"
  let bossLayer = 0
  let flareLayer = false

  function stopAmbient() {
    if (ambientNodes) {
      try {
        ambientNodes.stop()
      } catch {
        /* ignore */
      }
      ambientNodes = null
    }
  }

  function regionHue(): number {
    let h = 0
    for (const ch of regionId) h = (h + ch.charCodeAt(0) * 13) % 100
    return h / 100
  }
  function regionRoot(): number {
    if (regionId === "moon-pair-a") return 48
    if (regionId === "moon-pair-b") return 62
    if (regionId === "harbor-commons") return 50
    if (regionId === "aurora-port") return 58
    return 49 + Math.round((regionHue() - 0.5) * 12)
  }

  /** Soft bed under title, map, trade and story. Map also carries a light glitch texture. */
  function startMarsAmbient() {
    stopAmbient()
    if (!ctx || !master || !enabled || mutedBySystem || !unlocked) return
    if (theme !== "mars" && theme !== "title" && theme !== "trade" && theme !== "story") return
    try {
      const bed = ctx.createOscillator()
      const bedGain = ctx.createGain()
      bed.type = "sine"
      bed.frequency.value = (theme === "title" ? 110 : theme === "trade" ? 82 : theme === "story" ? 65 : regionRoot()) * (flareLayer ? 0.72 : 1)
      const amb = clampVolume(ambientVolume)
      bedGain.gain.value = 0.12 * amb
      bed.connect(bedGain)
      bedGain.connect(master)
      bed.start()

      const bufferSize = 2 * ctx.sampleRate
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.35
      const noise = ctx.createBufferSource()
      noise.buffer = noiseBuffer
      noise.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = "lowpass"
      filter.frequency.value = 320 + regionHue() * 220 + (theme === "title" ? 180 : 0)
      filter.Q.value = 0.7
      const noiseGain = ctx.createGain()
      noiseGain.gain.value = 0.045 * amb
      noise.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(master)
      noise.start()

      ambientGainNodes = { bed: bedGain, noise: noiseGain }
      ambientNodes = {
        stop() {
          ambientGainNodes = null
          try {
            bed.stop()
          } catch {
            /* ignore */
          }
          try {
            noise.stop()
          } catch {
            /* ignore */
          }
          try {
            bed.disconnect()
            bedGain.disconnect()
            noise.disconnect()
            filter.disconnect()
            noiseGain.disconnect()
          } catch {
            /* ignore */
          }
        },
      }
    } catch {
      ambientNodes = null
    }
  }

  function ensureGraph() {
    try {
      if (!ctx) {
        const AC = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
          (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AC) return false
        ctx = new AC()
      }
      if (!master && ctx) {
        master = ctx.createGain()
        master.gain.value = 0
        master.connect(ctx.destination)
      }
      return Boolean(ctx && master)
    } catch {
      ctx = null
      master = null
      return false
    }
  }

  function clearTimer() {
    if (timer !== null && typeof globalThis.clearTimeout === "function") {
      globalThis.clearTimeout(timer)
    }
    timer = null
  }

  function targetGain(): number {
    if (!enabled || mutedBySystem || theme === "silence") return 0
    // Keep under speech — soft bed
    return clampVolume(volume) * 0.22
  }

  function applyGain(now = ctx?.currentTime ?? 0) {
    if (!master || !ctx) return
    master.gain.cancelScheduledValues(now)
    master.gain.setTargetAtTime(targetGain(), now, 0.05)
  }

  function scheduleLoop() {
    clearTimer()
    if (!ctx || !master || theme === "silence" || !enabled || mutedBySystem || !unlocked) return
    const pattern = THEMES[theme]
    if (!pattern) return
    const sixteenth = 60 / pattern.bpm / 4
    const step = pattern.steps[stepIndex % pattern.steps.length]
    if (!step) return
    const [degree, dur] = step
    const seconds = dur * sixteenth
    if (degree !== null) {
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      const root = theme === "ragnarok" ? 65 : theme === "ending" || theme === "credits" ? 55 : theme === "mars" || theme === "town" || theme === "moon" ? regionRoot() : theme === "combat" ? 62 : theme === "trade" ? 46 : theme === "story" ? 52 : 55
      osc.type = flareLayer ? "sawtooth" : pattern.wave
      osc.frequency.value = midiToHz(degree, root + (flareLayer ? -5 : 0))
      env.gain.value = 0
      osc.connect(env)
      env.connect(master)
      const t0 = ctx.currentTime
      env.gain.setValueAtTime(0, t0)
      env.gain.linearRampToValueAtTime(theme === "ending" ? 0.55 : 0.7, t0 + 0.01)
      env.gain.exponentialRampToValueAtTime(0.001, t0 + Math.max(0.05, seconds * 0.9))
      osc.start(t0)
      osc.stop(t0 + seconds)
      if (theme === "ragnarok" && bossLayer > 0) {
        const sub = ctx.createOscillator()
        const subEnv = ctx.createGain()
        sub.type = "sawtooth"
        sub.frequency.value = midiToHz(degree, 65) * (bossLayer >= 2 ? 0.5 : 1.5)
        subEnv.gain.value = 0.12 * Math.min(3, bossLayer)
        sub.connect(subEnv)
        subEnv.connect(master)
        sub.start(t0)
        sub.stop(t0 + seconds)
      }
      if (theme === "mars" && stepIndex % 8 === 0) {
        const click = ctx.createOscillator()
        const clickEnv = ctx.createGain()
        click.type = "square"
        click.frequency.value = 180 + regionHue() * 600
        clickEnv.gain.value = 0.08
        click.connect(clickEnv)
        clickEnv.connect(master)
        click.start(t0)
        click.stop(t0 + 0.04)
      }
    }
    stepIndex = (stepIndex + 1) % pattern.steps.length
    timer = globalThis.setTimeout(scheduleLoop, seconds * 1000) as unknown as number
  }

  function restartLoop() {
    clearTimer()
    stepIndex = 0
    applyGain()
    if (theme === "mars" || theme === "town" || theme === "moon") startMarsAmbient()
    else stopAmbient()
    scheduleLoop()
  }

  return {
    unlock() {
      if (!ensureGraph() || !ctx) return
      const wasRunning = unlocked && ctx.state === "running"
      unlocked = true
      // iOS Safari: resume() only works inside a real tap (touchend/click), so this is called on every tap
      // until the context is running. A rejected resume() just waits for the next tap.
      try {
        const p = ctx.resume()
        if (p && typeof p.catch === "function") p.catch(() => {})
      } catch {
        /* next tap retries */
      }
      applyGain()
      if (!wasRunning && theme !== "silence") restartLoop()
    },
    setTheme(next) {
      if (theme === next) return
      theme = next
      if (!unlocked) return
      if (next === "silence") {
        clearTimer()
        stopAmbient()
        applyGain()
        return
      }
      if (!ensureGraph()) return
      restartLoop()
    },
    setEnabled(next) {
      enabled = next
      applyGain()
      if (!enabled) {
        clearTimer()
        stopAmbient()
      } else if (unlocked && theme !== "silence") restartLoop()
    },
    setVolume(next) {
      volume = clampVolume(next)
      applyGain()
    },
    setAmbientVolume(next) {
      ambientVolume = clampVolume(next)
      if (ambientGainNodes) {
        try {
          ambientGainNodes.bed.gain.value = 0.12 * ambientVolume
          ambientGainNodes.noise.gain.value = 0.045 * ambientVolume
        } catch {
          /* ignore */
        }
      }
    },
    getAmbientVolume: () => ambientVolume,
    stop() {
      clearTimer()
      stopAmbient()
      theme = "silence"
      applyGain()
    },
    getTheme: () => theme,
    isUnlocked: () => unlocked,
    isRunning: () => Boolean(unlocked && ctx && ctx.state === "running"),
    setMutedBySystem(muted) {
      if (mutedBySystem === muted) return
      mutedBySystem = muted
      applyGain()
      if (mutedBySystem) {
        clearTimer()
        stopAmbient()
      } else if (unlocked && enabled && theme !== "silence") restartLoop()
    },
    setRegion(id) {
      const next = id && id.trim() ? id : "open"
      if (regionId === next) return
      regionId = next
      if ((theme === "mars" || theme === "town" || theme === "moon") && unlocked && enabled && !mutedBySystem) startMarsAmbient()
    },
    setBossLayer(layer) {
      const next = Math.max(0, Math.min(3, Math.floor(layer)))
      if (bossLayer === next) return
      bossLayer = next
    },
    setFlareLayer(on) {
      const next = on === true
      if (flareLayer === next) return
      flareLayer = next
    },
  }
}

export function themeForPhase(phase: string, launched: boolean, opts?: { fight?: boolean; trading?: boolean; town?: boolean; credits?: boolean }): MusicTheme {
  if (!launched) return "title"
  if (phase === "blackout") return "silence"
  if (opts?.fight) return "combat"
  if (opts?.trading || phase === "practice" || phase === "practice-pause") return "trade"
  if (opts?.credits || (phase === "ending" && opts?.credits)) return "credits"
  if (phase === "ending") return "ending"
  if (phase === "ragnarok") return "ragnarok"
  if (opts?.town) return "town"
  if (phase === "colony-map") return "mars"
  if (phase === "moon-approach") return "moon"
  if (phase === "moon-choice" || phase === "cinematic" || phase === "cinematic-choice") return "story"
  if (phase === "colony-lesson") return "colony"
  if (
    phase === "pilot-select" ||
    phase === "wake" ||
    phase === "missing-pilot" ||
    phase === "auto-battle" ||
    phase === "cockpit-invite" ||
    phase === "cinematic-choice" ||
    phase === "cinematic" ||
    phase === "practice-pause" ||
    phase === "practice" ||
    phase === "near-loss" ||
    phase === "sis-rescue" ||
    phase === "navigate"
  ) {
    return "title"
  }
  return "title"
}

/** Documented: mars theme runs a soft ambient bed under the melody when unmuted. */
export function marsThemeHasAmbient(): boolean {
  return true
}
