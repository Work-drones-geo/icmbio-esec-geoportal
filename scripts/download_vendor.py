import os
import urllib.request

os.makedirs('lib/leaflet/images', exist_ok=True)

files = {
    'lib/leaflet/leaflet.js': 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'lib/leaflet/leaflet.css': 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'lib/leaflet/images/marker-icon.png': 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    'lib/leaflet/images/marker-icon-2x.png': 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    'lib/leaflet/images/marker-shadow.png': 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    'lib/leaflet/images/layers.png': 'https://unpkg.com/leaflet@1.9.4/dist/images/layers.png',
    'lib/leaflet/images/layers-2x.png': 'https://unpkg.com/leaflet@1.9.4/dist/images/layers-2x.png'
}

for path, url in files.items():
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        print(f"Baixando {path}...")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as resp, open(path, 'wb') as f:
                f.write(resp.read())
        except Exception as e:
            print(f"Falha ao baixar {url}: {e}")

print("Leaflet assets baixados com sucesso!")
