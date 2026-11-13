// One-command TESTNET deploy of the XOE contracts to YOUR OWN testnet account (UNTESTED end-to-end as a fresh deploy;
// the live deployment in config.json was done earlier with near-cli-rs. Everything here uses the same calls.)
//
//   node scripts/deploy-testnet.mjs <parent>.testnet            # dry run, prints the plan
//   node scripts/deploy-testnet.mjs <parent>.testnet --send     # sends testnet transactions
//
// Needs: contracts built (cd ../contracts && bash scripts/build.sh), and the parent account's key in
// ~/.near-credentials/testnet/<parent>.json (e.g. created with `near account create-account sponsor-by-faucet-service ...`).
// Parent needs about 7 testnet NEAR (get free testnet NEAR from the faucet). TESTNET ONLY. Never prints keys.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { actionCreators } from "@near-js/transactions";
import { accountFor, provider, fromXoe, failure, txUrl, outcomeHash } from "../lib/near.mjs";

const parentId = process.argv[2];
const send = process.argv.includes("--send");
if (!parentId || !parentId.endsWith(".testnet")) { console.error("usage: deploy-testnet.mjs <parent>.testnet [--send]  (testnet accounts only)"); process.exit(2); }
const W = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "contracts", "target", "near");
const wasm = (n) => new Uint8Array(fs.readFileSync(path.join(W, n, `${n}.wasm`)));
const NEAR = 10n ** 24n;
const ids = { token: `token.${parentId}`, rewards: `rewards.${parentId}`, attester: `attester.${parentId}`, player: `player1.${parentId}` };
const rewards = [["colony_cleared", 50], ["boss_beaten", 100], ["game_finished", 200], ...["wallet", "keys", "blocks", "fees", "stroops", "scams", "trustline", "volatility", "phishing", "seed-backup"].map((c) => [`colony_${c}`, 50])];

console.log("Plan for", parentId, send ? "(SENDING)" : "(dry run)");
console.log(" create+fund", ids.token, "2.4 NEAR, deploy xoe_token, new_default_meta(owner, max 1,000,000 XOE)");
console.log(" create+fund", ids.rewards, "2.4 NEAR, deploy xoe_rewards, new(owner, attester, token, caps 1000/100000 XOE)");
console.log(" create+fund", ids.attester, "0.3 NEAR;", ids.player, "1.2 NEAR (demo player)");
console.log(" token.add_minter(rewards); storage_deposit(rewards, player); set_reward x", rewards.length);
if (!send) process.exit(0);

const parent = accountFor(parentId);
const pk = (await parent.getSigner().getPublicKey());
const ok = (o, what) => { const f = failure(o); if (f) throw new Error(`${what} failed: ${f}`); console.log("OK", what, txUrl(outcomeHash(o))); };
const create = async (id, fund, code, initMethod, initArgs) => {
  const actions = [actionCreators.createAccount(), actionCreators.transfer(fund), actionCreators.addKey(pk, actionCreators.fullAccessKey())];
  if (code) actions.push(actionCreators.deployContract(code), actionCreators.functionCall(initMethod, initArgs, 100_000_000_000_000n, 0n));
  ok(await parent.signAndSendTransaction({ receiverId: id, actions }), `create ${id}`);
};
await create(ids.token, 24n * NEAR / 10n, wasm("xoe_token"), "new_default_meta", { owner_id: parentId, max_supply: fromXoe(1_000_000) });
await create(ids.rewards, 24n * NEAR / 10n, wasm("xoe_rewards"), "new", { owner_id: parentId, attester_id: ids.attester, token_id: ids.token, per_player_cap: fromXoe(1000), global_cap: fromXoe(100000) });
await create(ids.attester, 3n * NEAR / 10n);
await create(ids.player, 12n * NEAR / 10n);
const call = async (contractId, methodName, args, deposit = 1n, gas = 30_000_000_000_000n) => ok(await parent.callFunctionRaw({ contractId, methodName, args, deposit, gas }), `${contractId}.${methodName}`);
await call(ids.token, "add_minter", { account_id: ids.rewards });
for (const [id, amt] of rewards) await call(ids.rewards, "set_reward", { achievement: id, amount: fromXoe(amt) });
for (const who of [ids.rewards, ids.player]) await call(ids.token, "storage_deposit", { account_id: who, registration_only: true }, NEAR / 100n);
// the demo player must link a (made-up or own) Solana address once so the rewards contract accepts attestations
console.log("\nNext: from the player account call rewards.link_solana with your own Solana address and 0.01 NEAR,\nthen put the new names in demo/config.json and run `npm start`.");
