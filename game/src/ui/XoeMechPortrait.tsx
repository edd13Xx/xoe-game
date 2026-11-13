import spriteUrl from "../assets/xoe-sprite.png"

/**
 * XOE's original trade-sim mech: the existing violet/teal sprite inside a sleek
 * glowing frame (inspired by high-speed orbital mechs, not a copy of any franchise).
 */
export function XoeMechPortrait({
  reduced = false,
  firing = false,
}: {
  reduced?: boolean
  firing?: boolean
}) {
  return (
    <div className={`xoe-mech-portrait${reduced ? " is-reduced" : ""}${firing ? " is-firing" : ""}`} aria-hidden="true">
      <span className="xoe-mech-glow" />
      <span className="xoe-mech-frame" />
      <img src={spriteUrl} alt="" width={48} height={48} className="xoe-mech-sprite" />
    </div>
  )
}
