/** Two visitable towns on the colony route. Flavor and paper-desk access only — no rewards, caps, or ledger changes. */

export type TownId = "harbor-commons" | "aurora-port"

export interface TownNpc {
  id: string
  name: string
  role: string
  lines: readonly string[]
}

export interface Town {
  id: TownId
  name: string
  look: string
  blurb: string
  /** Short chorus kept for tests and compact readouts. */
  lines: readonly string[]
  board: readonly string[]
  npcs: readonly TownNpc[]
  x: number
  y: number
}

export const TOWNS: readonly Town[] = [
  {
    id: "harbor-commons",
    name: "Harbor Commons",
    x: 48,
    y: 292,
    look: "Lantern piers, teal moorings, and a notice board that faces the colony route.",
    blurb: "The first harbor after the terrace. Pilots check charts, talk, and open the paper desk. Practice only — not a real market.",
    lines: [
      "Dockkeep: Tide is quiet. Fly when you are ready.",
      "Chart-rigger: Ten colonies, then a moon. The desk downstairs is paper only.",
      "Kid on a crate: If the sky goes red, that is Sol having a day. Sim prices, not real money.",
    ],
    board: [
      "NOTICE: Paper desk only. No withdrawals. No live orders.",
      "ROUTE: Ten colonies, then a moon path. Irreversible at the gate.",
      "WEATHER: If the sky goes red, that is a solar flare — sim prices wobble, vault stays cold.",
    ],
    npcs: [
      {
        id: "mira",
        name: "Mira",
        role: "Dockkeep",
        lines: [
          "Tide is quiet tonight. Chart your ten, then decide which moon you can live with.",
          "The board downstairs is a practice desk. It will never pay you out. That is the point.",
          "If Sol throws a red day, keep the long small. The clamp is there for a reason.",
        ],
      },
      {
        id: "hal",
        name: "Hal",
        role: "Chart-rigger",
        lines: [
          "Harbor is the near port. Aurora sits on the far curve, under both moons.",
          "XO already filed your starter long — a tenth of a paper XOE, just so the desk has a pulse.",
          "Fly the route. Talk to people. The vault story can wait; it is still a hook, not a payout.",
        ],
      },
      {
        id: "nile",
        name: "Nile",
        role: "Kid on a crate",
        lines: [
          "I saw the sky go copper once. Music went dark. Prices dipped. Nobody got rich.",
          "If you hear the dock bells, that is just the piers, not a market open.",
          "Take a lantern if you head for Aurora. The cables there glow, but it is still just air.",
        ],
      },
    ],
  },
  {
    id: "aurora-port",
    name: "Aurora Port",
    x: 748,
    y: 568,
    look: "Violet dock-spires under Sol and Xelm, with aurora cables strung between the piers.",
    blurb: "The far port that watches both moons. A last paper trade and a look at the path ahead. No live orders.",
    lines: [
      "Port warden: Xelm is the quiet one. Sol burns. You pick once.",
      "Cable-tech: Those lights are just atmosphere. Pretty, not a payout.",
      "Night cook: Eat, fly, keep the starter trade honest. Sim only.",
    ],
    board: [
      "MOONS: Xelm keeps the keys. Sol throws heat. You lock one path.",
      "POWER: Frost Lock or Flare Dash is optional. You can fly the gate clean.",
      "REMINDER: Practice only. The desk here is the same paper board as Harbor.",
    ],
    npcs: [
      {
        id: "wren",
        name: "Wren",
        role: "Port warden",
        lines: [
          "Xelm is the quiet one — ashglass and frost. Sol burns. You pick once, and the gate does not forget.",
          "If you brought a power, try it on the approach. You should feel the path change before you commit.",
          "I will still be here after the credits. The port does not cash out.",
        ],
      },
      {
        id: "kesh",
        name: "Kesh",
        role: "Cable-tech",
        lines: [
          "Those lights are plasma and atmosphere. Pretty on a red day, still not a payout.",
          "I string the cables so pilots can see both moons at once. Looking is free.",
          "If your ship starts to shudder, that is the flare weather, not a broken hull.",
        ],
      },
      {
        id: "oro",
        name: "Oro",
        role: "Night cook",
        lines: [
          "Eat, fly, keep the starter trade honest. A tenth of a paper XOE is enough of a lesson.",
          "Harbor sent you with lanterns. I will send you with something warm and no bill.",
          "When the credits roll, come back and sit. The stew is still practice, like everything else.",
        ],
      },
    ],
  },
] as const

export function townById(id: string | null | undefined): Town | null {
  if (!id) return null
  return TOWNS.find((t) => t.id === id) ?? null
}

export function isTownId(id: string): id is TownId {
  return TOWNS.some((t) => t.id === id)
}
