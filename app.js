// ===== Firebase: importar las herramientas que vamos a usar =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Configuración de tu proyecto de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCirGXSV2z2yrSq-nXqFjUuTho8kGdaG6Q",
    authDomain: "tarea-al-dia.firebaseapp.com",
    projectId: "tarea-al-dia",
    storageBucket: "tarea-al-dia.firebasestorage.app",
    messagingSenderId: "188725809954",
    appId: "1:188725809954:web:b6d16a4164c0e095d44b7b",
    measurementId: "G-EQXPP9NBB3"
};

// Conectar con Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
auth.languageCode = "es";

// Dónde viven los datos de la familia en Firestore
const FAMILIA_ID = "mi-familia";
const refFamilia = doc(db, "familias", FAMILIA_ID);
const refTareas = collection(db, "familias", FAMILIA_ID, "tareas");


// ===== Estado de la app =====
let tareas = [];
let familia = { miembros: [], hijos: [] };
let filtroActual = "todas";      // "todas", "pendientes" o "realizadas"
let filtroHijo = "todos";        // "todos" o el id de un hijo
let dejarDeEscucharTareas = null;
let dejarDeEscucharFamilia = null;
let modoRegistro = false;        // false = iniciar sesión, true = crear cuenta


// ===== Elementos del HTML =====
document.getElementById("anio").textContent = new Date().getFullYear();

// Inicio de sesión
const btnGoogle = document.getElementById("btn-google");
const formAcceso = document.getElementById("form-acceso");
const inputCorreo = document.getElementById("correo");
const inputClave = document.getElementById("clave");
const btnAcceso = document.getElementById("btn-acceso");
const btnCambiarModo = document.getElementById("btn-cambiar-modo");
const btnOlvide = document.getElementById("btn-olvide");
const panelAcceso = document.getElementById("panel-acceso");
const panelMensaje = document.getElementById("panel-mensaje");
const mensajeTitulo = document.getElementById("mensaje-titulo");
const mensajeTexto = document.getElementById("mensaje-texto");
const btnReintentar = document.getElementById("btn-reintentar");
const btnSalirMensaje = document.getElementById("btn-salir-mensaje");
const avisoLogin = document.getElementById("aviso-login");
const nombreUsuario = document.getElementById("nombre-usuario");
const btnSalir = document.getElementById("btn-salir");

// Tareas
const formulario = document.getElementById("form-tarea");
const listaTareas = document.getElementById("lista-tareas");
const botonesFiltro = document.querySelectorAll("[data-filtro]");
const filtroHijos = document.getElementById("filtro-hijos");
const selectHijo = document.getElementById("hijo");
const btnNueva = document.getElementById("btn-nueva");
const btnCancelar = document.getElementById("btn-cancelar");

// Mi familia
const btnFamilia = document.getElementById("btn-familia");
const dialogoFamilia = document.getElementById("dialogo-familia");
const btnCerrarFamilia = document.getElementById("btn-cerrar-familia");
const listaAdultos = document.getElementById("lista-adultos");
const listaHijos = document.getElementById("lista-hijos");
const formAdulto = document.getElementById("form-adulto");
const inputCorreoAdulto = document.getElementById("correo-adulto");
const formHijo = document.getElementById("form-hijo");
const inputNombreHijo = document.getElementById("nombre-hijo");
const selectEmojiHijo = document.getElementById("emoji-hijo");
const avisoFamilia = document.getElementById("aviso-familia");

// Recordatorios
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


// ===== Inicio de sesión: eventos =====

// Botón de Google
btnGoogle.addEventListener("click", async function () {
    limpiarAviso();

    const proveedor = new GoogleAuthProvider();
    // Mostrar siempre la lista de cuentas, en lugar de entrar automáticamente
    proveedor.setCustomParameters({ prompt: "select_account" });

    // Desactivar el botón mientras la ventana de Google está abierta
    btnGoogle.disabled = true;

    try {
        await signInWithPopup(auth, proveedor);
    } catch (error) {
        // Si se canceló por un doble clic, no es un error real
        if (error.code !== "auth/cancelled-popup-request") {
            mostrarAviso(traducirError(error), true);
        }
    } finally {
        btnGoogle.disabled = false;
    }
});

// Formulario de correo y contraseña (sirve para entrar o para registrarse)
formAcceso.addEventListener("submit", async function (e) {
    e.preventDefault();
    limpiarAviso();

    const correo = inputCorreo.value.trim().toLowerCase();
    const clave = inputClave.value;

    try {
        if (modoRegistro) {
            const credencial = await createUserWithEmailAndPassword(auth, correo, clave);
            await sendEmailVerification(credencial.user);
        } else {
            await signInWithEmailAndPassword(auth, correo, clave);
        }
    } catch (error) {
        mostrarAviso(traducirError(error), true);
    }
});

// Cambiar entre "Iniciar sesión" y "Crear cuenta"
btnCambiarModo.addEventListener("click", function () {
    modoRegistro = !modoRegistro;
    btnAcceso.textContent = modoRegistro ? "Crear cuenta" : "Iniciar sesión";
    btnCambiarModo.textContent = modoRegistro
        ? "¿Ya tienes cuenta? Inicia sesión"
        : "¿No tienes cuenta? Regístrate";
    inputClave.autocomplete = modoRegistro ? "new-password" : "current-password";
    btnOlvide.classList.toggle("oculto", modoRegistro);
    limpiarAviso();
});

// Recuperar contraseña
btnOlvide.addEventListener("click", async function () {
    limpiarAviso();
    const correo = inputCorreo.value.trim().toLowerCase();

    if (!correo) {
        mostrarAviso("Escribe tu correo arriba y vuelve a presionar este botón.", true);
        return;
    }

    try {
        await sendPasswordResetEmail(auth, correo);
        mostrarAviso("Te enviamos un correo para cambiar tu contraseña. Revisa también la carpeta de spam.", false);
    } catch (error) {
        mostrarAviso(traducirError(error), true);
    }
});

// "Ya lo hice, reintentar": recargar los datos del usuario y volver a revisar
btnReintentar.addEventListener("click", async function () {
    limpiarAviso();
    const usuario = auth.currentUser;
    if (!usuario) {
        return;
    }
    await usuario.reload();
    await usuario.getIdToken(true);   // pedir un "pase" nuevo con los datos actualizados
    revisarUsuario(auth.currentUser);
});

// Cerrar sesión
btnSalir.addEventListener("click", () => signOut(auth));
btnSalirMensaje.addEventListener("click", () => signOut(auth));

// Firebase avisa cada vez que alguien entra o sale
onAuthStateChanged(auth, revisarUsuario);


// ===== Inicio de sesión: lógica =====

// Decide qué pantalla mostrar según el usuario
async function revisarUsuario(usuario) {
    detenerEscucha();

    // 1. Nadie ha iniciado sesión
    if (!usuario) {
        mostrarPantalla("sin-sesion");
        mostrarPanelAcceso();
        return;
    }

    // 2. Se registró con correo pero aún no lo verifica
    if (!usuario.emailVerified) {
        mostrarPantalla("sin-sesion");
        mostrarPanelMensaje(
            "Verifica tu correo",
            `Te enviamos un enlace a ${usuario.email}. Ábrelo y luego presiona "Ya lo hice, reintentar". Revisa también la carpeta de spam.`
        );
        return;
    }

    // 3. Comprobar si su correo está en la familia (las reglas lo deciden)
    try {
        await getDoc(refFamilia);
    } catch (error) {
        mostrarPantalla("sin-sesion");

        if (error.code === "permission-denied") {
            mostrarPanelMensaje(
                "Aún no tienes acceso",
                `El correo ${usuario.email} no está en la lista de la familia. Pide a un miembro que te agregue y luego presiona "Ya lo hice, reintentar".`
            );
        } else {
            mostrarPanelMensaje(
                "No se pudo conectar",
                "Revisa tu conexión a internet y presiona reintentar."
            );
        }
        return;
    }

    // 4. Todo bien: mostrar la app
    nombreUsuario.textContent = `👋 ${usuario.displayName || usuario.email}`;
    mostrarPantalla("con-sesion");
    await subirTareasLocales();
    escucharFamilia();
    escucharTareas();
}

// Cambia la clase del <body>: "cargando", "sin-sesion" o "con-sesion"
function mostrarPantalla(estado) {
    document.body.classList.remove("cargando", "sin-sesion", "con-sesion");
    document.body.classList.add(estado);
}

function mostrarPanelAcceso() {
    limpiarAviso();
    panelAcceso.classList.remove("oculto");
    panelMensaje.classList.add("oculto");
}

function mostrarPanelMensaje(titulo, texto) {
    limpiarAviso();
    mensajeTitulo.textContent = titulo;
    mensajeTexto.textContent = texto;
    panelAcceso.classList.add("oculto");
    panelMensaje.classList.remove("oculto");
}

function mostrarAviso(texto, esError) {
    avisoLogin.textContent = texto;
    avisoLogin.className = esError ? "aviso-error" : "aviso-ok";
}

function limpiarAviso() {
    avisoLogin.textContent = "";
    avisoLogin.className = "";
}

// Convierte los códigos de error de Firebase en mensajes entendibles
function traducirError(error) {
    const mensajes = {
        "auth/invalid-email": "El correo no es válido.",
        "auth/missing-password": "Escribe tu contraseña.",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
        "auth/email-already-in-use": "Ese correo ya tiene una cuenta. Inicia sesión.",
        "auth/invalid-credential": "Correo o contraseña incorrectos.",
        "auth/user-not-found": "No existe una cuenta con ese correo.",
        "auth/wrong-password": "Contraseña incorrecta.",
        "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
        "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de terminar.",
        "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes.",
        "auth/unauthorized-domain": "Este sitio no está autorizado en Firebase. Revisa los dominios autorizados.",
        "auth/network-request-failed": "No hay conexión a internet."
    };
    return mensajes[error.code] || `Ocurrió un error: ${error.message}`;
}


// ===== Escuchar la nube en tiempo real =====

// Escucha el documento de la familia (adultos e hijos)
function escucharFamilia() {
    dejarDeEscucharFamilia = onSnapshot(
        refFamilia,
        function (resultado) {
            const datos = resultado.data() || {};
            familia = {
                miembros: datos.miembros || [],
                hijos: datos.hijos || []
            };

            // Si el hijo que estaba filtrado fue eliminado, volver a "todos"
            if (filtroHijo !== "todos" && !buscarHijo(filtroHijo)) {
                filtroHijo = "todos";
            }

            dibujarFamilia();
            dibujarFiltroHijos();
            llenarSelectHijos();
            mostrarTareas();
        },
        manejarErrorEscucha
    );
}

// Escucha la colección de tareas
function escucharTareas() {
    let primeraVez = true;

    dejarDeEscucharTareas = onSnapshot(
        refTareas,
        function (resultado) {
            tareas = resultado.docs.map(d => ({ id: d.id, ...d.data() }));
            mostrarTareas();

            if (primeraVez) {
                primeraVez = false;
                revisarRecordatorios();
            }
        },
        manejarErrorEscucha
    );
}

// Si alguien te quita de la familia mientras usas la app, volver a revisar tu acceso
function manejarErrorEscucha(error) {
    console.error("Error al escuchar datos:", error);
    if (error.code === "permission-denied") {
        revisarUsuario(auth.currentUser);
    }
}

// Deja de escuchar (por ejemplo, al cerrar sesión)
function detenerEscucha() {
    if (dejarDeEscucharTareas) {
        dejarDeEscucharTareas();
        dejarDeEscucharTareas = null;
    }
    if (dejarDeEscucharFamilia) {
        dejarDeEscucharFamilia();
        dejarDeEscucharFamilia = null;
    }
    tareas = [];
    familia = { miembros: [], hijos: [] };
    filtroHijo = "todos";
    if (dialogoFamilia.open) {
        dialogoFamilia.close();
    }
}


// ===== Mi familia =====

// Abrir y cerrar la ventana
btnFamilia.addEventListener("click", function () {
    limpiarAvisoFamilia();
    dialogoFamilia.showModal();
});

btnCerrarFamilia.addEventListener("click", () => dialogoFamilia.close());

// Agregar un adulto por correo
formAdulto.addEventListener("submit", async function (e) {
    e.preventDefault();
    limpiarAvisoFamilia();

    const correo = inputCorreoAdulto.value.trim().toLowerCase();

    if (familia.miembros.includes(correo)) {
        mostrarAvisoFamilia("Ese correo ya está en la familia.", true);
        return;
    }

    try {
        await updateDoc(refFamilia, { miembros: arrayUnion(correo) });
        formAdulto.reset();
        mostrarAvisoFamilia(`Listo. ${correo} ya puede iniciar sesión en la app.`, false);
    } catch (error) {
        console.error(error);
        mostrarAvisoFamilia("No se pudo agregar el adulto. Revisa tu conexión.", true);
    }
});

// Quitar un adulto
async function quitarAdulto(correo) {
    if (!confirm(`¿Quitar a ${correo} de la familia? Ya no podrá ver las tareas.`)) {
        return;
    }
    limpiarAvisoFamilia();

    try {
        await updateDoc(refFamilia, { miembros: arrayRemove(correo) });
        mostrarAvisoFamilia(`${correo} fue quitado de la familia.`, false);
    } catch (error) {
        console.error(error);
        mostrarAvisoFamilia("No se pudo quitar al adulto.", true);
    }
}

// Agregar un hijo
formHijo.addEventListener("submit", async function (e) {
    e.preventDefault();
    limpiarAvisoFamilia();

    const nombre = inputNombreHijo.value.trim();
    const existe = familia.hijos.some(h => h.nombre.toLowerCase() === nombre.toLowerCase());

    if (existe) {
        mostrarAvisoFamilia(`Ya existe un hijo llamado ${nombre}.`, true);
        return;
    }

    const nuevoHijo = {
        id: `h${Date.now()}`,
        nombre: nombre,
        emoji: selectEmojiHijo.value
    };

    try {
        await updateDoc(refFamilia, { hijos: arrayUnion(nuevoHijo) });
        formHijo.reset();
        mostrarAvisoFamilia(`${nuevoHijo.emoji} ${nombre} fue agregado.`, false);
    } catch (error) {
        console.error(error);
        mostrarAvisoFamilia("No se pudo agregar al hijo.", true);
    }
});

// Quitar un hijo (sus tareas no se borran, quedan sin asignar)
async function quitarHijo(hijo) {
    if (!confirm(`¿Quitar a ${hijo.nombre}? Sus tareas no se borrarán, pero quedarán sin asignar.`)) {
        return;
    }
    limpiarAvisoFamilia();

    try {
        await updateDoc(refFamilia, { hijos: arrayRemove(hijo) });
        mostrarAvisoFamilia(`${hijo.nombre} fue quitado.`, false);
    } catch (error) {
        console.error(error);
        mostrarAvisoFamilia("No se pudo quitar al hijo.", true);
    }
}

// Dibuja las listas de adultos e hijos dentro de la ventana
function dibujarFamilia() {
    const miCorreo = auth.currentUser ? auth.currentUser.email : "";

    // Adultos
    listaAdultos.innerHTML = "";
    familia.miembros.forEach(function (correo) {
        const li = document.createElement("li");
        const texto = document.createElement("span");
        texto.textContent = correo === miCorreo ? `${correo} (tú)` : correo;
        li.appendChild(texto);

        // No mostrar "Quitar" en tu propio correo
        if (correo !== miCorreo) {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "btn-quitar";
            boton.textContent = "Quitar";
            boton.addEventListener("click", () => quitarAdulto(correo));
            li.appendChild(boton);
        }

        listaAdultos.appendChild(li);
    });

    // Hijos
    listaHijos.innerHTML = "";

    if (familia.hijos.length === 0) {
        const vacio = document.createElement("li");
        vacio.className = "vacio-familia";
        vacio.textContent = "Aún no hay hijos registrados";
        listaHijos.appendChild(vacio);
    }

    familia.hijos.forEach(function (hijo) {
        const li = document.createElement("li");
        const texto = document.createElement("span");
        texto.textContent = `${hijo.emoji} ${hijo.nombre}`;

        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btn-quitar";
        boton.textContent = "Quitar";
        boton.addEventListener("click", () => quitarHijo(hijo));

        li.append(texto, boton);
        listaHijos.appendChild(li);
    });
}

// Dibuja los botones de filtro por hijo
function dibujarFiltroHijos() {
    filtroHijos.innerHTML = "";

    if (familia.hijos.length === 0) {
        return;
    }

    const opciones = [{ id: "todos", nombre: "Todos", emoji: "👨‍👩‍👧" }, ...familia.hijos];

    opciones.forEach(function (hijo) {
        const li = document.createElement("li");
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "chip-hijo";
        boton.textContent = `${hijo.emoji} ${hijo.nombre}`;

        if (hijo.id === filtroHijo) {
            boton.classList.add("activo");
        }

        boton.addEventListener("click", function () {
            filtroHijo = hijo.id;
            dibujarFiltroHijos();
            mostrarTareas();
        });

        li.appendChild(boton);
        filtroHijos.appendChild(li);
    });
}

// Llena el campo "¿Para quién?" del formulario de tareas
function llenarSelectHijos() {
    const seleccionAnterior = selectHijo.value;
    selectHijo.innerHTML = "";

    const opcionFamilia = document.createElement("option");
    opcionFamilia.value = "";
    opcionFamilia.textContent = "👨‍👩‍👧 Toda la familia";
    selectHijo.appendChild(opcionFamilia);

    familia.hijos.forEach(function (hijo) {
        const opcion = document.createElement("option");
        opcion.value = hijo.id;
        opcion.textContent = `${hijo.emoji} ${hijo.nombre}`;
        selectHijo.appendChild(opcion);
    });

    // Mantener lo que estaba elegido, si todavía existe
    if (seleccionAnterior === "" || buscarHijo(seleccionAnterior)) {
        selectHijo.value = seleccionAnterior;
    }
}

function buscarHijo(id) {
    return familia.hijos.find(h => h.id === id);
}

function mostrarAvisoFamilia(texto, esError) {
    avisoFamilia.textContent = texto;
    avisoFamilia.className = esError ? "aviso-error" : "aviso-ok";
}

function limpiarAvisoFamilia() {
    avisoFamilia.textContent = "";
    avisoFamilia.className = "";
}


// ===== Acciones sobre las tareas =====

// Si había tareas en localStorage (versión anterior), ofrecer subirlas
async function subirTareasLocales() {
    const locales = JSON.parse(localStorage.getItem("tareas")) || [];
    if (locales.length === 0) {
        return;
    }

    const subir = confirm(
        `Encontramos ${locales.length} tarea(s) guardadas solo en este dispositivo. ¿Quieres subirlas a la nube para compartirlas con tu familia?`
    );
    if (!subir) {
        return;
    }

    for (const t of locales) {
        await addDoc(refTareas, {
            descripcion: t.descripcion,
            materia: t.materia,
            tipo: t.tipo,
            fecha: t.fecha,
            realizada: t.realizada,
            hijoId: "",
            creadoPor: auth.currentUser.email,
            creadoEn: serverTimestamp()
        });
    }
    localStorage.removeItem("tareas");
}

// Agregar una tarea nueva
formulario.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nueva = {
        descripcion: document.getElementById("descripcion").value.trim(),
        materia: document.getElementById("materia").value,
        tipo: document.getElementById("tipo").value,
        fecha: document.getElementById("fecha").value,
        hijoId: selectHijo.value,
        realizada: false,
        creadoPor: auth.currentUser.email,
        creadoEn: serverTimestamp()
    };

    cerrarFormulario();

    try {
        await addDoc(refTareas, nueva);
    } catch (error) {
        console.error(error);
        alert("No se pudo guardar la tarea. Revisa tu conexión.");
    }
});

// Cambia una tarea de pendiente a realizada, o al revés
async function cambiarEstado(id) {
    const tarea = tareas.find(t => t.id === id);
    try {
        await updateDoc(doc(refTareas, id), { realizada: !tarea.realizada });
    } catch (error) {
        console.error(error);
        alert("No se pudo actualizar la tarea.");
    }
}

// Elimina una tarea después de pedir confirmación
async function eliminarTarea(id) {
    if (!confirm("¿Seguro que quieres eliminar esta tarea?")) {
        return;
    }
    try {
        await deleteDoc(doc(refTareas, id));
    } catch (error) {
        console.error(error);
        alert("No se pudo eliminar la tarea.");
    }
}


// ===== Formulario y filtros =====

function abrirFormulario() {
    formulario.classList.remove("oculto");
    btnNueva.classList.add("oculto");

    // Si estás viendo las tareas de un hijo, elegirlo automáticamente
    selectHijo.value = filtroHijo !== "todos" ? filtroHijo : "";

    document.getElementById("descripcion").focus();
}

function cerrarFormulario() {
    formulario.reset();
    formulario.classList.add("oculto");
    btnNueva.classList.remove("oculto");
}

btnNueva.addEventListener("click", abrirFormulario);
btnCancelar.addEventListener("click", cerrarFormulario);

botonesFiltro.forEach(function (boton) {
    boton.addEventListener("click", function () {
        filtroActual = boton.dataset.filtro;
        botonesFiltro.forEach(b => b.classList.remove("activo"));
        boton.classList.add("activo");
        mostrarTareas();
    });
});


// ===== Funciones de ayuda =====

// Devuelve una fecha en formato "aaaa-mm-dd": obtenerHoy() = hoy, obtenerHoy(1) = mañana
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


// ===== Dibujar en la página =====

// Actualiza los números y la lista de compras del aside
function actualizarResumen(lista) {
    const hoy = obtenerHoy();

    const total = lista.length;
    const pendientes = lista.filter(t => !t.realizada).length;
    const realizadas = lista.filter(t => t.realizada).length;
    const atrasadas = lista.filter(t => !t.realizada && t.fecha < hoy).length;
    const comprasPendientes = lista.filter(t => !t.realizada && t.tipo === "comprar");

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

// Dibuja las tareas según los filtros, ordenadas por urgencia
function mostrarTareas() {
    listaTareas.innerHTML = "";

    const hoy = obtenerHoy();
    const manana = obtenerHoy(1);

    // 1. Filtrar por hijo
    const tareasDelHijo = filtroHijo === "todos"
        ? tareas
        : tareas.filter(t => t.hijoId === filtroHijo);

    // 2. Filtrar por estado
    let tareasVisibles = tareasDelHijo;

    if (filtroActual === "pendientes") {
        tareasVisibles = tareasDelHijo.filter(t => !t.realizada);
    } else if (filtroActual === "realizadas") {
        tareasVisibles = tareasDelHijo.filter(t => t.realizada);
    }

    // 3. Ordenar: primero las pendientes, y dentro de cada grupo por fecha más cercana
    tareasVisibles = [...tareasVisibles].sort(function (a, b) {
        if (a.realizada !== b.realizada) {
            return a.realizada ? 1 : -1;
        }
        return a.fecha.localeCompare(b.fecha);
    });

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

        const casilla = document.createElement("input");
        casilla.type = "checkbox";
        casilla.checked = tarea.realizada;
        casilla.addEventListener("change", () => cambiarEstado(tarea.id));

        const info = document.createElement("div");
        info.classList.add("info");

        const descripcion = document.createElement("p");
        descripcion.classList.add("descripcion");
        descripcion.textContent = tarea.descripcion;

        const etiquetas = document.createElement("div");
        etiquetas.classList.add("etiquetas");

        // Etiqueta del hijo (solo si la familia tiene hijos registrados)
        if (familia.hijos.length > 0) {
            const hijo = buscarHijo(tarea.hijoId);
            const textoHijo = hijo ? `${hijo.emoji} ${hijo.nombre}` : "👨‍👩‍👧 Familia";
            etiquetas.append(crearEtiqueta(textoHijo, "etiqueta-hijo"));
        }

        etiquetas.append(
            crearEtiqueta(nombresTipos[tarea.tipo] || tarea.tipo, "etiqueta-tipo"),
            crearEtiqueta(nombresMaterias[tarea.materia] || tarea.materia, "etiqueta-materia"),
            crearEtiqueta(`🗓️ ${formatearFecha(tarea.fecha)}`, "etiqueta-fecha")
        );

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

        const botonEliminar = document.createElement("button");
        botonEliminar.textContent = "Eliminar";
        botonEliminar.addEventListener("click", () => eliminarTarea(tarea.id));

        li.append(casilla, info, botonEliminar);
        listaTareas.appendChild(li);
    });

    // El resumen muestra los datos del hijo elegido (o de todos)
    actualizarResumen(tareasDelHijo);
}


// ===== Recordatorios con notificaciones =====

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

btnNotificaciones.addEventListener("click", async function () {
    await Notification.requestPermission();
    actualizarBotonNotificaciones();
    revisarRecordatorios(true);
});


// ===== Arranque de la app =====

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js")
        .then(() => console.log("Service worker registrado"))
        .catch(error => console.log("Error al registrar el service worker:", error));
}

actualizarBotonNotificaciones();
setInterval(revisarRecordatorios, 60 * 60 * 1000);