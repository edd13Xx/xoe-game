export const COPY_STATUS = "draft" as const

export const ROLE = "Pilot" as const
export const DEFAULT_NAME = "XO"
export const DEFAULT_CHARACTER_ID = "xoe"
export const GENDERS = ["female", "male"] as const
export type Gender = (typeof GENDERS)[number]

export const CHARACTER_CLASSES = {
  xoe: {
    // internal gameplay class only; the UI shows XO as CLASSIFIED with no stats (v18.2)
    name: "Sentinel",
    profile: "State-of-the-art, cutting-edge unknown orbital. Strength and defense: classified.",
  },
  "mara-venn": {
    name: "Sentinel",
    profile: "High defense, low offense. DEF 7 / OFF 3 base.",
  },
  "elias-cho": {
    name: "Striker",
    profile: "Even defense and offense. DEF 5 / OFF 5 base.",
  },
  "nia-okonkwo": {
    name: "Recon",
    profile: "Low defense, high offense. DEF 3 / OFF 7 base.",
  },
} as const

export type ClassName = (typeof CHARACTER_CLASSES)[keyof typeof CHARACTER_CLASSES]["name"]

export const PLAYER_CLASSES = ["Sentinel", "Striker", "Recon"] as const
export type PlayerClassName = (typeof PLAYER_CLASSES)[number]

export function playerClassProfile(name: PlayerClassName): string {
  if (name === "Sentinel") return CHARACTER_CLASSES["mara-venn"].profile
  if (name === "Striker") return CHARACTER_CLASSES["elias-cho"].profile
  return CHARACTER_CLASSES["nia-okonkwo"].profile
}

export function characterClass(id: string) {
  if (id === "xoe" || id === "mara-venn" || id === "elias-cho" || id === "nia-okonkwo") return CHARACTER_CLASSES[id]
  return null
}

/** Fictional roster flavor. Not a real file, and not a gameplay modifier. */
export const CHARACTER_DOSSIERS = {
  "mara-venn": "Sentinel line. High DEF practice role.",
  "elias-cho": "Striker line. Balanced practice role.",
  "nia-okonkwo": "Recon line. High OFF practice role.",
} as const

export function characterDossier(id: string): string | null {
  if (id === "mara-venn" || id === "elias-cho" || id === "nia-okonkwo") return CHARACTER_DOSSIERS[id]
  return null
}

export const PILOTS = [
  { id: "xoe", name: "XO", visor: "#a78bfa" },
  { id: "mara-venn", name: "Mara Venn", visor: "#a78bfa" },
  { id: "elias-cho", name: "Elias Cho", visor: "#e4b15c" },
  { id: "nia-okonkwo", name: "Nia Okonkwo", visor: "#9eb8d0" },
] as const

export const SUITS = [
  { id: "ceramic", label: "Ceramic white", hull: "#c4c0d4" },
  { id: "dusk", label: "Dusk gray", hull: "#6e7c8a" },
] as const

export type PilotId = (typeof PILOTS)[number]["id"]
export type SuitId = (typeof SUITS)[number]["id"]

export function pilotById(id: string) {
  return PILOTS.find((pilot) => pilot.id === id) ?? null
}

export function suitById(id: string) {
  return SUITS.find((suit) => suit.id === id) ?? null
}

export function isUsablePlayerName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length > 0 && trimmed.toLowerCase() !== ROLE.toLowerCase()
}

export const LINES = {
  wake: {
    speaker: "Scene",
    kind: "system",
    text: "You wake in a battle already involving XO. Drones are closing in to kill you. You sense danger.",
  },
  missing: {
    speaker: "Scene",
    kind: "system",
    text: "XO's original pilot is missing — not dead.",
  },
  auto: {
    speaker: "Scene",
    kind: "system",
    text: "Auto-battle activates before any invitation into the cockpit.",
  },
  zoeInvite: {
    speaker: "XO",
    kind: "dialogue",
    text: "Jump in if you want to survive.",
  },
  pause: {
    speaker: "XO",
    kind: "dialogue",
    text: "This is practice. The battle and the trade are the same exchange. Nothing here is a real trade. I will wait until you resume.",
  },
  near: {
    speaker: "Scene",
    kind: "system",
    text: "The practice line nearly breaks. The practice result does not change the rescue.",
  },
  sis: {
    speaker: "SIS",
    kind: "dialogue",
    text: "You ain't nothing.",
  },
} as const
