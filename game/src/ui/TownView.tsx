import { useState } from "react"
import { townById } from "../game/towns.ts"

/** Visit a town. No currency, no XP, no ledger writes. */
export function TownView({
  townId,
  visitedBoth,
  onLeave,
  onOpenDesk,
}: {
  townId: string
  visitedBoth: boolean
  onLeave: () => void
  onOpenDesk?: () => void
}) {
  const town = townById(townId)
  const [npcIndex, setNpcIndex] = useState(0)
  const [lineIndex, setLineIndex] = useState(0)
  const npc = town?.npcs[npcIndex] ?? null
  const line = npc ? (npc.lines[lineIndex % npc.lines.length] ?? "") : ""
  if (!town) return null

  const talkNext = () => {
    if (!npc) return
    if (lineIndex + 1 < npc.lines.length) setLineIndex((n) => n + 1)
    else {
      setNpcIndex((n) => (n + 1) % town.npcs.length)
      setLineIndex(0)
    }
  }

  return (
    <article className={`copy-block town-view is-${town.id}`} aria-label={town.name}>
      <div className="town-hero" aria-hidden="true">
        <div className="town-hero-sky" />
        <div className="town-hero-pier" />
      </div>
      <h1 tabIndex={-1}>{town.name}</h1>
      <p className="narration">{town.blurb}</p>
      <p className="fine">{town.look}</p>
      <section className="town-board" aria-label="Notice board">
        <h2 className="town-board-title">Notice board</h2>
        <ul className="town-lines">
          {town.board.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      {npc ? (
        <section className="town-npc" aria-label={`${npc.name}, ${npc.role}`}>
          <div className="town-npc-face" aria-hidden="true" data-npc={npc.id}>
            {npc.name.slice(0, 1)}
          </div>
          <div className="town-npc-copy">
            <p className="speaker">
              {npc.name} · {npc.role}
            </p>
            <p className="bubble">{line}</p>
          </div>
        </section>
      ) : null}
      {visitedBoth ? <p className="ok">Both towns visited this run.</p> : <p className="fine">A second town sits farther along the route.</p>}
      <div className="menu-row town-actions">
        {npc ? (
          <button type="button" className="touch-btn" onClick={talkNext}>
            {lineIndex + 1 < npc.lines.length ? `Continue with ${npc.name}` : "Next voice"}
          </button>
        ) : null}
        {onOpenDesk ? (
          <button type="button" className="touch-btn" onClick={onOpenDesk}>
            Open paper desk
          </button>
        ) : null}
        <button type="button" className="touch-btn primary" onClick={onLeave}>
          Back to the map
        </button>
      </div>
    </article>
  )
}
