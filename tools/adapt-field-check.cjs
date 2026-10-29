const assert=require('node:assert/strict');
module.exports=function(name,source,adaptations){
 if(name==='check-silhouette-court.cjs'){
  const from='gap: p.top - n.bottom',to='gap: Math.max(p.top-n.bottom,n.top-p.bottom,p.left-n.right,n.left-p.right)';assert(source.split(from).length===3);source=source.replaceAll(from,to);
  const fault="n.style.bottom = '112px'; const gap = p.getBoundingClientRect().top - n.getBoundingClientRect().bottom; n.style.removeProperty('bottom'); return gap;";
  assert(source.includes(fault));source=source.replace(fault,"const old=n.getAttribute('style'),r=p.getBoundingClientRect();n.style.top=r.top+'px';n.style.left=r.left+'px';n.style.width=r.width+'px';const q=n.getBoundingClientRect(),gap=Math.max(r.top-q.bottom,q.top-r.bottom,r.left-q.right,q.left-r.right);if(old===null)n.removeAttribute('style');else n.setAttribute('style',old);return gap;");
  source=source.replace('Fault injection catches old fixed notification position overlapping long prompt','Fault injection catches coincident notification and action boxes');
  adaptations.push('touch HUD now places notifications below actions or in a left landscape column;measure >=7px separation along either screen axis and inject actual coincident boxes;retain all20 optical/save/collision/input assertions');
 }
 return source;
};
