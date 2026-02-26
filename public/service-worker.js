// public/service-worker.js — Service Worker para PWA
// Cache-first strategy para assets, network-first para API

const CACHE_NAME = 'pulsoelectoral-v2.3';
const STATIC_ASSETS = [
  '/',
  '/login',
  '/encuesta',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Instalación: Precachear recursos estáticos críticos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] Precache failed:', err))
  );
});

// Activación: Limpiar caches antiguas
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Estrategia de cache según tipo de request
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // No interceptar requests de Supabase ni APIs externas
  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('googleapis.com')) {
    return;
  }
  
  // No interceptar requests POST/PUT/DELETE
  if (request.method !== 'GET') {
    return;
  }
  
  // Estrategia: Cache-first para assets estáticos
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Refrescar cache en background
          fetch(request)
            .then((response) => {
              if (response.ok) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, response);
                });
              }
            })
            .catch(() => {});
          return cached;
        }
        
        return fetchAndCache(request);
      })
    );
    return;
  }
  
  // Estrategia: Network-first para páginas (con fallback offline)
  if (isPage(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match('/offline');
          });
        })
    );
    return;
  }
  
  // Default: Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetchAndCache(request);
      return cached || fetchPromise;
    })
  );
});

// Helpers
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some((ext) => url.pathname.endsWith(ext));
}

function isPage(request) {
  return request.mode === 'navigate' || 
         request.headers.get('accept')?.includes('text/html');
}

async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, clone);
      });
    }
    return response;
  } catch (error) {
    console.warn('[SW] Fetch failed:', error);
    throw error;
  }
}

// Background sync para encuestas offline
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-encuestas') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncEncuestas());
  }
});

async function syncEncuestas() {
  console.log('[SW] Sync placeholder - delegado a React');
}

// Push notifications (placeholder para futura implementación)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    self.registration.showNotification(data.title || 'PulsoElectoral', {
      body: data.body || 'Nueva alerta de campaña',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data.url || '/',
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

console.log('[SW] Loaded v2.3');
