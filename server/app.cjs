// One origin for the game and ephemeral classroom rooms. No account or cloud save.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createCoopServer}=require('./coop.cjs');
const root=path.resolve(__dirname,'..');
const mime={'.js':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.svg':'image/svg+xml','.wasm':'application/wasm','.glb':'model/gltf-binary'};
function createAppServer({origins=[],allowReview=false}={}){
 const coop=createCoopServer({allowSameOrigin:true,origins}),handle=coop.listeners('request')[0];
 return http.createServer((req,res)=>{
  let pathname;try{pathname=new URL(req.url,'http://app.local').pathname;}catch{res.writeHead(400);res.end();return;}
  if(pathname.startsWith('/api/coop/')){req.url=pathname.slice('/api/coop'.length);return handle(req,res);}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(pathname.replace(/\/$/,'/index.html')));}catch{res.writeHead(400);res.end();return;}
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
  const parts=path.relative(root,file).split(path.sep);
  // Classroom sharing serves only the browser runtime, never repository/configuration files.
  const runtime=['src','assets','vendor'].includes(parts[0])||parts.length===1&&['index.html','fire-trial.html'].includes(parts[0]);
  const review=allowReview&&(['art','reports','tools'].includes(parts[0])||parts.length===1&&path.extname(file)==='.md');
  if(parts.some(p=>p.startsWith('.'))||!runtime&&!review){res.writeHead(404);res.end('Not found');return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',fs.statSync(file).size);res.setHeader('Cache-Control','no-store');
  if(req.method==='HEAD'){res.end();return;}
  fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 });
}
module.exports={createAppServer};
if(require.main===module){
 const port=Number(process.env.PORT||process.argv[2]||5512),host=process.env.HOST||(process.argv.includes('--share')?'0.0.0.0':'127.0.0.1');
 const server=createAppServer({origins:(process.env.COOP_ORIGINS||'').split(',').filter(Boolean)});
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`포트 ${port}번을 이미 사용 중입니다. 기존 교실 서버를 확인하거나 다른 포트를 지정하세요.`:e.message);process.exitCode=1;});
 server.listen(port,host,()=>{
  console.log(`무무 행성 · 교사 PC: http://127.0.0.1:${port}/`);
  if(host==='0.0.0.0'){
   const addresses=Object.values(require('node:os').networkInterfaces()).flat().filter(n=>n.family==='IPv4'&&!n.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address));
   for(const n of addresses)console.log(`학생 접속 주소: http://${n.address}:${port}/`);
   if(!addresses.length)console.log('교실 네트워크 주소가 없습니다. 교사 PC의 와이파이/유선 연결을 확인하세요.');
   console.log('같은 네트워크에서 위 주소로 접속 → 같이 하기 → 8자리 방 코드 (최대 3명)');
  }
  console.log('이 창을 열어 두세요. 종료: Ctrl+C. 개인 기록은 각 기기에 저장됩니다.');
 });
}
