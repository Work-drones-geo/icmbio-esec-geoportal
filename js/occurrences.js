/**
 * Módulo de Gestão de Ocorrências e Fiscalização Ambiental de Campo
 * Suporte a Câmera em Tempo Real (getUserMedia), Galeria de Fotos e Sincronização
 * Work Drones Geo • ICMBio WebGIS
 */

class OccurrenceManager {
  constructor() {
    this.map = null;
    this.layerGroup = null;
    this.occurrences = [];
    this.tempMarker = null;
    this.selectedLatLng = null;
    this.capturedPhotoBase64 = '';
    this.mediaStream = null;

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
    this.setupCameraEvents();
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

    // Resetar campos e fotos
    form.reset();
    this.capturedPhotoBase64 = '';
    this.stopCamera();

    const previewContainer = document.getElementById('photo-preview-container');
    if (previewContainer) previewContainer.style.display = 'none';

    const streamContainer = document.getElementById('camera-stream-container');
    if (streamContainer) streamContainer.style.display = 'none';

    // Preencher coordenadas
    document.getElementById('occ-lat').value = latlng.lat.toFixed(6);
    document.getElementById('occ-lon').value = latlng.lng.toFixed(6);
    document.getElementById('occ-accuracy').value = accuracy ? accuracy.toFixed(1) : '';

    // Nome do fiscal salvo
    const lastFiscal = localStorage.getItem('last_fiscal_name') || '';
    if (lastFiscal) {
      document.getElementById('occ-fiscal').value = lastFiscal;
    }

    // Criar marcador temporário de seleção no mapa
    if (this.tempMarker && this.map) {
      this.map.removeLayer(this.tempMarker);
    }

    const tempIcon = L.divIcon({
      className: 'temp-selection-pin',
      html: `
        <div style="
          background: #52B788;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid #FFFFFF;
          box-shadow: 0 0 14px rgba(82, 183, 136, 0.9);
          animation: pulseTracking 1.5s infinite;
        "></div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    this.tempMarker = L.marker([latlng.lat, latlng.lng], { icon: tempIcon }).addTo(this.map);

    modal.classList.add('active');
  }

  closeForm() {
    const modal = document.getElementById('modal-occurrence');
    if (modal) modal.classList.remove('active');
    this.stopCamera();

    if (this.tempMarker && this.map) {
      this.map.removeLayer(this.tempMarker);
      this.tempMarker = null;
    }
    this.selectedLatLng = null;
  }

  // --- CÂMERA EM TEMPO REAL & CAPTURA ---
  setupCameraEvents() {
    const btnStartCamera = document.getElementById('btn-start-camera');
    const btnBrowseGallery = document.getElementById('btn-browse-gallery');
    const fileInput = document.getElementById('occ-file-input');
    const btnTakeSnapshot = document.getElementById('btn-take-snapshot');
    const btnStopCamera = document.getElementById('btn-stop-camera');
    const btnDeletePhoto = document.getElementById('btn-delete-photo');
    const btnUseCurrentGps = document.getElementById('btn-use-current-gps');

    if (btnStartCamera) {
      btnStartCamera.addEventListener('click', () => this.startCamera());
    }

    if (btnBrowseGallery && fileInput) {
      btnBrowseGallery.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFileSelected(e.target.files[0]);
        }
      });
    }

    if (btnTakeSnapshot) {
      btnTakeSnapshot.addEventListener('click', () => this.takeSnapshot());
    }

    if (btnStopCamera) {
      btnStopCamera.addEventListener('click', () => this.stopCamera());
    }

    if (btnDeletePhoto) {
      btnDeletePhoto.addEventListener('click', () => this.deletePhoto());
    }

    if (btnUseCurrentGps) {
      btnUseCurrentGps.addEventListener('click', () => this.useCurrentGps());
    }
  }

  async startCamera() {
    const video = document.getElementById('camera-video-element');
    const streamContainer = document.getElementById('camera-stream-container');
    const previewContainer = document.getElementById('photo-preview-container');

    if (previewContainer) previewContainer.style.display = 'none';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      window.app.showToast('Câmera não suportada neste navegador. Use a opção de arquivo/galeria.', 'warning');
      document.getElementById('occ-file-input')?.click();
      return;
    }

    try {
      // Tentar abrir câmera traseira no mobile ou webcam no PC
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 }
        },
        audio: false
      });

      if (video) {
        video.srcObject = this.mediaStream;
        await video.play();
      }

      if (streamContainer) {
        streamContainer.style.display = 'block';
      }
    } catch (err) {
      console.warn('[OccurrenceManager] Erro ao acessar câmera:', err);
      window.app.showToast('Acesso à câmera bloqueado. Selecione uma foto da galeria.', 'warning');
      document.getElementById('occ-file-input')?.click();
    }
  }

  takeSnapshot() {
    const video = document.getElementById('camera-video-element');
    const streamContainer = document.getElementById('camera-stream-container');
    const previewContainer = document.getElementById('photo-preview-container');
    const previewImg = document.getElementById('photo-preview-element');

    if (!video || !video.videoWidth) {
      window.app.showToast('Aguarde o vídeo da câmera iniciar antes de disparar.', 'warning');
      return;
    }

    const canvas = document.createElement('canvas');
    const maxDim = 1024;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > height) {
      if (width > maxDim) {
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      }
    } else {
      if (height > maxDim) {
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    this.capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.75);

    // Desligar câmera e mostrar prévia
    this.stopCamera();

    if (previewImg) previewImg.src = this.capturedPhotoBase64;
    if (previewContainer) previewContainer.style.display = 'block';

    window.app.showToast('📸 Foto capturada com sucesso!', 'success');
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    const streamContainer = document.getElementById('camera-stream-container');
    if (streamContainer) streamContainer.style.display = 'none';

    const video = document.getElementById('camera-video-element');
    if (video) video.srcObject = null;
  }

  handleFileSelected(file) {
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
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        this.capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.75);

        const previewImg = document.getElementById('photo-preview-element');
        const previewContainer = document.getElementById('photo-preview-container');
        if (previewImg) previewImg.src = this.capturedPhotoBase64;
        if (previewContainer) previewContainer.style.display = 'block';

        window.app.showToast('📁 Foto carregada e otimizada!', 'success');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  deletePhoto() {
    this.capturedPhotoBase64 = '';
    const previewContainer = document.getElementById('photo-preview-container');
    const previewImg = document.getElementById('photo-preview-element');
    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.style.display = 'none';
    const fileInput = document.getElementById('occ-file-input');
    if (fileInput) fileInput.value = '';
    window.app.showToast('Foto removida.', 'info');
  }

  useCurrentGps() {
    if (window.mapEngine && window.mapEngine.currentPosition) {
      const { lat, lon, acc } = window.mapEngine.currentPosition;
      document.getElementById('occ-lat').value = lat.toFixed(6);
      document.getElementById('occ-lon').value = lon.toFixed(6);
      document.getElementById('occ-accuracy').value = acc.toFixed(1);

      if (this.tempMarker) {
        this.tempMarker.setLatLng([lat, lon]);
      }
      window.app.showToast(`Coordenadas atualizadas para o GPS atual (±${acc.toFixed(1)}m)!`, 'success');
    } else {
      window.app.showToast('Buscando sinal GPS...', 'info');
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const acc = pos.coords.accuracy;
            document.getElementById('occ-lat').value = lat.toFixed(6);
            document.getElementById('occ-lon').value = lon.toFixed(6);
            document.getElementById('occ-accuracy').value = acc.toFixed(1);

            if (this.tempMarker) {
              this.tempMarker.setLatLng([lat, lon]);
            }
            window.app.showToast(`Coordenadas atualizadas para o GPS atual (±${acc.toFixed(1)}m)!`, 'success');
          },
          (err) => {
            window.app.showToast('Sinal GPS indisponível no momento.', 'warning');
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
    }
  }

  setupFormEvents() {
    const form = document.getElementById('form-occurrence');
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

    if (isNaN(lat) || isNaN(lon)) {
      window.app.showToast('Coordenadas geográficas inválidas.', 'danger');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Salvar &amp; Transmitir Ocorrência</span>';
      }
      return;
    }

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

    // 2. Adicionar ao array e re-renderizar mapa
    this.occurrences.push(feature);
    this.renderMarkers();
    this.updateCounter();

    // 3. Remover marcador provisório
    if (this.tempMarker && this.map) {
      this.map.removeLayer(this.tempMarker);
      this.tempMarker = null;
    }

    // 4. Fechar modal antes de notificar
    this.closeForm();

    // 5. Transmitir ao GitHub
    window.app.showToast('Ocorrência gravada localmente. Transmitindo...', 'info');
    const syncResult = await window.gitHubSync.commitOccurrence(feature);

    if (syncResult.success) {
      window.app.showToast(`✅ Ocorrência comitada no GitHub! Hash: #${syncResult.commitSha}`, 'success');
    } else if (syncResult.offline) {
      window.app.showToast(`💾 ${syncResult.message}`, 'warning');
    } else {
      window.app.showToast(`💾 Salva no aparelho. Sincronização: ${syncResult.message}`, 'info');
    }

    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<span>Salvar &amp; Transmitir Ocorrência</span>';
    }
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
