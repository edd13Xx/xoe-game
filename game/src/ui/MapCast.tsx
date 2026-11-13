import xoeSprite from "../assets/xoe-sprite.png"
import type { OverworldNode } from "../game/overworld.ts"
import { listMapEnvironments, MOON_SCENERY } from "./overworld-scenery.ts"

/** Visual-only settlers and companions on the overworld. No gameplay changes. */
const NPC_OFFSET: Record<string, { x: number; y: number }> = {
  default: { x: 22, y: -18 },
}

export function XoeCompanion({
  x,
  y,
  reducedMotion = false,
}: {
  x: number
  y: number
  reducedMotion?: boolean
}) {
  return (
    <div
      className={`map-cast xoe-companion${reducedMotion ? " is-still" : ""}`}
      style={{ left: x + 36, top: y - 28 }}
      role="img"
      aria-label="XOE, Unknown Orbital Engine"
      data-cast="xoe"
    >
      <img src={xoeSprite} alt="" width={40} height={40} className="xoe-companion-sprite" />
      <span className="cast-name">XOE</span>
    </div>
  )
}

export function ColonySettlers({ nodes }: { nodes: readonly OverworldNode[] }) {
  const looks = listMapEnvironments()
  return (
    <>
      {nodes.map((n, i) => {
        const env = looks.find((e) => e.id === n.id)
        const off = NPC_OFFSET[n.id] ?? NPC_OFFSET.default!
        return (
          <div
            key={`npc-${n.id}`}
            className={`map-cast map-npc look-${n.kind} hue-${i % 12}`}
            style={{ left: n.x + off.x, top: n.y + off.y }}
            role="img"
            aria-label={`${n.label} settler`}
            data-cast="settler"
            data-node={n.id}
            title={env?.look ?? n.label}
          >
            <span className="map-npc-body" aria-hidden="true" />
          </div>
        )
      })}
      {MOON_SCENERY.map((m, i) => (
        <div
          key={`npc-${m.id}`}
          className={`map-cast map-npc look-moon hue-${(i + 8) % 12}`}
          style={{ left: m.x + 20, top: m.y - 22 }}
          role="img"
          aria-label={`${m.name} moon keeper`}
          data-cast="settler"
          data-node={m.id}
        >
          <span className="map-npc-body" aria-hidden="true" />
        </div>
      ))}
    </>
  )
}

