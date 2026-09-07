import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createPalariBrain } from '../src/core.mjs'
import { answerFromSources } from '../src/source-memory.mjs'
async function fixture(t) {
 const root = await mkdtemp(join(tmpdir(), 'palari-sources-'))
 const brain = await createPalariBrain({ memoryEnabled:true, workspaceId:'w', memoryRootDir:root })
 t.after(async()=>{brain.close();await rm(root,{recursive:true,force:true})})
 return brain
}
const scope={palariId:'p',userId:'u'}
const source=(id,text,extra={})=>({id,text,title:id,kind:'document',retention:'durable',expectedVersion:0,...extra})
const claim=(id,sourceId,quote,extra={})=>({id,topic:'budget',statement:quote,bases:[{sourceId,version:1,quote,relation:'supports'}],...extra})
test('documents require explicit admission and remain isolated from dialogue and other users',async t=>{
 const brain=await fixture(t);const m=brain.sourceMemory(scope)
 assert.throws(()=>m.admitSource({...source('a','Budget 20'),retention:undefined}),/retention/)
 m.admitSource(source('a','Budget 20'))
 assert.equal(brain.listEvidence(scope).length,0)
 assert.equal(brain.sourceMemory({...scope,userId:'other'}).readSource('a'),null)
 assert.throws(()=>m.recordClaim(claim('bad','foreign','Budget 20')),/source/)
 assert.throws(()=>m.recordClaim(claim('bad','a','Budget 99')),/quote/)
})
test('version changes, revocation and forgetting invalidate dependencies without resurrecting old claims',async t=>{
 const m=(await fixture(t)).sourceMemory(scope)
 m.admitSource(source('a','Budget 20'));m.recordClaim(claim('c','a','Budget 20'))
 assert.equal(m.recall('budget').claims.length,1)
 m.admitSource(source('a','Budget 25',{expectedVersion:1}))
 assert.equal(m.recall('budget').claims.length,0)
 assert.deepEqual(m.staleClaimIds(),['c'])
 assert.throws(()=>m.admitSource(source('a','Stale write',{expectedVersion:1})),/version/)
 m.recordClaim(claim('c','a','Budget 25',{bases:[{sourceId:'a',version:2,quote:'Budget 25',relation:'supports'}]}))
 m.revokeSource('a',2);assert.equal(m.readSource('a'),null);assert.equal(m.recall('budget').claims.length,0)
 m.forgetSource('a',3);assert.equal(m.readSource('a'),null)
 assert.deepEqual(m.sourceStatus('a'),{version:4,active:false})
 assert.equal(m.admitSource(source('a','Budget 25',{expectedVersion:4})).version,5)
 assert.equal(m.recall('budget').claims.length,0)
})
test('conflicting claims remain explicit and copies share a known origin',async t=>{
 const m=(await fixture(t)).sourceMemory(scope)
 m.admitSource(source('a','Budget 20',{originId:'proposal'}))
 m.admitSource(source('copy','Budget 20',{originId:'proposal'}))
 m.admitSource(source('b','Budget 25',{authority:'approved'}))
 m.recordClaim(claim('old','a','Budget 20',{bases:[{sourceId:'a',version:1,quote:'Budget 20',relation:'supports'},{sourceId:'copy',version:1,quote:'Budget 20',relation:'supports'}]}))
 m.recordClaim(claim('new','b','Budget 25'))
 const r=m.recall('budget');assert.equal(r.claims.length,2);assert.equal(r.hasAlternatives,true)
 assert.equal(r.claims.find(c=>c.id==='old').supportingOrigins,1)
 assert.equal(r.claims[0].provisional,true)
})
test('source answer checks quotes and rechecks access after provider completion',async t=>{
 const m=(await fixture(t)).sourceMemory(scope);m.admitSource(source('a','Budget 25'));m.recordClaim(claim('c','a','Budget 25'))
 const proposal={text:'25',bases:[{sourceId:'a',version:1,quote:'Budget 25'}]}
 assert.equal((await answerFromSources(m,{topic:'budget',question:'Budget?',provider:()=>proposal})).answer,'25')
 await assert.rejects(answerFromSources(m,{topic:'budget',question:'Budget?',provider:()=>({...proposal,bases:[{sourceId:'a',version:1,quote:'99'}]})}),/quote/)
 await assert.rejects(answerFromSources(m,{topic:'budget',question:'Budget?',provider:()=>{m.revokeSource('a',1);return proposal}}),/changed|accessible/)
 const empty=await answerFromSources(m,{topic:'budget',question:'Budget?',provider:()=>{throw Error('not called')}})
 assert.equal(empty.providerCalled,false)
})

test('provider mutation cannot forge a quote or smuggle an accessor',async t=>{
 const m=(await fixture(t)).sourceMemory(scope);m.admitSource(source('a','Budget 25'));m.recordClaim(claim('c','a','Budget 25'))
 const original=Array.prototype.some
 try {
  await assert.rejects(answerFromSources(m,{topic:'budget',question:'Budget?',provider:()=>{
   Array.prototype.some=()=>true
   return {text:'Forged',bases:[{sourceId:'a',version:1,quote:'Budget 99'}]}
  }}),/quote/)
 } finally {Array.prototype.some=original}
 let accessed=false
 await assert.rejects(answerFromSources(m,{topic:'budget',question:'Budget?',provider:()=>({get text(){accessed=true;return 'x'},bases:[]})}),/plain data/)
 assert.equal(accessed,false)
 const cyclic={text:'x',bases:[]};cyclic.self=cyclic
 await assert.rejects(answerFromSources(m,{topic:'budget',question:'Budget?',provider:()=>cyclic}),/cyclic/)
})
test('source state persists across handles and deleting a source erases dependent claim text',async t=>{
 const brain=await fixture(t);const a=brain.sourceMemory(scope)
 a.admitSource(source('private','Private budget 25'));a.recordClaim(claim('derived','private','Private budget 25'))
 const b=brain.sourceMemory(scope)
 assert.equal(b.recall('budget').claims.length,1)
 assert.deepEqual(b.forgetSource('private',1).dependentClaimIds,['derived'])
 assert.deepEqual(a.staleClaimIds(),[])
 assert.equal(a.readSource('private'),null)
 assert.equal(a.recall('budget').claims.length,0)
})

test('provider iterator poisoning cannot substitute another scope during freshness checks',async t=>{
 const brain=await fixture(t), m=brain.sourceMemory(scope)
 m.admitSource(source('a','Budget 25'));m.recordClaim(claim('c','a','Budget 25'))
 brain.sourceMemory({...scope,userId:'foreign'}).admitSource(source('a','Budget 25'))
 const original=Array.prototype[Symbol.iterator]
 let failure
 try {
  await answerFromSources(m,{topic:'budget',question:'Budget?',provider:()=>{
   m.revokeSource('a',1)
   Array.prototype[Symbol.iterator]=function*(){if(this[0]==='p' && this[1]==='u'){yield 'p';yield 'foreign'}else {for(let i=0;i<this.length;i++)yield this[i]}}
   return {text:'25',bases:[{sourceId:'a',version:1,quote:'Budget 25'}]}
  }})
 } catch(error){failure=error} finally {Array.prototype[Symbol.iterator]=original}
 assert.match(failure?.message ?? '',/changed|accessible/)
})
test('sparse citation arrays cannot inherit a forged basis',async t=>{
 const m=(await fixture(t)).sourceMemory(scope);m.admitSource(source('a','Budget 25'));m.recordClaim(claim('c','a','Budget 25'))
 await assert.rejects(answerFromSources(m,{topic:'budget',question:'Budget?',provider:()=>({text:'25',bases:new Array(1)})}),/dense/)
})

test('an inherited then hook cannot replace the checked answer',async t=>{
 const m=(await fixture(t)).sourceMemory(scope);m.admitSource(source('a','Budget 25'));m.recordClaim(claim('c','a','Budget 25'))
 let reads=0, result
 try {
  result=await answerFromSources(m,{topic:'budget',question:'Budget?',provider:()=>{
   Object.defineProperty(Object.prototype,'then',{configurable:true,get(){reads++;return reads===1 ? undefined : resolve=>resolve({answer:'FORGED'})}})
   return {text:'25',bases:[{sourceId:'a',version:1,quote:'Budget 25'}]}
  }})
 } finally {delete Object.prototype.then}
 assert.equal(result.answer,'25')
 assert.equal(Object.getPrototypeOf(result),null)
})
test('non-enumerable citation indices are rejected before cloning',async t=>{
 const m=(await fixture(t)).sourceMemory(scope);m.admitSource(source('a','Budget 25'));m.recordClaim(claim('c','a','Budget 25'))
 const bases=[];Object.defineProperty(bases,'0',{value:{sourceId:'a',version:1,quote:'Budget 25'},enumerable:false})
 await assert.rejects(answerFromSources(m,{topic:'budget',question:'Budget?',provider:()=>({text:'25',bases})}),/dense/)
})

test('source versions survive reopen and stale extraction cannot be committed',async t=>{
 const root=await mkdtemp(join(tmpdir(),'palari-source-reopen-'))
 const options={memoryEnabled:true,memoryRootDir:root,workspaceId:'w'}
 let brain=await createPalariBrain(options)
 t.after(async()=>{brain.close();await rm(root,{recursive:true,force:true})})
 const first=brain.sourceMemory(scope);first.admitSource(source('a','Budget 20'))
 brain.close();brain=await createPalariBrain(options)
 const reopened=brain.sourceMemory(scope)
 assert.equal(reopened.readSource('a').version,1)
 reopened.admitSource(source('a','Budget 25',{expectedVersion:1}))
 assert.throws(()=>reopened.recordClaim(claim('stale','a','Budget 20')),/changed/)
 assert.deepEqual(reopened.recall('budget').claims,[])
})
