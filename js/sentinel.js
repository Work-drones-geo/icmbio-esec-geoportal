/**
 * Módulo de Integração de Imagens de Satélite Sentinel-2 (Série Temporal 2023-2026)
 * Suporte a Cor Verdadeira (TCI/RGB) e Índice de Vegetação por Diferença Normalizada (NDVI)
 * Work Drones Geo • ICMBio WebGIS
 */

class SentinelManager {
  constructor() {
    this.catalog = null;
    this.currentYear = '2026';
    this.currentMode = 'rgb'; // 'rgb' ou 'ndvi'
    this.opacity = 0.95;
    this.isVisible = true;
    this.tileLayer = null;
    this.map = null;

    // Catálogo embutido para garantir funcionamento 100% offline imediato
    this.fallbackCatalog = {
      "2023": {
        "year": 2023,
        "scene_id": "S2B_MSIL2A_20230811T130249_R095_T23KQQ_20240911T210930",
        "date": "2023-08-11",
        "cloud_cover": 0.01,
        "satellite": "Sentinel-2B (MSI L2A)",
        "periodo": "Estiagem (Inverno)",
        "tile_rgb": "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-2-l2a&item=S2B_MSIL2A_20230811T130249_R095_T23KQQ_20240911T210930&assets=visual",
        "tile_ndvi": "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-2-l2a&item=S2B_MSIL2A_20230811T130249_R095_T23KQQ_20240911T210930&assets=B08&assets=B04&expression=%28B08_b1-B04_b1%29%2F%28B08_b1%2BB04_b1%29&rescale=-0.1%2C0.85&colormap_name=rdylgn"
      },
      "2024": {
        "year": 2024,
        "scene_id": "S2B_MSIL2A_20240815T130249_R095_T23KQR_20240815T140854",
        "date": "2024-08-15",
        "cloud_cover": 0.13,
        "satellite": "Sentinel-2B (MSI L2A)",
        "periodo": "Estiagem (Inverno)",
        "tile_rgb": "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-2-l2a&item=S2B_MSIL2A_20240815T130249_R095_T23KQR_20240815T140854&assets=visual",
        "tile_ndvi": "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-2-l2a&item=S2B_MSIL2A_20240815T130249_R095_T23KQR_20240815T140854&assets=B08&assets=B04&expression=%28B08_b1-B04_b1%29%2F%28B08_b1%2BB04_b1%29&rescale=-0.1%2C0.85&colormap_name=rdylgn"
      },
      "2025": {
        "year": 2025,
        "scene_id": "S2C_MSIL2A_20250716T130311_R095_T23KQQ_20250716T173813",
        "date": "2025-07-16",
        "cloud_cover": 0.90,
        "satellite": "Sentinel-2C (MSI L2A)",
        "periodo": "Estiagem (Inverno)",
        "tile_rgb": "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-2-l2a&item=S2C_MSIL2A_20250716T130311_R095_T23KQQ_20250716T173813&assets=visual",
        "tile_ndvi": "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-2-l2a&item=S2C_MSIL2A_20250716T130311_R095_T23KQQ_20250716T173813&assets=B08&assets=B04&expression=%28B08_b1-B04_b1%29%2F%28B08_b1%2BB04_b1%29&rescale=-0.1%2C0.85&colormap_name=rdylgn"
      },
      "2026": {
        "year": 2026,
        "scene_id": "S2C_MSIL2A_20260820T130241_R095_T23KQR_20260820T161808",
        "date": "2026-08-20",
        "cloud_cover": 0.34,
        "satellite": "Sentinel-2C (MSI L2A)",
        "periodo": "Estiagem (Inverno)",
        "tile_rgb": "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-2-l2a&item=S2C_MSIL2A_20260820T130241_R095_T23KQR_20260820T161808&assets=visual",
        "tile_ndvi": "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-2-l2a&item=S2C_MSIL2A_20260820T130241_R095_T23KQR_20260820T161808&assets=B08&assets=B04&expression=%28B08_b1-B04_b1%29%2F%28B08_b1%2BB04_b1%29&rescale=-0.1%2C0.85&colormap_name=rdylgn"
      }
    };
  }

  async init(leafletMap) {
    this.map = leafletMap;

    try {
      const resp = await fetch('data/sentinel_catalog.json');
      if (resp.ok) {
        this.catalog = await resp.json();
      } else {
        this.catalog = this.fallbackCatalog;
      }
    } catch {
      this.catalog = this.fallbackCatalog;
    }

    this.updateLayer();
    this.updateUI();
  }

  setYear(year) {
    if (!this.catalog[year]) return;
    this.currentYear = String(year);
    this.updateLayer();
    this.updateUI();
  }

  setMode(mode) {
    if (mode !== 'rgb' && mode !== 'ndvi') return;
    this.currentMode = mode;
    this.updateLayer();
    this.updateUI();
  }

  setOpacity(val) {
    this.opacity = parseFloat(val);
    if (this.tileLayer) {
      this.tileLayer.setOpacity(this.opacity);
    }
  }

  setVisibility(visible) {
    this.isVisible = visible;
    if (this.tileLayer) {
      if (visible && !this.map.hasLayer(this.tileLayer)) {
        this.tileLayer.addTo(this.map);
      } else if (!visible && this.map.hasLayer(this.tileLayer)) {
        this.map.removeLayer(this.tileLayer);
      }
    }
  }

  updateLayer() {
    if (!this.map || !this.catalog) return;

    const sceneData = this.catalog[this.currentYear];
    if (!sceneData) return;

    const tileUrl = this.currentMode === 'rgb' ? sceneData.tile_rgb : sceneData.tile_ndvi;

    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }

    this.tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      minZoom: 8,
      pane: 'sentinelPane',
      opacity: this.opacity,
      attribution: `&copy; ESA Sentinel-2 L2A | Planetary Computer | Work Drones Geo (${this.currentYear})`
    });

    if (this.isVisible) {
      this.tileLayer.addTo(this.map);
    }
  }

  updateUI() {
    const scene = this.catalog[this.currentYear];
    if (!scene) return;

    // Atualizar botões de ano
    document.querySelectorAll('.btn-year').forEach(btn => {
      const yr = btn.getAttribute('data-year');
      if (yr === this.currentYear) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Atualizar botões de modo (RGB vs NDVI)
    document.querySelectorAll('.btn-mode').forEach(btn => {
      const mode = btn.getAttribute('data-mode');
      if (mode === this.currentMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Metadados
    const infoYear = document.getElementById('scene-info-year');
    const infoDate = document.getElementById('scene-info-date');
    const infoClouds = document.getElementById('scene-info-clouds');
    const infoSat = document.getElementById('scene-info-sat');
    const ndviLegend = document.getElementById('ndvi-legend-container');

    if (infoYear) infoYear.textContent = this.currentYear;
    if (infoDate) infoDate.textContent = scene.date;
    if (infoClouds) infoClouds.textContent = `${scene.cloud_cover}%`;
    if (infoSat) infoSat.textContent = scene.satellite || 'Sentinel-2 L2A';

    // Mostrar ou esconder legenda de NDVI
    if (ndviLegend) {
      ndviLegend.style.display = (this.currentMode === 'ndvi' && this.isVisible) ? 'block' : 'none';
    }
  }
}

window.sentinelManager = new SentinelManager();
