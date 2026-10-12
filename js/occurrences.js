/**
 * Módulo de Gestão de Ocorrências e Fiscalização Ambiental de Campo
 * Work Drones Geo • ICMBio WebGIS
 */

class OccurrenceManager {
  constructor() {
    this.map = null;
    this.layerGroup = null;
    this.occurrences = [];
    this.currentMarker = null;
    this.selectedLatLng = null;
    this.capturedPhotoBase64 = '';

    this.typeIcons = {
      'Supressão de Manguezal': { color: '#E63946', icon: '🪓' },
      'Construção Irregular': { color: '#F77F00', icon: '🏗️' },
      'Descarte de Resíduos': { color: '#9D4EDD', icon: '🗑️' },
      'Queimada': { color: '#D62828', icon: '🔥' },
      'Pesca / Caça Predatória Ilegal': { color: '#0077B6', icon: '🎣' },
      'Poluição Hídrica': { color: '#2A9D8F', icon: '☣️' },
      'Outros': { color: '#4A5568', icon: '⚠️' }
    };
  }

  async init(leafletMap) {
    this.map = leafletMap;
    this.layerGroup = L.layerGroup().addTo(this.map);

    // Carregar ocorrências da base padrão e do armazenamento local
    await this.loadAllOccurrences();
    this.setupFormEvents();
  }

  async loadAllOccurrences() {
    let baseList = [];
    try {
      const resp = await fetch('data/ocorrencias.geojson?_t=' + Date.now());
      if (resp.ok) {
        const fc = await resp.json();
        baseList = fc.features || [];
      }
    } catch (e) {
      console.warn('[OccurrenceManager] Não foi possível carregar ocorrencias.geojson remoto:', e);
    }

    // Carregar ocorrências locais salvas no IndexedDB
    const localList = await window.offlineStore.getAllOccurrences();

    // Mesclar as listas dando preferência às mais atualizadas
    const mapById = new Map();
    baseList.forEach(f => mapById.set(f.id || f.properties?.id, f));
    localList.forEach(f => mapById.set(f.id || f.properties?.id, f));

    this.occurrences = Array.from(mapById.values());
    this.renderMarkers();
    this.updateCounter();
  }

  renderMarkers() {
    if (!this.layerGroup) return;
    this.layerGroup.clearLayers();

    this.occurrences.forEach((feat) => {
      const geom = feat.geometry;
      if (!geom || geom.type !== 'Point' || !geom.coordinates) return;

      const lon = geom.coordinates[0];
      const lat = geom.coordinates[1];
      const props = feat.properties || {};
      const typeInfo = this.typeIcons[props.tipo] || this.typeIcons['Outros'];

      // DivIcon com estilo Work Drones Geo
      const customIcon = L.divIcon({
        className: 'occ-map-pin',
        html: `
          <div style="
            background: ${typeInfo.color};
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid #FFFFFF;
            box-shadow: 0 4px 10px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="transform: rotate(45deg); font-size: 15px;">${typeInfo.icon}</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const marker = L.marker([lat, lon], { icon: customIcon });

      // Popup HTML estruturado
      const popupHtml = `
        <div class="occ-popup-card">
          <div class="occ-popup-header" style="background: ${typeInfo.color};">
            <span class="occ-popup-icon">${typeInfo.icon}</span>
            <div class="occ-popup-title-box">
              <h4 class="occ-popup-type">${props.tipo || 'Ocorrência'}</h4>
              <span class="occ-badge occ-badge-${(props.gravidade || 'Média').toLowerCase()}">Gravidade: ${props.gravidade || 'Média'}</span>
            </div>
          </div>
          <div class="occ-popup-body">
            <p class="occ-desc">${props.descricao || 'Sem descrição.'}</p>
            ${props.foto ? `<div class="occ-photo-thumb"><img src="${props.foto}" alt="Foto da Ocorrência" onclick="window.open('${props.foto}')"/></div>` : ''}
            <div class="occ-meta-grid">
              <div><strong>Fiscal:</strong> ${props.fiscal || 'Não identificado'}</div>
              <div><strong>Data:</strong> ${props.data_hora ? new Date(props.data_hora).toLocaleString('pt-BR') : 'N/A'}</div>
              <div><strong>Coords:</strong> ${lat.toFixed(5)}, ${lon.toFixed(5)}</div>
              ${props.precisao_gps ? `<div><strong>Precisão GPS:</strong> &plusmn;${props.precisao_gps}m</div>` : ''}
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 320 });
      this.layerGroup.addLayer(marker);
    });
  }

  updateCounter() {
    const el = document.getElementById('occ-count-badge');
    if (el) el.textContent = this.occurrences.length;
  }

  // Abre formulário para registrar ocorrência no ponto
  openForm(latlng, accuracy = null) {
    this.selectedLatLng = latlng;
    const modal = document.getElementById('modal-occurrence');
    const form = document.getElementById('form-occurrence');

    if (!modal || !form) return;

    // Resetar campos
    form.reset();
    this.capturedPhotoBase64 = '';
    const photoPreview = document.getElementById('photo-preview');
    if (photoPreview) {
      photoPreview.src = '';
      photoPreview.style.display = 'none';
    }

    // Preencher campos automáticos
    document.getElementById('occ-lat').value = latlng.lat.toFixed(6);
    document.getElementById('occ-lon').value = latlng.lng.toFixed(6);
    if (accuracy) {
      document.getElementById('occ-accuracy').value = accuracy.toFixed(1);
    } else {
      document.getElementById('occ-accuracy').value = '';
    }

    // Carregar nome do fiscal salvo anteriormente
    const lastFiscal = localStorage.getItem('last_fiscal_name') || '';
    if (lastFiscal) {
      document.getElementById('occ-fiscal').value = lastFiscal;
    }

    modal.classList.add('active');
  }

  closeForm() {
    const modal = document.getElementById('modal-occurrence');
    if (modal) modal.classList.remove('active');
    this.selectedLatLng = null;
  }

  setupFormEvents() {
    const form = document.getElementById('form-occurrence');
    const photoInput = document.getElementById('occ-photo');
    const photoPreview = document.getElementById('photo-preview');

    // Compressão automática de imagem da câmera via Canvas
    if (photoInput) {
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 1024;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxDim) {
                height *= maxDim / width;
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width *= maxDim / height;
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Converte para JPEG com qualidade balanceada (75%)
            this.capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.75);

            if (photoPreview) {
              photoPreview.src = this.capturedPhotoBase64;
              photoPreview.style.display = 'block';
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveOccurrence();
      });
    }
  }

  async handleSaveOccurrence() {
    const btnSubmit = document.getElementById('btn-submit-occ');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Salvando &amp; Sincronizando...</span>';
    }

    const lat = parseFloat(document.getElementById('occ-lat').value);
    const lon = parseFloat(document.getElementById('occ-lon').value);
    const tipo = document.getElementById('occ-type').value;
    const gravidade = document.getElementById('occ-severity').value;
    const fiscal = document.getElementById('occ-fiscal').value.trim();
    const descricao = document.getElementById('occ-desc').value.trim();
    const precisao = parseFloat(document.getElementById('occ-accuracy').value) || null;

    if (fiscal) {
      localStorage.setItem('last_fiscal_name', fiscal);
    }

    const occId = 'occ-' + Date.now();
    const feature = {
      type: 'Feature',
      id: occId,
      properties: {
        id: occId,
        tipo: tipo,
        gravidade: gravidade,
        fiscal: fiscal || 'Fiscal de Campo',
        descricao: descricao,
        data_hora: new Date().toISOString(),
        precisao_gps: precisao,
        status: 'Registrado em Campo',
        foto: this.capturedPhotoBase64
      },
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      }
    };

    // 1. Salvar no banco de dados local IndexedDB
    await window.offlineStore.saveOccurrence(feature);

    // 2. Adicionar ao array em memória e re-renderizar mapa
    this.occurrences.push(feature);
    this.renderMarkers();
    this.updateCounter();

    // 3. Transmitir ao GitHub se online
    window.app.showToast('Salvando intercorrência...', 'info');
    const syncResult = await window.gitHubSync.commitOccurrence(feature);

    if (syncResult.success) {
      window.app.showToast(`✅ Ocorrência comitada no GitHub! Hash: #${syncResult.commitSha}`, 'success');
    } else if (syncResult.offline) {
      window.app.showToast(`💾 ${syncResult.message}`, 'warning');
    } else {
      window.app.showToast(`⚠️ Salvo no aparelho. Erro no GitHub: ${syncResult.message}`, 'warning');
    }

    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<span>Salvar &amp; Transmitir Ocorrência</span>';
    }

    this.closeForm();
  }

  // --- Exportadores para Backup em Campo ---
  exportGeoJSON() {
    const fc = {
      type: 'FeatureCollection',
      name: 'Ocorrências - ICMBio Esec Guanabara & APA Guapimirim',
      features: this.occurrences
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fc, null, 2));
    this._downloadFile(dataStr, `ocorrencias_icmbio_${Date.now()}.geojson`);
  }

  exportCSV() {
    let csv = 'id,tipo,gravidade,fiscal,data_hora,latitude,longitude,precisao_gps,descricao\n';
    this.occurrences.forEach(f => {
      const p = f.properties || {};
      const c = f.geometry?.coordinates || [0, 0];
      const desc = (p.descricao || '').replace(/"/g, '""');
      csv += `"${f.id || p.id}","${p.tipo}","${p.gravidade}","${p.fiscal}","${p.data_hora}",${c[1]},${c[0]},${p.precisao_gps || ''},"${desc}"\n`;
    });
    const dataStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    this._downloadFile(dataStr, `ocorrencias_icmbio_${Date.now()}.csv`);
  }

  exportKML() {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Ocorrências ICMBio Esec Guanabara</name>
`;
    this.occurrences.forEach(f => {
      const p = f.properties || {};
      const c = f.geometry?.coordinates || [0, 0];
      kml += `    <Placemark>
      <name>${p.tipo} - ${p.gravidade}</name>
      <description><![CDATA[Fiscal: ${p.fiscal}<br>Data: ${p.data_hora}<br>Desc: ${p.descricao}]]></description>
      <Point>
        <coordinates>${c[0]},${c[1]},0</coordinates>
      </Point>
    </Placemark>\n`;
    });
    kml += `  </Document>
</kml>`;
    const dataStr = 'data:application/vnd.google-earth.kml+xml;charset=utf-8,' + encodeURIComponent(kml);
    this._downloadFile(dataStr, `ocorrencias_icmbio_${Date.now()}.kml`);
  }

  _downloadFile(contentUri, fileName) {
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', contentUri);
    dlAnchor.setAttribute('download', fileName);
    dlAnchor.click();
  }
}

window.occurrenceManager = new OccurrenceManager();
