import { tryGrokTts, DEFAULT_GROK_TTS_ENDPOINT } from "./xo-speech.ts"
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEFAULT_GROK_CONNECT, GROK_CONNECT_STORAGE_KEY, disconnectGrok, readGrokConnectSettings, writeGrokConnectSettings } from './grok-connect-settings.ts'
import { buildReportContext, clearErrorLog, grokAutoHintPrompt, grokBugReportPrompt, logClientError, templateBugReport } from './error-log.ts'
import { parseSpotAmount } from './live-ticker.ts'
import { parseCoinbaseSpot } from './market.ts'
import { boundedFetch } from './bounded-fetch.ts'
import { initialPractice, applyPaperAction, applyPracticeTick, formatTradeLine, paperResult } from './practice.ts'
import { settlePaperSession } from './paper-session.ts'
import { startFight } from './combat.ts'
import { resumeFightClock } from './fight-pause.ts'
const read = (p: string) => readFileSync(p, 'utf8')
function mem() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k,v) }, removeItem: (k: string) => { m.delete(k) } } }
const marker = ['xai', 'nonsecret-test-marker-0000'].join('-')
describe('v19 privacy and reliability', () => {
  it('keeps the boss education arcade-based, with no question form', () => {
    const source=read('src/ui/RagnarokView.tsx')
    expect(source).toContain('<BossFlightGates')
    expect(source).not.toContain('item.question')
    expect(source).not.toContain('MicChoiceButton')
  })
  it('pins speech bearer requests to xAI, never an edited endpoint', async () => {
    const fetcher=vi.fn(async (_url:string, _init?:RequestInit) => new Response('', {status:503}))
    vi.stubGlobal('fetch',fetcher)
    try {
      expect(await tryGrokTts('Hello',marker,'https://unapproved.invalid/key-thief','eve')).toBe(false)
      expect(fetcher.mock.calls[0]?.[0]).toBe(DEFAULT_GROK_TTS_ENDPOINT)
      const init=fetcher.mock.calls[0]?.[1] as RequestInit
      expect(init.redirect).toBe('error')
      expect(init.credentials).toBe('omit')
    } finally { vi.unstubAllGlobals() }
  })
  it('defaults to session-only, migrates old persistence without assuming consent, remembers only explicitly', () => {
    const store = mem()
    writeGrokConnectSettings(store, { ...DEFAULT_GROK_CONNECT, apiKey: marker })
    expect(store.getItem(GROK_CONNECT_STORAGE_KEY)).not.toContain(marker)
    expect(readGrokConnectSettings(store).apiKey).toBe(marker)
    writeGrokConnectSettings(store, { ...DEFAULT_GROK_CONNECT, apiKey: marker, remember: true })
    expect(store.getItem(GROK_CONNECT_STORAGE_KEY)).toContain(marker)
    disconnectGrok(store)
    expect(readGrokConnectSettings(store).apiKey).toBe('')
    store.setItem(GROK_CONNECT_STORAGE_KEY, JSON.stringify({ apiKey: marker }))
    expect(readGrokConnectSettings(store).apiKey).toBe(marker)
    expect(store.getItem(GROK_CONNECT_STORAGE_KEY)).not.toContain(marker)
  })
  it('reports failed wiping and refuses to reactivate a key', () => {
    const store = mem()
    writeGrokConnectSettings(store, { ...DEFAULT_GROK_CONNECT, apiKey: marker, remember: true })
    store.removeItem = () => { throw Error('blocked') }
    expect(disconnectGrok(store).storageError).toMatch(/could not be fully cleared/)
    expect(readGrokConnectSettings(store).apiKey).toBe('')
  })
  it('redacts notes, returned error names, copied reports and both AI prompts', () => {
    clearErrorLog()
    const e = new Error(marker); e.name = marker
    const logged = logClientError('manual', e)
    const ctx = buildReportContext({ note: `${marker} Bearer test-secret sk-nonsecret-placeholder0000`, grokEnabled: false, hasKey: false })
    for (const value of [JSON.stringify(logged), JSON.stringify(ctx), templateBugReport(ctx), grokBugReportPrompt(ctx), grokAutoHintPrompt(logged, marker)]) expect(value).not.toContain(marker)
  })
  it.each(['', ' ', '0', '-1', 'NaN', 'Infinity'])('rejects invalid Coinbase spot %j', (amount) => {
    expect(parseSpotAmount({ data: { amount } })).toBeNull()
    expect(parseCoinbaseSpot({ data: { amount } })).toBeNull()
  })
  it('aborts hung quote requests and exits within its timeout', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const promise = boundedFetch((_url, init) => { signal = init?.signal as AbortSignal; return new Promise(() => {}) }, 'https://api.coinbase.com', 20)
    const caught = expect(promise).rejects.toThrow(/timed out/)
    await vi.advanceTimersByTimeAsync(21)
    await caught
    expect(signal?.aborted).toBe(true)
    vi.useRealTimers()
  })
  it('consumes world desk P/L once; reset session cannot pay it again', () => {
    let d = initialPractice({ unclaimedStroops: 0, price: 10 })
    d = applyPaperAction(d, 'buy', 10); d = applyPracticeTick(d, 12)
    const first = settlePaperSession(d, () => 0)
    expect(first.pnl).not.toBe(0)
    expect(settlePaperSession(first.next, () => 0).pnl).toBe(0)
  })
  it('formats sim dollars from actual mark P/L rather than the fixed starting conversion', () => {
    let d = initialPractice({ unclaimedStroops: 0, price: 10 })
    d = applyPaperAction(d, 'buy', 10); d = applyPracticeTick(d, 12)
    expect(formatTradeLine(d).pnl).toContain(paperResult(d).toFixed(2))
  })
  it('skirmish uses the world desk and never settles a second copy', () => {
    expect(read('src/App.tsx')).toContain('sharedDesk={worldDesk}')
    expect(read('src/ui/FightView.tsx')).toContain('if (!sharedDesk && pnl !== 0)')
  })
  it('does not reapply XLM steps on animation ticks or clamp non-XOE instruments', () => {
    expect(read('src/ui/useTickerFeed.ts')).toContain('const drip = 0')
    expect(read('src/ui/MarketPanel.tsx')).toContain('USD / XLM')
    expect(read('src/ui/LiveTicker.tsx')).not.toContain('clampXoePrice')
  })
  it('keeps the map fight shortcut narrow so Map and Enter are not masked', () => {
    expect(read('src/index.css')).toContain('.map-fight-btn { width: 72px; max-width: 72px;')
  })
  it('owns touch pointers and clears cancelled holds and paused keyboard flags', () => {
    for (const file of ['src/ui/ColonyMapView.tsx','src/ui/ColonyLessonView.tsx']) {
      const source=read(file)
      expect(source).toContain('activePointer.current !== null')
      expect(source).toContain('onPointerCancel=')
      expect(source).toContain('onLostPointerCapture=')
    }
    expect(read('src/ui/ColonyMapView.tsx')).toContain('keysRef.current = { u: false, d: false, l: false, r: false }')
  })
  it('blocks practice trades and map movement while a menu is paused', () => {
    expect(read('src/App.tsx')).toContain('if (!playFrozen) dispatch({ type: "paper-action"')
    expect(read('src/ui/PracticeView.tsx')).toContain('const paused = frozen ||')
    expect(read('src/ui/ColonyMapView.tsx')).toContain('paused || hidden')
  })
  it('pauses combat without remount, preserves cooldowns, supports native tick clicks', () => {
    const f = startFight('colony', 'normal')
    f.mech.dodgeUntilMs = 1000; f.mech.fireCooldownUntilMs = 1100
    const next = resumeFightClock(f, 5000)
    expect(next.mech.dodgeUntilMs).toBe(6000)
    expect(next.mech.fireCooldownUntilMs).toBe(6100)
    expect(next.enemies).toEqual(f.enemies)
    const app = read('src/App.tsx')
    expect(app).toContain('{mapFight ? (')
    expect(app).toContain('paused={playFrozen} mode="colony"')
    expect(read('src/ui/FightView.tsx')).toContain('onClick={(e) => { e.stopPropagation(); tapTick(t) }}')
    expect(read('src/index.css')).toContain('.drawer-head .drawer-close { min-height: 48px; }')
  })
})
