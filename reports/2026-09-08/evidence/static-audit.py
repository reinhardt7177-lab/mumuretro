"""Repository inventory and import reachability; no source files are changed."""
import json, re, subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[3]
files = sorted((root/'src').rglob('*.js'))
texts = {p: p.read_text(encoding='utf-8') for p in files}
imports = {}
missing = []
for p, text in texts.items():
    specs = re.findall(r'''(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]''', text)
    local = [(p.parent/s).resolve() for s in specs if s.startswith('.')]
    imports[p] = local
    missing.extend({'file':p.relative_to(root).as_posix(),'import':str(t.relative_to(root))} for t in local if not t.exists())
seen = set()
todo = [root/'src/boot.js']
while todo:
    p = todo.pop()
    if p in seen: continue
    seen.add(p)
    todo.extend(t for t in imports.get(p,[]) if t.exists())
assets = list((root/'assets').rglob('*'))
groups = {}
for p in assets:
    if not p.is_file(): continue
    e = p.suffix
    g = groups.setdefault(e,{'count':0,'bytes':0})
    g['count'] += 1
    g['bytes'] += p.stat().st_size
syntax = []
for p in files:
    r = subprocess.run(['node','--input-type=module','--check'],input=texts[p],encoding='utf-8',capture_output=True)
    if r.returncode: syntax.append({'file':p.relative_to(root).as_posix(),'error':r.stderr})
result = {
  'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
  'jsFiles':len(files),'physicalLines':sum(len(t.splitlines()) for t in texts.values()),
  'reachableFiles':len(seen),'unreachableFiles':[p.relative_to(root).as_posix() for p in files if p not in seen],
  'missingRelativeImports':missing,'syntaxErrors':syntax,'assetsByExtension':groups,
  'largestFiles':sorted([{'file':p.relative_to(root).as_posix(),'lines':len(t.splitlines()),'bytes':p.stat().st_size} for p,t in texts.items()],key=lambda x:-x['lines'])[:12],
  'bgmFiles':[p.name for p in (root/'assets/audio/bgm').glob('*.mp3')],
}
(Path(__file__).parent/'static-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
