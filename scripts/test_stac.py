import json
import urllib.request
import urllib.parse

bbox = [-43.111413, -22.782143, -42.951745, -22.659755]

def search_stac(api_url, collection_id, start_date, end_date):
    query = {
        "bbox": bbox,
        "datetime": f"{start_date}/{end_date}",
        "collections": [collection_id],
        "query": {
            "eo:cloud_cover": {"lt": 15}
        },
        "limit": 10,
        "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}]
    }
    
    req = urllib.request.Request(
        f"{api_url}/search",
        data=json.dumps(query).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'User-Agent': 'ICMBio-WebGIS/1.0'}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('features', [])
    except Exception as e:
        print(f"Error querying {api_url}: {e}")
        return []

# Test Earth Search (Element 84 AWS Sentinel-2-l2a)
print("--- Testando Earth Search AWS ---")
features = search_stac("https://earth-search.aws.element84.com/v1", "sentinel-2-l2a", "2023-05-01T00:00:00Z", "2023-08-31T23:59:59Z")
print(f"Encontradas {len(features)} cenas em 2023")
if features:
    first = features[0]
    print(f"ID: {first['id']}, Data: {first['properties'].get('datetime')}, Nuvens: {first['properties'].get('eo:cloud_cover')}%")
    print(f"Assets disponíveis: {list(first.get('assets', {}).keys())[:10]}")

# Test Planetary Computer
print("\n--- Testando Planetary Computer ---")
pc_features = search_stac("https://planetarycomputer.microsoft.com/api/stac/v1", "sentinel-2-l2a", "2023-05-01T00:00:00Z", "2023-08-31T23:59:59Z")
print(f"Encontradas {len(pc_features)} cenas no Planetary Computer em 2023")
if pc_features:
    first_pc = pc_features[0]
    print(f"ID: {first_pc['id']}, Data: {first_pc['properties'].get('datetime')}, Nuvens: {first_pc['properties'].get('eo:cloud_cover')}%")
    print(f"Assets disponíveis: {list(first_pc.get('assets', {}).keys())[:10]}")
