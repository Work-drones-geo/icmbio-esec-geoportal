const CACHE_NAME = 'icmbio-geoportal-v1.3';
const TILE_CACHE_NAME = 'icmbio-tiles-cache-v1.3';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/map.js',
  './js/sentinel.js',
  './js/occurrences.js',
  './js/github-sync.js',
  './js/offline-store.js',
  './data/esec_guanabara.geojson',
  './data/apa_guapimirim.geojson',
  './data/sentinel_catalog.json',
  './data/ocorrencias.geojson',
  './lib/leaflet/leaflet.js',
  './lib/leaflet/leaflet.css',
  './lib/leaflet/images/marker-icon.png',
  './lib/leaflet/images/marker-icon-2x.png',
  './lib/leaflet/images/marker-shadow.png',
  './assets/logo_workdrones.svg',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// 1. Instalação: Cache do App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pré-carregando App Shell para uso offline');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== TILE_CACHE_NAME) {
            console.log('[ServiceWorker] Removendo cache legado:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Interceptação de Requisições (Fetch)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não interceptar requisições para a API do GitHub (commits, SHA)
  if (url.hostname.includes('api.github.com')) {
    return;
  }

  // Requisições para tiles de mapa ou serviços externos de imagem
  const isTileRequest = url.pathname.includes('/tile/') ||
                        url.pathname.includes('/tiles/') ||
                        url.hostname.includes('arcgisonline.com') ||
                        url.hostname.includes('google.com') ||
                        url.hostname.includes('openstreetmap.org') ||
                        url.hostname.includes('tile.') ||
                        url.hostname.includes('cartocdn.com') ||
                        url.hostname.includes('planetarycomputer.microsoft.com');

  if (isTileRequest) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (tileCache) => {
        const cachedResponse = await tileCache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            tileCache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Se offline e não tem no cache, retorna imagem vazia/fallback
          return cachedResponse || new Response('', { status: 408, statusText: 'Offline Tile' });
        }
      })
    );
    return;
  }

  // Para arquivos locais (App Shell): Estratégia Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => {
        // Se a rede falhar, o cache já servirá
      });

      return cachedResponse || fetchPromise;
    })
  );
});
