// Grok AI desk coach for the XOE paper-trading simulator (server side).
// The xAI key comes ONLY from process.env.XAI_API_KEY on this server. It is never sent to the game or the browser.
// XAI_BASE_URL is for tests only (points at a local mock). Every failure path returns { ok:false, reason } so the game can fall back to its rule-based tip instantly.

export const XAI_URL = "https://api.x.ai/v1/chat/completions";
export const DEFAULT_MODEL = "grok-4.20-0309-non-reasoning"; // fast, non-reasoning; override with XAI_MODEL
export const TIMEOUT_MS = 6000;
export const MAX_CHARS = 280;
export const RATE_PER_MINUTE = 12;

export const IMAGERY = ["enemy squadrons", "an asteroid field", "a solar flare", "a hull breach", "oxygen reserves", "fuel lines", "shield generators", "radar contacts", "an ambush in a nebula", "a boarding party", "a meteor storm", "a cracked reactor"];
export const SYSTEM_PROMPT =
  "You are XOE, the in-universe combat co-pilot riding along with an orbital mech pilot during a PAPER-MONEY practice trade. " +
  "Reply in 1-2 short sentences (max 45 words). Open with a battle-mode callout such as XO, XOE! or XOE, battle mode! " +
  "Speak ONLY in survival and battle metaphors: never say RSI, EMA, oversold, overbought, percent, stop-loss, take-profit, lots, equity, long, short, buy, sell or other trading jargon, and never quote raw indicator numbers or percentages: use no digits and no number words at all, and do not say stop, line, flank line or risk. " +
  "Translate the readings you are given (RSI 14 and EMA 9 / EMA 21 computed from the simulated XOE price on the shown timeframe, plus risk, size, stop and P/L) into the fiction so the lesson is taught implicitly: " +
  "price below the fast and slow lines or momentum turning down means enemies closing in from that direction, so steer clear or brace; price breaking back above them means a gap opening in the enemy line; " +
  "oversold means the enemy fleet is exhausted and falling back; overbought means we are overextended deep in hostile space; " +
  "high risk per trade or a big position means oxygen low or hull thin, one hit and we are destroyed, so ease off the throttle; a missing or far stop means shields are down; " +
  "tightening the stop or cutting size is evasive maneuvers, raising shields or calling auxiliary supply; a losing streak means damage piling up, pull back and repair; a win means target down, regroup. " +
  "Vary the imagery every time (enemy squadrons, asteroid fields, solar flares, hull breaches, oxygen, fuel, shields, radar contacts, ambushes) and never repeat the same line. " +
  "Sound urgent and alert like a co-pilot under fire, but stay short and clear. " +
  "This is a simulation with play money only: never give financial advice, never tell anyone to invest real money, never guarantee or predict prices, " +
  "never mention any real coin other than the in-game XOE, never write a dollar sign or currency symbol, and do not use markdown, lists or emoji.";

const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const pick = (v, allowed) => (allowed.includes(v) ? v : null);

/** Only these fields ever leave the server for xAI. Everything else in the request body is dropped. */
export function sanitizeContext(raw) {
  if (!raw || typeof raw !== "object") return null;
  const side = pick(raw.side, ["long", "short", "flat"]);
  if (!side) return null;
  return {
    state: pick(raw.state, ["open-position", "planning-order"]) || "planning-order",
    side,
    sizeLots: num(raw.sizeLots, 0, 1e9),
    entry: num(raw.entry, 0, 1e9),
    mark: num(raw.mark, 0, 1e9),
    stopLoss: num(raw.stopLoss, 0, 1e9),
    takeProfit: num(raw.takeProfit, 0, 1e9),
    riskPctOfEquity: num(raw.riskPctOfEquity, 0, 1000),
    unrealizedPnlPct: num(raw.unrealizedPnlPct, -1000, 1000),
    lastResult: pick(raw.lastResult, ["win", "loss", "none"]) || "none",
    losingStreak: num(raw.losingStreak, 0, 100) ?? 0,
    timeframe: pick(raw.timeframe, ["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W", "1mo"]),
    rsi14: num(raw.rsi14, 0, 100),
    rsiState: pick(raw.rsiState, ["oversold", "overbought", "neutral", "warming"]),
    emaFast9: num(raw.emaFast9, 0, 1e9),
    emaSlow21: num(raw.emaSlow21, 0, 1e9),
    priceVsEmaFast: pick(raw.priceVsEmaFast, ["above", "below"]),
    indicatorSignal: typeof raw.indicatorSignal === "string" ? raw.indicatorSignal.replace(/[^\x20-\x7e]/g, "").slice(0, 160) : null,
    ruleTip: typeof raw.ruleTip === "string" ? raw.ruleTip.slice(0, 160) : null,
  };
}

export function userPrompt(ctx) {
  const parts = Object.entries(ctx).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`);
  return `Paper-trading desk state (play money):\n${parts.join("\n")}\nGive the pilot one brief coaching tip.`;
}

/** Cleans a model reply; returns null if it is unusable or breaks a content rule. */
export function cleanReply(text) {
  if (typeof text !== "string") return null;
  let t = text.replace(/[*_`#>$]+/g, "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/xrp|ripple/i.test(t)) return null;
  if (t.length > MAX_CHARS) {
    const cut = t.slice(0, MAX_CHARS);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    t = end > 60 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
  }
  return t;
}

/** Simple sliding-window limiter, per key (IP). */
export function makeLimiter(perMinute = RATE_PER_MINUTE, now = () => Date.now()) {
  const hits = new Map();
  return (key) => {
    const t = now();
    const arr = (hits.get(key) || []).filter((x) => t - x < 60000);
    if (arr.length >= perMinute) { hits.set(key, arr); return false; }
    arr.push(t); hits.set(key, arr); return true;
  };
}

/**
 * Returns { status, body }. Never throws.
 * deps: { env, fetchImpl, limiter, key }
 */
export async function coachReply(rawBody, { env = process.env, fetchImpl = globalThis.fetch, limiter = null, key = "local" } = {}) {
  const ctx = sanitizeContext(rawBody?.context ?? rawBody);
  if (!ctx) return { status: 400, body: { ok: false, reason: "bad-context" } };
  const apiKey = env.XAI_API_KEY;
  if (!apiKey) return { status: 200, body: { ok: false, reason: "no-key" } };
  if (limiter && !limiter(key)) return { status: 429, body: { ok: false, reason: "rate-limit" } };
  const model = env.XAI_MODEL || DEFAULT_MODEL;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(env.XAI_BASE_URL ? `${env.XAI_BASE_URL.replace(/\/$/, "")}/chat/completions` : XAI_URL, {
      method: "POST",
      signal: ac.signal,
      redirect: "error",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, stream: false, temperature: 0.9, max_tokens: 120,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt(ctx) + " Lead imagery this time: " + IMAGERY[Math.floor(Math.random() * IMAGERY.length)] + "." }],
      }),
    });
    if (!res.ok) return { status: 200, body: { ok: false, reason: `http-${res.status}` } };
    const data = await res.json();
    const text = cleanReply(data?.choices?.[0]?.message?.content);
    if (!text) return { status: 200, body: { ok: false, reason: "bad-reply" } };
    return { status: 200, body: { ok: true, text, source: "grok", model } };
  } catch (e) {
    return { status: 200, body: { ok: false, reason: e?.name === "AbortError" ? "timeout" : "error" } };
  } finally {
    clearTimeout(timer);
  }
}
