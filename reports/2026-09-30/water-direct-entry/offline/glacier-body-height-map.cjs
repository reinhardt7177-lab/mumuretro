const fs=require('fs');
const d=JSON.parse(fs.readFileSync('D:/mumumetro/unity/MumuPlanet/Assets/Mumu/Models/WaterMountain/glacier-temple-v03.json','utf8'));
const cell=.25,X0=-7,Z0=-3,W=56,H=46;
const grid=[...Array(H)].map(()=>Array(W).fill('.'));
function mark(ch,filter,y0,y1){for(const m of d.meshes){if(!filter(m.material))continue;const v=m.vertices,t=m.triangles;
 for(let i=0;i<t.length;i+=3){const p=[t[i],t[i+1],t[i+2]].map(j=>[v[j*3],v[j*3+1],v[j*3+2]]);const ymin=Math.min(...p.map(q=>q[1])),ymax=Math.max(...p.map(q=>q[1]));if(ymax<y0||ymin>y1)continue;
  // rasterize triangle xz projection coarsely by sampling barycentric points
  for(let a=0;a<=8;a++)for(let b=0;b<=8-a;b++){const c=8-a-b;const x=(p[0][0]*a+p[1][0]*b+p[2][0]*c)/8,z=(p[0][2]*a+p[1][2]*b+p[2][2]*c)/8,y=(p[0][1]*a+p[1][1]*b+p[2][1]*c)/8;if(y<y0||y>y1)continue;
   const gx=Math.floor((x-X0)/cell),gz=Math.floor((z-Z0)/cell);if(gx>=0&&gx<W&&gz>=0&&gz<H)grid[gz][gx]=ch;}}}}
mark('s',n=>/limestone|worn/.test(n),0.05,1.8);
mark('#',n=>/ice|frost/i.test(n),0.05,1.8);
console.log('x from -7 to 7 (each char .25m); rows z from 8 (top) to -3 (bottom). # ice, s stone, | collider x=+-3.6');
for(let gz=H-1;gz>=0;gz--){const z=Z0+gz*cell;console.log((z.toFixed(2)).padStart(6)+' '+grid[gz].join(''));}
