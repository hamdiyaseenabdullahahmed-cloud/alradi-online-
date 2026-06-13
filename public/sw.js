// ==================== Service Worker – الرعدي أونلاين ====================
const CACHE_NAME = 'alradi-ultimate-v13';
const STATIC_CACHE = 'alradi-static-v13';
const DYNAMIC_CACHE = 'alradi-dynamic-v13';

// الملفات الأساسية للتخزين المؤقت
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/admin',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
    console.log('🔧 Service Worker: جاري التثبيت...');
    event.waitUntil(
        caches.open(STATIC_CACHE).then(cache => {
            console.log('📦 تخزين الملفات الأساسية');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
    console.log('🔄 Service Worker: جاري التفعيل...');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// استراتيجية Network First مع Cache Fallback
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // تجاهل طلبات API و WebSocket
    if (url.pathname.startsWith('/api/') || 
        url.pathname.startsWith('/socket.io/') ||
        url.pathname.includes('googleapis')) {
        return;
    }
    
    // استراتيجية Cache First للملفات الثابتة
    if (request.destination === 'style' || 
        request.destination === 'script' || 
        request.destination === 'font') {
        event.respondWith(
            caches.match(request).then(cached => {
                return cached || fetch(request).then(response => {
                    const responseClone = response.clone();
                    caches.open(STATIC_CACHE).then(cache => {
                        cache.put(request, responseClone);
                    });
                    return response;
                });
            }).catch(() => {
                return new Response('⚠️ غير متصل بالإنترنت', { status: 503 });
            })
        );
        return;
    }
    
    // استراتيجية Network First للصفحات والصور
    event.respondWith(
        fetch(request).then(response => {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(request, responseClone);
            });
            return response;
        }).catch(() => {
            return caches.match(request).then(cached => {
                if (cached) return cached;
                if (request.destination === 'document') {
                    return caches.match('/');
                }
                return new Response('⚠️ غير متصل بالإنترنت', { status: 503 });
            });
        })
    );
});

// إشعارات Push
self.addEventListener('push', event => {
    const data = event.data?.json() || {};
    const options = {
        body: data.body || 'هناك تحديث جديد في متجر الرعدي أونلاين',
        icon: '/uploads/logo/falcon-logo.png',
        badge: '/uploads/logo/falcon-logo.png',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/' }
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || '🦅 الرعدي أونلاين', options)
    );
});

// النقر على الإشعار
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then(clientList => {
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

console.log('🦅 Service Worker – الرعدي أونلاين جاهز للعمل');
