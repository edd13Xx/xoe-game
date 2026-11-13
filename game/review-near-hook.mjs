// Proves the REAL game emits an "xoe:achievement" event when the first colony is cleared (desktop, local build, mocked network).
// Mirrors the first colony of review-full-playthrough.mjs. No NEAR/network access is involved.
import fs from 'node:fs';
import assert from 'node:assert/strict';
process.env.XOE_REVIEW_LIBRARY='1';
const { openGame, closeGame, wait, press, pressName, phaseOf, bodyText, setupPilot, walkStory, practiceDesk, toMap, closeChapterCard, pressGate, dismissReminder }=await import('./review-v19.mjs');
const fixture=JSON.parse(fs.readFileSync('review/route-fixture.json'));
const s=await openGame({device:'desktop'});
try{
 await s.page.evaluate(()=>{window.__xoeEvents=[];window.addEventListener('xoe:achievement',e=>window.__xoeEvents.push(e.detail))});
 assert.equal((await setupPilot(s)).ok,true);await walkStory(s);await practiceDesk(s);assert.equal(await toMap(s),true);await closeChapterCard(s);
 await pressName(s,'Close trade result');
 const colony=fixture.colonies[0];
 await dismissReminder(s);await closeChapterCard(s);
 await pressName(s,'Full Map');assert.equal(await press(s,s.page.locator(`[data-dome="${colony.id}"]`)),true);
 await wait(s,6500);await dismissReminder(s);
 const enter=s.page.locator('.enter-prompt button').first();assert.equal(await enter.isEnabled(),true);assert.equal(await press(s,enter),true);await wait(s,300);
 assert.equal(await phaseOf(s),'colony-lesson');
 assert.equal(await pressGate(s,colony.gate),true);await wait(s,2600);
 const ev=await s.page.evaluate(()=>window.__xoeEvents);
 console.log('events', JSON.stringify(ev));
 assert.deepEqual(ev[0],{id:'colony_cleared',detail:colony.id});
 console.log('PASS: real colony clear emitted xoe:achievement for', colony.id);
}finally{await closeGame(s)}
