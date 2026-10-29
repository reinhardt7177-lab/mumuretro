// Reuse the prepared view setup, with a bounded debugger interruption if a
// single rear-view evaluation stalls. This does not touch personal storage.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve(__dirname,'capture-chronicle-framing.cjs');let s=fs.readFileSync(file,'utf8');
s=s.replace("const phase=process.argv[2]||'before'","const phase='diagnostic'");
s=s.replace('for(let i=0;i<120;i++)','for(let i=0;i<3;i++)');
s=s.replace('for(const shot of[',`const client=await p.context().newCDPSession(p);await client.send('Debugger.enable');
client.on('Debugger.paused',async event=>{const stack=event.callFrames.map(f=>({function:f.functionName,url:f.url,location:f.location}));fs.writeFileSync(B+'/rear-stall-stack.json',JSON.stringify({reason:event.reason,stack},null,2));console.log(JSON.stringify(stack.slice(0,12)));await client.send('Runtime.terminateExecution').catch(()=>{});await client.send('Debugger.resume').catch(()=>{});});
const guard=setTimeout(()=>client.send('Debugger.pause').catch(()=>{}),20000);guard.unref();
for(const shot of[`);
s=s.replace('report.shots.push(row);','console.log("completed "+shot.id);report.shots.push(row);');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(s,file);
