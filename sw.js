const APP_VERSION = '1.3';
const CACHE_NAME = `rettungsdienst-codes-v${APP_VERSION}`;
const APP_NAME = 'Rettungsdienst Codes RLP';

const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './einsatzcodes.json',
    './images/logo.png',
    './icons/icon-72x72.png',
    './icons/icon-96x96.png',
    './icons/icon-128x128.png',
    './icons/icon-144x144.png',
    './icons/icon-152x152.png',
    './icons/icon-192x192.png',
    './icons/icon-384x384.png',
    './icons/icon-512x512.png'
];

// Installation - Service Worker wird installiert
self.addEventListener('install', event => {
    console.log(`🔧 Service Worker installiert - Version ${APP_VERSION}`);

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Cache geöffnet:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('✅ Alle Dateien erfolgreich gecacht');
                // Nach erfolgreichem Caching Clients über Update informieren
                return self.clients.matchAll();
            })
            .then(clients => {
                if (clients.length > 0) {
                    console.log(`📢 Benachrichtige ${clients.length} Client(s) über Update`);
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'UPDATE_AVAILABLE',
                            version: APP_VERSION
                        });
                    });
                }
            })
            .catch(error => {
                console.error('❌ Fehler beim Cachen der Dateien:', error);
            })
    );

    // Sofort neue Version aktivieren
    self.skipWaiting();
});

// Aktivierung - Service Worker wird aktiviert
self.addEventListener('activate', event => {
    console.log(`🚀 Service Worker aktiviert - Version ${APP_VERSION}`);

    event.waitUntil(
        Promise.all([
            // Alte Caches löschen
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName.startsWith('rettungsdienst-codes-v') && cacheName !== CACHE_NAME) {
                            console.log('🗑️ Lösche alten Cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Sofort Kontrolle über alle Clients übernehmen
            self.clients.claim()
        ])
    );
});

// Fetch Events - Requests abfangen und aus Cache bedienen
self.addEventListener('fetch', event => {
    // Nur GET-Requests verarbeiten
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);
    const isNavigationRequest = event.request.mode === 'navigate';
    const isHTMLRequest = event.request.destination === 'document' ||
        url.pathname.endsWith('.html') ||
        url.pathname === '/' ||
        url.pathname.endsWith('/');

    // Navigation Requests (HTML Seiten)
    if (isNavigationRequest || isHTMLRequest) {
        event.respondWith(
            // Zuerst versuchen aus Netzwerk zu laden
            fetch(event.request)
                .then(response => {
                    // Bei erfolgreichem Netzwerk-Request, Response cachen
                    if (response && response.status === 200 && response.type === 'basic') {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Bei Netzwerk-Fehler aus Cache bedienen
                    return caches.match(event.request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                console.log('📱 Offline: Bediene aus Cache:', event.request.url);
                                return cachedResponse;
                            }
                            // Fallback für Navigation Requests
                            if (isNavigationRequest) {
                                return caches.match('./index.html');
                            }
                            // Wenn nichts im Cache, Fehler werfen
                            throw new Error('Keine Cache-Antwort verfügbar');
                        });
                })
        );
    }
    // Alle anderen Requests (CSS, JS, Bilder, etc.)
    else {
        event.respondWith(
            // Zuerst aus Cache versuchen (Cache First Strategy)
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        // Cache-Hit: Response zurückgeben, aber trotzdem im Hintergrund updaten
                        fetch(event.request).then(response => {
                            if (response && response.status === 200 && response.type === 'basic') {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(event.request, responseClone);
                                });
                            }
                        }).catch(() => {
                            // Netzwerk-Fehler ignorieren wenn wir Cache haben
                        });

                        return cachedResponse;
                    }

                    // Kein Cache-Hit: Aus Netzwerk laden
                    return fetch(event.request).then(response => {
                        // Erfolgreiche Response cachen
                        if (response && response.status === 200 && response.type === 'basic') {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return response;
                    });
                })
                .catch(error => {
                    console.error('❌ Fetch Fehler:', event.request.url, error);
                    // Bei kritischen Dateien (JS/CSS) einen Fallback bereitstellen
                    if (event.request.url.includes('.css')) {
                        return new Response('/* Offline - CSS nicht verfügbar */', {
                            headers: { 'Content-Type': 'text/css' }
                        });
                    }
                    if (event.request.url.includes('.js')) {
                        return new Response('console.log("Offline - JS nicht verfügbar");', {
                            headers: { 'Content-Type': 'application/javascript' }
                        });
                    }
                    throw error;
                })
        );
    }
});

// Message Handler - Nachrichten von der App empfangen
self.addEventListener('message', event => {
    const message = event.data;

    if (!message) return;

    console.log('📬 Service Worker Message empfangen:', message.type);

    switch (message.type) {
        case 'SKIP_WAITING':
            // Sofort neue Version aktivieren
            self.skipWaiting();
            break;

        case 'GET_VERSION':
            // Version-Informationen zurücksenden
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
            // Cache löschen auf Anfrage
            event.waitUntil(
                caches.delete(CACHE_NAME).then((success) => {
                    console.log('🗑️ Cache gelöscht auf Benutzeranfrage:', success);
                    if (event.ports && event.ports[0]) {
                        event.ports[0].postMessage({
                            type: 'CACHE_CLEARED',
                            success: success
                        });
                    }
                })
            );
            break;

        case 'CACHE_STATUS':
            // Cache-Status abfragen
            event.waitUntil(
                caches.open(CACHE_NAME).then(cache => {
                    return cache.keys();
                }).then(requests => {
                    if (event.ports && event.ports[0]) {
                        event.ports[0].postMessage({
                            type: 'CACHE_STATUS_RESPONSE',
                            cacheSize: requests.length,
                            cacheName: CACHE_NAME
                        });
                    }
                })
            );
            break;
    }
});

// Push Notifications - für zukünftige Erweiterungen
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
    console.log('🔔 Notification Click:', event.action);
    event.notification.close();

    if (event.action === 'open' || !event.action) {
        // App öffnen oder fokussieren
        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            }).then(clientList => {
                // Prüfen ob App bereits offen ist
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // App nicht offen - neue Instanz öffnen
                if (clients.openWindow) {
                    return clients.openWindow('./');
                }
            })
        );
    }
});

// Background Sync - für Offline-Synchronisation
self.addEventListener('sync', event => {
    console.log('🔄 Background Sync Event:', event.tag);

    if (event.tag === 'background-sync') {
        event.waitUntil(
            Promise.resolve().then(() => {
                console.log('✅ Background Sync ausgeführt');
                // Optional: Benachrichtigung über erfolgreiche Synchronisation
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
    console.error('❌ Service Worker Error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('❌ Service Worker Unhandled Promise Rejection:', event.reason);
});

// Periodische Background Sync registrieren (falls unterstützt)
self.addEventListener('periodicsync', event => {
    if (event.tag === 'background-sync') {
        event.waitUntil(
            // Hier könnten Sie periodische Updates implementieren
            console.log('🔄 Periodic Background Sync ausgeführt')
        );
    }
});

// Service Worker Update Event
self.addEventListener('updatefound', () => {
    console.log('🔄 Service Worker Update gefunden');
});

// Startup-Log
console.log(`🚀 ${APP_NAME} Service Worker geladen - Version ${APP_VERSION}`);
console.log(`📦 Cache Name: ${CACHE_NAME}`);
console.log(`📂 Zu cachende URLs: ${urlsToCache.length}`);
console.log('🎯 Service Worker bereit für Requests');