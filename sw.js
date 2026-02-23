const APP_VERSION = '1.0';
const CACHE_NAME = `rettungsdienst-codes-v${APP_VERSION}`;
const APP_NAME = 'Rettungsdienst Codes RLP';

const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icons/icon-72x72.png',
    './icons/icon-96x96.png',
    './icons/icon-128x128.png',
    './icons/icon-144x144.png',
    './icons/icon-152x152.png',
    './icons/icon-192x192.png',
    './icons/icon-384x384.png',
    './icons/icon-512x512.png'
];

// Installation
self.addEventListener('install', event => {
    console.log(`Service Worker installiert - Version ${APP_VERSION}`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache geöffnet:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Fehler beim Cachen der Dateien:', error);
            })
    );
    self.skipWaiting();
});

// Aktivierung
self.addEventListener('activate', event => {
    console.log(`Service Worker aktiviert - Version ${APP_VERSION}`);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName.startsWith('rettungsdienst-codes-v') && cacheName !== CACHE_NAME) {
                        console.log('Lösche alten Cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Fetch Events
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);
    const isNavigationRequest = event.request.mode === 'navigate';
    const isHTMLRequest = event.request.destination === 'document' || 
                         url.pathname.endsWith('.html') || 
                         url.pathname === '/' ||
                         url.pathname.endsWith('/');

    if (isNavigationRequest || isHTMLRequest) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            if (isNavigationRequest) {
                                return caches.match('./index.html');
                            }
                            throw new Error('Keine Cache-Antwort verfügbar');
                        });
                })
        );
    } else {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    return fetch(event.request).then(response => {
                        if (response && response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return response;
                    });
                })
        );
    }
});

// Message Handler
self.addEventListener('message', event => {
    const message = event.data;
    
    if (!message) return;

    switch (message.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({
                    type: 'VERSION_INFO',
                    version: APP_VERSION,
                    cacheVersion: CACHE_NAME,
                    appName: APP_NAME
                });
            }
            break;
            
        case 'CLEAR_CACHE':
            event.waitUntil(
                caches.delete(CACHE_NAME).then(() => {
                    console.log('Cache gelöscht auf Benutzeranfrage');
                    if (event.ports && event.ports[0]) {
                        event.ports[0].postMessage({
                            type: 'CACHE_CLEARED',
                            success: true
                        });
                    }
                })
            );
            break;
    }
});

// Push Notifications
self.addEventListener('push', event => {
    let notificationData = {
        title: APP_NAME,
        body: 'Neue Einsatzinformationen verfügbar',
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-96x96.png'
    };

    if (event.data) {
        try {
            const pushData = event.data.json();
            notificationData = {
                ...notificationData,
                ...pushData
            };
        } catch (e) {
            notificationData.body = event.data.text() || notificationData.body;
        }
    }

    const options = {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        vibrate: [200, 100, 200],
        tag: 'rettungsdienst-update',
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1,
            type: 'update',
            url: './'
        },
        actions: [
            {
                action: 'open',
                title: 'App öffnen',
                icon: './icons/icon-96x96.png'
            },
            {
                action: 'close',
                title: 'Schließen',
                icon: './icons/icon-96x96.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(notificationData.title, options)
    );
});

// Notification Click Handler
self.addEventListener('notificationclick', event => {
    console.log('Notification Click:', event.action);
    event.notification.close();

    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            }).then(clientList => {
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('./');
                }
            })
        );
    }
});

// Background Sync für Offline-Funktionalität
self.addEventListener('sync', event => {
    console.log('Background Sync Event:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(
            Promise.resolve().then(() => {
                console.log('Background Sync ausgeführt');
                return self.registration.showNotification(`${APP_NAME} - Sync`, {
                    body: 'Daten wurden synchronisiert',
                    icon: './icons/icon-192x192.png',
                    badge: './icons/icon-96x96.png',
                    tag: 'sync-notification'
                });
            })
        );
    }
});

// Error Handler
self.addEventListener('error', event => {
    console.error('Service Worker Error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('Service Worker Unhandled Promise Rejection:', event.reason);
});

console.log(`${APP_NAME} Service Worker geladen - Version ${APP_VERSION}`);
console.log('Cache Name:', CACHE_NAME);
console.log('Zu cachende URLs:', urlsToCache.length);