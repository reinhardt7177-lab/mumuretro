#!/usr/bin/env python3
# 캐시 비활성 정적 서버 — ES 모듈 수정이 새로고침 시 즉시 반영되도록 no-store 헤더 부여.
import http.server, sys, os, functools

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # tools/.. = 프로젝트 루트


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # HTTP/1.1 + keep-alive. ES 모듈 수십 개를 병렬로 받으므로 필수.
    protocol_version = 'HTTP/1.1'

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *a):
        # 404만 로그 — GLB 수십 개 요청으로 로그가 묻히는 것 방지.
        if a and str(a[1]) != '200':
            super().log_message(fmt, *a)


# ThreadingHTTPServer 필수 — 단일 스레드 서버는 브라우저의 병렬 모듈/GLB 요청에서 블로킹된다.
http.server.ThreadingHTTPServer.allow_reuse_address = True
handler = functools.partial(NoCacheHandler, directory=ROOT)
with http.server.ThreadingHTTPServer(("", PORT), handler) as httpd:
    print(f"no-cache 정적 서버 :{PORT}  root={ROOT}", flush=True)
    httpd.serve_forever()
