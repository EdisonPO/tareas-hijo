// Nombre de la caché. Si cambias esta versión, se crea una caché nueva
const CACHE = "tareas-v12";

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

// 4. Llega una notificación desde el servidor (aunque la app esté cerrada)
self.addEventListener("push", function (e) {
    let carga = {};

    try {
        carga = e.data ? e.data.json() : {};
    } catch (error) {
        carga = {};
    }

    // Apps Script envía los datos en "data"; por si acaso, también se acepta "notification"
    const info = carga.data || carga.notification || {};

    const titulo = info.titulo || info.title || "📚 Tareas al Día";
    const opciones = {
        body: info.cuerpo || info.body || "Tienes tareas pendientes",
        icon: "iconos/android-chrome-192x192.png",
        badge: "iconos/android-chrome-192x192.png",
        tag: info.etiqueta || "tareas-al-dia",
        renotify: true,
        data: { enlace: info.enlace || "./" }
    };

    e.waitUntil(self.registration.showNotification(titulo, opciones));
});

// 5. Al tocar una notificación: abrir la app o traerla al frente
self.addEventListener("notificationclick", function (e) {
    e.notification.close();

    const enlace = (e.notification.data && e.notification.data.enlace) || "./";

    e.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (ventanas) {
            if (ventanas.length > 0) {
                return ventanas[0].focus();
            }
            return clients.openWindow(enlace);
        })
    );
});