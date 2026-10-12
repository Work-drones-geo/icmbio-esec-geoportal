/**
 * Orquestrador Principal da Aplicação WebGIS PWA
 * Work Drones Geo • ICMBio WebGIS
 */

class App {
  constructor() {
    this.deferredInstallPrompt = null;
  }

  async init() {
    console.log('[App] Inicializando Work Drones Geo WebGIS...');

    // 1. Inicializar Armazenamento Offline
    await window.offlineStore.init();

    // 2. Inicializar Sincronizador GitHub
    await window.gitHubSync.init();

    // 3. Inicializar Mapa e Camadas
    await window.mapEngine.init();

    // 4. Registrar Service Worker PWA
    this.registerServiceWorker();

    // 5. Configurar Eventos de Rede (Online/Offline)
    this.setupNetworkMonitor();

    // 6. Configurar Interações da UI (Menus, Abas, Modais)
    this.setupUIEvents();

    // 7. Checar pendências de sincronização
    this.checkPendingSync();

    console.log('[App] Sistema pronto para operações de campo.');
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('[App] Service Worker registrado:', reg.scope);
          })
          .catch((err) => {
            console.warn('[App] Falha ao registrar Service Worker:', err);
          });
      });
    }

    // Suporte ao botão "Instalar PWA"
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      const btnInstall = document.getElementById('btn-pwa-install');
      if (btnInstall) btnInstall.style.display = 'flex';
    });
  }

  setupNetworkMonitor() {
    const updateNetworkBadge = () => {
      const isOnline = navigator.onLine;
      const badge = document.getElementById('network-badge');
      const dot = document.getElementById('network-dot');
      const text = document.getElementById('network-text');

      if (badge && text && dot) {
        if (isOnline) {
          badge.className = 'status-badge status-online';
          text.textContent = 'ONLINE';
          dot.style.background = '#52B788';
        } else {
          badge.className = 'status-badge status-offline';
          text.textContent = 'OFFLINE (CAMPO)';
          dot.style.background = '#F4A261';
        }
      }
    };

    window.addEventListener('online', async () => {
      updateNetworkBadge();
      this.showToast('Conexão restabelecida! Verificando pendências de envio...', 'success');
      await this.triggerPendingSync();
    });

    window.addEventListener('offline', () => {
      updateNetworkBadge();
      this.showToast('Modo Offline ativado. Dados e mapas salvos no aparelho.', 'warning');
    });

    updateNetworkBadge();
  }

  setupUIEvents() {
    // Menu Lateral (Toggle Drawer no mobile)
    const sidebar = document.getElementById('sidebar');
    const btnToggle = document.getElementById('btn-toggle-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');

    const toggleSidebar = () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active');
      if (window.mapEngine) {
        window.mapEngine.invalidateSizeMultiple();
      }
    };

    if (btnToggle) btnToggle.addEventListener('click', toggleSidebar);
    if (backdrop) backdrop.addEventListener('click', toggleSidebar);
    if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', toggleSidebar);

    // Controle Deslizante de Opacidade/Transparência da Sidebar
    const panelOpacitySlider = document.getElementById('panel-opacity-slider');
    const panelOpacityVal = document.getElementById('panel-opacity-val');
    const savedOpacity = localStorage.getItem('sidebar_opacity') || '0.88';

    const applySidebarOpacity = (val) => {
      sidebar.style.background = `rgba(19, 42, 19, ${val})`;
      if (panelOpacityVal) panelOpacityVal.textContent = `${Math.round(val * 100)}%`;
      if (panelOpacitySlider) panelOpacitySlider.value = val;
      localStorage.setItem('sidebar_opacity', val);
    };

    applySidebarOpacity(savedOpacity);

    if (panelOpacitySlider) {
      panelOpacitySlider.addEventListener('input', (e) => {
        applySidebarOpacity(e.target.value);
      });
    }

    // Fechar modais ao pressionar ESC
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.occurrenceManager?.closeForm();
        document.getElementById('modal-github')?.classList.remove('active');
        if (sidebar.classList.contains('open')) toggleSidebar();
      }
    });

    // Abas da Sidebar
    document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const target = document.getElementById(`tab-${tabId}`);
        if (target) target.classList.add('active');
      });
    });

    // Controles de Satélite Sentinel-2
    document.querySelectorAll('.btn-year').forEach(btn => {
      btn.addEventListener('click', () => {
        const yr = btn.getAttribute('data-year');
        window.sentinelManager.setYear(yr);
      });
    });

    document.querySelectorAll('.btn-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = btn.getAttribute('data-mode');
        window.sentinelManager.setMode(m);
      });
    });

    const sliderOpacity = document.getElementById('sentinel-opacity-slider');
    if (sliderOpacity) {
      sliderOpacity.addEventListener('input', (e) => {
        window.sentinelManager.setOpacity(e.target.value);
        const valEl = document.getElementById('sentinel-opacity-val');
        if (valEl) valEl.textContent = `${Math.round(e.target.value * 100)}%`;
      });
    }

    const checkSentinelVisible = document.getElementById('check-sentinel-visible');
    if (checkSentinelVisible) {
      checkSentinelVisible.addEventListener('change', (e) => {
        window.sentinelManager.setVisibility(e.target.checked);
      });
    }

    // Seletor de Mapa Base
    document.querySelectorAll('input[name="basemap-radio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        window.mapEngine.setBaseLayer(e.target.value);
      });
    });

    // Atalhos de Zoom das UCs
    const btnZoomEsec = document.getElementById('btn-zoom-esec');
    const btnZoomApa = document.getElementById('btn-zoom-apa');
    const btnZoomAll = document.getElementById('btn-zoom-all');
    if (btnZoomEsec) btnZoomEsec.addEventListener('click', () => window.mapEngine.zoomToEsec());
    if (btnZoomApa) btnZoomApa.addEventListener('click', () => window.mapEngine.zoomToApa());
    if (btnZoomAll) btnZoomAll.addEventListener('click', () => window.mapEngine.zoomToOverview());

    // Botão de Rastreamento GPS
    const btnGpsTrack = document.getElementById('btn-gps-track');
    if (btnGpsTrack) {
      btnGpsTrack.addEventListener('click', () => {
        window.mapEngine.toggleGpsTracking();
      });
    }

    // Botão FAB Flutuante: Nova Ocorrência (usa GPS ou centro do mapa)
    const btnAddOcc = document.getElementById('btn-add-occurrence-fab');
    if (btnAddOcc) {
      btnAddOcc.addEventListener('click', () => {
        if (window.mapEngine.currentPosition) {
          const latlng = {
            lat: window.mapEngine.currentPosition.lat,
            lng: window.mapEngine.currentPosition.lon
          };
          window.occurrenceManager.openForm(latlng, window.mapEngine.currentPosition.acc);
        } else {
          // Usa centro do mapa
          const center = window.mapEngine.map.getCenter();
          window.occurrenceManager.openForm(center, null);
        }
      });
    }

    // Fechar modal de ocorrência
    const btnCloseModal = document.getElementById('btn-close-occ-modal');
    const btnCancelModal = document.getElementById('btn-cancel-occ-modal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => window.occurrenceManager.closeForm());
    if (btnCancelModal) btnCancelModal.addEventListener('click', () => window.occurrenceManager.closeForm());

    // Configuração do GitHub Modal
    const btnOpenGhConfig = document.getElementById('btn-open-github-modal');
    const modalGh = document.getElementById('modal-github');
    const btnCloseGh = document.getElementById('btn-close-github-modal');
    const formGh = document.getElementById('form-github-config');
    const btnTestGh = document.getElementById('btn-test-github');

    if (btnOpenGhConfig) {
      btnOpenGhConfig.addEventListener('click', () => {
        document.getElementById('gh-repo').value = window.gitHubSync.repo || '';
        document.getElementById('gh-token').value = window.gitHubSync.token || '';
        document.getElementById('gh-branch').value = window.gitHubSync.branch || 'main';
        modalGh.classList.add('active');
      });
    }

    if (btnCloseGh) btnCloseGh.addEventListener('click', () => modalGh.classList.remove('active'));

    if (formGh) {
      formGh.addEventListener('submit', async (e) => {
        e.preventDefault();
        const repo = document.getElementById('gh-repo').value;
        const token = document.getElementById('gh-token').value;
        const branch = document.getElementById('gh-branch').value;

        await window.gitHubSync.saveConfig(token, repo, branch);
        modalGh.classList.remove('active');
        this.showToast('Configurações do GitHub salvas com sucesso!', 'success');
        this.updateGitHubStatusUI();
      });
    }

    if (btnTestGh) {
      btnTestGh.addEventListener('click', async () => {
        const repo = document.getElementById('gh-repo').value;
        const token = document.getElementById('gh-token').value;
        const branch = document.getElementById('gh-branch').value;
        await window.gitHubSync.saveConfig(token, repo, branch);

        try {
          btnTestGh.textContent = 'Testando...';
          const info = await window.gitHubSync.testConnection();
          this.showToast(`Conectado com sucesso ao repositório ${info.repoName}!`, 'success');
        } catch (err) {
          this.showToast(`Erro na conexão: ${err.message}`, 'danger');
        } finally {
          btnTestGh.textContent = 'Testar Conexão';
        }
      });
    }

    // Botões de Exportação
    const btnExpGeoJSON = document.getElementById('btn-exp-geojson');
    const btnExpKML = document.getElementById('btn-exp-kml');
    const btnExpCSV = document.getElementById('btn-exp-csv');
    if (btnExpGeoJSON) btnExpGeoJSON.addEventListener('click', () => window.occurrenceManager.exportGeoJSON());
    if (btnExpKML) btnExpKML.addEventListener('click', () => window.occurrenceManager.exportKML());
    if (btnExpCSV) btnExpCSV.addEventListener('click', () => window.occurrenceManager.exportCSV());

    // Botão de Sincronizar Fila Manualmente
    const btnSyncQueue = document.getElementById('btn-sync-queue');
    if (btnSyncQueue) {
      btnSyncQueue.addEventListener('click', () => this.triggerPendingSync());
    }

    // Instalar PWA
    const btnInstall = document.getElementById('btn-pwa-install');
    if (btnInstall) {
      btnInstall.addEventListener('click', async () => {
        if (this.deferredInstallPrompt) {
          this.deferredInstallPrompt.prompt();
          const { outcome } = await this.deferredInstallPrompt.userChoice;
          console.log('[App] PWA install outcome:', outcome);
          this.deferredInstallPrompt = null;
          btnInstall.style.display = 'none';
        }
      });
    }

    this.updateGitHubStatusUI();
  }

  async checkPendingSync() {
    const list = await window.offlineStore.getPendingSyncList();
    const count = list.length;
    const badge = document.getElementById('sync-pending-count');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  }

  async triggerPendingSync() {
    if (!window.gitHubSync.isConfigured) {
      this.showToast('Configure o Repositório e Token do GitHub para sincronizar.', 'warning');
      return;
    }

    this.showToast('Sincronizando intercorrências pendentes com o GitHub...', 'info');
    const res = await window.gitHubSync.syncPendingQueue();

    if (res.syncedCount > 0) {
      this.showToast(`✅ ${res.syncedCount} ocorrência(s) sincronizadas no repositório!`, 'success');
      await window.occurrenceManager.loadAllOccurrences();
    } else if (res.pendingCount === 0) {
      this.showToast('Todas as ocorrências já estão sincronizadas.', 'info');
    }
    await this.checkPendingSync();
  }

  updateGitHubStatusUI() {
    const stEl = document.getElementById('gh-status-indicator');
    if (stEl) {
      if (window.gitHubSync.isConfigured) {
        stEl.innerHTML = `<span style="color: #52B788;">● Conectado a: <strong>${window.gitHubSync.repo}</strong></span>`;
      } else {
        stEl.innerHTML = `<span style="color: #F4A261;">● Não configurado (operando em modo offline local)</span>`;
      }
    }
  }

  // Toasts de Notificação
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }
}

window.app = new App();
window.addEventListener('DOMContentLoaded', () => window.app.init());
