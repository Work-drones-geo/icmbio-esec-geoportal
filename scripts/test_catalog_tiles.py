import json
import urllib.request

with open('data/sentinel_catalog.json', 'r', encoding='utf-8') as f:
    cat = json.load(f)

for y, data in cat.items():
    date_str = data["date"]
    scenes = data["scenes"]
    print(f"Ano {y} ({date_str}): {len(scenes)} quadrantes")
    for sc in scenes:
        mgrs = sc["mgrs"]
        url_rgb = sc["tile_rgb"].format(z=12, x=1558, y=2313)
        try:
            req = urllib.request.Request(url_rgb, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                print(f"   Quadrante {mgrs} RGB: OK {resp.status}")
        except Exception as e:
            print(f"   Quadrante {mgrs} RGB: {e}")
