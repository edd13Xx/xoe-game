export interface RegionHook {
  id: string
  playable: boolean
  parent: string | null
  note: string
}

export const REGIONS = [
  {
    id: "planet-x-terrace",
    playable: true,
    parent: "planet-x",
    note: "Compact opening terrace. Opening still ends at the sealed hatch before colony travel.",
  },
  {
    id: "planet-x-open",
    playable: false,
    parent: "planet-x",
    note: "Open exploration on Planet X is recorded and not built.",
  },
  {
    id: "planet-x-underground",
    playable: false,
    parent: "planet-x",
    note: "Underground story areas are recorded and not built. A sealed hatch is only a hook.",
  },
  {
    id: "space-overworld",
    playable: false,
    parent: null,
    note: "A space overworld is recorded and not built.",
  },
  {
    id: "moon-pair-a",
    playable: true,
    parent: "space-overworld",
    note: "Moon name Xelm approved by Eddie (owner canon). Cold key/security moon. Ability Seal Refocus still pending Eddie approval. Irreversible run choice.",
  },
  {
    id: "moon-pair-b",
    playable: true,
    parent: "space-overworld",
    note: "Moon name Sol approved by Eddie (owner canon). Fiery speed/blocks moon. Ability Chain Ward still pending Eddie approval. Irreversible run choice.",
  },
  {
    id: "colony-route",
    playable: true,
    parent: "space-overworld",
    note: "Five colony lessons after the terrace. Educational prototype route. Not promoted to locked canon geography.",
  },
  {
    id: "ragnarok-gate",
    playable: true,
    parent: "space-overworld",
    note: "Ragnarok gated quiz fight + cut-to-black ending. Boss percent math unrecovered; quiz is the stand-in.",
  },
  {
    id: "universal-vault",
    playable: false,
    parent: null,
    note: "Universal Vault is a story hook. It is not the legacy share vault and it is not connected.",
  },
] as const satisfies readonly RegionHook[]

export const STORY_HOOKS = {
  zoeIsKey: {
    id: "zoe-is-key",
    playable: false,
    revealedInOpening: false,
    note: "Zoe discovering she is key remains a later hook. XOE is the scripted UI/AI voice in this build; that does not resolve the Zoe-is-key reveal.",
  },
  unsuccessfulRescue: {
    id: "unsuccessful-rescue",
    playable: false,
    sameAsOpeningSisRescue: false,
    note: "A later rescue is recorded as unsuccessful. The opening SIS rescue is a different beat.",
  },
  xenoEscapeMachine: {
    id: "xeno-escape-machine",
    playable: false,
    presentInOpening: true,
    escapeImplemented: false,
    note: "XOE is recorded as an escape-machine. Opening battle uses XOE. Ending sacrifices the mech suit as story; not a live vault escape.",
  },
  postGameVault: {
    recorded: true,
    when: "after-beating-the-game",
    settlementFormula: null,
    implemented: false,
    connectedToStellar: false,
  },
} as const

export const DAY_NIGHT = {
  hours: 24,
  compactTerracePreview: true,
  spaceOverworld: false,
} as const

export function playableRegionIds(): string[] {
  return REGIONS.filter((region) => region.playable).map((region) => region.id)
}
