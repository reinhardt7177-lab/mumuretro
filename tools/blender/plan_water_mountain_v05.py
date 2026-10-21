import os,json,math
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
ART=os.path.join(ROOT,'art/water-temple-mountain/v05')
with open(os.path.join(ART,'design-spec.json'),encoding='utf-8-sig') as f:spec=json.load(f)
with open(os.path.join(ROOT,'art/engine-transfer/model-data/WaterMountain/water-mountain-v03.json')) as f:a=json.load(f)['anchors']
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1500" viewBox="0 0 1800 1500">','<rect width="1800" height="1500" fill="#122632"/>','<style>text{font-family:Malgun Gothic,sans-serif;fill:#f0e2bb} .grid{stroke:#304651;stroke-width:1} .rock{fill:none;stroke:#c5a575;stroke-width:1.5} .route{fill:none;stroke:#73dcc7;stroke-width:3}</style>', '<text x="48" y="48" font-size="30">태양 절벽 v05 · 360도 제작 설계도</text>','<text x="48" y="80" font-size="17">동일한 단면 좌표로 도면과 Blender 형상 제작 · 단위 m · H 손잡이 / P 보행점 · 금색 암반 / 청록 동선</text>']
views=[('정면 · 남 / -Z',0,1,1,55,130),('후면 · 북 / +Z',0,1,-1,645,130),('우측 · 동 / +X',2,1,1,1235,130),('좌측 · 서 / -X',2,1,-1,55,760),('평면 · 위 / +Y',0,2,1,645,760),('단면·제작 기준',None,None,1,1235,760)]
pts=[(p['x'],p['y'],p['z']) for p in a['holds']+a['walk']]
route=[0,1,2,3,4,5,6,7,10,11,12,13,14,8,9,15]
for title,ax,ay,sign,ox,oy in views:
    svg.append(f'<text x="{ox}" y="{oy}" font-size="24">{title}</text>')
    if ax is None:
        for j,t in enumerate(['정상 11.3m / 거울 중심 13.3m','최대 외곽 약 13.3 × 14.5m','한 덩어리 · 넓은 층판 제거','동쪽: 0.9m 좁은 오르막','서쪽: 세로 침식골','북쪽: 정상까지 이어지는 능선','단면 높이: -1 / 4.7 / 5.65','6.8 / 8.6 / 10.2 / 11.3m','지층 요철 ±0.04m','후면 요철 ±0.4m / 골 0.72m','등반 구역은 변형 제한','근거: design-spec.json']):svg.append(f'<text x="{ox}" y="{oy+55+j*32}" font-size="19">{t}</text>')
        continue
    def project(p):return (ox+245+sign*p[ax]*25,oy+435-p[ay]*25)
    for x in range(0,21):svg.append(f'<line class="grid" x1="{ox+x*25}" y1="{oy+30}" x2="{ox+x*25}" y2="{oy+485}"/>')
    for y in range(0,19):svg.append(f'<line class="grid" x1="{ox}" y1="{oy+30+y*25}" x2="{ox+500}" y2="{oy+30+y*25}"/>')
    for pr in spec['profiles']:
        poly=[project((x,pr['y'],z)) for x,z in pr['outline']]
        svg.append('<polygon class="rock" points="'+' '.join(f'{x:.1f},{y:.1f}' for x,y in poly)+'"/>')
    for k in range(12):
        line=[project((pr['outline'][k][0],pr['y'],pr['outline'][k][1])) for pr in spec['profiles']]
        svg.append('<polyline class="rock" points="'+' '.join(f'{x:.1f},{y:.1f}' for x,y in line)+'"/>')
    svg.append('<polyline class="route" points="'+' '.join('%.1f,%.1f'%project(pts[i]) for i in route)+'"/>')
    for i,p in enumerate(pts):
        x,y=project(p);label='H'+str(i) if i<10 else 'P'+str(i-10)
        svg.append(f'<circle cx="{x}" cy="{y}" r="3" fill="#73dcc7"/><text x="{x+5}" y="{y-5}" font-size="12">{label}</text>')
    x,y=project(spec['mirror_center']);svg.append(f'<circle cx="{x}" cy="{y}" r="9" fill="none" stroke="#f3c86c" stroke-width="3"/>')
    svg.append(f'<text x="{ox}" y="{oy+515}" font-size="15">격자 1m · 반대편 선 포함 · 치수용 정사영</text>')
svg.append('<text x="48" y="1460" font-size="17">v05 / 기존 손잡이·동선 보존 / 원형 3단 층, 공중 길, 열린 뒷면 금지 / 실제 표면은 Blender 회전 렌더에서 검토</text></svg>')
with open(os.path.join(ART,'blueprint.svg'),'w',encoding='utf8') as f:f.write('\n'.join(svg))
print('Blueprint written from seven authoritative profiles')

