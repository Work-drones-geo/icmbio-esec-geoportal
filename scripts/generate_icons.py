import os
import struct
import zlib

def create_png(width, height, color_bg=(19, 42, 19), color_fg=(82, 183, 136), filepath='icon.png'):
    # Pure Python PNG generator with a stylized drone/cross emblem
    raw_rows = []
    cx, cy = width // 2, height // 2
    r_outer = int(width * 0.40)
    r_inner = int(width * 0.32)
    drone_arm = int(width * 0.16)
    
    for y in range(height):
        row = [0] # filter type 0
        for x in range(width):
            dx = x - cx
            dy = y - cy
            dist2 = dx * dx + dy * dy
            
            # Check if within outer ring
            is_ring = (r_inner * r_inner <= dist2 <= r_outer * r_outer)
            # Center circle
            is_center = dist2 <= (int(width * 0.08) ** 2)
            # Drone cross arms (45 deg or orthogonal)
            is_arm = (abs(dx - dy) < width * 0.035 or abs(dx + dy) < width * 0.035) and (dist2 <= (r_outer * r_outer))
            # Propeller circles
            prop_dist1 = (dx - drone_arm) ** 2 + (dy - drone_arm) ** 2
            prop_dist2 = (dx + drone_arm) ** 2 + (dy - drone_arm) ** 2
            prop_dist3 = (dx - drone_arm) ** 2 + (dy + drone_arm) ** 2
            prop_dist4 = (dx + drone_arm) ** 2 + (dy + drone_arm) ** 2
            prop_rad2 = int(width * 0.065) ** 2
            is_prop = (prop_dist1 <= prop_rad2 or prop_dist2 <= prop_rad2 or prop_dist3 <= prop_rad2 or prop_dist4 <= prop_rad2)
            
            if is_center or is_prop or is_arm or is_ring:
                row.extend(color_fg)
            else:
                row.extend(color_bg)
        raw_rows.append(bytes(row))
        
    raw_data = b''.join(raw_rows)
    compressed = zlib.compress(raw_data, 9)
    
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(data)) + c + crc
        
    png_data = b'\x89PNG\r\n\x1a\n'
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    png_data += chunk(b'IHDR', ihdr_data)
    # IDAT
    png_data += chunk(b'IDAT', compressed)
    # IEND
    png_data += chunk(b'IEND', b'')
    
    with open(filepath, 'wb') as f:
        f.write(png_data)

os.makedirs('assets', exist_ok=True)
create_png(192, 192, (19, 42, 19), (82, 183, 136), 'assets/icon-192.png')
create_png(512, 512, (19, 42, 19), (82, 183, 136), 'assets/icon-512.png')
print("Ícones PNG 192x192 e 512x512 criados com sucesso.")

# Create rich SVG logo
svg_logo = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" width="100%" height="100%">
  <defs>
    <linearGradient id="gradBrand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#52B788" />
      <stop offset="100%" stop-color="#74C69D" />
    </linearGradient>
    <linearGradient id="gradDark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1B4332" />
      <stop offset="100%" stop-color="#081C15" />
    </linearGradient>
  </defs>
  <!-- Background Badge -->
  <rect x="5" y="10" width="80" height="80" rx="16" fill="url(#gradDark)" stroke="#52B788" stroke-width="2"/>
  
  <!-- Stylized Drone + Geo Icon -->
  <circle cx="45" cy="50" r="10" fill="#52B788"/>
  <circle cx="45" cy="50" r="4" fill="#081C15"/>
  <!-- Drone Arms -->
  <line x1="25" y1="30" x2="65" y2="70" stroke="#74C69D" stroke-width="3" stroke-linecap="round"/>
  <line x1="65" y1="30" x2="25" y2="70" stroke="#74C69D" stroke-width="3" stroke-linecap="round"/>
  <!-- Rotors -->
  <circle cx="25" cy="30" r="7" fill="none" stroke="#52B788" stroke-width="2.5"/>
  <circle cx="65" cy="30" r="7" fill="none" stroke="#52B788" stroke-width="2.5"/>
  <circle cx="25" cy="70" r="7" fill="none" stroke="#52B788" stroke-width="2.5"/>
  <circle cx="65" cy="70" r="7" fill="none" stroke="#52B788" stroke-width="2.5"/>
  <!-- Geo Coordinates Arc -->
  <path d="M 18 50 A 27 27 0 0 1 72 50" fill="none" stroke="#D8F3DC" stroke-width="1.5" stroke-dasharray="2,3"/>

  <!-- Brand Typography -->
  <text x="100" y="44" font-family="'Inter', 'Segoe UI', system-ui, sans-serif" font-size="24" font-weight="900" fill="#FFFFFF" letter-spacing="0.5">WORK DRONES</text>
  <text x="282" y="44" font-family="'Inter', 'Segoe UI', system-ui, sans-serif" font-size="24" font-weight="900" fill="#52B788" letter-spacing="1">GEO</text>
  <text x="100" y="68" font-family="'Inter', 'Segoe UI', system-ui, sans-serif" font-size="11.5" font-weight="600" fill="#B7E4C7" letter-spacing="2">ICMBIO • ESEC GUANABARA &amp; APA GUAPIMIRIM</text>
</svg>'''

with open('assets/logo_workdrones.svg', 'w', encoding='utf-8') as f:
    f.write(svg_logo)

# SVG Icon standalone
svg_icon = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <rect width="100" height="100" rx="22" fill="#132A13"/>
  <circle cx="50" cy="50" r="12" fill="#52B788"/>
  <circle cx="50" cy="50" r="5" fill="#132A13"/>
  <line x1="28" y1="28" x2="72" y2="72" stroke="#74C69D" stroke-width="4" stroke-linecap="round"/>
  <line x1="72" y1="28" x2="28" y2="72" stroke="#74C69D" stroke-width="4" stroke-linecap="round"/>
  <circle cx="28" cy="28" r="8" fill="none" stroke="#52B788" stroke-width="3"/>
  <circle cx="72" cy="28" r="8" fill="none" stroke="#52B788" stroke-width="3"/>
  <circle cx="28" cy="72" r="8" fill="none" stroke="#52B788" stroke-width="3"/>
  <circle cx="72" cy="72" r="8" fill="none" stroke="#52B788" stroke-width="3"/>
  <circle cx="50" cy="50" r="38" fill="none" stroke="#52B788" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6"/>
</svg>'''

with open('assets/icon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_icon)

print("SVGs gerados em assets/")
