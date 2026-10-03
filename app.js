// ===== Configuración inicial =====

// Año automático en el footer
document.getElementById("anio").textContent = new Date().getFullYear();

// Cargar las tareas guardadas, o empezar con un arreglo vacío si no hay nada
let tareas = JSON.parse(localStorage.getItem("tareas")) || [];

// Filtro elegido actualmente: "todas", "pendientes" o "realizadas"
let filtroActual = "todas";

// Elementos del HTML que vamos a usar
const formulario = document.getElementById("form-tarea");
const listaTareas = document.getElementById("lista-tareas");
const botonesFiltro = document.querySelectorAll("nav button");
const btnNueva = document.getElementById("btn-nueva");
const btnCancelar = document.getElementById("btn-cancelar");
const btnNotificaciones = document.getElementById("btn-notificaciones");
const estadoNotificaciones = document.getElementById("estado-notificaciones");

// "Traductores": del value guardado al nombre que se muestra
const nombresMaterias = {
    matematicas: "Matemáticas",
    lengua: "Lengua",
    ciencias: "Ciencias",
    ingles: "Inglés",
    otra: "Otra"
};

const nombresTipos = {
    deber: "📘 Deber",
    comprar: "🛒 Comprar",
    evento: "📅 Evento"
};


// ===== Eventos =====

// Cuando se envía el formulario
formulario.addEventListener("submit", function (e) {
    e.preventDefault();

    const tarea = {
        id: Date.now(),
        descripcion: document.getElementById("descripcion").value,
        materia: document.getElementById("materia").value,
        tipo: document.getElementById("tipo").value,
        fecha: document.getElementById("fecha").value,
        realizada: false
    };

    tareas.push(tarea);
    guardarTareas();
    mostrarTareas();
    cerrarFormulario();
});

// Botones para mostrar u ocultar el formulario
btnNueva.addEventListener("click", abrirFormulario);
btnCancelar.addEventListener("click", cerrarFormulario);

// Botones de filtro del nav
botonesFiltro.forEach(function (boton) {
    boton.addEventListener("click", function () {
        filtroActual = boton.dataset.filtro;
        botonesFiltro.forEach(b => b.classList.remove("activo"));
        boton.classList.add("activo");
        mostrarTareas();
    });
});

// Botón de recordatorios: pedir permiso y mostrar una notificación de prueba
btnNotificaciones.addEventListener("click", async function () {
    await Notification.requestPermission();
    actualizarBotonNotificaciones();
    revisarRecordatorios(true);
});


// ===== Funciones de ayuda =====

// Guarda el arreglo completo en localStorage
function guardarTareas() {
    localStorage.setItem("tareas", JSON.stringify(tareas));
}

// Devuelve una fecha en formato "aaaa-mm-dd"
// obtenerHoy() = hoy, obtenerHoy(1) = mañana
function obtenerHoy(diasExtra = 0) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + diasExtra);
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

// Convierte "2026-10-06" en "06/10/2026"
function formatearFecha(fecha) {
    const [anio, mes, dia] = fecha.split("-");
    return `${dia}/${mes}/${anio}`;
}

// Crea una etiqueta pequeña (<span>) con un texto y una clase de estilo
function crearEtiqueta(texto, clase) {
    const span = document.createElement("span");
    span.classList.add("etiqueta", clase);
    span.textContent = texto;
    return span;
}


// ===== Formulario =====

// Muestra el formulario y esconde el botón "+ Nueva tarea"
function abrirFormulario() {
    formulario.classList.remove("oculto");
    btnNueva.classList.add("oculto");
    document.getElementById("descripcion").focus();
}

// Limpia y esconde el formulario, y vuelve a mostrar el botón
function cerrarFormulario() {
    formulario.reset();
    formulario.classList.add("oculto");
    btnNueva.classList.remove("oculto");
}


// ===== Acciones sobre las tareas =====

// Cambia una tarea de pendiente a realizada, o al revés
function cambiarEstado(id) {
    const tarea = tareas.find(t => t.id === id);
    tarea.realizada = !tarea.realizada;
    guardarTareas();
    mostrarTareas();
}

// Elimina una tarea después de pedir confirmación
function eliminarTarea(id) {
    if (!confirm("¿Seguro que quieres eliminar esta tarea?")) {
        return;
    }
    tareas = tareas.filter(t => t.id !== id);
    guardarTareas();
    mostrarTareas();
}


// ===== Dibujar en la página =====

// Actualiza los números y la lista de compras del aside
function actualizarResumen() {
    const hoy = obtenerHoy();

    const total = tareas.length;
    const pendientes = tareas.filter(t => !t.realizada).length;
    const realizadas = tareas.filter(t => t.realizada).length;
    const atrasadas = tareas.filter(t => !t.realizada && t.fecha < hoy).length;
    const comprasPendientes = tareas.filter(t => !t.realizada && t.tipo === "comprar");

    document.getElementById("total-tareas").textContent = total;
    document.getElementById("tareas-pendientes").textContent = pendientes;
    document.getElementById("tareas-realizadas").textContent = realizadas;
    document.getElementById("tareas-atrasadas").textContent = atrasadas;
    document.getElementById("pendiente-comprar").textContent = comprasPendientes.length;

    const listaCompras = document.getElementById("lista-compras");
    listaCompras.innerHTML = "";

    comprasPendientes.forEach(t => {
        const li = document.createElement("li");
        li.textContent = `${t.descripcion} (para el ${formatearFecha(t.fecha)})`;
        listaCompras.appendChild(li);
    });
}

// Dibuja las tareas dentro de <ul id="lista-tareas"> según el filtro
function mostrarTareas() {
    listaTareas.innerHTML = "";

    const hoy = obtenerHoy();
    const manana = obtenerHoy(1);

    // Elegir qué tareas mostrar según el filtro
    let tareasVisibles = tareas;

    if (filtroActual === "pendientes") {
        tareasVisibles = tareas.filter(t => !t.realizada);
    } else if (filtroActual === "realizadas") {
        tareasVisibles = tareas.filter(t => t.realizada);
    }

    // Ordenar: primero las pendientes, y dentro de cada grupo por fecha más cercana
    tareasVisibles = [...tareasVisibles].sort(function (a, b) {
        if (a.realizada !== b.realizada) {
            return a.realizada ? 1 : -1;
        }
        return a.fecha.localeCompare(b.fecha);
    });

    // Si no hay tareas que mostrar, poner un mensaje
    if (tareasVisibles.length === 0) {
        const vacio = document.createElement("li");
        vacio.classList.add("vacio");
        vacio.textContent = "No hay tareas aquí 🎉";
        listaTareas.appendChild(vacio);
    }

    tareasVisibles.forEach(function (tarea) {
        const li = document.createElement("li");

        li.classList.add(`tipo-${tarea.tipo}`);
        if (tarea.realizada) {
            li.classList.add("realizada");
        }

        // Casilla para marcar como realizada
        const casilla = document.createElement("input");
        casilla.type = "checkbox";
        casilla.checked = tarea.realizada;
        casilla.addEventListener("change", function () {
            cambiarEstado(tarea.id);
        });

        // Contenedor de la información
        const info = document.createElement("div");
        info.classList.add("info");

        const descripcion = document.createElement("p");
        descripcion.classList.add("descripcion");
        descripcion.textContent = tarea.descripcion;

        const etiquetas = document.createElement("div");
        etiquetas.classList.add("etiquetas");

        etiquetas.append(
            crearEtiqueta(nombresTipos[tarea.tipo] || tarea.tipo, "etiqueta-tipo"),
            crearEtiqueta(nombresMaterias[tarea.materia] || tarea.materia, "etiqueta-materia"),
            crearEtiqueta(`🗓️ ${formatearFecha(tarea.fecha)}`, "etiqueta-fecha")
        );

        // Alertas de urgencia, solo para tareas pendientes
        if (!tarea.realizada) {
            if (tarea.fecha < hoy) {
                etiquetas.append(crearEtiqueta("⚠️ Atrasada", "etiqueta-atrasada"));
            } else if (tarea.fecha === hoy) {
                etiquetas.append(crearEtiqueta("⏰ Es para hoy", "etiqueta-hoy"));
            } else if (tarea.fecha === manana) {
                etiquetas.append(crearEtiqueta("👀 Mañana", "etiqueta-manana"));
            }
        }

        info.append(descripcion, etiquetas);

        // Botón para eliminar
        const botonEliminar = document.createElement("button");
        botonEliminar.textContent = "Eliminar";
        botonEliminar.addEventListener("click", function () {
            eliminarTarea(tarea.id);
        });

        li.append(casilla, info, botonEliminar);
        listaTareas.appendChild(li);
    });

    actualizarResumen();
}


// ===== Recordatorios con notificaciones =====

// Muestra el botón o un mensaje según el permiso actual
function actualizarBotonNotificaciones() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        btnNotificaciones.classList.add("oculto");
        estadoNotificaciones.textContent = "Este navegador no permite notificaciones. En iPhone, primero instala la app en la pantalla de inicio.";
        return;
    }

    if (Notification.permission === "granted") {
        btnNotificaciones.classList.add("oculto");
        estadoNotificaciones.textContent = "🔔 Recordatorios activados";
    } else if (Notification.permission === "denied") {
        btnNotificaciones.classList.add("oculto");
        estadoNotificaciones.textContent = "Las notificaciones están bloqueadas. Actívalas desde el candado junto a la dirección de la página.";
    } else {
        btnNotificaciones.classList.remove("oculto");
        estadoNotificaciones.textContent = "";
    }
}

// Revisa las tareas urgentes y muestra una notificación (máximo una al día)
async function revisarRecordatorios(forzar = false) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
        return;
    }

    const hoy = obtenerHoy();

    if (!forzar && localStorage.getItem("ultimoAviso") === hoy) {
        return;
    }

    const manana = obtenerHoy(1);
    const pendientes = tareas.filter(t => !t.realizada);
    const atrasadas = pendientes.filter(t => t.fecha < hoy).length;
    const paraHoy = pendientes.filter(t => t.fecha === hoy).length;
    const paraManana = pendientes.filter(t => t.fecha === manana).length;

    const partes = [];
    if (atrasadas > 0) partes.push(`⚠️ ${atrasadas} atrasada(s)`);
    if (paraHoy > 0) partes.push(`⏰ ${paraHoy} para hoy`);
    if (paraManana > 0) partes.push(`👀 ${paraManana} para mañana`);

    let mensaje = partes.join(" · ");

    if (partes.length === 0) {
        if (!forzar) {
            return;
        }
        mensaje = "¡Todo al día! No hay tareas urgentes 🎉";
    }

    const registro = await navigator.serviceWorker.ready;
    registro.showNotification("📚 Tareas de mi hijo", {
        body: mensaje,
        icon: "iconos/android-chrome-192x192.png",
        badge: "iconos/android-chrome-192x192.png",
        tag: "resumen-diario"
    });

    localStorage.setItem("ultimoAviso", hoy);
}


// ===== Arranque de la app =====

// Dibujar las tareas guardadas
mostrarTareas();

// Registrar el service worker para que la página funcione como app
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js")
        .then(() => console.log("Service worker registrado"))
        .catch(error => console.log("Error al registrar el service worker:", error));
}

// Preparar recordatorios: al abrir la app, y luego cada hora mientras esté abierta
actualizarBotonNotificaciones();
revisarRecordatorios();
setInterval(revisarRecordatorios, 60 * 60 * 1000);