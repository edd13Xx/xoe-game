import { DrawerShell } from "./DrawerShell.tsx"
import { ProDesk } from "./ProDesk.tsx"

/**
 * XOE trade desk drawer: a pro-style trading screen (original XOE look) over live play.
 * Everything here is simulated: testnet XOE, no real money, no network.
 */
export function PaperAdvancedDrawer({
  open,
  onClose,
  xoePrice = 10,
  reducedMotion = false,
}: {
  open: boolean
  onClose: () => void
  midHint?: number
  xoePrice?: number
  xoeHistory?: readonly number[]
  reducedMotion?: boolean
}) {
  return (
    <DrawerShell open={open} title="XOE trade desk" onClose={onClose} labelledBy="drawer-paper-title">
      <ProDesk open={open} price={xoePrice} reducedMotion={reducedMotion} />
    </DrawerShell>
  )
}
