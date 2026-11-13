/**
 * v18: header pilot label. "XO · XO" read as a doubled label when the pilot and the
 * player name match (QA WebKit run). Show the name once in that case.
 */
export function pilotHeaderLabel(pilotName: string, playerName: string | null | undefined): string {
  const pilot = pilotName.trim() || "Pilot"
  const player = (playerName ?? "").trim()
  if (!player || player.toLowerCase() === pilot.toLowerCase()) return pilot
  return `${pilot} · ${player}`
}
