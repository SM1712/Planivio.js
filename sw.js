const CACHE_NAME = 'planivio-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles/main.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/utilities.css',
  './styles/pages/dashboard.css',
  './styles/pages/tareas.css',
  './styles/pages/calendario.css',
  './styles/pages/cursos.css',
  './styles/pages/apuntes.css',
  './styles/pages/proyectos.css',
  './styles/pages/grupos.css',
  './src/main.js',
  './src/state.js',
  './src/ui.js',
  './src/utils.js',
  './src/firebase.js',
  './src/notifications.js',
  './src/eventBus.js',
  './src/icons.js',
  './src/pages/dashboard.js',
  './src/pages/tareas.js',
  './src/pages/cursos.js',
  './src/pages/calendario.js',
  './src/pages/apuntes.js',
  './src/pages/proyectos.js',
  './src/pages/grupos.js',
  './src/pages/pulsos.js',
  './src/views/dashboard.html',
  './src/views/tareas.html',
  './src/views/calendario.html',
  './src/views/cursos.html',
  './src/views/apuntes.html',
  './src/views/proyectos.html',
  './src/views/grupos.html',
  './assets/pulsito-icon.png',
  './assets/notification.mp3',
  './Planivio.ico'
];

// Instalar Service Worker y cachear recursos estáticos
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activar Service Worker y limpiar caches antiguos
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activando...');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando cache antiguo:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar peticiones de red
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET o que sean a esquemas no soportados (ej. chrome-extension)
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Estrategia: Cache First, falling back to Network
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response; // Retornar desde cache
      }
      return fetch(event.request).then((networkResponse) => {
        // Opcional: Cachear dinámicamente nuevas peticiones (con cuidado)
        // Por ahora solo retornamos la respuesta de red
        return networkResponse;
      });
    })
  );
});

// --- Notificaciones Push (Existente) ---
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  console.log(`[Service Worker] Push had this data: "${event.data ? event.data.text() : 'no data'}"`);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Planivio', body: event.data.text() };
    }
  } else {
    data = { title: 'Planivio', body: 'Tienes una nueva notificación.' };
  }

  const title = data.title || 'Planivio';
  const options = {
    body: data.body || 'Tienes una nueva notificación.',
    icon: 'assets/pulsito-icon.png',
    badge: 'assets/pulsito-icon.png',
    data: data.url || '/'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.');

  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});
