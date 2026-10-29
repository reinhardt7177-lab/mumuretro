"""Descriptive fixed-ROI image measurements, not an art-quality score."""
import json, math
from pathlib import Path
from PIL import Image

root=Path('art/arrival-coherence/v01/lighting')
boxes={'scene_below_HUD':(70,125,1135,685),'near_stone_left':(500,520,550,555),'near_stone_right':(715,520,755,550),'front_or_side_head':(630,370,651,394),'rear_face':(632,373,650,393),'upper_sky':(775,70,1060,108),'left_tree_crown':(315,125,475,250)}
def sample(image,box):
    values=list(image.crop(box).convert('RGB').getdata())
    lum=sorted(.2126*r+.7152*g+.0722*b for r,g,b in values)
    n=len(values)
    mean=sum(lum)/n
    return {'pixels':n,'meanDisplayLuma255':mean,'standardDeviationDisplayLuma255':math.sqrt(sum((l-mean)**2 for l in lum)/n),'p01DisplayLuma255':lum[int((n-1)*.01)],'p95DisplayLuma255':lum[int((n-1)*.95)],'white250Fraction':sum(min(p)>=250 for p in values)/n,'anyChannel250Fraction':sum(max(p)>=250 for p in values)/n,'dark12Fraction':sum(l<12 for l in lum)/n,'meanRGB':[sum(p[c] for p in values)/n for c in range(3)]}
report={'description':'Fixed screen rectangles contain mixed surfaces. Display-referred numbers; not linear radiance, perceptual quality, exact face segmentation, or student readability. Native PNGs remain unchanged.','rois':boxes,'images':[]}
for phase in ['current-before','candidate-01','candidate-02','candidate-03','candidate-04-leaf']:
    for view in ['front','side','rear']:
        image=Image.open(root/f'{phase}-{view}.png')
        report['images'].append({'phase':phase,'view':view,'size':image.size,'rois':{k:sample(image,b) for k,b in boxes.items() if (k!='rear_face' or view=='rear') and (k!='left_tree_crown' or view=='side')}})
report['fogResponse']=[{'depth':d,'oldExp2':1-math.exp(-(d*.0175)**2),'candidate02Smoothstep':(lambda t:t*t*(3-2*t))(max(0,min(1,(d-12)/88)))} for d in [8,12,18,28,50,75,100]]
(root/'pixel-measurements.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
for row in report['images']:
    if row['view'] in ['side','rear']:
        k='rear_face' if row['view']=='rear' else 'left_tree_crown'
        a=row['rois'][k];print(row['phase'],row['view'],k,'luma',round(a['meanDisplayLuma255'],2),'dark12',round(a['dark12Fraction'],4),'stone95',round(row['rois']['near_stone_left']['p95DisplayLuma255'],2),'stone250',row['rois']['near_stone_left']['anyChannel250Fraction'])
