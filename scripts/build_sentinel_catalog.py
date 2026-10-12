import json
import urllib.request
import urllib.parse

bbox = [-43.111413, -22.782143, -42.951745, -22.659755]

def get_best_scene(year):
    api_url = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
    query = {
        "bbox": bbox,
        "datetime": f"{year}-05-01T00:00:00Z/{year}-08-31T23:59:59Z",
        "collections": ["sentinel-2-l2a"],
        "query": {
            "eo:cloud_cover": {"lt": 15}
        },
        "limit": 10,
        "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}]
    }
    
    req = urllib.request.Request(
        api_url,
        data=json.dumps(query).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'User-Agent': 'ICMBio-WebGIS/1.0'}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        return data.get('features', [])

catalog = {}
for y in [2023, 2024, 2025, 2026]:
    scenes = get_best_scene(y)
    if scenes:
        item = scenes[0]
        item_id = item['id']
        date_str = item['properties']['datetime'][:10]
        clouds = round(item['properties']['eo:cloud_cover'], 2)
        
        # Build URL template for RGB (visual)
        rgb_params = urllib.parse.urlencode({
            'collection': 'sentinel-2-l2a',
            'item': item_id,
            'assets': 'visual'
        })
        tile_rgb = f"https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}@1x?{rgb_params}"
        
        # Build URL template for NDVI
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

        catalog[str(y)] = {
            "year": y,
            "scene_id": item_id,
            "date": date_str,
            "cloud_cover": clouds,
            "satellite": "Sentinel-2 L2A",
            "tile_rgb": tile_rgb,
            "tile_ndvi": tile_ndvi,
            "bounds": item.get('bbox')
        }
        print(f"[{y}] Scene: {item_id} | Data: {date_str} | Nuvens: {clouds}%")

with open('data/sentinel_catalog.json', 'w', encoding='utf-8') as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

print("Catalogo oficial salvo com sucesso em data/sentinel_catalog.json")
