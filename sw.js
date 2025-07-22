// === SERVICE WORKER PARA PWA CONTROLE FINANCEIRO ===
// Versão 2.1.0

const CACHE_NAME = 'cf-pwa-v2.1.0';
const STATIC_CACHE = 'cf-static-v2.1.0';
const DYNAMIC_CACHE = 'cf-dynamic-v2.1.0';

// Recursos para cache offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://i.ibb.co/vx4BtbSv/Sem-t-tulo-1.png',
  'https://i.ibb.co/kj8jVkq/Logotipo-Faustino-Representa-es-e-Vendas-Moderno-Preto-Branco-2.png'
];

// URLs que sempre precisam de rede
const NETWORK_FIRST_URLS = [
  'https://script.google.com/macros/s/AKfycbyCTfJwf15QR4HBDQI05nWoqimuqNsK2dOs1BoxoFcJ15JQYLSz248SCdCI_zhbfoMGKg/exec'
];

// === INSTALAÇÃO DO SERVICE WORKER ===
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando...');
  
  event.waitUntil(
    Promise.all([
      // Cache dos recursos estáticos
      caches.open(STATIC_CACHE).then(cache => {
        console.log('📦 Cacheando recursos estáticos...');
        return cache.addAll(STATIC_ASSETS);
      }),
      
      // Pular waiting para ativar imediatamente
      self.skipWaiting()
    ])
  );
});

// === ATIVAÇÃO DO SERVICE WORKER ===
self.addEventListener('activate', event => {
  console.log('✅ Service Worker: Ativando...');
  
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== CACHE_NAME) {
              console.log('🗑️ Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Assumir controle de todas as abas
      self.clients.claim()
    ])
  );
});

// === INTERCEPTAÇÃO DE REQUESTS ===
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requests não HTTP
  if (!request.url.startsWith('http')) {
    return;
  }

  // Estratégia baseada no tipo de recurso
  if (isStaticAsset(request.url)) {
    // Cache-first para recursos estáticos
    event.respondWith(cacheFirst(request));
  } else if (isNetworkFirstUrl(request.url)) {
    // Network-first para APIs e conteúdo dinâmico
    event.respondWith(networkFirst(request));
  } else if (request.destination === 'document') {
    // Stale-while-revalidate para páginas HTML
    event.respondWith(staleWhileRevalidate(request));
  } else {
    // Cache-first padrão para outros recursos
    event.respondWith(cacheFirst(request));
  }
});

// === ESTRATÉGIAS DE CACHE ===

// Cache-first: Tenta cache primeiro, depois rede
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    // Cachear apenas respostas válidas
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('❌ Cache-first falhou:', error);
    return await getOfflineFallback(request);
  }
}

// Network-first: Tenta rede primeiro, cache como fallback
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cachear resposta da rede
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('🌐 Network-first: Tentando cache...', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return await getOfflineFallback(request);
  }
}

// Stale-while-revalidate: Retorna cache e atualiza em background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Atualizar cache em background
  const networkResponsePromise = fetch(request).then(response => {
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cachedResponse);
  
  // Retornar cache imediatamente se disponível
  return cachedResponse || networkResponsePromise;
}

// === FUNÇÕES AUXILIARES ===

function isStaticAsset(url) {
  return STATIC_ASSETS.some(asset => url.includes(asset)) ||
         url.includes('.png') ||
         url.includes('.jpg') ||
         url.includes('.jpeg') ||
         url.includes('.svg') ||
         url.includes('.css') ||
         url.includes('.js');
}

function isNetworkFirstUrl(url) {
  return NETWORK_FIRST_URLS.some(networkUrl => url.includes(networkUrl));
}

// Fallback para quando está offline
async function getOfflineFallback(request) {
  if (request.destination === 'document') {
    // Retornar página principal em cache
    const cachedPage = await caches.match('/');
    if (cachedPage) {
      return cachedPage;
    }
  }
  
  // Resposta offline genérica
  return new Response(
    JSON.stringify({
      error: 'Você está offline',
      message: 'Esta funcionalidade requer conexão com a internet',
      offline: true
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
}

// === LIMPEZA AUTOMÁTICA DE CACHE ===
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => 
    name.startsWith('cf-') && 
    name !== STATIC_CACHE && 
    name !== DYNAMIC_CACHE
  );
  
  return Promise.all(oldCaches.map(name => caches.delete(name)));
}

// === NOTIFICAÇÕES PUSH (PREPARADO PARA FUTURO) ===
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Nova notificação do seu Controle Financeiro',
      icon: 'https://i.ibb.co/vx4BtbSv/Sem-t-tulo-1.png',
      badge: 'https://i.ibb.co/vx4BtbSv/Sem-t-tulo-1.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [
        {
          action: 'view',
          title: 'Ver Detalhes',
          icon: 'https://i.ibb.co/vx4BtbSv/Sem-t-tulo-1.png'
        },
        {
          action: 'dismiss',
          title: 'Dispensar'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'C.F - Controle Financeiro', options)
    );
  }
});

// Clique em notificação
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/?notification=true')
    );
  }
});

// === SYNC EM BACKGROUND (PREPARADO PARA FUTURO) ===
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Aqui você pode implementar sincronização de dados
      console.log('🔄 Background sync executado')
    );
  }
});

// === MENSAGENS DO APP PRINCIPAL ===
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME,
      static: STATIC_CACHE,
      dynamic: DYNAMIC_CACHE
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(DYNAMIC_CACHE),
        cleanupOldCaches()
      ]).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

// === TRATAMENTO DE ERROS ===
self.addEventListener('error', event => {
  console.error('❌ Service Worker Error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('❌ Service Worker Promise Rejection:', event.reason);
});

console.log('🚀 Service Worker v2.1.0 carregado com sucesso!');
