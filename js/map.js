/**
 * Módulo Principal de Mapa (Leaflet & GPS em Tempo Real)
 * Work Drones Geo • ICMBio WebGIS
 */

class MapEngine {
  constructor() {
    this.map = null;
    this.baseLayers = {};
    this.esecLayer = null;
    this.apaLayer = null;

    // GPS & Telemetria
    this.watchId = null;
    this.isTracking = false;
    this.followUser = true;
    this.currentPosition = null;
    this.gpsMarker = null;
    this.gpsAccuracyCircle = null;

    // Bounding Box e Centro
    this.center = [-22.720949, -43.031579];
    this.defaultZoom = 12;
  }

  async init() {
    // 1. Instanciar Leaflet Map
    this.map = L.map('map', {
      center: this.center,
      zoom: this.defaultZoom,
      zoomControl: false,
      attributionControl: false
    });

    // Reposicionar controle de zoom para canto inferior direito
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // 2. Mapas Base
    this.setupBaseLayers();

    // 3. Carregar Polígonos das UCs
    await this.loadConservationUnits();

    // 4. Inicializar Módulos Filhos
    await window.sentinelManager.init(this.map);
    await window.occurrenceManager.init(this.map);

    // 5. Configurar Eventos do Mapa (clique, coordenadas do cursor)
    this.setupMapEvents();

    console.log('[MapEngine] Inicializado com sucesso.');
  }

  setupBaseLayers() {
    // Esri World Imagery (Satélite)
    this.baseLayers['satellite'] = L.tileLayer('https://server.arcgisonline.com/ArcArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri'
    });

    // CartoDB Dark Matter (Contraste escuro de alta legibilidade)
    this.baseLayers['dark'] = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; CartoDB'
    });

    // OpenStreetMap
    this.baseLayers['osm'] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    });

    // Ativa Satélite por padrão
    this.baseLayers['satellite'].addTo(this.map);
  }

  setBaseLayer(type) {
    Object.values(this.baseLayers).forEach(layer => {
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
    });

    if (this.baseLayers[type]) {
      this.baseLayers[type].addTo(this.map);
      // Assegurar que Sentinel e vetores fiquem acima
      if (window.sentinelManager && window.sentinelManager.tileLayer) {
        window.sentinelManager.tileLayer.bringToBack();
      }
    }
  }

  async loadConservationUnits() {
    try {
      // 1. ESEC Guanabara (Verde Esmeralda Vibrante #52B788)
      const esecResp = await fetch('data/esec_guanabara.geojson');
      if (esecResp.ok) {
        const esecGeo = await esecResp.json();
        this.esecLayer = L.geoJSON(esecGeo, {
          style: {
            color: '#52B788',
            weight: 2.8,
            dashArray: '',
            fillColor: '#52B788',
            fillOpacity: 0.18
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            layer.bindPopup(`
              <div class="uc-popup">
                <div class="uc-popup-badge badge-esec">Proteção Integral</div>
                <h3 class="uc-popup-title">${props.nome || 'Estação Ecológica da Guanabara'}</h3>
                <p class="uc-popup-info"><strong>Órgão Gestor:</strong> ICMBio</p>
                <p class="uc-popup-info"><strong>Área:</strong> ~1.935 hectares de manguezal preservado</p>
                <p class="uc-popup-desc">Preserva o maior remanescente contínuo de manguezais da Baía de Guanabara, berçário de espécies estuarinas e refúgio de aves migratórias.</p>
              </div>
            `);
          }
        }).addTo(this.map);
      }
    } catch (e) {
      console.warn('[MapEngine] Erro ao carregar Esec Guanabara:', e);
    }

    try {
      // 2. APA Guapimirim (Verde Menta / Oliva #74C69D)
      const apaResp = await fetch('data/apa_guapimirim.geojson');
      if (apaResp.ok) {
        const apaGeo = await apaResp.json();
        this.apaLayer = L.geoJSON(apaGeo, {
          style: {
            color: '#74C69D',
            weight: 2.2,
            dashArray: '6, 6',
            fillColor: '#74C69D',
            fillOpacity: 0.10
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            layer.bindPopup(`
              <div class="uc-popup">
                <div class="uc-popup-badge badge-apa">Uso Sustentável</div>
                <h3 class="uc-popup-title">${props.nome || 'APA de Guapimirim'}</h3>
                <p class="uc-popup-info"><strong>Órgão Gestor:</strong> ICMBio</p>
                <p class="uc-popup-info"><strong>Área:</strong> ~13.926 hectares</p>
                <p class="uc-popup-desc">Protege os rios Guapi-Mirim, Macacu e Guaxindiba, integrando preservação de manguezais, caranguejais e atividades de pesca artesanal tradicional.</p>
              </div>
            `);
          }
        }).addTo(this.map);
      }
    } catch (e) {
      console.warn('[MapEngine] Erro ao carregar APA Guapimirim:', e);
    }
  }

  // Enquadramentos Rápidos
  zoomToEsec() {
    if (this.esecLayer) {
      this.map.fitBounds(this.esecLayer.getBounds(), { padding: [30, 30], maxZoom: 14 });
    }
  }

  zoomToApa() {
    if (this.apaLayer) {
      this.map.fitBounds(this.apaLayer.getBounds(), { padding: [30, 30], maxZoom: 13 });
    }
  }

  zoomToOverview() {
    this.map.setView(this.center, this.defaultZoom);
  }

  // --- GEOLOCALIZAÇÃO EM TEMPO REAL (GPS TRACKER) ---
  toggleGpsTracking() {
    if (this.isTracking) {
      this.stopGpsTracking();
    } else {
      this.startGpsTracking();
    }
  }

  startGpsTracking() {
    if (!('geolocation' in navigator)) {
      window.app.showToast('Geolocalização não suportada neste dispositivo.', 'danger');
      return;
    }

    this.isTracking = true;
    const btnGps = document.getElementById('btn-gps-track');
    const hudStatus = document.getElementById('gps-hud-status');
    if (btnGps) btnGps.classList.add('tracking-active');
    if (hudStatus) hudStatus.textContent = 'GPS Conectado';

    window.app.showToast('Conectando ao receptor GPS em alta precisão...', 'info');

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onGpsSuccess(pos),
      (err) => this.onGpsError(err),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 1000
      }
    );
  }

  stopGpsTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;

    const btnGps = document.getElementById('btn-gps-track');
    const hudStatus = document.getElementById('gps-hud-status');
    if (btnGps) btnGps.classList.remove('tracking-active');
    if (hudStatus) hudStatus.textContent = 'GPS Inativo';

    if (this.gpsMarker) {
      this.map.removeLayer(this.gpsMarker);
      this.gpsMarker = null;
    }
    if (this.gpsAccuracyCircle) {
      this.map.removeLayer(this.gpsAccuracyCircle);
      this.gpsAccuracyCircle = null;
    }

    window.app.showToast('Rastreamento GPS desativado.', 'info');
  }

  onGpsSuccess(position) {
    const coords = position.coords;
    const lat = coords.latitude;
    const lon = coords.longitude;
    const acc = coords.accuracy; // em metros
    const speed = coords.speed ? (coords.speed * 3.6).toFixed(1) : '0.0'; // km/h
    this.currentPosition = { lat, lon, acc, speed };

    const latlng = L.latLng(lat, lon);

    // 1. Atualizar ou Criar Marcador de Posição do Fiscal
    if (!this.gpsMarker) {
      const gpsIcon = L.divIcon({
        className: 'gps-pulse-icon',
        html: `
          <div class="gps-pulse-outer">
            <div class="gps-pulse-center"></div>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      this.gpsMarker = L.marker(latlng, { icon: gpsIcon, zIndexOffset: 1000 }).addTo(this.map);
      this.gpsAccuracyCircle = L.circle(latlng, {
        radius: acc,
        color: '#52B788',
        weight: 1.5,
        fillColor: '#52B788',
        fillOpacity: 0.12
      }).addTo(this.map);

      window.app.showToast(`GPS fixado: precisão ±${acc.toFixed(1)}m`, 'success');
    } else {
      this.gpsMarker.setLatLng(latlng);
      this.gpsAccuracyCircle.setLatLng(latlng);
      this.gpsAccuracyCircle.setRadius(acc);
    }

    // 2. Se modo "Seguir" ativado, centralizar mapa
    if (this.followUser) {
      this.map.panTo(latlng, { animate: true, duration: 0.6 });
    }

    // 3. Atualizar HUD de Telemetria e Coordenadas
    this.updateTelemetryHUD(lat, lon, acc, speed);
  }

  onGpsError(err) {
    console.warn('[MapEngine] Erro de Geolocalização:', err);
    let msg = 'Erro no GPS.';
    if (err.code === 1) msg = 'Permissão de GPS negada pelo usuário.';
    else if (err.code === 2) msg = 'Sinal GPS indisponível no momento.';
    else if (err.code === 3) msg = 'Tempo limite de busca GPS esgotado.';
    window.app.showToast(msg, 'warning');
  }

  updateTelemetryHUD(lat, lon, acc, speed) {
    const hudCoords = document.getElementById('gps-hud-coords');
    const hudUtm = document.getElementById('gps-hud-utm');
    const hudAcc = document.getElementById('gps-hud-acc');
    const hudSpeed = document.getElementById('gps-hud-speed');

    if (hudCoords) {
      hudCoords.textContent = `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;
    }

    // Conversão SIRGAS 2000 UTM Zona 23S
    const utm = this.latLonToUtm23S(lat, lon);
    if (hudUtm) {
      hudUtm.textContent = `UTM 23S: E ${utm.easting.toFixed(0)}m / N ${utm.northing.toFixed(0)}m`;
    }

    if (hudAcc) {
      hudAcc.textContent = `±${acc.toFixed(1)}m`;
    }

    if (hudSpeed) {
      hudSpeed.textContent = `${speed} km/h`;
    }
  }

  // Conversão de Latitude/Longitude (WGS84 / SIRGAS 2000) para UTM 23S
  latLonToUtm23S(lat, lon) {
    const a = 6378137.0; // raio equatorial GRS80/WGS84
    const f = 1 / 298.257223563;
    const k0 = 0.9996;
    const e2 = 2 * f - f * f;
    const ep2 = e2 / (1 - e2);

    const latRad = lat * (Math.PI / 180);
    const lonRad = lon * (Math.PI / 180);
    const centralLonRad = -45.0 * (Math.PI / 180); // Meridiano Central UTM 23S = 45°W

    const deltaLon = lonRad - centralLonRad;

    const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
    const T = Math.tan(latRad) * Math.tan(latRad);
    const C = ep2 * Math.cos(latRad) * Math.cos(latRad);
    const A = Math.cos(latRad) * deltaLon;

    // Arco meridiano M
    const M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * latRad
      - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * latRad)
      + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * latRad)
      - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * latRad));

    const easting = 500000.0 + k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6
      + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5) / 120);

    let northing = k0 * (M + N * Math.tan(latRad) * (Math.pow(A, 2) / 2
      + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6) / 720));

    // Hemisfério Sul
    if (lat < 0) {
      northing += 10000000.0;
    }

    return { easting, northing };
  }

  setupMapEvents() {
    // Clique no mapa: permite abrir cadastro de ocorrência naquele ponto específico
    this.map.on('click', (e) => {
      // Se não estiver em modo de medição
      window.occurrenceManager.openForm(e.latlng, null);
    });

    // Movimento do cursor: barra de status
    this.map.on('mousemove', (e) => {
      const el = document.getElementById('footer-cursor-coords');
      if (el) {
        el.textContent = `${e.latlng.lat.toFixed(5)}°, ${e.latlng.lng.toFixed(5)}°`;
      }
    });
  }
}

window.mapEngine = new MapEngine();
