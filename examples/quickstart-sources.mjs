// Offline project memory: conflicting sources, revision, access revocation.
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPalariBrain } from '../src/core.mjs'
import { answerFromSources } from '../src/source-memory.mjs'
const root=await mkdtemp(join(tmpdir(),'palari-project-'))
const brain=await createPalariBrain({memoryEnabled:true,workspaceId:'project-demo',memoryRootDir:root})
const memory=brain.sourceMemory({palariId:'project',userId:'owner'})
function admit(id,text,authority,expectedVersion=0) {
 const source=memory.admitSource({id,text,title:id,kind:'document',authority,expectedVersion,retention:'durable'})
 memory.recordClaim({id,topic:'budget',statement:text,bases:[{sourceId:id,version:source.version,quote:text,relation:'supports'}]})
}
// An explicit demonstration policy, not a model or inferred authority ranking.
const provider=({evidence})=>{
 const basis=evidence.claims.flatMap(c=>c.bases).find(b=>b.authority==='approved')
 return basis ? {text:basis.quote,bases:[{sourceId:basis.sourceId,version:basis.version,quote:basis.quote}]} : {text:'No current approved budget is available.',bases:[]}
}
const answer=()=>answerFromSources(memory,{topic:'budget',question:'What is the approved budget?',provider})
try {
 admit('proposal','Proposed budget: $20,000.','proposal')
 admit('meeting','Discussed budget: $30,000.','discussion')
 admit('approval','Approved budget: $25,000.','approved')
 assert.equal(memory.recall('budget').hasAlternatives,true)
 console.log('Sources: proposal, discussion and approval remain separate.')
 assert.equal((await answer()).answer,'Approved budget: $25,000.')
 console.log('Answer: approved budget is $25,000, citing approval version 1.')
 memory.admitSource({id:'approval',text:'Approved budget: $28,000.',title:'approval',kind:'document',authority:'approved',retention:'durable',expectedVersion:1})
 assert.deepEqual(memory.staleClaimIds(),['approval'])
 assert.equal((await answer()).abstained,true)
 console.log('Revision: prior approval claim is stale until re-extracted.')
 memory.recordClaim({id:'approval',topic:'budget',statement:'Approved budget: $28,000.',bases:[{sourceId:'approval',version:2,quote:'Approved budget: $28,000.',relation:'supports'}]})
 assert.equal((await answer()).answer,'Approved budget: $28,000.')
 memory.revokeSource('approval',2)
 assert.equal((await answer()).abstained,true)
 console.log('Revocation: approval and dependent claim are excluded.')
 memory.forgetSource('approval',3)
 assert.equal(memory.readSource('approval'),null)
 console.log('Forget: source content and dependent claim removed.')
} finally {brain.close();await rm(root,{recursive:true,force:true})}
