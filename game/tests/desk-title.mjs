import { webkit } from "/workspace/xoe-qa/node_modules/playwright/index.mjs"
import { pathToFileURL } from "node:url"
const b = await webkit.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } })
await ctx.route("**/*", (r) => (/^https?:/.test(r.request().url()) ? r.abort() : r.continue()))
const p = await ctx.newPage(); await p.goto(pathToFileURL(process.argv[2]).href); await p.waitForTimeout(800)
await p.screenshot({ path: "/workspace/eddie-bot-handoff/qa-v18.2/v18.2-desktop-1280x800-title.png" })
await b.close()
