// Ephemeral, account-free rooms. Deploy separately from static hosting.
const {createBalance,releaseBalance,commandBalance}=require('./balance.cjs');
const http=require('node:http'),crypto=require('node:crypto');
function createCoopServer({now=Date.now,origins=['http://127.0.0.1:5512'],ttl=30000}={}){
 const rooms=new Map();
 function sweep(){for(const [code,r] of rooms){for(const [id,p] of r.players)if(now()-p.seen>ttl){releaseBalance(r.balance,p.id);r.players.delete(id);}if(!r.players.size)rooms.delete(code);}}
 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;if(origin&&!origins.includes(origin)){res.writeHead(403);return res.end();}
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(req.method!=='POST')return reply(405,{error:'method'});
  try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return reply(413,{error:'size'});}const body=JSON.parse(raw);sweep();
   if(req.url==='/create'||req.url==='/join'){
    let code=String(body.code||'').toUpperCase(),room;
    if(req.url==='/create'){if(rooms.size>=100)return reply(503,{error:'busy'});do{code=crypto.randomBytes(4).toString('hex').toUpperCase();}while(rooms.has(code));room={players:new Map(),balance:createBalance()};rooms.set(code,room);}else room=rooms.get(code);
    if(!room)return reply(404,{error:'missing'});if(room.players.size>=3)return reply(409,{error:'full'});
    const token=crypto.randomBytes(24).toString('hex'),id=crypto.randomUUID();room.players.set(token,{id,seen:now(),pose:null});return reply(200,{code,token,id});
   }
   const room=rooms.get(body.code),player=room?.players.get(body.token);if(!player)return reply(401,{error:'expired'});
   if(req.url==='/leave'){releaseBalance(room.balance,player.id);room.players.delete(body.token);return reply(200,{left:true});}
   if(req.url==='/balance'){const error=commandBalance(room.balance,player.id,body.command);player.seen=now();return reply(error?409:200,{error,balance:room.balance});}
   if(req.url!=='/state')return reply(404,{error:'route'});
   if(body.pose===null)player.pose=null;
   if(body.pose!==undefined&&body.pose!==null){const p=body.pose;if(!p||!['lab','planet','balance'].includes(p.scene)||!Array.isArray(p.position)||p.position.length!==3||!p.position.every(v=>Number.isFinite(v)&&Math.abs(v)<1000))return reply(400,{error:'pose'});player.pose={scene:p.scene,position:p.position};}
   player.seen=now();return reply(200,{balance:room.balance,players:[...room.players.values()].map(({id,pose})=>({id,pose}))});
  }catch{return reply(400,{error:'request'});}
 });return server;
}
module.exports={createCoopServer};
if(require.main===module)createCoopServer({origins:(process.env.COOP_ORIGINS||'http://127.0.0.1:5512').split(',')}).listen(Number(process.env.PORT||5520),'127.0.0.1',()=>console.log('Coop server 5520'));
