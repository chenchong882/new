#!/bin/zsh
# 雙擊後啟動本機預覽；按 Control-C 停止。
preview_project_dir="${0:A:h}"
python3 - "$preview_project_dir" <<'PY'
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import sys
import webbrowser

class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

handler = partial(PreviewHandler, directory=sys.argv[1])
with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
    url = f'http://127.0.0.1:{server.server_port}/admin.html'
    print('\n本機預覽已啟動：' + url, flush=True)
    print('請保持此視窗開啟；按 Control-C 停止。\n', flush=True)
    webbrowser.open_new_tab(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n本機預覽已停止。')
PY
