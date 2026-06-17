#!/usr/bin/env python3
# Meshy text-to-3D 배치 생성기 — 힐링 존 히어로 오브젝트 GLB.
# 키는 환경변수 MESHY_API_KEY로만. 저장소/클라이언트에 키 미포함.
# 복원력: 프롭 단위 순차 처리(미리보기→다운로드(잠정)→리파인→덮어쓰기), 이미 있으면 스킵 → 재실행 시 이어서.
import os, sys, json, time, urllib.request, urllib.error

KEY = os.environ.get("MESHY_API_KEY")
if not KEY:
    print("ERROR: MESHY_API_KEY 환경변수가 없습니다."); sys.exit(1)

BASE = "https://api.meshy.ai/openapi/v2/text-to-3d"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "assets", "env"))
os.makedirs(OUT, exist_ok=True)

STYLE = ", low poly, stylized cartoon game asset, flat clean colors, simple shapes, single isolated object, solid color background"
NEG = "photorealistic, realistic, busy textures, text, multiple objects, cluttered, high poly noise"

PROPS = [
    ("palm_tree",    "a cute palm tree with a gently curved trunk and drooping green fronds and a couple of coconuts"),
    ("beach_parasol","a colorful striped beach umbrella parasol on a pole"),
    ("rowboat",      "a small simple wooden rowboat with two seats and oars"),
    ("stone_lantern","a Korean stone garden lantern (seokdeung) with a glowing light box and a pyramid cap"),
    ("big_tree",     "a lush round broadleaf tree with a thick trunk"),
    ("mushroom_cluster","a small cluster of cute mushrooms with red caps and white spots"),
    ("beach_rock",   "a smooth rounded gray rock boulder cluster"),
    ("flower_bush",  "a small leafy bush dotted with little colorful flowers"),
    ("wooden_dock",  "a short small wooden pier dock with plank deck and support posts"),
    ("picnic_table", "a simple wooden picnic table with attached bench seats"),
]


def req(method, url, body=None, tries=4):
    for k in range(tries):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(url, data=data, method=method)
        r.add_header("Authorization", "Bearer " + KEY)
        if body is not None:
            r.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(r, timeout=60) as resp:
                return resp.status, json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            try: return e.code, json.loads(e.read().decode())
            except Exception: return e.code, {"error": "http " + str(e.code)}
        except Exception as e:
            if k == tries - 1:
                return 0, {"error": str(e)}
            time.sleep(3)


def poll_one(tid, label, timeout=900):
    t0 = time.time()
    while time.time() - t0 < timeout:
        t = req("GET", BASE + "/" + tid)[1]
        st = t.get("status")
        if st == "SUCCEEDED":
            print(f"[{label}] OK {tid[:8]}", flush=True); return t
        if st in ("FAILED", "EXPIRED", "CANCELED"):
            print(f"[{label}] FAIL {tid[:8]}: {t.get('task_error')}", flush=True); return None
        time.sleep(8)
    print(f"[{label}] TIMEOUT {tid[:8]}", flush=True); return None


def download(url, path):
    for k in range(3):
        try:
            urllib.request.urlretrieve(url, path); return os.path.getsize(path)
        except Exception as e:
            if k == 2: print("  download err:", e, flush=True); return 0
            time.sleep(3)


def process(name, prompt):
    path = os.path.join(OUT, name + ".glb")
    if os.path.exists(path) and os.path.getsize(path) > 5000:
        print(f"[skip] {name} (이미 존재)", flush=True); return True

    s, j = req("POST", BASE, {"mode": "preview", "prompt": prompt + STYLE, "negative_prompt": NEG,
                              "art_style": "realistic", "should_remesh": True, "target_polycount": 10000})
    rid = j.get("result") if isinstance(j, dict) else None
    print(f"[preview submit] {name} -> {rid} (http {s})", flush=True)
    if not rid:
        print("  ", j, flush=True); return False
    t = poll_one(rid, "preview")
    if not t:
        return False
    glb = (t.get("model_urls") or {}).get("glb")
    if glb:
        kb = download(glb, path) // 1024
        print(f"[provisional] {name}.glb {kb} KB", flush=True)

    s2, j2 = req("POST", BASE, {"mode": "refine", "preview_task_id": rid})
    rrid = j2.get("result") if isinstance(j2, dict) else None
    print(f"[refine submit] {name} -> {rrid} (http {s2})", flush=True)
    if rrid:
        rt = poll_one(rrid, "refine")
        if rt:
            rglb = (rt.get("model_urls") or {}).get("glb")
            if rglb:
                kb = download(rglb, path) // 1024
                print(f"[SAVED] {name}.glb {kb} KB (textured)", flush=True)
    return os.path.exists(path) and os.path.getsize(path) > 5000


def main():
    ok = 0
    for name, prompt in PROPS:
        try:
            if process(name, prompt): ok += 1
        except Exception as e:
            print(f"[error] {name}: {e}", flush=True)
    print(f"=== 완료: {ok}/{len(PROPS)} ===", flush=True)


if __name__ == "__main__":
    main()
