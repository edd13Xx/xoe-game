/** v18.2: "open map" (Full Map button, voice, or typed) opens the full-screen map. Local only — no xAI call. */
export const OPEN_MAP_EVENT = "xoe:open-map"
let available = false
export function setMapScreenAvailable(on: boolean): void {
  available = on
}
export function isMapScreenAvailable(): boolean {
  return available
}
/** Returns false when the colony map is not on screen (the map lives there). */
export function requestOpenMap(): boolean {
  if (!available || typeof window === "undefined") return false
  window.dispatchEvent(new Event(OPEN_MAP_EVENT))
  return true
}
export const OPEN_MAP_PATTERN = /\b(open|show|bring up|pull up|see)\b.*\b(the )?(big |full |world )?map\b|^\s*(big |full )?map\s*[.!]?\s*$/i
export const MAP_OPENED_SAY = "XO: Opening the map."
export const MAP_NOT_HERE_SAY = "XO: The map works on the colony map. Go there first, then say “open map.”"
