export type SkyPhase = "night" | "dawn" | "day" | "dusk"

export function skyPhase(hour: number): SkyPhase {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("Hour must be an integer from 0 through 23")
  }
  if (hour >= 5 && hour <= 7) return "dawn"
  if (hour >= 8 && hour <= 16) return "day"
  if (hour >= 17 && hour <= 19) return "dusk"
  return "night"
}

export function localHour(now: Date): number {
  return now.getHours()
}
