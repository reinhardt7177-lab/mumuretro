import os,json,html
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));OUT=os.path.join(ROOT,'art/glacier-water-temple/v01')
with open(os.path.join(OUT,'design-spec.json'),encoding='utf-8-sig') as f:d=json.load(f)
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1540" viewBox="0 0 1600 1540">','<rect width="1600" height="1540" fill="#112734"/>','<style>text{font-family:Malgun Gothic,sans-serif;fill:#e5eced} .stone{fill:#8b897a;stroke:#eee0bf;stroke-width:2}.ice{fill:#2786a0;fill-opacity:.32;stroke:#7bdeeb;stroke-width:2}.line{fill:none;stroke:#a5bbbf;stroke-width:1.5}.dim{stroke:#e4c481;stroke-width:1.5}.flow{fill:none;stroke:#6edfd1;stroke-width:6}</style>']
def text(x,y,t,size=17,color=None):s.append(f'<text x="{x}" y="{y}" font-size="{size}"'+(f' style="fill:{color}"' if color else '')+'>'+html.escape(t)+'</text>')
def rect(x,y,w,h,cls='stone'):s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" class="{cls}"/>')
def path(p,cls='ice'):s.append(f'<path d="{p}" class="{cls}"/>')
def line(x,y,a,b,cls='line'):s.append(f'<line x1="{x}" y1="{y}" x2="{a}" y2="{b}" class="{cls}"/>')
def dim(x,y,a,b,label):
    line(x,y,a,b,'dim');line(x-5,y-5,x+5,y+5,'dim');line(a-5,b-5,a+5,b+5,'dim');text((x+a)/2+8,(y+b)/2-8,label,16,'#e4c481')
text(45,48,'빙하에 갇힌 물의 신전 · 제작 설계 v01',30);text(45,82,'단위 m / 실제 제작 치수 우선 / 석조 본체 + 유지 빙하 + 해빙 봉인 분리',18)
# Front orthographic view; 50 pixels/metre.
text(45,130,'01 정면 · 돌산 거울을 향하는 면',23)
x=350;base=510;S=50
rect(x-180,base-55,360,55)
rect(x-180,base-270,50,215);rect(x+130,base-270,50,215)
rect(x-180,base-290,360,35)
for dx in [-156,-125,125,156]:
    rect(x+dx-17,base-240,34,185)
    for k in [-8,0,8]:line(x+dx+k,base-225,x+dx+k,base-65)
# A 3.35m wide / 4.1m high entrance arch at 1.12m threshold.
w=3.35*S/2;b=base-1.12*S;top=b-4.1*S;spring=top+w
path(f'M{x-w},{b} L{x-w},{spring} A{w},{w} 0 0 1 {x+w},{spring} L{x+w},{b} Z','stone')
path(f'M{x-w+6},{b} L{x-w+6},{spring} Q{x},{top+2} {x+w-6},{spring} L{x+w-6},{b} Z')
path(f'M110,510 L116,382 L145,276 L157,195 L208,168 L248,208 L310,174 L371,170 L432,207 L473,178 L528,217 L553,318 L590,510 L514,510 L496,340 L468,270 L430,230 L376,210 L310,225 L242,235 L206,298 L191,405 L185,510 Z')
for k in range(4):rect(x-60-k*4,base+12+k*10,120+k*8,10)
line(80,176,x,base-150,'dim');s.append(f'<circle cx="{x}" cy="{base-150}" r="9" fill="#f5c967"/>');text(65,162,'거울에서 오는 태양광',15,'#f5c967');text(375,base-150,'수신점 Y=3.0',15)
dim(110,578,590,578,'빙하 폭 9.6');dim(625,510,625,170,'6.8');dim(x-w,base-34,x+w,base-34,'개구 3.35')
text(50,622,'청록: 유지 빙하 · 중앙 봉인만 해빙 · 기단 높이 1.10',16)
# Plan, front at bottom; 45 px/m.
text(815,130,'02 평면 · 접근로와 빛 통로',23)
x=1150;z0=365;S=45
rect(x-162,z0-216,324,216)
path(f'M{x-216},{z0+81} L{x-225},{z0-90} L{x-190},{z0-255} L{x-86},{z0-279} L{x+84},{z0-270} L{x+196},{z0-238} L{x+216},{z0-65} L{x+203},{z0+81} L{x+92},{z0+55} L{x+102},{z0-154} L{x-109},{z0-172} L{x-98},{z0+55} Z')
rect(x-54,z0+10,108,235,'line')
for k in range(4):line(x-54,z0+20+k*16,x+54,z0+20+k*16)
for side in [-1,1]:
    path(f'M{x+side*83},{z0} L{x+side*83},{z0+215}','flow');s.append(f'<circle cx="{x+side*112.5}" cy="{z0-24.75}" r="16" class="stone"/>')
for dx in [-140.4,140.4]:s.append(f'<circle cx="{x+dx}" cy="{z0-33.75}" r="12" class="stone"/>')
line(x,z0+230,x,z0+12,'dim');text(x+63,z0+172,'중앙 접근로',16);text(x+63,z0+196,'폭 2.4 이상',16);text(x-198,z0+221,'양옆 배수로',15)
dim(x-216,665,x+216,665,'빙하 외곽 폭 9.6');text(835,710,'전면 -Z / 후면 +Z · 외곽 깊이 8.0 / 본체 깊이 4.8',16)
# section in Y/Z; 50 px/m.
text(45,760,'03 중앙 단면 · 계단–문턱–봉인',23)
x=260;base=1160;S=50
rect(x,base-55,240,55);rect(x+220,base-270,20,215);rect(x,base-290,240,35)
path(f'M{x-28},{base-56} L{x-28},{base-260} Q{x-10},{base-278} {x+7},{base-258} L{x+7},{base-56} Z')
path(f'M{x-35},{base-270} L{x-25},{base-325} L{x+65},{base-340} L{x+165},{base-324} L{x+257},{base-338} L{x+295},{base-248} L{x+310},{base} L{x+248},{base} L{x+243},{base-270} Z')
for k in range(4):rect(x-132+k*33,base-(k+1)*13.75,33,(k+1)*13.75)
line(60,base-250,x-26,base-150,'dim');s.append(f'<circle cx="{x-26}" cy="{base-150}" r="7" fill="#f5c967"/>')
path(f'M{x-10},{base-56} L{x-45},{base-56} L{x-45},{base-5} L{x-145},{base-5}','flow')
text(48,1210,'4段 × 0.275m → 문턱 1.12m',17);text(48,1239,'정문 얼음 두께 0.7m · 지붕은 빛 통로에서 후퇴',16)
# rear elevation
text(815,760,'04 후면 · 건물을 감싸는 빙하',23)
x=1150;base=1160
rect(x-180,base-290,360,290)
path(f'M{x-240},{base} L{x-225},{base-115} L{x-207},{base-240} L{x-150},{base-306} L{x-82},{base-340} L{x+12},{base-317} L{x+97},{base-337} L{x+194},{base-280} L{x+224},{base-140} L{x+240},{base} Z')
for dx in [-145,-60,70,155]:path(f'M{x+dx},{base-275} l-20,65 l27,52 l-18,65 l20,75','line')
text(824,1210,'후면 빙하 유지 · 큰 덩어리로 연결',17);text(824,1239,'투명 판을 여러 겹 겹치지 않기 / 공중 수정 금지',16)
text(45,1300,'05 해빙 상태 / 전체 빙하를 없애지 않는다',23)
for i,(title,desc) in enumerate([('① 동결','유백색 봉인이 정문을 덮음'),('② 가열','중앙 서리가 투명해짐'),('③ 해빙','물막이 문턱·배수로로 흐름'),('④ 개방','아치 노출 / 외곽 빙하 유지')]):
    xx=45+i*385;rect(xx,1325,360,110,'line');text(xx+16,1360,title,21,'#e4c481');text(xx+16,1396,desc,16)
text(45,1490,'제작 기준: design-spec.json / 미술 형태는 reference.png / 시안 단계이며 Blender·Unity 교체 전',17)
s.append('</svg>')
with open(os.path.join(OUT,'blueprint.svg'),'w',encoding='utf8') as f:f.write('\n'.join(s))
print('Glacier temple blueprint generated')
