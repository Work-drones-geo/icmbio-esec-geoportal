/**
 * Módulo de Integração de Imagens de Satélite Sentinel-2 (Série Temporal 2023-2026)
 * Suporte a Mosaico de 4 Quadrantes (23KPQ, 23KQQ, 23KPR, 23KQR) cobrindo 100% das UCs
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
    this.layerGroup = null;
    this.subLayers = [];
    this.map = null;
  }

  async init(leafletMap) {
    this.map = leafletMap;
    this.layerGroup = L.layerGroup();

    try {
      const resp = await fetch('data/sentinel_catalog.json?_t=' + Date.now());
      if (resp.ok) {
        this.catalog = await resp.json();
      }
    } catch (e) {
      console.warn('[SentinelManager] Falha ao carregar catálogo remoto:', e);
    }

    this.updateLayer();
    this.updateUI();
  }

  setYear(year) {
    if (!this.catalog || !this.catalog[year]) return;
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
    this.subLayers.forEach(layer => {
      if (layer && layer.setOpacity) {
        layer.setOpacity(this.opacity);
      }
    });
  }

  setVisibility(visible) {
    this.isVisible = visible;
    if (!this.map || !this.layerGroup) return;

    if (visible && !this.map.hasLayer(this.layerGroup)) {
      this.layerGroup.addTo(this.map);
    } else if (!visible && this.map.hasLayer(this.layerGroup)) {
      this.map.removeLayer(this.layerGroup);
    }
    this.updateUI();
  }

  updateLayer() {
    if (!this.map || !this.catalog) return;

    const yearData = this.catalog[this.currentYear];
    if (!yearData) return;

    // Limpar camadas anteriores
    if (this.layerGroup) {
      this.layerGroup.clearLayers();
    }
    this.subLayers = [];

    const scenes = yearData.scenes || [];

    if (scenes.length > 0) {
      // Mosaico com todos os quadrantes (23KPQ, 23KQQ, 23KPR, 23KQR)
      scenes.forEach(sc => {
        const tileUrl = this.currentMode === 'rgb' ? sc.tile_rgb : sc.tile_ndvi;
        const layer = L.tileLayer(tileUrl, {
          maxZoom: 19,
          minZoom: 8,
          pane: 'sentinelPane',
          opacity: this.opacity,
          attribution: `&copy; ESA Sentinel-2 L2A (${yearData.date})`
        });
        this.subLayers.push(layer);
        this.layerGroup.addLayer(layer);
      });
    } else if (yearData.tile_rgb) {
      // Fallback para cena única
      const tileUrl = this.currentMode === 'rgb' ? yearData.tile_rgb : yearData.tile_ndvi;
      const layer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        minZoom: 8,
        pane: 'sentinelPane',
        opacity: this.opacity,
        attribution: `&copy; ESA Sentinel-2 L2A`
      });
      this.subLayers.push(layer);
      this.layerGroup.addLayer(layer);
    }

    if (this.isVisible && !this.map.hasLayer(this.layerGroup)) {
      this.layerGroup.addTo(this.map);
    }
  }

  updateUI() {
    if (!this.catalog) return;
    const yearData = this.catalog[this.currentYear];
    if (!yearData) return;

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
    if (infoDate) infoDate.textContent = yearData.date || 'Estiagem';
    if (infoClouds) infoClouds.textContent = `${yearData.cloud_cover}% (Média UCs)`;
    if (infoSat) infoSat.textContent = yearData.satellite || 'Sentinel-2 L2A';

    // Mostrar ou esconder legenda de NDVI
    if (ndviLegend) {
      ndviLegend.style.display = (this.currentMode === 'ndvi' && this.isVisible) ? 'block' : 'none';
    }
  }
}

window.sentinelManager = new SentinelManager();
