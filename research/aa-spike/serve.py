#!/usr/bin/env python3
"""Serves ONLY the dApp test pages over HTTPS on https://127.0.0.1:8443 (Harbour injects window.ethereum on https pages only).
Nothing else in this folder (e.g. .state/) is reachable. A self-signed cert for 127.0.0.1 is made once in .state/ (gitignored).
    python3 serve.py        then open https://127.0.0.1:8443/dapp-full.html and accept the certificate warning once."""
import http.server, os, ssl, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = {'/dapp-full.html': 'text/html', '/dapp-test.html': 'text/html', '/dapp-full.lib.js': 'text/javascript'}
CERT, KEY = os.path.join(HERE, '.state', 'tls-cert.pem'), os.path.join(HERE, '.state', 'tls-key.pem')

def make_cert():
    os.makedirs(os.path.dirname(CERT), exist_ok=True)
    cfg = "[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=127.0.0.1\n[ext]\nsubjectAltName=IP:127.0.0.1,DNS:localhost\n"
    with tempfile.NamedTemporaryFile('w', suffix='.cnf', delete=False) as f: f.write(cfg)
    subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '365', '-keyout', KEY, '-out', CERT, '-config', f.name], check=True, capture_output=True)
    os.unlink(f.name); os.chmod(KEY, 0o600)

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/': path = '/dapp-full.html'
        if path not in FILES:
            self.send_response(404); self.end_headers(); return
        with open(os.path.join(HERE, path.lstrip('/')), 'rb') as f: body = f.read()
        self.send_response(200); self.send_header('Content-Type', FILES[path] + '; charset=utf-8')
        self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, fmt, *a): pass

if not (os.path.exists(CERT) and os.path.exists(KEY)): make_cert()
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8443), Handler)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(CERT, KEY); srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
print('Open https://127.0.0.1:8443/dapp-full.html  (accept the certificate warning once; Ctrl+C to stop)')
srv.serve_forever()
