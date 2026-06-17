#!/usr/bin/env python3
# 캐시 비활성 정적 서버 — ES 모듈 수정이 새로고침 시 즉시 반영되도록 no-store 헤더 부여.
import http.server, socketserver, sys, os, functools

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # tools/.. = 프로젝트 루트


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
handler = functools.partial(NoCacheHandler, directory=ROOT)
with socketserver.TCPServer(("", PORT), handler) as httpd:
    print(f"no-cache 정적 서버 :{PORT}  root={ROOT}", flush=True)
    httpd.serve_forever()
