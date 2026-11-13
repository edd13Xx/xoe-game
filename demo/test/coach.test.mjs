// Server-side Grok coach tests with a mocked fetch. No key and no network needed.
import test from "node:test";
import assert from "node:assert/strict";
import { coachReply, sanitizeContext, userPrompt, cleanReply, makeLimiter, SYSTEM_PROMPT, XAI_URL, DEFAULT_MODEL } from "../lib/coach.mjs";

const ctx = { side: "long", sizeLots: 2, entry: 10, mark: 10.2, stopLoss: 9.5, takeProfit: 11, riskPctOfEquity: 3.1, unrealizedPnlPct: 0.4, lastResult: "loss", losingStreak: 2, ruleTip: "big risk" };
const okFetch = (text, seen = {}) => async (url, init) => { seen.url = url; seen.init = init; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }] }) }; };

test("no key -> ok:false no-key, never calls fetch", async () => {
  let called = false;
  const r = await coachReply({ context: ctx }, { env: {}, fetchImpl: async () => { called = true; } });
  assert.deepEqual(r, { status: 200, body: { ok: false, reason: "no-key" } });
  assert.equal(called, false);
});

test("bad context -> 400", async () => {
  assert.equal((await coachReply({ context: { side: "sideways" } }, { env: { XAI_API_KEY: "k" } })).status, 400);
  assert.equal((await coachReply(null, { env: { XAI_API_KEY: "k" } })).status, 400);
});

test("success: calls xAI with bearer key, model, system prompt and only whitelisted context", async () => {
  const seen = {};
  const r = await coachReply({ context: { ...ctx, apiKey: "leak", wallet: "x.near", note: "XRP" } }, { env: { XAI_API_KEY: "test-key" }, fetchImpl: okFetch("Your stop risks 3% of equity. Try a smaller size next time.", seen) });
  assert.equal(r.body.ok, true); assert.equal(r.body.source, "grok"); assert.equal(r.body.model, DEFAULT_MODEL);
  assert.equal(seen.url, XAI_URL);
  assert.equal(seen.init.headers.authorization, "Bearer test-key");
  const body = JSON.parse(seen.init.body);
  assert.equal(body.messages[0].content, SYSTEM_PROMPT); assert.equal(body.max_tokens, 120); assert.equal(body.stream, false);
  assert.ok(!/leak|x\.near|XRP/.test(body.messages[1].content), "extra fields must not be forwarded");
  assert.ok(/side: long/.test(body.messages[1].content));
  assert.ok(!/test-key/.test(JSON.stringify(r)), "key must never be in the response");
});

test("XAI_MODEL overrides the model", async () => {
  const seen = {}; await coachReply({ context: ctx }, { env: { XAI_API_KEY: "k", XAI_MODEL: "grok-4.7" }, fetchImpl: okFetch("Fine.", seen) });
  assert.equal(JSON.parse(seen.init.body).model, "grok-4.7");
});

test("http error / throw / bad reply / XRP reply all fall back", async () => {
  const env = { XAI_API_KEY: "k" };
  assert.equal((await coachReply({ context: ctx }, { env, fetchImpl: async () => ({ ok: false, status: 401 }) })).body.reason, "http-401");
  assert.equal((await coachReply({ context: ctx }, { env, fetchImpl: async () => { throw new Error("boom"); } })).body.reason, "error");
  assert.equal((await coachReply({ context: ctx }, { env, fetchImpl: okFetch("") })).body.reason, "bad-reply");
  assert.equal((await coachReply({ context: ctx }, { env, fetchImpl: okFetch("Consider XRP instead.") })).body.reason, "bad-reply");
});

test("timeout: aborts and reports timeout", async () => {
  const slow = (url, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" }))));
  const t0 = Date.now();
  const r = await coachReply({ context: ctx }, { env: { XAI_API_KEY: "k" }, fetchImpl: slow });
  assert.equal(r.body.reason, "timeout"); assert.ok(Date.now() - t0 < 7500);
});

test("rate limit: 12 per minute per key, then 429", async () => {
  let t = 0; const limiter = makeLimiter(12, () => t);
  const f = okFetch("Ok.");
  for (let i = 0; i < 12; i++) assert.equal((await coachReply({ context: ctx }, { env: { XAI_API_KEY: "k" }, fetchImpl: f, limiter, key: "a" })).status, 200);
  assert.equal((await coachReply({ context: ctx }, { env: { XAI_API_KEY: "k" }, fetchImpl: f, limiter, key: "a" })).status, 429);
  assert.equal((await coachReply({ context: ctx }, { env: { XAI_API_KEY: "k" }, fetchImpl: f, limiter, key: "b" })).status, 200);
  t = 61000;
  assert.equal((await coachReply({ context: ctx }, { env: { XAI_API_KEY: "k" }, fetchImpl: f, limiter, key: "a" })).status, 200);
});

test("cleanReply strips markdown and caps length", () => {
  assert.equal(cleanReply("**Keep** the _stop_."), "Keep the stop.");
  const long = ("Sentence number one is here. ").repeat(30);
  const c = cleanReply(long); assert.ok(c.length <= 281);
  assert.equal(cleanReply(42), null);
});

test("sanitizeContext clamps numbers and drops junk", () => {
  const c = sanitizeContext({ side: "short", sizeLots: 1e12, entry: "abc", riskPctOfEquity: -5, extra: 1 });
  assert.equal(c.sizeLots, 1e9); assert.equal(c.entry, null); assert.equal(c.riskPctOfEquity, 0); assert.ok(!("extra" in c));
});

test("indicator fields pass through sanitized; dollar signs are stripped from replies", () => {
  const ctx = sanitizeContext({ side: "flat", mark: 10, timeframe: "5m", rsi14: 28.4, rsiState: "oversold", emaFast9: 10, emaSlow21: 10.1, priceVsEmaFast: "above", indicatorSignal: "RSI 28, oversold, price back above EMA 9 on 5m: possible long (sim).\u0000", evil: "x" });
  assert.equal(ctx.timeframe, "5m");
  assert.equal(ctx.rsi14, 28.4);
  assert.equal(ctx.rsiState, "oversold");
  assert.equal(ctx.priceVsEmaFast, "above");
  assert.match(ctx.indicatorSignal, /possible long \(sim\)\.$/);
  assert.equal("evil" in ctx, false);
  assert.equal(sanitizeContext({ side: "flat", timeframe: "99y", rsiState: "x" }).timeframe, null);
  assert.match(userPrompt(ctx), /rsi14: 28.4/);
  assert.equal(cleanReply("RSI 28 near $10.05, possible long (sim)."), "RSI 28 near 10.05, possible long (sim).");
  assert.match(SYSTEM_PROMPT, /RSI 14/);
});
