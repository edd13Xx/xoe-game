/** Current local Chromium acceptance. Original pre-menu test is preserved in docs/history/accept-v18.2.mjs. */
import { spawnSync } from 'node:child_process'
const build=process.env.XOE_BUILD||'dist/index.html'
for(const args of [['check'],['run','map'],['run','grok-test'],['run','tutorial']]){
 const result=spawnSync(process.execPath,['verify.mjs',...args,'--build',build],{stdio:'inherit'})
 if(result.status!==0){process.exitCode=result.status??1;break}
}
