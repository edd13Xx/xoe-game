import fs from 'node:fs';
import assert from 'node:assert/strict';
process.env.XOE_REVIEW_LIBRARY='1';
const { openGame, closeGame, wait: realWait, press, pressName, phaseOf, bodyText, setupPilot, walkStory, practiceDesk, toMap, closeChapterCard, pressGate, dismissReminder }=await import('./review-v19.mjs');
// runFor fires every timer/rAF callback; it never grants clears, levels, damage or rewards.
const wait=async(s,ms)=>{if(process.env.XOE_FAST_CLOCK==='1'){await s.page.clock.runFor(ms);await realWait(s,30)}else await realWait(s,ms)};
const closeSkirmish=async(s)=>{
  for (let i=0;i<4;i++){
    const close=s.page.getByRole('button',{name:'Close fight',exact:true});
    if(!(await close.isVisible().catch(()=>false))) break;
    await pressName(s,'Close fight');await wait(s,200);
  }
};
const fixture=JSON.parse(fs.readFileSync('review/route-fixture.json'));
const axeSource=fs.readFileSync('node_modules/axe-core/axe.min.js','utf8');
const results=process.env.REVIEW_DEVICES && fs.existsSync('review/full-playthrough-v19.json') ? JSON.parse(fs.readFileSync('review/full-playthrough-v19.json')).filter(r=>!process.env.REVIEW_DEVICES.split(',').includes(r.device)) : [];
for(const device of (process.env.REVIEW_DEVICES||'desktop,portrait,landscape').split(',')){
 const s=await openGame({device});const r={device,preciseClockAdvance:process.env.XOE_FAST_CLOCK==='1',colonies:[],a11y:[],errors:[]};
 const shot=async name=>s.page.screenshot({path:`review/${device}-${name}.png`});
 const axe=async screen=>{await s.page.addScriptTag({content:axeSource});const a=await s.page.evaluate(async()=>{const a=await window.axe.run(document,{resultTypes:['violations']});return a.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});r.a11y.push({screen,violations:a});};
 try{
  await axe('front');await shot('front');
  await press(s,s.page.locator('[data-section=settings] > summary'));
  await press(s,s.page.locator('.voice-settings > summary'));
  assert.equal(await s.page.getByRole('checkbox',{name:'Enable browser voice (off by default)'}).isChecked(),false);
  await axe('settings-and-voice');
  await pressName(s,'FAQ');await axe('faq');await pressName(s,'Close');
  await pressName(s,'Start');await wait(s,200);await axe('setup');
  // Return to front and use the same visible setup path as maintained acceptance.
  await closeGame(s);
 }catch(e){r.errors.push(String(e));await closeGame(s)}
 // New storage/context for the actual fresh playthrough; no levels, clears or rewards are seeded.
 const run=await openGame({device});Object.assign(s,run);
 try{
  assert.equal((await setupPilot(s)).ok,true);await walkStory(s);await practiceDesk(s);assert.equal(await toMap(s),true);await closeChapterCard(s);await closeSkirmish(s);await pressName(s,'Close trade result');await axe('map');
  for(const [i,colony] of fixture.colonies.entries()){
   await dismissReminder(s);await closeChapterCard(s);
   assert.equal(await phaseOf(s),'colony-map',await bodyText(s));
   await pressName(s,'Full Map');assert.equal(await press(s,s.page.locator(`[data-dome="${colony.id}"]`)),true);
   await wait(s,6500);await dismissReminder(s);
   await closeSkirmish(s);
   const enter=s.page.locator(s.phone?'.enter-chip':'.enter-prompt button').first();
   assert.equal(await enter.isEnabled(),true,`${colony.id}: ${await bodyText(s)}`);assert.equal(await press(s,enter),true);await wait(s,300);
   assert.equal(await phaseOf(s),'colony-lesson');if(i===0){await axe('lesson');await shot('lesson')}
   assert.equal(await pressGate(s,colony.gate),true);await wait(s,2600);
   // Optional side missions are left at their default, not disabled by the fixture.
   if(await phaseOf(s)==='side-mission'){await pressName(s,'Skip side mission');await wait(s,200)}
   console.log(device, 'cleared', colony.id);
   r.colonies.push({id:colony.id,phase:await phaseOf(s),saved:(await bodyText(s)).match(/\d+\/10 saved/)?.[0]||(/All clear/.test(await bodyText(s))?'10/10 saved':null),pilot:(await bodyText(s)).match(/Pilot Lv \d+/)?.[0]});
   assert.equal(await phaseOf(s),'colony-map',await bodyText(s));
   fs.writeFileSync(`review/${device}-full-run-progress.json`,JSON.stringify(r,null,2));
  }
  await closeSkirmish(s);
  await shot('route-complete');assert.match(await bodyText(s),/All clear/);
  r.checkpoints=await s.page.evaluate(()=>({meta:JSON.parse(localStorage.getItem('xoe.metaProgress.v1')||'null'),applied:localStorage.getItem('xoe.routeCheckpoints.v1')}));
  assert.equal(await pressName(s,'Choose moon path'),true);await wait(s,200);await axe('moon-choice');
  assert.equal(await press(s,s.page.getByRole('button',{name:/^Xelm/})),true);assert.equal(await pressName(s,'Lock moon path · Xelm'),true);await wait(s,200);
  assert.equal(await phaseOf(s),'moon-approach');await axe('moon-approach');await shot('moon-approach');
  assert.equal(await pressName(s,'Enter the Ragnarok gate'),true);await wait(s,200);
  assert.equal(await phaseOf(s),'ragnarok');
  r.bossEntry=await s.page.locator('#scene h1').evaluate(h=>({top:h.getBoundingClientRect().top,bottom:h.getBoundingClientRect().bottom,viewport:innerHeight,focused:document.activeElement===h}));
  assert.ok(r.bossEntry.top>=-1&&r.bossEntry.bottom<=r.bossEntry.viewport&&r.bossEntry.focused,'Boss heading must be visible and focused after moon choice');
  await axe('fight');await shot('boss-fight');
  for(let i=0;i<180 && await s.page.locator('.fight-view').count();i++){
   const retry=s.page.getByRole('button',{name:'Try again',exact:true});if(await retry.isVisible()){r.retries=(r.retries||0)+1;assert.ok(r.retries<=3);await press(s,retry)}
   const dodge=s.page.getByRole('button',{name:'Dash / Shield (boost dash, dodge)',exact:true});if(await dodge.isEnabled())await press(s,dodge);
   const energy=s.page.locator('[data-fight-tick="energy"]').first();if(await energy.count())await press(s,energy);
   await pressName(s,'Fire');await wait(s,200);
  }
  assert.equal(await s.page.locator('.fight-view').count(),0,'Boss combat must actually be won');r.bossCombatWon=true;
  for(let i=0;i<fixture.boss.length && await phaseOf(s)==='ragnarok';i++){
   const gate=s.page.locator('.boss-flight-gate').filter({hasText:fixture.boss[i]}).first();assert.equal(await press(s,gate),true,`boss gate ${i}`);await wait(s,2800);
  }
  assert.equal(await phaseOf(s),'ending');await axe('ending');await shot('ending');
  r.endingScreens=[];
  for(let i=0;i<8&&await phaseOf(s)==='ending';i++){
    const body=await bodyText(s);
    r.endingScreens.push(body);
    if(/Credits/.test(body)&&!r.creditsShot){await axe('credits');await shot('credits');r.creditsShot=true}
    assert.equal(await press(s,s.page.getByRole('button',{name:/^(Continue|Cut to black)$/})),true);await wait(s,200)
  }
  r.finalPhase=await phaseOf(s);assert.equal(r.finalPhase,'blackout');await shot('complete');
 }catch(e){r.errors.push(String(e));r.failureText=await bodyText(s);await shot('full-run-failure')}
 if(s.net.blocked.length || s.errors.length)r.errors.push("Unexpected app request or console/page error")
 r.network={unexpected:s.net.blocked,hosts:[...s.net.hosts],coinbase:s.net.coinbase,xai:s.net.xai,errors:s.errors};await closeGame(s);results.push(r);fs.writeFileSync('review/full-playthrough-v19.json',JSON.stringify(results,null,2));console.log(device,JSON.stringify({colonies:r.colonies,final:r.finalPhase,errors:r.errors,a11y:r.a11y.map(a=>({screen:a.screen,serious:a.violations.filter(v=>['serious','critical'].includes(v.impact))}))}));
}
if(results.some(r=>r.errors.length||r.a11y.some(a=>a.violations.some(v=>['serious','critical'].includes(v.impact)))))process.exitCode=1;
