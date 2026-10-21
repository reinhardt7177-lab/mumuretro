"""Make web textures from preserved sources; never replace the original maps."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art/engine-transfer/model-data/WaterDeityV03'
OUT = ROOT / 'assets/models/heritage/textures'
OUT.mkdir(parents=True, exist_ok=True)
records = []
for source, target in [('mat0-albedo.jpg', 'water-deity-albedo.jpg'),
                       ('mat0-orm-source.jpg', 'water-deity-orm.jpg'),
                       ('mat0-normal-final.png', 'water-deity-normal.png')]:
    with Image.open(SOURCE / source) as image:
        original = list(image.size)
        image = image.convert('RGB')
        image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
        options = {'quality': 92, 'subsampling': 0} if target.endswith('.jpg') else {}
        image.save(OUT / target, **options)
        records.append({'source': source, 'output': target, 'originalSize': original,
                        'webSize': list(image.size), 'bytes': (OUT / target).stat().st_size})
(OUT / 'preparation.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
print(json.dumps(records))
