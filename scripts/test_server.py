import urllib.request
import threading
import time
from http.server import SimpleHTTPRequestHandler, HTTPServer

server = HTTPServer(('127.0.0.1', 8089), SimpleHTTPRequestHandler)
t = threading.Thread(target=server.serve_forever)
t.daemon = True
t.start()

time.sleep(1)

urls_to_test = [
    'http://127.0.0.1:8089/index.html',
    'http://127.0.0.1:8089/css/style.css',
    'http://127.0.0.1:8089/js/app.js',
    'http://127.0.0.1:8089/js/map.js',
    'http://127.0.0.1:8089/js/sentinel.js',
    'http://127.0.0.1:8089/js/occurrences.js',
    'http://127.0.0.1:8089/js/github-sync.js',
    'http://127.0.0.1:8089/js/offline-store.js',
    'http://127.0.0.1:8089/sw.js',
    'http://127.0.0.1:8089/manifest.webmanifest',
    'http://127.0.0.1:8089/data/esec_guanabara.geojson',
    'http://127.0.0.1:8089/data/apa_guapimirim.geojson',
    'http://127.0.0.1:8089/data/sentinel_catalog.json',
    'http://127.0.0.1:8089/data/ocorrencias.geojson',
    'http://127.0.0.1:8089/lib/leaflet/leaflet.js',
    'http://127.0.0.1:8089/assets/logo_workdrones.svg',
    'http://127.0.0.1:8089/assets/icon.svg',
    'http://127.0.0.1:8089/assets/icon-192.png'
]

success = True
for u in urls_to_test:
    try:
        with urllib.request.urlopen(u) as resp:
            data = resp.read()
            name = u.split('/')[-1]
            print(f'OK {resp.status} - {name} ({len(data)} bytes)')
    except Exception as e:
        print(f'FAIL {u}: {e}')
        success = False

server.shutdown()
if success:
    print('\nTODOS OS ASSETS CARREGADOS COM SUCESSO (200 OK)!')
