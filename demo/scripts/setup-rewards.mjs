// OWNER setup (testnet): one reward per game colony + wider per-player cap. Uses the owner key from the
// local testnet credentials folder. Idempotent. Placeholders: tokenomics are NOT final.
import { accountFor, config, fromXoe, view, outcomeHash, failure, txUrl } from "../lib/near.mjs";
const COLONIES = ["wallet", "keys", "blocks", "fees", "stroops", "scams", "trustline", "volatility", "phishing", "seed-backup"];
const owner = accountFor(config.owner);
const have = new Map((await view(config.rewards, "list_rewards")).map(([k]) => [k, true]));
const call = async (method, args) => {
  const o = await owner.callFunctionRaw({ contractId: config.rewards, methodName: method, args, deposit: 1n, gas: 30_000_000_000_000n });
  const f = failure(o); console.log(method, JSON.stringify(args).slice(0, 80), f ? "FAILED " + f : "OK " + txUrl(outcomeHash(o)));
};
for (const c of COLONIES) {
  const id = `colony_${c}`;
  if (!have.has(id)) await call("set_reward", { achievement: id, amount: fromXoe(50) });
}
const cfg = await view(config.rewards, "get_config");
if (BigInt(cfg.per_player_cap) < BigInt(fromXoe(1000))) await call("set_caps", { per_player_cap: fromXoe(1000), global_cap: cfg.global_cap });
console.log("rewards:", (await view(config.rewards, "list_rewards")).map(([k]) => k).join(", "));
