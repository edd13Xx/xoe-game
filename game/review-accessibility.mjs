import fs from 'node:fs';
process.env.XOE_REVIEW_LIBRARY='1';
const {openGame,closeGame,pressName,wait}=await import('./review-v19.mjs');
const source=fs.readFileSync('node_modules/axe-core/axe.min.js','utf8'),results=[];
for(const device of ['desktop','portrait','landscape']){
 const s=await openGame({device}),r={device,screens:[],errors:[]};
 try{
  await s.page.addScriptTag({content:source});
  for(const name of ['High scores / Leaderboard','Tutorial','Report a problem','XOE trade desk','Market','Ask XOE','Account & Wallet']){
   if(!await pressName(s,name))throw new Error(`Cannot open ${name}`);await wait(s,100);
   const violations=await s.page.evaluate(async()=>{const a=await window.axe.run(document,{resultTypes:['violations']});return a.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
   r.screens.push({name,violations});
   if(violations.some(v=>['serious','critical'].includes(v.impact)))await s.page.screenshot({path:`review/${device}-a11y-panel-failure.png`});
   if(!await pressName(s,'Close'))throw new Error(`Cannot close ${name}`);
  }
 }catch(e){r.errors.push(String(e))}
 r.network={blocked:s.net.blocked,errors:s.errors};await closeGame(s);results.push(r);fs.writeFileSync('review/accessibility-panels.json',JSON.stringify(results,null,2));console.log(device,JSON.stringify(r));
}
if(results.some(r=>r.errors.length||r.network.errors.length||r.network.blocked.length||r.screens.some(s=>s.violations.some(v=>['serious','critical'].includes(v.impact)))))process.exitCode=1;
