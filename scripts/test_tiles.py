import json
import urllib.request

# Let's inspect the assets of a Planetary Computer Sentinel-2 item
item_id = "S2B_MSIL2A_20230811T130249_R095_T23KQQ_20240911T210930"
url = f"https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/{item_id}"
req = urllib.request.Request(url, headers={'User-Agent': 'ICMBio-WebGIS/1.0'})
with urllib.request.urlopen(req) as resp:
    item = json.loads(resp.read().decode('utf-8'))
    print("Assets PC:", list(item['assets'].keys()))
    if 'rendered_preview' in item['assets']:
        print("rendered_preview:", item['assets']['rendered_preview']['href'])

# Let's check tilejson endpoint
tilejson_url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/tilejson.json?collection=sentinel-2-l2a&item={item_id}&assets=visual"
try:
    with urllib.request.urlopen(urllib.request.Request(tilejson_url, headers={'User-Agent': 'ICMBio-WebGIS/1.0'})) as resp:
        tj = json.loads(resp.read().decode('utf-8'))
        print("\nTileJSON Visual Tiles URL template:")
        print(tj['tiles'][0])
except Exception as e:
    print("TileJSON error:", e)

# Test NDVI tilejson endpoint
ndvi_tilejson_url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/tilejson.json?collection=sentinel-2-l2a&item={item_id}&expression=(B08-B04)/(B08%2BB04)&rescale=-0.2,0.85&colormap_name=rdylgn"
try:
    with urllib.request.urlopen(urllib.request.Request(ndvi_tilejson_url, headers={'User-Agent': 'ICMBio-WebGIS/1.0'})) as resp:
        tj_ndvi = json.loads(resp.read().decode('utf-8'))
        print("\nTileJSON NDVI Tiles URL template:")
        print(tj_ndvi['tiles'][0])
except Exception as e:
    print("NDVI TileJSON error:", e)
