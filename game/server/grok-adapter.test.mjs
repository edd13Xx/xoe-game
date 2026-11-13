import assert from "node:assert/strict"
import test from "node:test"
import { createGuestGrokHandler, createStore } from "./grok-adapter.mjs"

test("stays unconfigured without server flags and does not call upstream", async () => {
  let called = false
  const handle = createGuestGrokHandler({
    env: {},
    fetchImpl: async () => {
      called = true
      throw new Error("should not be called")
    },
    store: createStore(),
  })
  const result = await handle({ text: "hello", sessionId: "guest-1" })
  assert.equal(result.status, 503)
  assert.equal(result.body.status, "Grok unavailable/not configured")
  assert.equal(called, false)
  assert.equal(JSON.stringify(result.body).includes("XAI_API_KEY"), false)
})

test("mocked configured call is bounded and is not a live credential", async () => {
  const store = createStore()
  const seen = []
  const handle = createGuestGrokHandler({
    env: { XAI_GROK_GUEST_ENABLED: "1", XAI_API_KEY: "not-a-live-credential", XAI_MODEL: "mock-model" },
    store,
    fetchImpl: async (url, init) => {
      seen.push({ url, authorization: init.headers.authorization })
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "mock reply" } }] }),
      }
    },
  })
  const result = await handle({ text: "hello guest", sessionId: "guest-1" })
  assert.equal(result.status, 200)
  assert.equal(result.body.reply, "mock reply")
  assert.equal(seen[0].url, "https://api.x.ai/v1/chat/completions")
  assert.equal(result.body.reply.includes("not-a-live-credential"), false)
  const limited = createGuestGrokHandler({
    env: { XAI_GROK_GUEST_ENABLED: "1", XAI_API_KEY: "not-a-live-credential" },
    store: createStore(),
    limits: { maxInputChars: 4, maxOutputChars: 20, maxPerSession: 1, maxGlobal: 1, maxConcurrent: 1 },
    fetchImpl: async () => {
      throw new Error("should not send an oversized message")
    },
  })
  const tooLong = await limited({ text: "hello", sessionId: "guest-2" })
  assert.equal(tooLong.status, 413)
})


test("server model defaults to grok-4.7 and keeps explicit overrides (mock only)", async () => {
  for (const override of [undefined, "mock-model"]) {
    let model
    const handle=createGuestGrokHandler({env:{XAI_GROK_GUEST_ENABLED:"1",XAI_API_KEY:"not-a-live-credential",...(override?{XAI_MODEL:override}:{})},store:createStore(),fetchImpl:async(_url,init)=>{model=JSON.parse(init.body).model;return{ok:true,json:async()=>({choices:[{message:{content:"mock"}}]})}}})
    assert.equal((await handle({text:"hello",sessionId:"model-check"})).status,200)
    assert.equal(model,override??"grok-4.7")
  }
})
