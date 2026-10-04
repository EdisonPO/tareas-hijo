// Nombre de la caché. Si cambias esta versión, se crea una caché nueva
const CACHE = "tareas-v4";

// Archivos que se guardan para que la app abra más rápido
const ARCHIVOS = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./analizador.js",
    "./manifest.json",
    "./iconos/android-chrome-192x192.png",
    "./iconos/android-chrome-512x512.png"
];

// 1. Instalación: guardar los archivos en la caché
self.addEventListener("install", function (e) {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(ARCHIVOS))
    );
    self.skipWaiting();
});

// 2. Activación: borrar cachés de versiones anteriores
self.addEventListener("activate", function (e) {
    e.waitUntil(
        caches.keys().then(nombres =>
            Promise.all(
                nombres
                    .filter(nombre => nombre !== CACHE)
                    .map(nombre => caches.delete(nombre))
            )
        )
    );
    self.clients.claim();
});

// 3. Peticiones: solo manejar las de nuestro propio sitio
self.addEventListener("fetch", function (e) {
    const esDeOtroSitio = new URL(e.request.url).origin !== self.location.origin;

    // Firebase, Google y otros sitios pasan directo a internet
    if (e.request.method !== "GET" || esDeOtroSitio) {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then(function (respuesta) {
                const copia = respuesta.clone();
                caches.open(CACHE).then(cache => cache.put(e.request, copia));
                return respuesta;
            })
            .catch(function () {
                return caches.match(e.request);
            })
    );
});

// 4. Al tocar una notificación: abrir la app o traerla al frente
self.addEventListener("notificationclick", function (e) {
    e.notification.close();

    e.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (ventanas) {
            if (ventanas.length > 0) {
                return ventanas[0].focus();
            }
            return clients.openWindow("./");
        })
    );
});