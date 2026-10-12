import json
import urllib.request

api_url = 'https://planetarycomputer.microsoft.com/api/stac/v1/search'
bbox = [-43.111413, -22.782143, -42.951745, -22.659755]

def find_best_orbit_for_year(year):
    # Find orbit R095 date in dry season with lowest average clouds across KPQ, KQQ, KPR, KQR
    query = {
        'bbox': bbox,
        'datetime': f'{year}-05-01T00:00:00Z/{year}-09-15T23:59:59Z',
        'collections': ['sentinel-2-l2a'],
        'query': {
            'eo:cloud_cover': {'lt': 10}
        },
        'limit': 100
    }
    req = urllib.request.Request(api_url, data=json.dumps(query).encode('utf-8'), headers={'Content-Type': 'application/json', 'User-Agent': 'ICMBio/1.0'})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    
    # Group by date
    by_date = {}
    for f in data['features']:
        date = f['properties']['datetime'][:10]
        mgrs = f['properties'].get('s2:mgrs_tile', '')
        if not mgrs and len(f['id'].split('_')) > 5:
            mgrs = f['id'].split('_')[5][1:] # e.g. T23KQQ -> 23KQQ
        by_date.setdefault(date, {})[mgrs] = f
        
    print(f"\n--- ANO {year} ---")
    best_date = None
    best_score = 9999
    for d, tiles_dict in by_date.items():
        has_kpq = '23KPQ' in tiles_dict
        has_kqq = '23KQQ' in tiles_dict
        has_kpr = '23KPR' in tiles_dict
        has_kqr = '23KQR' in tiles_dict
        # We need at least KPQ and KQQ (the two core tiles for ESEC Guanabara and APA Guapimirim)
        if has_kpq and has_kqq:
            clouds = [tiles_dict[t]['properties']['eo:cloud_cover'] for t in tiles_dict]
            avg_cloud = sum(clouds) / len(clouds)
            print(f"Data: {d} | Tiles: {list(tiles_dict.keys())} | Média Nuvens: {avg_cloud:.2f}%")
            if avg_cloud < best_score:
                best_score = avg_cloud
                best_date = d
                
    print(f"-> Melhor Data para {year}: {best_date} (Média Nuvens: {best_score:.2f}%)")
    return by_date.get(best_date, {})

for y in [2023, 2024, 2025, 2026]:
    find_best_orbit_for_year(y)
