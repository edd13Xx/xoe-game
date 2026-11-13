import { useEffect, useState } from "react"
import { HEALTH_ITEMS, buyHealthItem, effectiveMaxHealth, vaultBonusFraction } from "../game/health-shop.ts"
import { readMeta, writeMeta, type MetaProgress } from "../game/meta-progress.ts"
import { maybeShopPurchaseLine } from "../game/shop-lines.ts"
import { xoSpeak } from "../game/xo-speech.ts"
import { getLocalStore } from "../game/safe-storage.ts"

function store() {
  return getLocalStore()
}

/** Simple counter shop: XO behind the counter, health items only (A/C style). */
export function ShopView() {
  const [meta, setMeta] = useState<MetaProgress>(() => readMeta(null))
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    setMeta(readMeta(store()))
  }, [])

  function buy(id: string) {
    const result = buyHealthItem(meta, id)
    if (!result) {
      setNote("Not enough coins (pocket or vault).")
      return
    }
    writeMeta(store(), result.meta)
    setMeta(result.meta)
    const line = maybeShopPurchaseLine(Date.now(), true)
    if (line) void xoSpeak(line)
    setNote(line ? `${line} Healed ${result.healed}.` : `Healed ${result.healed}.`)
  }

  const bonus = Math.round(vaultBonusFraction(meta.vault) * 100)

  return (
    <section className="panel shop-view" aria-label="XO shop">
      <div className="shop-counter">
        <div className="shopkeeper" aria-hidden="true">
          <span className="shopkeeper-xo">XO</span>
          <span className="fine">Behind the counter</span>
        </div>
        <div>
          <h2>Shop</h2>
          <p className="fine">Health items only — no weapons. Vault bonus +{bonus}% max health (cap 50%).</p>
          <p className="fine">
            Pocket {meta.coins} · Vault {meta.vault} · Energy {meta.energy} · Max HP {effectiveMaxHealth(meta)}
          </p>
        </div>
      </div>
      <table className="price-list">
        <thead>
          <tr>
            <th>Item</th>
            <th>Heal</th>
            <th>Price</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {HEALTH_ITEMS.map((item) => (
            <tr key={item.id}>
              <td>{item.label}</td>
              <td>+{item.heal === 9999 ? "full" : item.heal}</td>
              <td>{item.cost}</td>
              <td>
                <button type="button" className="touch-btn primary" onClick={() => buy(item.id)}>
                  Buy
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {note ? <p role="status">{note}</p> : null}
    </section>
  )
}
