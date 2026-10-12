import json
import urllib.request
import urllib.parse

api_url = 'https://planetarycomputer.microsoft.com/api/stac/v1/search'
bbox = [-43.111413, -22.782143, -42.951745, -22.659755]

optimal_dates = {
    "2023": "2023-08-11",
    "2024": "2024-08-15",
    "2025": "2025-06-16",
    "2026": "2026-07-21"
}

catalog = {}

for year, target_date in optimal_dates.items():
    query = {
        'bbox': bbox,
        'datetime': f"{target_date}T00:00:00Z/{target_date}T23:59:59Z",
        'collections': ['sentinel-2-l2a'],
        'limit': 50
    }
    
    req = urllib.request.Request(
        api_url,
        data=json.dumps(query).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'User-Agent': 'ICMBio/1.0'}
    )
    
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        
    features = data.get('features', [])
    
    # Deduplicate by MGRS tile (keep lowest cloud cover)
    mgrs_best = {}
    for f in features:
        item_id = f['id']
        mgrs = f['properties'].get('s2:mgrs_tile', '')
        if not mgrs and len(item_id.split('_')) > 5:
            mgrs = item_id.split('_')[5][1:]
        clouds = round(f['properties'].get('eo:cloud_cover', 0), 2)
        if mgrs not in mgrs_best or clouds < mgrs_best[mgrs]['clouds']:
            mgrs_best[mgrs] = {
                'feature': f,
                'clouds': clouds,
                'item_id': item_id
            }

    scenes_list = []
    total_clouds = 0
    sat_name = 'Sentinel-2'

    for mgrs, info in sorted(mgrs_best.items()):
        f = info['feature']
        item_id = info['item_id']
        clouds = info['clouds']
        total_clouds += clouds
        sat_name = f['properties'].get('platform', 'Sentinel-2')

        rgb_params = urllib.parse.urlencode({
            'collection': 'sentinel-2-l2a',
            'item': item_id,
            'assets': 'visual'
        })
        tile_rgb = f"https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}@1x?{rgb_params}"

        ndvi_params = urllib.parse.urlencode([
            ('collection', 'sentinel-2-l2a'),
            ('item', item_id),
            ('assets', 'B08'),
            ('assets', 'B04'),
            ('expression', '(B08_b1-B04_b1)/(B08_b1+B04_b1)'),
            ('rescale', '-0.1,0.85'),
            ('colormap_name', 'rdylgn')
        ])
        tile_ndvi = f"https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}@1x?{ndvi_params}"

        scenes_list.append({
            'item_id': item_id,
            'mgrs': mgrs,
            'clouds': clouds,
            'tile_rgb': tile_rgb,
            'tile_ndvi': tile_ndvi,
            'bounds': f.get('bbox')
        })
        print(f"[{year}] Tile {mgrs}: Nuvens={clouds}% | ID={item_id}")

    avg_clouds = round(total_clouds / len(scenes_list), 2) if scenes_list else 0

    catalog[str(year)] = {
        'year': int(year),
        'date': target_date,
        'cloud_cover': avg_clouds,
        'satellite': f"Sentinel-2 ({sat_name.upper()})",
        'periodo': 'Estiagem (Inverno)',
        'scenes': scenes_list
    }

with open('data/sentinel_catalog.json', 'w', encoding='utf-8') as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

print("Catalogo oficial deduplicado com 4 quadrantes salvo em data/sentinel_catalog.json!")
