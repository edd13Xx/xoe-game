// CLI version of the demo flow on TESTNET: attest the next open colony reward as the game attester,
// then claim it as the demo player. Needs the testnet keys in ~/.near-credentials/testnet (see README).
import { accountFor, config, view, snapshot, outcomeHash, failure, txUrl } from "../lib/near.mjs";
// The rewards contract only accepts attestations for players who linked a NEAR payout address (one-time, 0.01 NEAR).
if (!(await view(config.rewards, "get_near_address", { account_id: config.demoPlayer }))) {
  const l = await accountFor(config.demoPlayer).callFunctionRaw({ contractId: config.rewards, methodName: "link_near_address", args: { near_address: config.demoPayoutAddress }, deposit: 10n ** 22n, gas: 30_000_000_000_000n });
  if (failure(l)) throw new Error("link_near_address failed: " + failure(l));
  console.log("link    ", txUrl(outcomeHash(l)));
}
const before = await snapshot();
const open = before.rewards.find((r) => r.id.startsWith("colony_") && r.id !== "colony_cleared" && !r.attested && !r.claimed);
if (!open) { console.log("All colony rewards already earned for", before.player); process.exit(0); }
console.log("balance before:", before.balance, "XOE; earning", open.id);
const a = await accountFor(config.attester).callFunctionRaw({ contractId: config.rewards, methodName: "attest", args: { player: before.player, achievement: open.id }, gas: 30_000_000_000_000n });
if (failure(a)) throw new Error("attest failed: " + failure(a));
console.log("attest  ", txUrl(outcomeHash(a)));
const c = await accountFor(config.demoPlayer).callFunctionRaw({ contractId: config.rewards, methodName: "claim", args: { achievement: open.id }, gas: 100_000_000_000_000n });
if (failure(c)) throw new Error("claim failed: " + failure(c));
console.log("claim   ", txUrl(outcomeHash(c)));
console.log("balance after:", (await snapshot()).balance, "XOE");
