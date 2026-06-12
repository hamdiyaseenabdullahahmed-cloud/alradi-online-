// ==================== Service Worker – الرعدي أونلاين ====================
const CACHE_NAME = 'alradi-store-v10';
const DYNAMIC_CACHE = 'alradi-dynamic-v10';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/admin',
    '/uploads/logo/falcon-logo.png',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'
];

// ==================== تثبيت Service Worker ====================
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: تثبيت...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 تخزين الملفات الأساسية');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('✅ Service Worker: تم التثبيت');
                return self.skipWaiting();
            })
    );
});

// ==================== تفعيل Service Worker ====================
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker: تفعيل...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== DYNAMIC_CACHE)
                    .map((name) => {
                        console.log('🗑️ حذف الكاش القديم:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('✅ Service Worker: تم التفعيل');
            return self.clients.claim();
        })
    );
});

// ==================== استراتيجية: Network First مع Cache Fallback ====================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // تجاهل طلبات API (لا تخزن في الكاش)
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
        return;
    }

    // استراتيجية Network First
    event.respondWith(
        fetch(request)
            .then((response) => {
                const responseClone = response.clone();
                caches.open(DYNAMIC_CACHE).then((cache) => {
                    cache.put(request, responseClone);
                });
                return response;
            })
            .catch(() => {
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    if (request.headers.get('accept')?.includes('text/html')) {
                        return caches.match('/');
                    }
                    return new Response('غير متصل بالإنترنت', { status: 503 });
                });
            })
    );
});

// ==================== إشعارات Push ====================
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    const options = {
        body: data.body || 'هناك تحديث جديد في متجر الرعدي أونلاين',
        icon: '/uploads/logo/falcon-logo.png',
        badge: '/uploads/logo/falcon-logo.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(
            data.title || '🦅 الرعدي أونلاين',
            options
        )
    );
});

// ==================== النقر على الإشعار ====================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
        })
    );
});

// ==================== مزامنة الخلفية ====================
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-cart') {
        event.waitUntil(syncCartData());
    } else if (event.tag === 'sync-orders') {
        event.waitUntil(syncOrderData());
    }
});

async function syncCartData() {
    console.log('🔄 مزامنة السلة...');
}

async function syncOrderData() {
    console.log('🔄 مزامنة الطلبات...');
}

console.log('🦅 Service Worker – الرعدي أونلاين جاهز');
