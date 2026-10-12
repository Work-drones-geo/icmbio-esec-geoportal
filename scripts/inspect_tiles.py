import json
import urllib.request

bbox = [-43.111413, -22.782143, -42.951745, -22.659755]
api_url = 'https://planetarycomputer.microsoft.com/api/stac/v1/search'

def inspect_month(year, month):
    query = {
        'bbox': bbox,
        'datetime': f'{year}-{month:02d}-01T00:00:00Z/{year}-{month:02d}-28T23:59:59Z',
        'collections': ['sentinel-2-l2a'],
        'limit': 50
    }
    req = urllib.request.Request(api_url, data=json.dumps(query).encode('utf-8'), headers={'Content-Type': 'application/json', 'User-Agent': 'ICMBio/1.0'})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    
    print(f"=== {year}-{month:02d} Total: {len(data['features'])} ===")
    for f in data['features']:
        parts = f['id'].split('_')
        # MGRS tile is typically around index 5 or in properties s2:mgrs_tile
        mgrs = f['properties'].get('s2:mgrs_tile', '')
        date = f['properties']['datetime'][:10]
        clouds = f['properties'].get('eo:cloud_cover', 0)
        geom_bbox = f.get('bbox', [])
        print(f"Date: {date} | MGRS: {mgrs} | Clouds: {clouds:.2f}% | ID: {f['id']}")
        print(f"   Scene BBOX: {geom_bbox}")

inspect_month(2024, 8)
