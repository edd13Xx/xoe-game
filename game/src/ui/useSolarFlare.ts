import { useCallback, useEffect, useRef, useState } from "react"
import { bindFlareController } from "../game/flare-bus.ts"
import { readQaFlare } from "../game/qa-flags.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import {
  FLARE_DAY_TICKS,
  applyFlareTick,
  emptyFlareLog,
  idleFlare,
  markFlareStarted,
  readFlareLog,
  rollFlare,
  seedFromDeviceId,
  startFlare,
  writeFlareLog,
  type FlareLog,
  type SolarFlareState,
} from "../game/solar-flare.ts"
import type { MusicController } from "../game/music.ts"
import type { XoeSimState } from "../game/xoe-sim-price.ts"

/**
 * Session/day scheduler + bind to the ticker. Red-day UI is start/end only
 * (the price path lives in the ticker feed).
 */
export function useSolarFlare(music: MusicController, started: boolean): { redDay: boolean; noteSession: () => void } {
  const [redDay, setRedDay] = useState(false)
  const flareRef = useRef<SolarFlareState>(idleFlare())
  const logRef = useRef<FlareLog>(emptyFlareLog())
  const dayTicksRef = useRef(0)
  const notedRef = useRef(false)
  const pendingRef = useRef<"roll" | "force" | null>(null)
  const musicRef = useRef(music)

  useEffect(() => {
    musicRef.current = music
  }, [music])

  useEffect(() => {
    const store = getLocalStore()
    const seed = seedFromDeviceId(store.getItem("xoe.deviceId.v1"))
    logRef.current = readFlareLog(store, seed)
    flareRef.current = idleFlare(logRef.current.seed)

    const begin = (sim: XoeSimState, noise: number, now: number, forced: boolean) => {
      const log = logRef.current
      const session = Math.max(1, log.sessionCount)
      const day = Math.max(0, log.dayCount)
      const startedFlare = startFlare(sim.price, { seed: log.seed, session, day, forced })
      flareRef.current = startedFlare
      if (!forced) {
        logRef.current = markFlareStarted(log, session, day)
        writeFlareLog(store, logRef.current)
      }
      setRedDay(true)
      musicRef.current.setFlareLayer(true)
      const out = applyFlareTick(sim, startedFlare, noise, now)
      flareRef.current = out.flare
      return out
    }

    const ctrl = {
      peek: () => flareRef.current,
      onSimTick: (sim: XoeSimState, noise: number, now: number) => {
        const pending = pendingRef.current
        if (pending && !flareRef.current.active && sim.price > 0) {
          pendingRef.current = null
          return begin(sim, noise, now, pending === "force")
        }
        let flare = flareRef.current
        if (flare.active) {
          const out = applyFlareTick(sim, flare, noise, now)
          flareRef.current = out.flare
          if (!out.flare.active) {
            setRedDay(false)
            musicRef.current.setFlareLayer(false)
          }
          return out
        }
        dayTicksRef.current += 1
        if (dayTicksRef.current >= FLARE_DAY_TICKS) {
          dayTicksRef.current = 0
          const log = logRef.current
          const day = log.dayCount + 1
          const session = Math.max(1, log.sessionCount)
          const nextLog = { ...log, dayCount: day }
          logRef.current = nextLog
          writeFlareLog(store, nextLog)
          if (rollFlare(nextLog, nextLog.seed, session, day) && sim.price > 0) {
            return begin(sim, noise, now, false)
          }
        }
        return { sim, flare }
      },
    }
    bindFlareController(ctrl)
    return () => bindFlareController(null)
  }, [])

  useEffect(() => {
    if (!started && !redDay) music.setFlareLayer(false)
  }, [started, redDay, music])

  const noteSession = useCallback(() => {
    if (notedRef.current) return
    notedRef.current = true
    const store = getLocalStore()
    const seed = logRef.current.seed || seedFromDeviceId(store.getItem("xoe.deviceId.v1"))
    const session = logRef.current.sessionCount + 1
    const day = Math.max(0, logRef.current.dayCount)
    const log: FlareLog = { ...logRef.current, seed, sessionCount: session }
    logRef.current = log
    writeFlareLog(store, log)
    if (readQaFlare()) pendingRef.current = "force"
    else if (rollFlare(log, seed, session, day)) pendingRef.current = "roll"
  }, [])

  return { redDay, noteSession }
}
