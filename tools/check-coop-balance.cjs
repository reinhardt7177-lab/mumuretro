const assert=require('node:assert/strict');const {createBalance,commandBalance,releaseBalance}=require('../server/balance.cjs');
const s=createBalance(),cmd=(id,stage,type,box,cell,value)=>commandBalance(s,id,{stage,type,box,cell,value});
assert.equal(cmd('a',1,'pick',0),'locked');assert.equal(cmd('a',0,'pick',0),null);assert.equal(cmd('b',0,'pick',0),'owned');assert.equal(cmd('b',0,'place',0,0),'owner');releaseBalance(s,'a');assert.equal(s.stages[0].at[0],-1);
for(let i=0;i<3;i++){assert.equal(cmd(String(i),0,'pick',i),null);assert.equal(cmd(String(i),0,'place',i,i),null);}assert(s.stages[0].solved);
for(const [i,cell]of [0,2,3,1].entries()){assert.equal(cmd('a',1,'pick',i),null);assert.equal(cmd('a',1,'place',i,cell),null);}assert(s.stages[1].solved);
for(const [i,cell]of [0,2].entries()){assert.equal(cmd('a',2,'pick',i),null);assert.equal(cmd('a',2,'place',i,cell),null);}assert(s.stages[2].solved);console.log('PASS ownership, disconnect release, stage order, three balance rules');
