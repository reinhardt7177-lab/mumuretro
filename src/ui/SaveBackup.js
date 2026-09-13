import { parseSave } from '../core/SaveGame.js';
export function attachSaveBackup(settings, capture) {
 const section=document.createElement('div');section.className='now';
 const title=document.createElement('div');title.textContent='탐사 기록';
 const button=document.createElement('button');button.type='button';button.textContent='기록 파일로 보관';
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent='현재 기록을 파일로 보관한다. 화면 설정은 이 기기에 남는다.';
 section.append(title,button,status);settings.appendSection(section);
 button.addEventListener('click',()=>{
  try {
   const raw=JSON.stringify({version:1,savedAt:Date.now(),progress:capture()});
   if(!parseSave(raw))throw Error('invalid');
   const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download=`mumu-save-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
   status.textContent='기록 파일 다운로드를 요청했다. 다운로드 목록을 확인하자.';
  }catch{status.textContent='기록 파일을 만들지 못했다. 현재 게임 기록은 유지된다.';}
 });
}
