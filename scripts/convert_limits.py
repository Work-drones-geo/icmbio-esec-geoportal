import os
import re
import json
import zipfile
import xml.etree.ElementTree as ET

def clean_kml_xml(xml_content):
    # Remove XML declaration if duplicated
    xml_content = re.sub(r'<\?xml[^>]*\?>', '', xml_content)
    # Remove all namespaces definitions
    xml_content = re.sub(r'\s+xmlns(?::\w+)?="[^"]*"', '', xml_content)
    # Strip namespace prefixes from tags like <atom:link> -> <link>, </gx:coord> -> </coord>
    xml_content = re.sub(r'<(/)?[\w-]+:([\w-]+)', r'<\1\2', xml_content)
    # Wrap in single root if needed
    return f'<?xml version="1.0" encoding="utf-8"?>\n<kml>{xml_content}</kml>'

def parse_kml(xml_str, default_name):
    # Quick regex extraction of coordinates in Polygon LinearRing if ET fails or as primary
    features = []
    
    # We can also parse placemarks directly
    placemark_blocks = re.findall(r'<Placemark\b[^>]*>(.*?)</Placemark>', xml_str, flags=re.DOTALL)
    for pm in placemark_blocks:
        name_m = re.search(r'<name>(.*?)</name>', pm)
        pm_name = name_m.group(1).strip() if name_m else default_name
        
        # Look for polygon coordinates
        outer_match = re.search(r'<outerBoundaryIs>.*?<coordinates>(.*?)</coordinates>.*?</outerBoundaryIs>', pm, flags=re.DOTALL)
        if outer_match:
            raw_coords = outer_match.group(1).strip()
            outer_ring = []
            for token in raw_coords.split():
                parts = [p.strip() for p in token.split(',') if p.strip()]
                if len(parts) >= 2:
                    try:
                        outer_ring.append([float(parts[0]), float(parts[1])])
                    except ValueError:
                        continue
            
            inner_rings = []
            inner_matches = re.findall(r'<innerBoundaryIs>.*?<coordinates>(.*?)</coordinates>.*?</innerBoundaryIs>', pm, flags=re.DOTALL)
            for inn in inner_matches:
                inner_ring = []
                for token in inn.strip().split():
                    parts = [p.strip() for p in token.split(',') if p.strip()]
                    if len(parts) >= 2:
                        try:
                            inner_ring.append([float(parts[0]), float(parts[1])])
                        except ValueError:
                            continue
                if inner_ring:
                    inner_rings.append(inner_ring)

            if outer_ring:
                features.append({
                    "type": "Feature",
                    "properties": {
                        "nome": pm_name,
                        "unidade": default_name
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [outer_ring] + inner_rings
                    }
                })

    # If no outerBoundaryIs was found, check for plain Polygon/coordinates
    if not features:
        coord_blocks = re.findall(r'<coordinates>(.*?)</coordinates>', xml_str, flags=re.DOTALL)
        for cb in coord_blocks:
            pts = []
            for token in cb.strip().split():
                parts = [p.strip() for p in token.split(',') if p.strip()]
                if len(parts) >= 2:
                    try:
                        pts.append([float(parts[0]), float(parts[1])])
                    except ValueError:
                        continue
            if len(pts) >= 3:
                features.append({
                    "type": "Feature",
                    "properties": {
                        "nome": default_name,
                        "unidade": default_name
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [pts]
                    }
                })

    return {
        "type": "FeatureCollection",
        "name": default_name,
        "features": features
    }

def main():
    os.makedirs('data', exist_ok=True)
    
    # 1. ESEC Guanabara
    with open('LIMITE_esec_guanabara.kml', 'r', encoding='utf-8', errors='ignore') as f:
        esec_fc = parse_kml(f.read(), 'Estação Ecológica da Guanabara')
    
    with open('data/esec_guanabara.geojson', 'w', encoding='utf-8') as f:
        json.dump(esec_fc, f, ensure_ascii=False, indent=2)
    print(f"ESEC Guanabara convertida com sucesso: {len(esec_fc['features'])} feição(ões).")
    
    # 2. APA Guapimirim
    with zipfile.ZipFile('LIMITE_apa_guapi_mirim_kml.kmz', 'r') as z:
        with z.open('doc.kml') as f:
            kml_text = f.read().decode('utf-8', errors='ignore')
            apa_fc = parse_kml(kml_text, 'Área de Proteção Ambiental de Guapimirim')
            
    with open('data/apa_guapimirim.geojson', 'w', encoding='utf-8') as f:
        json.dump(apa_fc, f, ensure_ascii=False, indent=2)
    print(f"APA Guapimirim convertida com sucesso: {len(apa_fc['features'])} feição(ões).")

    # 3. Calcular Bounding Box conjunta
    all_points = []
    for fc in [esec_fc, apa_fc]:
        for feat in fc['features']:
            for ring in feat['geometry']['coordinates']:
                all_points.extend(ring)

    if all_points:
        min_lon = min(p[0] for p in all_points)
        min_lat = min(p[1] for p in all_points)
        max_lon = max(p[0] for p in all_points)
        max_lat = max(p[1] for p in all_points)
        center_lat = (min_lat + max_lat) / 2
        center_lon = (min_lon + max_lon) / 2
        print(f"Bounding Box Total: [{min_lon:.6f}, {min_lat:.6f}, {max_lon:.6f}, {max_lat:.6f}]")
        print(f"Centro do Mapa: [{center_lat:.6f}, {center_lon:.6f}]")
        
        # Save a metadata file
        meta = {
            "bbox": [min_lon, min_lat, max_lon, max_lat],
            "center": [center_lat, center_lon],
            "esec_num_features": len(esec_fc['features']),
            "apa_num_features": len(apa_fc['features'])
        }
        with open('data/meta_ucs.json', 'w', encoding='utf-8') as f:
            json.dump(meta, f, indent=2)

if __name__ == '__main__':
    main()
