import { expect, it } from "vitest"
import { readFileSync } from "node:fs"
it("does not override dynamic visible fight/microphone/ticker names and groups independent pilot controls correctly",()=>{
 const source=(name:string)=>readFileSync(new URL(`./${name}.tsx`,import.meta.url),"utf8")
 expect(source("FightView")).not.toContain('aria-label={`Fire at ${en.name}`}')
 expect(source("FightView")).toContain('<span className="sr-only">Fire at </span>{en.name}')
 expect(source("MicChoiceButton")).toContain('"🎤 Say gate"')
 expect(source("MicChoiceButton")).not.toContain('aria-label={listening')
 expect(source("PilotMenu")).toContain('className="roster-list" role="group"')
 expect(source("PilotMenu")).not.toContain('role="listbox"')
 expect(source("XOrbitalMenu")).toContain("<VoiceSettings />")
 expect(source("LiveTicker")).not.toContain('aria-label={`Ticker coin')
})
it("keeps the phone Enter verb/name contiguous and supplies high-contrast FAQ navigation in every state",()=>{
 const map=readFileSync(new URL("./ColonyMapView.tsx",import.meta.url),"utf8")
 expect(map).toContain('</span>{" "}')
 const chip=map.slice(map.indexOf('data-enter-chip="1"'),map.indexOf('className="enter-chip-verb"'))
 expect(chip).not.toContain('aria-label=')
 expect(chip).toContain('title=')
 const css=readFileSync(new URL("../index.css",import.meta.url),"utf8")
 expect(css).not.toContain('translateY(24px); opacity: 0.6')
 expect(css).toContain('.faq-toc a, .faq-toc a:visited, .faq-toc a:hover, .faq-toc a:focus-visible { color: #c4b5fd; }')
})
