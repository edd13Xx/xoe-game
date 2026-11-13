// Thin near-api-js helpers for the XOE demo. TESTNET ONLY. Never prints keys.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Account, KeyPairSigner, providers } from "near-api-js";

export const config = JSON.parse(fs.readFileSync(new URL("../config.json", import.meta.url), "utf8"));
if (config.network !== "testnet") throw new Error("This demo is testnet only.");

export const provider = new providers.JsonRpcProvider({ url: process.env.NEAR_RPC || config.rpc });

const CRED_DIR = process.env.XOE_CRED_DIR || path.join(os.homedir(), ".near-credentials", "testnet");

/** Account object signed by a key from the local testnet credentials folder (never printed). */
export function accountFor(accountId) {
  const file = path.join(CRED_DIR, `${accountId}.json`);
  const cred = JSON.parse(fs.readFileSync(file, "utf8"));
  return new Account(accountId, provider, KeyPairSigner.fromSecretKey(cred.private_key));
}
export function hasKey(accountId) {
  return fs.existsSync(path.join(CRED_DIR, `${accountId}.json`));
}

export const view = (contractId, method, args = {}) => provider.callFunction(contractId, method, args);

export const toXoe = (yocto) => {
  const s = BigInt(yocto).toString().padStart(config.decimals + 1, "0");
  const whole = s.slice(0, -config.decimals), frac = s.slice(-config.decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
};
export const fromXoe = (xoe) => (BigInt(xoe) * 10n ** BigInt(config.decimals)).toString();

export const txUrl = (hash) => `${config.explorer}/txns/${hash}`;
export const outcomeHash = (o) => o?.transaction?.hash || o?.transaction_outcome?.id || null;

/** Failure text of a FinalExecutionOutcome, or null if every receipt succeeded. */
export function failure(o) {
  const st = o?.status;
  if (st && typeof st === "object" && "Failure" in st) return JSON.stringify(st.Failure).slice(0, 300);
  for (const r of o?.receipts_outcome || []) {
    const s = r.outcome?.status;
    if (s && typeof s === "object" && "Failure" in s) return JSON.stringify(s.Failure).slice(0, 300);
  }
  return null;
}

export async function snapshot(player = config.demoPlayer) {
  const [supply, balance, cfg, rewards] = await Promise.all([
    view(config.token, "ft_total_supply"),
    view(config.token, "ft_balance_of", { account_id: player }),
    view(config.rewards, "get_config"),
    view(config.rewards, "list_rewards"),
  ]);
  const flags = {};
  await Promise.all(rewards.map(async ([id]) => {
    const [a, c] = await Promise.all([
      view(config.rewards, "is_attested", { account_id: player, achievement: id }),
      view(config.rewards, "is_claimed", { account_id: player, achievement: id }),
    ]);
    flags[id] = { attested: a, claimed: c };
  }));
  return {
    network: config.network, token: config.token, rewardsContract: config.rewards, player,
    totalSupply: toXoe(supply), balance: toXoe(balance),
    paused: cfg.paused, perPlayerCap: toXoe(cfg.per_player_cap), globalCap: toXoe(cfg.global_cap),
    totalIssued: toXoe(cfg.total_issued), playerIssued: toXoe(await view(config.rewards, "get_player_issued", { account_id: player })),
    rewards: rewards.map(([id, amt]) => ({ id, amount: toXoe(amt), ...flags[id] })),
  };
}
