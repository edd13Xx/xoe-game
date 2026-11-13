// XOE x NEAR demo server (TESTNET ONLY). Serves the demo page + the game build, and exposes:
//   GET  /api/state                 live on-chain state read through NEAR RPC
//   POST /api/achievement {id,detail}   "game server" role: the attester account records the achievement on-chain
//   POST /api/claim {achievement}       demo player account claims -> rewards contract mints XOE via the token contract
// Binds to 127.0.0.1. Keys are read from ~/.near-credentials/testnet and never printed or served.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { accountFor, config, hasKey, snapshot, view, outcomeHash, failure, txUrl } from "./lib/near.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = process.env.XOE_GAME_DIR || path.join(HERE, "..", "game", "dist");
const PORT = Number(process.env.PORT || 4400);
const HOST = process.env.HOST || "127.0.0.1";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".mp4": "video/mp4" };

const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const readBody = (req) => new Promise((ok, no) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > 4096) { no(new Error("body too large")); req.destroy(); } }); req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); });

let queue = Promise.resolve(); // one signed tx at a time per key (nonce safety)
const serial = (fn) => (queue = queue.then(fn, fn));

async function rewardIdFor(id, detail) {
  const table = (await view(config.rewards, "list_rewards")).map(([k]) => k);
  const specific = id === "colony_cleared" && detail ? `colony_${String(detail).replace(/[^a-z-]/g, "")}` : null;
  if (specific && table.includes(specific)) return specific;
  return table.includes(id) ? id : null;
}

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET" && url.pathname === "/api/state") return send(res, 200, { ...(await snapshot()), explorer: config.explorer, canClaimForDemoPlayer: hasKey(config.demoPlayer) && hasKey(config.attester) });
  if (req.method === "POST" && url.pathname === "/api/achievement") {
    const { id, detail } = await readBody(req);
    const rid = await rewardIdFor(String(id || ""), detail);
    if (!rid) return send(res, 400, { error: "unknown achievement" });
    const player = config.demoPlayer;
    if (await view(config.rewards, "is_claimed", { account_id: player, achievement: rid })) return send(res, 200, { achievement: rid, status: "already-claimed" });
    if (await view(config.rewards, "is_attested", { account_id: player, achievement: rid })) return send(res, 200, { achievement: rid, status: "already-attested" });
    const o = await serial(() => accountFor(config.attester).callFunctionRaw({ contractId: config.rewards, methodName: "attest", args: { player, achievement: rid }, gas: 30_000_000_000_000n }));
    const f = failure(o);
    return send(res, f ? 500 : 200, f ? { error: f } : { achievement: rid, status: "attested", tx: outcomeHash(o), txUrl: txUrl(outcomeHash(o)) });
  }
  if (req.method === "POST" && url.pathname === "/api/claim") {
    const { achievement } = await readBody(req);
    const table = (await view(config.rewards, "list_rewards")).map(([k]) => k);
    if (!table.includes(achievement)) return send(res, 400, { error: "unknown achievement" });
    const o = await serial(() => accountFor(config.demoPlayer).callFunctionRaw({ contractId: config.rewards, methodName: "claim", args: { achievement }, gas: 100_000_000_000_000n }));
    const f = failure(o);
    return send(res, f ? 400 : 200, f ? { error: f } : { achievement, status: "claimed", tx: outcomeHash(o), txUrl: txUrl(outcomeHash(o)), state: await snapshot() });
  }
  // static
  let rel = decodeURIComponent(url.pathname);
  let root = path.join(HERE, "public");
  if (rel === "/game") { res.writeHead(302, { location: "/game/" }); return res.end(); }
  if (rel.startsWith("/game/")) { root = GAME_DIR; rel = rel.slice(5); }
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, "not found", "text/plain");
  return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || "application/octet-stream");
}

http.createServer((req, res) => handle(req, res).catch((e) => send(res, 500, { error: String(e.message || e).slice(0, 300) }))).listen(PORT, HOST, () => console.log(`XOE NEAR demo (testnet) on http://${HOST}:${PORT}`));
