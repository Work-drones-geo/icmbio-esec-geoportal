/**
 * Módulo de Sincronização com GitHub REST API (Automated Push/Commit)
 * Work Drones Geo • ICMBio WebGIS
 */

class GitHubSync {
  constructor() {
    this.token = '';
    this.repo = ''; // formato "proprietario/repositorio"
    this.branch = 'main';
    this.filePath = 'data/ocorrencias.geojson';
    this.isConfigured = false;
    this.isSyncing = false;
  }

  async init() {
    // Carrega credenciais salvas no dispositivo
    this.token = (await window.offlineStore.getSetting('github_token')) || '';
    this.repo = (await window.offlineStore.getSetting('github_repo')) || '';
    this.branch = (await window.offlineStore.getSetting('github_branch')) || 'main';
    this.isConfigured = Boolean(this.token && this.repo);
  }

  async saveConfig(token, repo, branch = 'main') {
    this.token = token.trim();
    this.repo = repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
    this.branch = branch.trim() || 'main';
    this.isConfigured = Boolean(this.token && this.repo);

    await window.offlineStore.setSetting('github_token', this.token);
    await window.offlineStore.setSetting('github_repo', this.repo);
    await window.offlineStore.setSetting('github_branch', this.branch);
  }

  // Testa conectividade e permissões do token
  async testConnection() {
    if (!this.isConfigured) {
      throw new Error('Configuração do GitHub incompleta (Token ou Repositório ausente).');
    }

    const url = `https://api.github.com/repos/${this.repo}`;
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `Erro HTTP ${resp.status}`);
    }

    const data = await resp.json();
    return {
      repoName: data.full_name,
      permissions: data.permissions || {},
      private: data.private
    };
  }

  // Faz commit de uma nova ocorrência ou atualiza o GeoJSON no GitHub
  async commitOccurrence(feature, retries = 2) {
    if (!this.isConfigured) {
      // Se não configurado, salva offline para push posterior
      await window.offlineStore.addPendingSync(feature);
      return { success: false, offline: true, message: 'Salvo localmente (GitHub não configurado).' };
    }

    if (!navigator.onLine) {
      // Sem internet: enfileira localmente
      await window.offlineStore.addPendingSync(feature);
      return { success: false, offline: true, message: 'Dispositivo offline. Ocorrência salva na fila local.' };
    }

    try {
      // 1. Obter o arquivo ocorrencias.geojson atual e seu SHA
      const getUrl = `https://api.github.com/repos/${this.repo}/contents/${this.filePath}?ref=${this.branch}&_t=${Date.now()}`;
      const getResp = await fetch(getUrl, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      let currentFc = {
        type: 'FeatureCollection',
        name: 'Ocorrências de Fiscalização - Esec Guanabara & APA Guapimirim',
        features: []
      };
      let currentSha = null;

      if (getResp.ok) {
        const fileData = await getResp.json();
        currentSha = fileData.sha;
        const decodedContent = this._b64DecodeUnicode(fileData.content.replace(/\n/g, ''));
        try {
          currentFc = JSON.parse(decodedContent);
          if (!Array.isArray(currentFc.features)) currentFc.features = [];
        } catch (e) {
          console.warn('[GitHubSync] Erro ao parsear GeoJSON remoto:', e);
        }
      } else if (getResp.status === 404) {
        // Arquivo ainda não existe, será criado no primeiro commit
        currentSha = null;
      } else {
        throw new Error(`Falha ao ler arquivo do GitHub: HTTP ${getResp.status}`);
      }

      // 2. Anexar ou atualizar a Feature
      const existingIdx = currentFc.features.findIndex(f => f.id === feature.id || (f.properties && f.properties.id === feature.id));
      if (existingIdx >= 0) {
        currentFc.features[existingIdx] = feature;
      } else {
        currentFc.features.push(feature);
      }

      // 3. Montar mensagem de commit e conteúdo Base64 seguro
      const props = feature.properties || {};
      const commitMsg = `feat(fiscalizacao): ${props.tipo || 'Ocorrencia'} por ${props.fiscal || 'Fiscal'} [${props.data_hora ? props.data_hora.substring(0, 16) : new Date().toISOString()}]`;
      const jsonStr = JSON.stringify(currentFc, null, 2);
      const b64Content = this._b64EncodeUnicode(jsonStr);

      // 4. Executar PUT na API do GitHub
      const putUrl = `https://api.github.com/repos/${this.repo}/contents/${this.filePath}`;
      const putBody = {
        message: commitMsg,
        content: b64Content,
        branch: this.branch
      };
      if (currentSha) {
        putBody.sha = currentSha;
      }

      const putResp = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      });

      if (!putResp.ok) {
        if (putResp.status === 409 && retries > 0) {
          // Conflito de SHA (concorrência): repete após breve pausa
          console.warn('[GitHubSync] Conflito de SHA detectado, re-sincronizando...');
          await new Promise(r => setTimeout(r, 800));
          return this.commitOccurrence(feature, retries - 1);
        }
        const err = await putResp.json().catch(() => ({}));
        throw new Error(err.message || `Erro no commit: HTTP ${putResp.status}`);
      }

      const putData = await putResp.json();
      
      // Remove da fila pendente se existia lá
      await window.offlineStore.removePendingSync(feature.id);

      return {
        success: true,
        offline: false,
        commitSha: putData.commit ? putData.commit.sha.substring(0, 7) : 'ok',
        commitUrl: putData.commit ? putData.commit.html_url : null
      };

    } catch (err) {
      console.error('[GitHubSync] Erro no commit:', err);
      // Salva na fila pendente para quando a conexão estiver estável
      await window.offlineStore.addPendingSync(feature);
      return {
        success: false,
        offline: true,
        message: `Falha na transmissão (${err.message}). Ocorrência enfileirada no dispositivo para reenvio.`
      };
    }
  }

  // Sincroniza em lote todos os itens pendentes acumulados em campo
  async syncPendingQueue() {
    if (!this.isConfigured || !navigator.onLine || this.isSyncing) {
      return { syncedCount: 0, pendingCount: 0 };
    }

    const pendingList = await window.offlineStore.getPendingSyncList();
    if (!pendingList || pendingList.length === 0) {
      return { syncedCount: 0, pendingCount: 0 };
    }

    this.isSyncing = true;
    let synced = 0;

    try {
      // 1. Obter arquivo atual do repositório
      const getUrl = `https://api.github.com/repos/${this.repo}/contents/${this.filePath}?ref=${this.branch}&_t=${Date.now()}`;
      const getResp = await fetch(getUrl, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      let currentFc = {
        type: 'FeatureCollection',
        name: 'Ocorrências de Fiscalização - Esec Guanabara & APA Guapimirim',
        features: []
      };
      let currentSha = null;

      if (getResp.ok) {
        const fileData = await getResp.json();
        currentSha = fileData.sha;
        const decodedContent = this._b64DecodeUnicode(fileData.content.replace(/\n/g, ''));
        try {
          currentFc = JSON.parse(decodedContent);
          if (!Array.isArray(currentFc.features)) currentFc.features = [];
        } catch (e) {
          console.warn('[GitHubSync] Erro ao parsear:', e);
        }
      }

      // 2. Fazer merge de todos os pendentes
      for (const feat of pendingList) {
        const idx = currentFc.features.findIndex(f => f.id === feat.id || (f.properties && f.properties.id === feat.id));
        if (idx >= 0) {
          currentFc.features[idx] = feat;
        } else {
          currentFc.features.push(feat);
        }
      }

      // 3. Commit consolidado
      const commitMsg = `feat(fiscalizacao): sincronizacao em lote de ${pendingList.length} ocorrencia(s) de campo`;
      const jsonStr = JSON.stringify(currentFc, null, 2);
      const b64Content = this._b64EncodeUnicode(jsonStr);

      const putUrl = `https://api.github.com/repos/${this.repo}/contents/${this.filePath}`;
      const putBody = {
        message: commitMsg,
        content: b64Content,
        branch: this.branch
      };
      if (currentSha) putBody.sha = currentSha;

      const putResp = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      });

      if (putResp.ok) {
        for (const feat of pendingList) {
          await window.offlineStore.removePendingSync(feat.id);
        }
        synced = pendingList.length;
      }
    } catch (e) {
      console.error('[GitHubSync] Erro ao sincronizar lote:', e);
    } finally {
      this.isSyncing = false;
    }

    const remaining = (await window.offlineStore.getPendingSyncList()).length;
    return { syncedCount: synced, pendingCount: remaining };
  }

  // Utilitários de codificação Base64 com suporte total a UTF-8 / pt-BR
  _b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode('0x' + p1);
    }));
  }

  _b64DecodeUnicode(str) {
    return decodeURIComponent(atob(str).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }
}

window.gitHubSync = new GitHubSync();
