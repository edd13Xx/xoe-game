// Prints the live TESTNET state of the XOE token + rewards contracts (read-only, no keys needed).
import { snapshot, config } from "../lib/near.mjs";
const s = await snapshot(process.argv[2] || config.demoPlayer);
console.log(`network ${s.network}\ntoken ${s.token}  total supply ${s.totalSupply} XOE\nrewards ${s.rewardsContract}  issued ${s.totalIssued} / cap ${s.globalCap}, paused=${s.paused}\nplayer ${s.player}  balance ${s.balance} XOE  (issued to player ${s.playerIssued} / ${s.perPlayerCap})`);
for (const r of s.rewards) console.log(`  ${r.id.padEnd(20)} ${String(r.amount).padStart(4)} XOE  ${r.claimed ? "claimed" : r.attested ? "attested" : "-"}`);
