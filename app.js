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
    signInAnonymously,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    query,
    where,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getMessaging,
    getToken,
    isSupported
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

// Nuestro propio módulo: el analizador de mensajes
import { analizarAvisos } from "./analizador.js?v=5";

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

// 👇 Clave pública para notificaciones web (Configuración del proyecto → Cloud Messaging)
const VAPID_KEY = "BK-hfcw5-w5TvyrFDsvFSSlk6vMj01OVbHzY5iDw2zO_4PZWdF4aCSCpWfgGvNGoU46HHBFzGx7BNohUnIzQ_ls";

// Conectar con Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
auth.languageCode = "es";

// Dónde viven los datos de la familia en Firestore
const FAMILIA_ID = "mi-familia";
const refFamilia = doc(db, "familias", FAMILIA_ID);
const refTareas = collection(db, "familias", FAMILIA_ID, "tareas");
const refSugerencias = collection(db, "familias", FAMILIA_ID, "sugerencias");
const refDispositivos = collection(db, "familias", FAMILIA_ID, "dispositivos");
const refCodigos = collection(db, "familias", FAMILIA_ID, "codigos");
const refEstudiantes = collection(db, "familias", FAMILIA_ID, "estudiantes");

// Cada celular o computadora tiene un identificador propio, guardado en el dispositivo
let idDispositivo = localStorage.getItem("idDispositivo");
if (!idDispositivo) {
    idDispositivo = crypto.randomUUID();
    localStorage.setItem("idDispositivo", idDispositivo);
}

// Horas que se pueden elegir (formato de 24 horas) y las que vienen marcadas por defecto
const HORAS_DISPONIBLES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const HORAS_POR_DEFECTO = [9, 15, 19];

// Códigos de vinculación: letras y números fáciles de leer (sin O, 0, I, 1) y duración
const LETRAS_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MINUTOS_CODIGO = 15;


// ===== Estado de la app =====
let tareas = [];
let sugerencias = [];
let estudiantes = [];            // celulares de los hijos vinculados (lo ven los adultos)
let familia = { miembros: [], hijos: [] };
let estudiante = null;           // en el celular del hijo: { hijoId, nombre, emoji }
let vinculando = false;          // true mientras el celular del hijo se está vinculando
let avisoPendiente = "";         // mensaje para mostrar en la pantalla de inicio
let filtroActual = "todas";      // "todas", "pendientes" o "realizadas"
let filtroHijo = "todos";        // "todos" o el id de un hijo
let modoNino = localStorage.getItem("modoNino");   // id del hijo en modo niño, o null
let tareaEnEdicion = null;       // id de la tarea que se está editando (null = tarea nueva)
let tareaEnDetalle = null;       // id de la tarea que se está viendo en "Detalle"
let sugerenciaEnRevision = null; // id de la sugerencia de Gmail que se está convirtiendo en tarea
let avisosPendientes = [];       // avisos encontrados en un mensaje con varios avisos
let avisoEnRevision = null;      // el aviso de esa lista que se está revisando en el formulario
let origenFormulario = { origen: "manual", texto: "" };   // de dónde viene la tarea del formulario
let origenAvisos = { origen: "pegado", texto: "" };       // de dónde viene la lista de avisos
let configRecordatorios = { activo: false, horas: HORAS_POR_DEFECTO, contenido: "urgentes", avisosColegio: true };
let configGuardada = false;      // ¿este dispositivo ya guardó alguna vez su configuración?
let horasElegidas = new Set();   // horas marcadas en la ventana de recordatorios
let dejarDeEscucharTareas = null;
let dejarDeEscucharFamilia = null;
let dejarDeEscucharSugerencias = null;
let dejarDeEscucharEstudiantes = null;
let modoRegistro = false;        // false = iniciar sesión, true = crear cuenta
let temporizadorToast = null;


// ===== Texto compartido desde otra app (WhatsApp, Gmail, etc.) =====
// Android abre la app con una dirección como: index.html?texto=Para mañana traer...
const parametros = new URLSearchParams(location.search);

let textoCompartido = [
    parametros.get("titulo"),
    parametros.get("texto"),
    parametros.get("enlace")
].filter(Boolean).join("\n");

// Limpiar la dirección para que al recargar no se vuelva a procesar el mismo texto
if (textoCompartido) {
    history.replaceState(null, "", location.pathname);
}


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

// Acceso de estudiantes
const btnSoyEstudiante = document.getElementById("btn-soy-estudiante");
const panelEstudiante = document.getElementById("panel-estudiante");
const formEstudiante = document.getElementById("form-estudiante");
const inputCodigoEstudiante = document.getElementById("codigo-estudiante");
const btnEntrarEstudiante = document.getElementById("btn-entrar-estudiante");
const btnVolverAcceso = document.getElementById("btn-volver-acceso");

// Tareas
const formulario = document.getElementById("form-tarea");
const tituloForm = document.getElementById("titulo-form");
const btnGuardarTarea = document.getElementById("btn-guardar-tarea");
const listaTareas = document.getElementById("lista-tareas");
const botonesFiltro = document.querySelectorAll("[data-filtro]");
const filtroHijos = document.getElementById("filtro-hijos");
const selectHijo = document.getElementById("hijo");
const btnNueva = document.getElementById("btn-nueva");
const btnCancelar = document.getElementById("btn-cancelar");
const avisoAnalisis = document.getElementById("aviso-analisis");
const toast = document.getElementById("toast");

// Detalle de la tarea
const dialogoDetalle = document.getElementById("dialogo-detalle");
const btnCerrarDetalle = document.getElementById("btn-cerrar-detalle");
const detalleDescripcion = document.getElementById("detalle-descripcion");
const detalleEtiquetas = document.getElementById("detalle-etiquetas");
const detalleDatos = document.getElementById("detalle-datos");
const detalleOriginal = document.getElementById("detalle-original");
const detalleTextoOriginal = document.getElementById("detalle-texto-original");
const btnDetalleEstado = document.getElementById("btn-detalle-estado");
const btnDetalleEditar = document.getElementById("btn-detalle-editar");
const btnDetalleEliminar = document.getElementById("btn-detalle-eliminar");

// Pegar mensaje
const btnPegar = document.getElementById("btn-pegar");
const dialogoPegar = document.getElementById("dialogo-pegar");
const btnCerrarPegar = document.getElementById("btn-cerrar-pegar");
const btnPegarPortapapeles = document.getElementById("btn-pegar-portapapeles");
const formPegar = document.getElementById("form-pegar");
const textoMensaje = document.getElementById("texto-mensaje");

// Varios avisos en un mismo mensaje
const dialogoAvisos = document.getElementById("dialogo-avisos");
const btnCerrarAvisos = document.getElementById("btn-cerrar-avisos");
const textoAvisos = document.getElementById("texto-avisos");
const selectHijoAvisos = document.getElementById("hijo-avisos");
const listaAvisos = document.getElementById("lista-avisos");
const btnAgregarTodos = document.getElementById("btn-agregar-todos");

// Avisos del colegio (sugerencias desde Gmail)
const btnSugerencias = document.getElementById("btn-sugerencias");
const dialogoSugerencias = document.getElementById("dialogo-sugerencias");
const btnCerrarSugerencias = document.getElementById("btn-cerrar-sugerencias");
const listaSugerencias = document.getElementById("lista-sugerencias");

// Mi familia
const btnFamilia = document.getElementById("btn-familia");
const dialogoFamilia = document.getElementById("dialogo-familia");
const btnCerrarFamilia = document.getElementById("btn-cerrar-familia");
const listaAdultos = document.getElementById("lista-adultos");
const listaHijos = document.getElementById("lista-hijos");
const listaEstudiantes = document.getElementById("lista-estudiantes");
const formAdulto = document.getElementById("form-adulto");
const inputCorreoAdulto = document.getElementById("correo-adulto");
const formHijo = document.getElementById("form-hijo");
const inputNombreHijo = document.getElementById("nombre-hijo");
const selectEmojiHijo = document.getElementById("emoji-hijo");
const avisoFamilia = document.getElementById("aviso-familia");

// Código de vinculación
const dialogoCodigo = document.getElementById("dialogo-codigo");
const btnCerrarCodigo = document.getElementById("btn-cerrar-codigo");
const btnListoCodigo = document.getElementById("btn-listo-codigo");
const textoCodigoPara = document.getElementById("texto-codigo-para");
const codigoGenerado = document.getElementById("codigo-generado");
const textoExpiraCodigo = document.getElementById("texto-expira-codigo");

// Modo niño
const btnModoNino = document.getElementById("btn-modo-nino");
const dialogoNino = document.getElementById("dialogo-nino");
const btnCerrarNino = document.getElementById("btn-cerrar-nino");
const pasoCrearPin = document.getElementById("paso-crear-pin");
const pasoElegirHijo = document.getElementById("paso-elegir-hijo");
const formCrearPin = document.getElementById("form-crear-pin");
const inputPinNuevo = document.getElementById("pin-nuevo");
const inputPinConfirmar = document.getElementById("pin-confirmar");
const listaElegirHijo = document.getElementById("lista-elegir-hijo");
const btnCambiarPin = document.getElementById("btn-cambiar-pin");
const avisoNino = document.getElementById("aviso-nino");
const tituloNino = document.getElementById("titulo-nino");
const btnSalirNino = document.getElementById("btn-salir-nino");
const dialogoPin = document.getElementById("dialogo-pin");
const btnCerrarPin = document.getElementById("btn-cerrar-pin");
const formPin = document.getElementById("form-pin");
const inputPinSalir = document.getElementById("pin-salir");
const btnOlvidePin = document.getElementById("btn-olvide-pin");
const avisoPin = document.getElementById("aviso-pin");

// Recordatorios
const btnRecordatorios = document.getElementById("btn-recordatorios");
const estadoNotificaciones = document.getElementById("estado-notificaciones");
const dialogoRecordatorios = document.getElementById("dialogo-recordatorios");
const btnCerrarRecordatorios = document.getElementById("btn-cerrar-recordatorios");
const chkRecActivo = document.getElementById("rec-activo");
const recOpciones = document.getElementById("rec-opciones");
const recHoras = document.getElementById("rec-horas");
const chkRecAvisos = document.getElementById("rec-avisos");
const btnGuardarRecordatorios = document.getElementById("btn-guardar-recordatorios");
const btnProbarRecordatorio = document.getElementById("btn-probar-recordatorio");
const avisoRecordatorios = document.getElementById("aviso-recordatorios");

// "Traductores": del value guardado al nombre que se muestra
const nombresMaterias = {
    matematicas: "Matemáticas",
    lengua: "Lengua",
    ciencias: "Ciencias",
    ingles: "Inglés",
    religion: "Religión",
    otra: "Otra"
};

const nombresTipos = {
    deber: "📘 Deber",
    comprar: "🛒 Comprar",
    evento: "📅 Evento"
};

const nombresOrigen = {
    gmail: "📥 Correo del colegio",
    pegado: "📋 Mensaje pegado",
    compartido: "📲 Compartido desde otra app",
    manual: "✍️ Escrita a mano"
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


// ===== Acceso de estudiantes: eventos =====

btnSoyEstudiante.addEventListener("click", function () {
    limpiarAviso();
    formEstudiante.reset();
    panelAcceso.classList.add("oculto");
    panelMensaje.classList.add("oculto");
    panelEstudiante.classList.remove("oculto");
    setTimeout(() => inputCodigoEstudiante.focus(), 50);
});

btnVolverAcceso.addEventListener("click", mostrarPanelAcceso);

// Vincular este celular con el código que generó un adulto
formEstudiante.addEventListener("submit", async function (e) {
    e.preventDefault();
    limpiarAviso();

    const codigo = normalizarCodigo(inputCodigoEstudiante.value);

    if (codigo.length !== 9) {
        mostrarAviso("El código tiene 8 letras y números, como K7M2-Q9XA.", true);
        return;
    }

    btnEntrarEstudiante.disabled = true;
    vinculando = true;

    try {
        // 1. Entrar con una "cuenta invisible" (inicio anónimo), si aún no hay una
        let usuario = auth.currentUser;
        if (!usuario) {
            const credencial = await signInAnonymously(auth);
            usuario = credencial.user;
        }

        // 2. Buscar el código
        const resultado = await getDoc(doc(refCodigos, codigo));
        if (!resultado.exists()) {
            throw new Error("codigo-invalido");
        }

        const datosCodigo = resultado.data();
        if (datosCodigo.expira.toMillis() < Date.now()) {
            throw new Error("codigo-vencido");
        }

        // 3. Crear el vínculo entre este celular y el perfil del hijo
        await setDoc(doc(refEstudiantes, usuario.uid), {
            hijoId: datosCodigo.hijoId,
            nombre: datosCodigo.nombre,
            emoji: datosCodigo.emoji,
            codigo: codigo,
            vinculadoEn: serverTimestamp()
        });

        // 4. Borrar el código para que nadie más lo use
        await deleteDoc(doc(refCodigos, codigo)).catch(() => {});

        vinculando = false;
        await revisarUsuario(usuario);
    } catch (error) {
        vinculando = false;
        console.error("Error al vincular:", error);
        mostrarAviso(traducirErrorCodigo(error), true);
    } finally {
        btnEntrarEstudiante.disabled = false;
    }
});

// "k7m2 q9xa" → "K7M2-Q9XA"
function normalizarCodigo(texto) {
    const limpio = texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return limpio.length === 8 ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio;
}

function traducirErrorCodigo(error) {
    if (error.message === "codigo-invalido") {
        return "Ese código no existe o ya fue usado. Pide uno nuevo.";
    }
    if (error.message === "codigo-vencido" || error.code === "permission-denied") {
        return `Ese código ya venció o no es válido. Pide uno nuevo (duran ${MINUTOS_CODIGO} minutos).`;
    }
    if (error.code === "auth/operation-not-allowed" || error.code === "auth/admin-restricted-operation") {
        return "El acceso de estudiantes no está activado en Firebase (inicio de sesión anónimo).";
    }
    if (error.code === "auth/network-request-failed" || error.code === "unavailable") {
        return "No hay conexión a internet.";
    }
    return "No se pudo vincular este celular. Inténtalo otra vez.";
}

// Firebase avisa cada vez que alguien entra o sale
onAuthStateChanged(auth, revisarUsuario);


// ===== Inicio de sesión: lógica =====

// Decide qué pantalla mostrar según el usuario
async function revisarUsuario(usuario) {
    detenerEscucha();

    // 1. Nadie ha iniciado sesión (al cerrar sesión, también se quita el modo niño)
    if (!usuario) {
        estudiante = null;
        document.body.classList.remove("modo-estudiante");
        salirModoNino();
        mostrarPantalla("sin-sesion");
        mostrarPanelAcceso();

        if (avisoPendiente) {
            mostrarAviso(avisoPendiente, true);
            avisoPendiente = "";
        }
        return;
    }

    // 2. Celular de un hijo (inicio anónimo vinculado con un código)
    if (usuario.isAnonymous) {
        if (!vinculando) {
            await revisarEstudiante(usuario);
        }
        return;
    }

    // A partir de aquí: es un adulto
    estudiante = null;
    document.body.classList.remove("modo-estudiante");
    modoNino = localStorage.getItem("modoNino");

    // 3. Se registró con correo pero aún no lo verifica
    if (!usuario.emailVerified) {
        mostrarPantalla("sin-sesion");
        mostrarPanelMensaje(
            "Verifica tu correo",
            `Te enviamos un enlace a ${usuario.email}. Ábrelo y luego presiona "Ya lo hice, reintentar". Revisa también la carpeta de spam.`
        );
        return;
    }

    // 4. Comprobar si su correo está en la familia (las reglas lo deciden)
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

    // 5. Todo bien: mostrar la app
    nombreUsuario.textContent = `👋 ${usuario.displayName || usuario.email}`;
    mostrarPantalla("con-sesion");
    document.body.classList.toggle("modo-nino", Boolean(modoNino));
    await subirTareasLocales();
    escucharFamilia();
    escucharTareas();
    escucharSugerencias();
    escucharEstudiantes();
    cargarConfigRecordatorios();

    // 6. Si la app se abrió desde "Compartir", procesar ese texto
    procesarTextoCompartido();
}

// El celular de un hijo: revisar que siga vinculado y mostrar solo sus tareas
async function revisarEstudiante(usuario) {
    try {
        const vinculo = await getDoc(doc(refEstudiantes, usuario.uid));

        // Si fue desvinculado (o nunca se vinculó), volver a la pantalla de inicio
        if (!vinculo.exists()) {
            avisoPendiente = "Este celular ya no está vinculado. Pide un código nuevo a tu papá o mamá.";
            await signOut(auth);
            return;
        }

        estudiante = vinculo.data();

        // Usar la vista del modo niño, con los datos de este hijo
        modoNino = estudiante.hijoId;
        familia = {
            miembros: [],
            hijos: [{ id: estudiante.hijoId, nombre: estudiante.nombre, emoji: estudiante.emoji }]
        };

        textoCompartido = "";
        mostrarPantalla("con-sesion");
        document.body.classList.add("modo-nino", "modo-estudiante");
        tituloNino.textContent = `${estudiante.emoji} Tareas de ${estudiante.nombre}`;

        escucharTareasEstudiante();
    } catch (error) {
        console.error("Error al revisar el vínculo del estudiante:", error);
        mostrarPantalla("sin-sesion");
        mostrarPanelMensaje(
            "No se pudo conectar",
            "Revisa tu conexión a internet y presiona reintentar."
        );
    }
}

// Cambia la clase del <body>: "cargando", "sin-sesion" o "con-sesion"
function mostrarPantalla(estado) {
    document.body.classList.remove("cargando", "sin-sesion", "con-sesion");
    document.body.classList.add(estado);
}

function mostrarPanelAcceso() {
    limpiarAviso();
    panelAcceso.classList.remove("oculto");
    panelEstudiante.classList.add("oculto");
    panelMensaje.classList.add("oculto");
}

function mostrarPanelMensaje(titulo, texto) {
    limpiarAviso();
    mensajeTitulo.textContent = titulo;
    mensajeTexto.textContent = texto;
    panelAcceso.classList.add("oculto");
    panelEstudiante.classList.add("oculto");
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

            // Si el hijo en modo niño fue eliminado, salir del modo niño
            if (modoNino && !buscarHijo(modoNino)) {
                salirModoNino();
            }

            dibujarFamilia();
            dibujarFiltroHijos();
            llenarSelectHijos();
            aplicarModoNino();
        },
        manejarErrorEscucha
    );
}

// Escucha todas las tareas (adultos)
function escucharTareas() {
    dejarDeEscucharTareas = onSnapshot(
        refTareas,
        function (resultado) {
            tareas = resultado.docs.map(d => ({ id: d.id, ...d.data() }));
            mostrarTareas();

            // Si el detalle de una tarea está abierto, actualizarlo con los datos nuevos
            if (dialogoDetalle.open) {
                dibujarDetalle();
            }
        },
        manejarErrorEscucha
    );
}

// Escucha solo las tareas del hijo (celular del estudiante)
function escucharTareasEstudiante() {
    const consulta = query(refTareas, where("hijoId", "==", estudiante.hijoId));

    dejarDeEscucharTareas = onSnapshot(
        consulta,
        function (resultado) {
            tareas = resultado.docs.map(d => ({ id: d.id, ...d.data() }));
            mostrarTareas();

            if (dialogoDetalle.open) {
                dibujarDetalle();
            }
        },
        manejarErrorEscucha
    );
}

// Escucha solo las sugerencias pendientes (avisos de Gmail aún sin revisar)
function escucharSugerencias() {
    const consulta = query(refSugerencias, where("estado", "==", "pendiente"));

    dejarDeEscucharSugerencias = onSnapshot(
        consulta,
        function (resultado) {
            sugerencias = resultado.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));
            dibujarSugerencias();
        },
        function (error) {
            // Solo se registra: un error aquí no debe sacar al usuario de la app
            console.error("Error al escuchar las sugerencias:", error);
        }
    );
}

// Escucha los celulares de los hijos vinculados (adultos)
function escucharEstudiantes() {
    dejarDeEscucharEstudiantes = onSnapshot(
        refEstudiantes,
        function (resultado) {
            estudiantes = resultado.docs.map(d => ({ id: d.id, ...d.data() }));
            dibujarEstudiantes();
        },
        function (error) {
            console.error("Error al escuchar los celulares vinculados:", error);
        }
    );
}

// Si alguien pierde el permiso mientras usa la app, volver a revisar su acceso
function manejarErrorEscucha(error) {
    console.error("Error al escuchar datos:", error);
    if (error.code === "permission-denied") {
        revisarUsuario(auth.currentUser);
    }
}

// Deja de escuchar (por ejemplo, al cerrar sesión)
function detenerEscucha() {
    [
        dejarDeEscucharTareas, dejarDeEscucharFamilia,
        dejarDeEscucharSugerencias, dejarDeEscucharEstudiantes
    ].forEach(function (detener) {
        if (detener) {
            detener();
        }
    });
    dejarDeEscucharTareas = null;
    dejarDeEscucharFamilia = null;
    dejarDeEscucharSugerencias = null;
    dejarDeEscucharEstudiantes = null;

    tareas = [];
    sugerencias = [];
    estudiantes = [];
    avisosPendientes = [];
    avisoEnRevision = null;
    tareaEnEdicion = null;
    tareaEnDetalle = null;
    familia = { miembros: [], hijos: [] };
    filtroHijo = "todos";

    [
        dialogoFamilia, dialogoCodigo, dialogoNino, dialogoPin, dialogoPegar,
        dialogoSugerencias, dialogoAvisos, dialogoDetalle, dialogoRecordatorios
    ].forEach(function (dialogo) {
        if (dialogo.open) {
            dialogo.close();
        }
    });
}


// ===== Detalle de una tarea =====

btnCerrarDetalle.addEventListener("click", () => dialogoDetalle.close());

// Abre la ventana de detalle de una tarea
function abrirDetalle(id) {
    tareaEnDetalle = id;
    dibujarDetalle();

    if (!dialogoDetalle.open) {
        dialogoDetalle.showModal();
    }
}

// Llena la ventana con los datos actuales de la tarea
function dibujarDetalle() {
    const tarea = tareas.find(t => t.id === tareaEnDetalle);

    // Si la tarea fue eliminada (por ti o por otra persona), cerrar la ventana
    if (!tarea) {
        if (dialogoDetalle.open) {
            dialogoDetalle.close();
        }
        return;
    }

    // Descripción y etiquetas
    detalleDescripcion.textContent = tarea.descripcion;

    detalleEtiquetas.innerHTML = "";
    detalleEtiquetas.append(
        crearEtiqueta(nombresTipos[tarea.tipo] || tarea.tipo, "etiqueta-tipo"),
        crearEtiqueta(nombresMaterias[tarea.materia] || tarea.materia, "etiqueta-materia")
    );

    // Datos en forma de "etiqueta: valor"
    detalleDatos.innerHTML = "";

    const hijo = buscarHijo(tarea.hijoId);
    agregarFilaDetalle("Para", hijo ? `${hijo.emoji} ${hijo.nombre}` : "👨‍👩‍👧 Toda la familia");

    const plazo = tarea.realizada ? "" : ` · ${describirPlazo(tarea.fecha)}`;
    agregarFilaDetalle("Fecha", `${formatearFechaLarga(tarea.fecha)}${plazo}`);

    agregarFilaDetalle("Estado", tarea.realizada ? "✅ Realizada" : "⏳ Pendiente");

    // Quién la creó o editó: solo para los adultos
    if (!estudiante && tarea.creadoPor) {
        const cuando = formatearMomento(tarea.creadoEn);
        agregarFilaDetalle("Creada por", cuando ? `${tarea.creadoPor} · ${cuando}` : tarea.creadoPor);
    }

    if (!estudiante && tarea.editadoPor) {
        const cuando = formatearMomento(tarea.editadoEn);
        agregarFilaDetalle("Editada por", cuando ? `${tarea.editadoPor} · ${cuando}` : tarea.editadoPor);
    }

    if (!estudiante && tarea.origen) {
        agregarFilaDetalle("Origen", nombresOrigen[tarea.origen] || tarea.origen);
    }

    // Mensaje original (solo si se guardó)
    detalleOriginal.classList.toggle("oculto", !tarea.textoOriginal);
    detalleTextoOriginal.textContent = tarea.textoOriginal || "";

    // Botón de estado
    btnDetalleEstado.textContent = tarea.realizada ? "↩️ Marcar como pendiente" : "✅ Marcar como hecha";
}

// Agrega una fila "dato: valor" a la lista de detalles
function agregarFilaDetalle(etiqueta, valor) {
    const dt = document.createElement("dt");
    dt.textContent = etiqueta;

    const dd = document.createElement("dd");
    dd.textContent = valor;

    detalleDatos.append(dt, dd);
}

// Botones de la ventana de detalle
btnDetalleEstado.addEventListener("click", function () {
    if (tareaEnDetalle) {
        cambiarEstado(tareaEnDetalle);
    }
});

btnDetalleEditar.addEventListener("click", function () {
    const tarea = tareas.find(t => t.id === tareaEnDetalle);
    if (tarea) {
        dialogoDetalle.close();
        editarTarea(tarea);
    }
});

btnDetalleEliminar.addEventListener("click", function () {
    if (tareaEnDetalle) {
        eliminarTarea(tareaEnDetalle);
    }
});


// ===== Avisos del colegio (sugerencias desde Gmail) =====

btnSugerencias.addEventListener("click", () => dialogoSugerencias.showModal());
btnCerrarSugerencias.addEventListener("click", () => dialogoSugerencias.close());

// Dibuja el aviso amarillo y la lista dentro de la ventana
function dibujarSugerencias() {
    const cantidad = sugerencias.length;

    btnSugerencias.classList.toggle("oculto", cantidad === 0);
    btnSugerencias.textContent = cantidad === 1
        ? "📥 Tienes 1 aviso nuevo del colegio"
        : `📥 Tienes ${cantidad} avisos nuevos del colegio`;

    listaSugerencias.innerHTML = "";

    // Si ya no quedan avisos, cerrar la ventana
    if (cantidad === 0 && dialogoSugerencias.open) {
        dialogoSugerencias.close();
    }

    sugerencias.forEach(function (sugerencia) {
        const li = document.createElement("li");
        li.className = "tarjeta-sugerencia";

        const descripcion = document.createElement("p");
        descripcion.className = "descripcion-sugerencia";
        descripcion.textContent = sugerencia.descripcion;

        // Mensaje original, plegable
        const detalles = document.createElement("details");
        const resumen = document.createElement("summary");
        resumen.textContent = "Ver mensaje original";
        const original = document.createElement("p");
        original.className = "texto-original";
        original.textContent = `${sugerencia.asunto || ""}\n\n${sugerencia.textoOriginal || ""}`;
        detalles.append(resumen, original);

        // Botones
        const botones = document.createElement("div");
        botones.className = "botones-sugerencia";

        const btnAceptar = document.createElement("button");
        btnAceptar.type = "button";
        btnAceptar.className = "btn-aceptar-sugerencia";
        btnAceptar.textContent = "✅ Revisar y agregar";
        btnAceptar.addEventListener("click", () => revisarSugerencia(sugerencia));

        const btnDescartar = document.createElement("button");
        btnDescartar.type = "button";
        btnDescartar.className = "btn-descartar-sugerencia";
        btnDescartar.textContent = "Descartar";
        btnDescartar.addEventListener("click", () => descartarSugerencia(sugerencia.id));

        botones.append(btnAceptar, btnDescartar);

        li.append(descripcion, crearEtiquetasAviso(sugerencia), detalles, botones);
        listaSugerencias.appendChild(li);
    });
}

// Llena el formulario con la sugerencia para que el adulto la confirme
function revisarSugerencia(sugerencia) {
    dialogoSugerencias.close();
    avisoEnRevision = null;
    sugerenciaEnRevision = sugerencia.id;

    llenarFormularioCon(sugerencia);

    // Recordar el correo original para guardarlo con la tarea
    origenFormulario = {
        origen: "gmail",
        texto: `${sugerencia.asunto || ""}\n\n${sugerencia.textoOriginal || ""}`.trim()
    };

    avisoAnalisis.textContent = sugerencia.fecha
        ? "📥 Aviso del correo. Revisa los datos y elige para quién es."
        : "📥 Aviso del correo. ⚠️ No encontré la fecha: elígela tú.";
}

// Marca la sugerencia como descartada (deja de aparecer)
async function descartarSugerencia(id) {
    try {
        await updateDoc(doc(refSugerencias, id), { estado: "descartada" });
    } catch (error) {
        console.error(error);
        alert("No se pudo descartar el aviso.");
    }
}

// Etiquetas de tipo, materia y fecha para una tarjeta de aviso
function crearEtiquetasAviso(aviso) {
    const etiquetas = document.createElement("div");
    etiquetas.className = "etiquetas";
    etiquetas.append(
        crearEtiqueta(nombresTipos[aviso.tipo] || aviso.tipo, "etiqueta-tipo"),
        crearEtiqueta(nombresMaterias[aviso.materia] || aviso.materia, "etiqueta-materia"),
        crearEtiqueta(aviso.fecha ? `🗓️ ${formatearFecha(aviso.fecha)}` : "🗓️ Sin fecha", "etiqueta-fecha")
    );
    return etiquetas;
}


// ===== Pegar mensaje y compartir (usan el analizador) =====

btnPegar.addEventListener("click", function () {
    formPegar.reset();
    dialogoPegar.showModal();
    setTimeout(() => textoMensaje.focus(), 50);
});

btnCerrarPegar.addEventListener("click", () => dialogoPegar.close());

// Leer directamente lo que el usuario copió
btnPegarPortapapeles.addEventListener("click", async function () {
    try {
        textoMensaje.value = await navigator.clipboard.readText();
    } catch (error) {
        alert("No se pudo leer lo copiado. Mantén presionado el cuadro de texto y elige Pegar.");
    }
});

// Analizar el mensaje pegado
formPegar.addEventListener("submit", function (e) {
    e.preventDefault();
    dialogoPegar.close();
    procesarTexto(textoMensaje.value, "pegado");
});

// Procesa el texto que llegó desde el menú "Compartir" de Android
function procesarTextoCompartido() {
    if (!textoCompartido) {
        return;
    }

    // Usarlo una sola vez
    const texto = textoCompartido;
    textoCompartido = "";

    // En modo niño no se pueden agregar tareas
    if (modoNino) {
        mostrarToast("Para agregar tareas, sal del modo niño 🔒");
        return;
    }

    procesarTexto(texto, "compartido");
}

// Analiza un texto: si hay un aviso abre el formulario; si hay varios, abre la lista
function procesarTexto(texto, origen) {
    sugerenciaEnRevision = null;
    avisoEnRevision = null;

    const avisos = analizarAvisos(texto);

    if (avisos.length > 1) {
        mostrarAvisos(avisos, { origen: origen, texto: texto.trim() });
        return;
    }

    const resultado = avisos[0];
    llenarFormularioCon(resultado);

    // Recordar el mensaje original para guardarlo con la tarea
    origenFormulario = { origen: origen, texto: texto.trim() };

    const inicio = origen === "compartido" ? "📲 Mensaje compartido." : "✨ Datos detectados del mensaje.";
    avisoAnalisis.textContent = resultado.fecha
        ? `${inicio} Revísalos antes de agregar.`
        : `${inicio} ⚠️ No encontré la fecha: elígela tú.`;
}

// Abre el formulario de tareas con los datos detectados
function llenarFormularioCon(resultado) {
    abrirFormulario();

    document.getElementById("descripcion").value = resultado.descripcion;
    document.getElementById("materia").value = resultado.materia;
    document.getElementById("tipo").value = resultado.tipo;
    document.getElementById("fecha").value = resultado.fecha;

    avisoAnalisis.textContent = resultado.fecha
        ? "✨ Datos detectados del mensaje. Revísalos antes de agregar."
        : "✨ Datos detectados del mensaje. ⚠️ No encontré la fecha: elígela tú.";
}


// ===== Varios avisos en un mismo mensaje =====

btnCerrarAvisos.addEventListener("click", () => dialogoAvisos.close());

// Muestra la ventana con la lista de avisos encontrados
function mostrarAvisos(avisos, origen) {
    avisosPendientes = avisos;
    origenAvisos = origen;
    selectHijoAvisos.value = filtroHijo !== "todos" ? filtroHijo : "";
    dibujarAvisos();
    abrirDialogoAvisos();
}

function abrirDialogoAvisos() {
    if (!dialogoAvisos.open) {
        dialogoAvisos.showModal();
    }
}

// Dibuja una tarjeta por cada aviso pendiente
function dibujarAvisos() {
    const cantidad = avisosPendientes.length;

    textoAvisos.textContent = cantidad === 1
        ? "Queda 1 aviso por agregar."
        : `Hay ${cantidad} avisos en el mensaje. Agrégalos todos de una vez o revisa cada uno.`;

    listaAvisos.innerHTML = "";

    avisosPendientes.forEach(function (aviso) {
        const li = document.createElement("li");
        li.className = "tarjeta-sugerencia";

        const descripcion = document.createElement("p");
        descripcion.className = "descripcion-sugerencia";
        descripcion.textContent = aviso.descripcion;

        const botones = document.createElement("div");
        botones.className = "botones-sugerencia";

        const btnRevisar = document.createElement("button");
        btnRevisar.type = "button";
        btnRevisar.className = "btn-aceptar-sugerencia";
        btnRevisar.textContent = "✅ Revisar y agregar";
        btnRevisar.addEventListener("click", () => revisarAviso(aviso));

        const btnQuitar = document.createElement("button");
        btnQuitar.type = "button";
        btnQuitar.className = "btn-descartar-sugerencia";
        btnQuitar.textContent = "Quitar";
        btnQuitar.addEventListener("click", () => quitarAvisoPendiente(aviso));

        botones.append(btnRevisar, btnQuitar);

        li.append(descripcion, crearEtiquetasAviso(aviso), botones);
        listaAvisos.appendChild(li);
    });
}

// Lleva un aviso al formulario para revisarlo antes de agregarlo
function revisarAviso(aviso) {
    dialogoAvisos.close();
    sugerenciaEnRevision = null;

    llenarFormularioCon(aviso);
    avisoEnRevision = aviso;
    origenFormulario = { ...origenAvisos };
    selectHijo.value = selectHijoAvisos.value;

    avisoAnalisis.textContent = aviso.fecha
        ? "🧩 Aviso del mensaje. Revisa los datos antes de agregar."
        : "🧩 Aviso del mensaje. ⚠️ No encontré la fecha: elígela tú.";
}

// Quita un aviso de la lista (porque ya se agregó o porque no interesa)
function quitarAvisoPendiente(aviso) {
    avisosPendientes = avisosPendientes.filter(a => a !== aviso);

    if (avisosPendientes.length === 0) {
        if (dialogoAvisos.open) {
            dialogoAvisos.close();
        }
        return;
    }
    dibujarAvisos();
}

// Agrega de una vez todos los avisos que tienen fecha
btnAgregarTodos.addEventListener("click", async function () {
    const conFecha = avisosPendientes.filter(a => a.fecha);

    if (conFecha.length === 0) {
        alert("Ningún aviso tiene fecha. Revísalos uno por uno para elegirla.");
        return;
    }

    btnAgregarTodos.disabled = true;

    try {
        for (const aviso of conFecha) {
            await addDoc(refTareas, {
                descripcion: aviso.descripcion,
                materia: aviso.materia,
                tipo: aviso.tipo,
                fecha: aviso.fecha,
                hijoId: selectHijoAvisos.value,
                realizada: false,
                origen: origenAvisos.origen,
                textoOriginal: origenAvisos.texto.slice(0, 3000),
                creadoPor: auth.currentUser.email,
                creadoEn: serverTimestamp()
            });
            quitarAvisoPendiente(aviso);
        }

        mostrarToast(`✅ ${conFecha.length} tarea(s) agregada(s)`);
    } catch (error) {
        console.error(error);
        alert("No se pudieron agregar todas las tareas. Revisa tu conexión.");
    } finally {
        btnAgregarTodos.disabled = false;
    }
});


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

        const acciones = document.createElement("div");
        acciones.className = "acciones-hijo";

        // Generar un código para vincular el celular de este hijo
        const btnVincular = document.createElement("button");
        btnVincular.type = "button";
        btnVincular.className = "btn-vincular";
        btnVincular.textContent = "📱 Vincular";
        btnVincular.addEventListener("click", () => generarCodigoVinculacion(hijo, btnVincular));

        const btnQuitar = document.createElement("button");
        btnQuitar.type = "button";
        btnQuitar.className = "btn-quitar";
        btnQuitar.textContent = "Quitar";
        btnQuitar.addEventListener("click", () => quitarHijo(hijo));

        acciones.append(btnVincular, btnQuitar);
        li.append(texto, acciones);
        listaHijos.appendChild(li);
    });
}

// Dibuja los celulares vinculados, con un botón para desvincular
function dibujarEstudiantes() {
    listaEstudiantes.innerHTML = "";

    if (estudiantes.length === 0) {
        const vacio = document.createElement("li");
        vacio.className = "vacio-familia";
        vacio.textContent = "Ningún celular vinculado todavía";
        listaEstudiantes.appendChild(vacio);
        return;
    }

    estudiantes.forEach(function (vinculo) {
        const li = document.createElement("li");
        const texto = document.createElement("span");
        const cuando = formatearMomento(vinculo.vinculadoEn);
        texto.textContent = cuando
            ? `${vinculo.emoji} ${vinculo.nombre} · vinculado el ${cuando}`
            : `${vinculo.emoji} ${vinculo.nombre}`;

        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btn-quitar";
        boton.textContent = "Desvincular";
        boton.addEventListener("click", () => desvincularEstudiante(vinculo));

        li.append(texto, boton);
        listaEstudiantes.appendChild(li);
    });
}

// Crea un código temporal para vincular el celular de un hijo
async function generarCodigoVinculacion(hijo, boton) {
    limpiarAvisoFamilia();
    boton.disabled = true;

    try {
        const codigo = crearCodigo();
        const expira = new Date(Date.now() + MINUTOS_CODIGO * 60 * 1000);

        await setDoc(doc(refCodigos, codigo), {
            hijoId: hijo.id,
            nombre: hijo.nombre,
            emoji: hijo.emoji,
            creadoPor: auth.currentUser.email,
            expira: Timestamp.fromDate(expira)
        });

        textoCodigoPara.textContent = `Para ${hijo.emoji} ${hijo.nombre}`;
        codigoGenerado.textContent = codigo;
        textoExpiraCodigo.textContent =
            `Válido hasta las ${expira.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })} (${MINUTOS_CODIGO} minutos). Se puede usar una sola vez.`;

        dialogoCodigo.showModal();
    } catch (error) {
        console.error(error);
        mostrarAvisoFamilia("No se pudo generar el código. Revisa que hayas publicado las reglas nuevas.", true);
    } finally {
        boton.disabled = false;
    }
}

// Genera un código como "K7M2-Q9XA" con letras al azar seguras
function crearCodigo() {
    const numeros = new Uint32Array(8);
    crypto.getRandomValues(numeros);

    const letras = [...numeros].map(n => LETRAS_CODIGO[n % LETRAS_CODIGO.length]).join("");
    return `${letras.slice(0, 4)}-${letras.slice(4)}`;
}

// Quitar el acceso a un celular vinculado
async function desvincularEstudiante(vinculo) {
    if (!confirm(`¿Desvincular el celular de ${vinculo.nombre}? Dejará de ver las tareas al instante.`)) {
        return;
    }
    limpiarAvisoFamilia();

    try {
        await deleteDoc(doc(refEstudiantes, vinculo.id));
        mostrarAvisoFamilia(`El celular de ${vinculo.nombre} fue desvinculado.`, false);
    } catch (error) {
        console.error(error);
        mostrarAvisoFamilia("No se pudo desvincular el celular.", true);
    }
}

btnCerrarCodigo.addEventListener("click", () => dialogoCodigo.close());
btnListoCodigo.addEventListener("click", () => dialogoCodigo.close());

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

// Llena los campos "¿Para quién?" (del formulario y de la ventana de avisos)
function llenarSelectHijos() {
    [selectHijo, selectHijoAvisos].forEach(function (select) {
        const seleccionAnterior = select.value;
        select.innerHTML = "";

        const opcionFamilia = document.createElement("option");
        opcionFamilia.value = "";
        opcionFamilia.textContent = "👨‍👩‍👧 Toda la familia";
        select.appendChild(opcionFamilia);

        familia.hijos.forEach(function (hijo) {
            const opcion = document.createElement("option");
            opcion.value = hijo.id;
            opcion.textContent = `${hijo.emoji} ${hijo.nombre}`;
            select.appendChild(opcion);
        });

        // Mantener lo que estaba elegido, si todavía existe
        if (seleccionAnterior === "" || buscarHijo(seleccionAnterior)) {
            select.value = seleccionAnterior;
        }
    });
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

// ===== FIN DE LA PARTE A — pega la Parte B justo debajo de esta línea =====

// ===== Modo niño =====

// Abrir la ventana de modo niño
btnModoNino.addEventListener("click", function () {
    limpiarAvisoNino();
    prepararDialogoNino(false);
    dialogoNino.showModal();
});

btnCerrarNino.addEventListener("click", () => dialogoNino.close());

// Muestra el paso de "crear PIN" o el de "elegir hijo"
function prepararDialogoNino(forzarCrearPin) {
    const hayPin = Boolean(localStorage.getItem("pinPadres"));
    const crearPin = forzarCrearPin || !hayPin;

    pasoCrearPin.classList.toggle("oculto", !crearPin);
    pasoElegirHijo.classList.toggle("oculto", crearPin);
    formCrearPin.reset();
    dibujarElegirHijo();

    if (crearPin) {
        setTimeout(() => inputPinNuevo.focus(), 50);
    }
}

// Guardar un PIN nuevo
formCrearPin.addEventListener("submit", async function (e) {
    e.preventDefault();
    limpiarAvisoNino();

    const pin = inputPinNuevo.value;
    const confirmacion = inputPinConfirmar.value;

    if (!/^\d{4}$/.test(pin)) {
        mostrarAvisoNino("El PIN debe tener exactamente 4 números.", true);
        return;
    }

    if (pin !== confirmacion) {
        mostrarAvisoNino("Los dos PIN no coinciden. Inténtalo otra vez.", true);
        return;
    }

    localStorage.setItem("pinPadres", await convertirPinEnHash(pin));
    mostrarAvisoNino("PIN guardado en este dispositivo ✅", false);
    prepararDialogoNino(false);
});

btnCambiarPin.addEventListener("click", function () {
    limpiarAvisoNino();
    prepararDialogoNino(true);
});

// Dibuja los botones grandes para elegir hijo
function dibujarElegirHijo() {
    listaElegirHijo.innerHTML = "";

    if (familia.hijos.length === 0) {
        const mensaje = document.createElement("p");
        mensaje.className = "mensaje-sin-hijos";
        mensaje.textContent = "Primero agrega a tus hijos en 👨‍👩‍👧 Mi familia.";
        listaElegirHijo.appendChild(mensaje);
        return;
    }

    familia.hijos.forEach(function (hijo) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btn-elegir-hijo";

        const emoji = document.createElement("span");
        emoji.className = "emoji-grande";
        emoji.textContent = hijo.emoji;

        boton.append(emoji, hijo.nombre);
        boton.addEventListener("click", () => entrarModoNino(hijo.id));
        listaElegirHijo.appendChild(boton);
    });
}

// Activar el modo niño para un hijo
function entrarModoNino(hijoId) {
    modoNino = hijoId;
    localStorage.setItem("modoNino", hijoId);
    dialogoNino.close();
    cerrarFormulario();
    aplicarModoNino();
}

// Desactivar el modo niño
function salirModoNino() {
    modoNino = null;
    localStorage.removeItem("modoNino");
    aplicarModoNino();
}

// Aplica (o quita) el modo niño en la pantalla
function aplicarModoNino() {
    document.body.classList.toggle("modo-nino", Boolean(modoNino));

    const hijo = modoNino ? buscarHijo(modoNino) : null;
    tituloNino.textContent = hijo ? `${hijo.emoji} Tareas de ${hijo.nombre}` : "";

    mostrarTareas();
}

// Botón "Salir" del modo niño: pedir el PIN
btnSalirNino.addEventListener("click", function () {
    formPin.reset();
    limpiarAvisoPin();
    dialogoPin.showModal();
    setTimeout(() => inputPinSalir.focus(), 50);
});

btnCerrarPin.addEventListener("click", () => dialogoPin.close());

// Revisar el PIN escrito
formPin.addEventListener("submit", async function (e) {
    e.preventDefault();
    limpiarAvisoPin();

    const pinGuardado = localStorage.getItem("pinPadres");
    const pinEscrito = await convertirPinEnHash(inputPinSalir.value);

    if (!pinGuardado || pinEscrito === pinGuardado) {
        dialogoPin.close();
        salirModoNino();
    } else {
        mostrarAvisoPin("PIN incorrecto. Inténtalo otra vez.", true);
        formPin.reset();
        inputPinSalir.focus();
    }
});

// Si se olvidó el PIN: cerrar sesión (un adulto tendrá que volver a entrar)
btnOlvidePin.addEventListener("click", function () {
    const aceptar = confirm(
        "Para salir sin el PIN hay que cerrar sesión. Un adulto tendrá que volver a iniciar sesión con su cuenta. ¿Continuar?"
    );
    if (aceptar) {
        signOut(auth);
    }
});

// Convierte el PIN en un "hash" (una huella) para no guardarlo tal cual
async function convertirPinEnHash(pin) {
    const datos = new TextEncoder().encode(`tarea-al-dia:${pin}`);
    const hash = await crypto.subtle.digest("SHA-256", datos);
    return [...new Uint8Array(hash)]
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

// Mensaje flotante
function mostrarToast(texto) {
    toast.textContent = texto;
    toast.classList.add("visible");
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => toast.classList.remove("visible"), 2500);
}

function mostrarAvisoNino(texto, esError) {
    avisoNino.textContent = texto;
    avisoNino.className = esError ? "aviso-error" : "aviso-ok";
}

function limpiarAvisoNino() {
    avisoNino.textContent = "";
    avisoNino.className = "";
}

function mostrarAvisoPin(texto, esError) {
    avisoPin.textContent = texto;
    avisoPin.className = esError ? "aviso-error" : "aviso-ok";
}

function limpiarAvisoPin() {
    avisoPin.textContent = "";
    avisoPin.className = "";
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
            origen: "manual",
            creadoPor: auth.currentUser.email,
            creadoEn: serverTimestamp()
        });
    }
    localStorage.removeItem("tareas");
}

// Guardar el formulario: agrega una tarea nueva o guarda los cambios de una existente
formulario.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Recordar de dónde viene esta tarea (antes de cerrar el formulario)
    const idEdicion = tareaEnEdicion;
    const idSugerencia = sugerenciaEnRevision;
    const aviso = avisoEnRevision;
    const origen = { ...origenFormulario };

    // Los datos que se pueden escribir en el formulario
    const datos = {
        descripcion: document.getElementById("descripcion").value.trim(),
        materia: document.getElementById("materia").value,
        tipo: document.getElementById("tipo").value,
        fecha: document.getElementById("fecha").value,
        hijoId: selectHijo.value
    };

    cerrarFormulario();

    try {
        // A) Editar una tarea existente
        if (idEdicion) {
            await updateDoc(doc(refTareas, idEdicion), {
                ...datos,
                editadoPor: auth.currentUser.email,
                editadoEn: serverTimestamp()
            });
            mostrarToast("✏️ Tarea actualizada");
            return;
        }

        // B) Agregar una tarea nueva (con su origen y el mensaje original, si lo hay)
        const nuevaTarea = await addDoc(refTareas, {
            ...datos,
            realizada: false,
            origen: origen.origen,
            textoOriginal: origen.texto.slice(0, 3000),
            creadoPor: auth.currentUser.email,
            creadoEn: serverTimestamp()
        });

        // Si venía de un aviso de Gmail, marcarlo como aceptado
        if (idSugerencia) {
            await updateDoc(doc(refSugerencias, idSugerencia), {
                estado: "aceptada",
                tareaId: nuevaTarea.id
            });
        }

        // Si venía de un mensaje con varios avisos, seguir con los que faltan
        if (aviso) {
            quitarAvisoPendiente(aviso);
            if (avisosPendientes.length > 0) {
                abrirDialogoAvisos();
            }
        }
    } catch (error) {
        console.error(error);
        alert(idEdicion
            ? "No se pudieron guardar los cambios. Es posible que la tarea haya sido eliminada."
            : "No se pudo guardar la tarea. Revisa tu conexión.");
    }
});

// Abre el formulario con los datos de una tarea para editarla
function editarTarea(tarea) {
    sugerenciaEnRevision = null;
    avisoEnRevision = null;

    abrirFormulario();

    // Cambiar el formulario a "modo edición"
    tareaEnEdicion = tarea.id;
    tituloForm.textContent = "Editar tarea";
    btnGuardarTarea.textContent = "Guardar cambios";

    document.getElementById("descripcion").value = tarea.descripcion;
    document.getElementById("materia").value = tarea.materia;
    document.getElementById("tipo").value = tarea.tipo;
    document.getElementById("fecha").value = tarea.fecha;
    selectHijo.value = buscarHijo(tarea.hijoId) ? tarea.hijoId : "";

    avisoAnalisis.textContent = "✏️ Estás editando una tarea. Cambia lo que necesites y presiona Guardar cambios.";

    // Llevar la pantalla hasta el formulario (útil en el celular)
    formulario.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Cambia una tarea de pendiente a realizada, o al revés
async function cambiarEstado(id) {
    const tarea = tareas.find(t => t.id === id);
    if (!tarea) {
        return;
    }
    const quedaraHecha = !tarea.realizada;

    // En modo niño (o en el celular del hijo), felicitar al marcar una tarea como hecha
    if (modoNino && quedaraHecha) {
        const hijo = buscarHijo(modoNino);
        mostrarToast(`¡Bien hecho${hijo ? ", " + hijo.nombre : ""}! 🎉`);
    }

    try {
        await updateDoc(doc(refTareas, id), { realizada: quedaraHecha });
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

    // Si justo se estaba editando esa tarea, cerrar el formulario
    if (tareaEnEdicion === id) {
        cerrarFormulario();
    }

    try {
        await deleteDoc(doc(refTareas, id));
    } catch (error) {
        console.error(error);
        alert("No se pudo eliminar la tarea.");
    }
}


// ===== Formulario y filtros =====

// Abre el formulario listo para una tarea nueva
function abrirFormulario() {
    formulario.classList.remove("oculto");
    btnNueva.classList.add("oculto");
    avisoAnalisis.textContent = "";

    // Por defecto, el formulario es para agregar una tarea escrita a mano
    tareaEnEdicion = null;
    origenFormulario = { origen: "manual", texto: "" };
    tituloForm.textContent = "Registrar tarea";
    btnGuardarTarea.textContent = "Agregar";

    // Si estás viendo las tareas de un hijo, elegirlo automáticamente
    selectHijo.value = filtroHijo !== "todos" ? filtroHijo : "";

    document.getElementById("descripcion").focus();
}

function cerrarFormulario() {
    formulario.reset();
    formulario.classList.add("oculto");
    btnNueva.classList.remove("oculto");
    avisoAnalisis.textContent = "";
    sugerenciaEnRevision = null;
    avisoEnRevision = null;
    tareaEnEdicion = null;
    origenFormulario = { origen: "manual", texto: "" };
    tituloForm.textContent = "Registrar tarea";
    btnGuardarTarea.textContent = "Agregar";
}

btnNueva.addEventListener("click", function () {
    sugerenciaEnRevision = null;
    avisoEnRevision = null;
    abrirFormulario();
});

// Cancelar: si estabas revisando uno de varios avisos, volver a la lista
btnCancelar.addEventListener("click", function () {
    const veniaDeAvisos = avisoEnRevision !== null;
    cerrarFormulario();

    if (veniaDeAvisos && avisosPendientes.length > 0) {
        abrirDialogoAvisos();
    }
});

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

// Convierte "2026-10-12" en "lunes, 12 de octubre de 2026"
function formatearFechaLarga(fecha) {
    const [anio, mes, dia] = fecha.split("-").map(Number);
    return new Date(anio, mes - 1, dia).toLocaleDateString("es-EC", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

// Cuántos días faltan o pasaron: "es para hoy", "faltan 3 días", "venció hace 2 días"
function describirPlazo(fecha) {
    const [anio, mes, dia] = fecha.split("-").map(Number);
    const limite = new Date(anio, mes - 1, dia);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const dias = Math.round((limite - hoy) / 86400000);

    if (dias === 0) return "es para hoy";
    if (dias === 1) return "es para mañana";
    if (dias > 1) return `faltan ${dias} días`;
    if (dias === -1) return "venció ayer";
    return `venció hace ${-dias} días`;
}

// Convierte la fecha y hora guardada por Firestore en texto: "5 oct 2026, 14:30"
function formatearMomento(momento) {
    if (!momento || typeof momento.toDate !== "function") {
        return "";
    }
    return momento.toDate().toLocaleString("es-EC", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// 9 → "9:00 a. m.", 15 → "3:00 p. m."
function formatearHora(hora) {
    const sufijo = hora < 12 ? "a. m." : "p. m.";
    const hora12 = hora % 12 === 0 ? 12 : hora % 12;
    return `${hora12}:00 ${sufijo}`;
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

    // 1. ¿De qué hijo mostrar tareas? En modo niño, siempre del niño activo
    const hijoVisible = modoNino || (filtroHijo !== "todos" ? filtroHijo : null);

    const tareasDelHijo = hijoVisible
        ? tareas.filter(t => t.hijoId === hijoVisible)
        : tareas;

    // 2. Filtrar por estado (en modo niño se muestran todas)
    const estado = modoNino ? "todas" : filtroActual;
    let tareasVisibles = tareasDelHijo;

    if (estado === "pendientes") {
        tareasVisibles = tareasDelHijo.filter(t => !t.realizada);
    } else if (estado === "realizadas") {
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
        vacio.textContent = modoNino ? "¡No tienes tareas! 🎉" : "No hay tareas aquí 🎉";
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

        // Zona de información: al tocarla se abren los detalles
        const info = document.createElement("div");
        info.classList.add("info");
        info.tabIndex = 0;
        info.title = "Ver detalles";
        info.setAttribute("role", "button");
        info.addEventListener("click", () => abrirDetalle(tarea.id));
        info.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                abrirDetalle(tarea.id);
            }
        });

        const descripcion = document.createElement("p");
        descripcion.classList.add("descripcion");
        descripcion.textContent = tarea.descripcion;

        const etiquetas = document.createElement("div");
        etiquetas.classList.add("etiquetas");

        // Etiqueta del hijo (no hace falta en modo niño)
        if (familia.hijos.length > 0 && !modoNino) {
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

        // Botones de editar y eliminar
        const acciones = document.createElement("div");
        acciones.className = "acciones-tarea";

        const botonEditar = document.createElement("button");
        botonEditar.type = "button";
        botonEditar.className = "btn-editar";
        botonEditar.textContent = "✏️ Editar";
        botonEditar.addEventListener("click", () => editarTarea(tarea));

        const botonEliminar = document.createElement("button");
        botonEliminar.type = "button";
        botonEliminar.className = "btn-eliminar";
        botonEliminar.textContent = "Eliminar";
        botonEliminar.addEventListener("click", () => eliminarTarea(tarea.id));

        acciones.append(botonEditar, botonEliminar);

        li.append(casilla, info, acciones);
        listaTareas.appendChild(li);
    });

    // El resumen muestra los datos del hijo elegido (o de todos)
    actualizarResumen(tareasDelHijo);
}


// ===== Recordatorios con notificaciones push (configuración propia de cada dispositivo) =====

// Abrir la ventana con la configuración actual de este dispositivo
btnRecordatorios.addEventListener("click", function () {
    limpiarAvisoRecordatorios();

    // Si nunca se configuró, mostrarlo activado con las horas por defecto
    chkRecActivo.checked = configGuardada ? configRecordatorios.activo : true;
    horasElegidas = new Set(configRecordatorios.horas);
    chkRecAvisos.checked = configRecordatorios.avisosColegio;

    const radio = document.querySelector(`input[name="rec-contenido"][value="${configRecordatorios.contenido}"]`);
    if (radio) {
        radio.checked = true;
    }

    recOpciones.classList.toggle("oculto", !chkRecActivo.checked);
    dibujarHoras();
    dialogoRecordatorios.showModal();
});

btnCerrarRecordatorios.addEventListener("click", () => dialogoRecordatorios.close());

// Mostrar u ocultar las opciones al activar o desactivar
chkRecActivo.addEventListener("change", function () {
    recOpciones.classList.toggle("oculto", !chkRecActivo.checked);
});

// Dibuja los botones de las horas (los elegidos se ven pintados)
function dibujarHoras() {
    recHoras.innerHTML = "";

    HORAS_DISPONIBLES.forEach(function (hora) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "chip-hora";
        boton.textContent = formatearHora(hora);

        if (horasElegidas.has(hora)) {
            boton.classList.add("activo");
        }

        boton.addEventListener("click", function () {
            if (horasElegidas.has(hora)) {
                horasElegidas.delete(hora);
            } else {
                horasElegidas.add(hora);
            }
            boton.classList.toggle("activo");
        });

        recHoras.appendChild(boton);
    });
}

// Guardar la configuración de este dispositivo en Firestore
btnGuardarRecordatorios.addEventListener("click", async function () {
    limpiarAvisoRecordatorios();

    const activo = chkRecActivo.checked;
    const horas = [...horasElegidas].sort((a, b) => a - b);
    const radioElegido = document.querySelector('input[name="rec-contenido"]:checked');
    const contenido = radioElegido ? radioElegido.value : "urgentes";
    const avisosColegio = chkRecAvisos.checked;

    if (activo && horas.length === 0 && !avisosColegio) {
        mostrarAvisoRecordatorios("Elige al menos una hora, o activa los avisos del colegio.", true);
        return;
    }

    btnGuardarRecordatorios.disabled = true;

    try {
        const refEste = doc(refDispositivos, idDispositivo);

        if (activo) {
            // Pedir permiso y obtener la "dirección" de este dispositivo para recibir notificaciones
            const token = await obtenerTokenPush(true);

            await setDoc(refEste, {
                token: token,
                usuario: auth.currentUser.email,
                horas: horas,
                contenido: contenido,
                avisosColegio: avisosColegio,
                activo: true,
                navegador: navigator.userAgent.slice(0, 150),
                actualizado: serverTimestamp()
            }, { merge: true });
        } else {
            await setDoc(refEste, {
                activo: false,
                actualizado: serverTimestamp()
            }, { merge: true });
        }

        configRecordatorios = { activo, horas, contenido, avisosColegio };
        configGuardada = true;
        actualizarEstadoRecordatorios();
        dialogoRecordatorios.close();
        mostrarToast(activo ? "🔔 Recordatorios guardados" : "🔕 Recordatorios desactivados");
    } catch (error) {
        console.error("Error al guardar los recordatorios:", error);
        mostrarAvisoRecordatorios(traducirErrorRecordatorios(error), true);
    } finally {
        btnGuardarRecordatorios.disabled = false;
    }
});

// Pide permiso (si hace falta) y devuelve el token de este dispositivo
async function obtenerTokenPush(pedirPermiso) {
    if (!("Notification" in window) || !(await isSupported())) {
        throw new Error("no-soportado");
    }

    if (pedirPermiso) {
        await Notification.requestPermission();
    }

    if (Notification.permission !== "granted") {
        throw new Error("sin-permiso");
    }

    const registro = await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);

    return getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registro
    });
}

// Al entrar a la app: leer la configuración de este dispositivo y renovar su token
async function cargarConfigRecordatorios() {
    try {
        const resultado = await getDoc(doc(refDispositivos, idDispositivo));

        if (resultado.exists()) {
            const datos = resultado.data();
            configGuardada = true;
            configRecordatorios = {
                activo: Boolean(datos.activo),
                horas: datos.horas || HORAS_POR_DEFECTO,
                contenido: datos.contenido || "urgentes",
                avisosColegio: datos.avisosColegio !== false
            };
        }

        actualizarEstadoRecordatorios();

        // El token puede cambiar con el tiempo: actualizarlo en silencio
        if (configRecordatorios.activo && "Notification" in window && Notification.permission === "granted") {
            const token = await obtenerTokenPush(false);
            await setDoc(doc(refDispositivos, idDispositivo), {
                token: token,
                actualizado: serverTimestamp()
            }, { merge: true });
        }
    } catch (error) {
        console.error("No se pudo cargar la configuración de recordatorios:", error);
    }
}

// Texto debajo del botón: a qué horas llegan los recordatorios en este dispositivo
function actualizarEstadoRecordatorios() {
    if (!configRecordatorios.activo) {
        estadoNotificaciones.textContent = configGuardada
            ? "🔕 Recordatorios desactivados en este dispositivo"
            : "Aún no activas los recordatorios en este dispositivo";
        return;
    }

    if (configRecordatorios.horas.length === 0) {
        estadoNotificaciones.textContent = "🔔 Solo avisos nuevos del colegio";
        return;
    }

    const horas = configRecordatorios.horas.map(formatearHora).join(", ");
    estadoNotificaciones.textContent = `🔔 Recordatorios a las ${horas}`;
}

// Muestra una notificación de ejemplo en este dispositivo
btnProbarRecordatorio.addEventListener("click", async function () {
    limpiarAvisoRecordatorios();

    if (!("Notification" in window)) {
        mostrarAvisoRecordatorios(traducirErrorRecordatorios(new Error("no-soportado")), true);
        return;
    }

    await Notification.requestPermission();

    if (Notification.permission !== "granted") {
        mostrarAvisoRecordatorios(traducirErrorRecordatorios(new Error("sin-permiso")), true);
        return;
    }

    const registro = await navigator.serviceWorker.ready;
    registro.showNotification("📚 Tareas al Día", {
        body: "⚠️ 1 atrasada · ⏰ 2 para hoy\n• Así se verán tus recordatorios",
        icon: "iconos/android-chrome-192x192.png",
        badge: "iconos/android-chrome-192x192.png",
        tag: "prueba"
    });
});

// Convierte los errores de notificaciones en mensajes entendibles
function traducirErrorRecordatorios(error) {
    if (error.message === "no-soportado") {
        return "Este navegador no permite notificaciones. En iPhone, primero instala la app en la pantalla de inicio (iOS 16.4 o más reciente).";
    }
    if (error.message === "sin-permiso") {
        return "No diste permiso para mostrar notificaciones. Actívalo desde el candado junto a la dirección o en los ajustes de la app.";
    }
    if (error.code === "permission-denied") {
        return "No se pudo guardar. Revisa que hayas publicado las reglas nuevas de Firestore.";
    }
    if (String(error.code || "").startsWith("messaging/")) {
        return "No se pudo registrar este dispositivo para notificaciones. Revisa la clave VAPID y tu conexión.";
    }
    return "No se pudo guardar. Revisa tu conexión a internet.";
}

function mostrarAvisoRecordatorios(texto, esError) {
    avisoRecordatorios.textContent = texto;
    avisoRecordatorios.className = esError ? "aviso-error" : "aviso-ok";
}

function limpiarAvisoRecordatorios() {
    avisoRecordatorios.textContent = "";
    avisoRecordatorios.className = "";
}


// ===== Arranque de la app =====

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js")
        .then(() => console.log("Service worker registrado"))
        .catch(error => console.log("Error al registrar el service worker:", error));
}