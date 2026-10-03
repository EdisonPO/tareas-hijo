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

// Botones para mostrar u ocultar el formulario
const btnNueva = document.getElementById("btn-nueva");
const btnCancelar = document.getElementById("btn-cancelar");

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

btnNueva.addEventListener("click", abrirFormulario);
btnCancelar.addEventListener("click", cerrarFormulario);

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

// Cuando se envía el formulario
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

// Cuando se hace clic en un botón de filtro
botonesFiltro.forEach(function (boton) {
    boton.addEventListener("click", function () {
        // 1. Guardar el filtro de este botón
        filtroActual = boton.dataset.filtro;

        // 2. Quitar la clase "activo" a todos los botones
        botonesFiltro.forEach(b => b.classList.remove("activo"));

        // 3. Poner la clase "activo" solo a este botón
        boton.classList.add("activo");

        // 4. Volver a dibujar la lista
        mostrarTareas();
    });
});

// Guarda el arreglo completo en localStorage
function guardarTareas() {
    localStorage.setItem("tareas", JSON.stringify(tareas));
}

// Devuelve la fecha de hoy en formato "aaaa-mm-dd"
function obtenerHoy() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const dia = String(hoy.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

// Convierte "2026-10-06" en "06/10/2026"
function formatearFecha(fecha) {
    const [anio, mes, dia] = fecha.split("-");
    return `${dia}/${mes}/${anio}`;
}

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

// Actualiza los números y la lista de compras del aside
function actualizarResumen() {
    const hoy = obtenerHoy();

    // Calcular cada dato (siempre con TODAS las tareas, sin importar el filtro)
    const total = tareas.length;
    const pendientes = tareas.filter(t => !t.realizada).length;
    const realizadas = tareas.filter(t => t.realizada).length;
    const atrasadas = tareas.filter(t => !t.realizada && t.fecha < hoy).length;
    const comprasPendientes = tareas.filter(t => !t.realizada && t.tipo === "comprar");

    // Poner los números en los span del aside
    document.getElementById("total-tareas").textContent = total;
    document.getElementById("tareas-pendientes").textContent = pendientes;
    document.getElementById("tareas-realizadas").textContent = realizadas;
    document.getElementById("tareas-atrasadas").textContent = atrasadas;
    document.getElementById("pendiente-comprar").textContent = comprasPendientes.length;

    // Llenar la lista de compras con la descripción de cada artículo
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

    // Elegir qué tareas mostrar según el filtro
    let tareasVisibles = tareas;

    if (filtroActual === "pendientes") {
        tareasVisibles = tareas.filter(t => !t.realizada);
    } else if (filtroActual === "realizadas") {
        tareasVisibles = tareas.filter(t => t.realizada);
    }

    // Si no hay tareas que mostrar, poner un mensaje
    if (tareasVisibles.length === 0) {
        const vacio = document.createElement("li");
        vacio.classList.add("vacio");
        vacio.textContent = "No hay tareas aquí 🎉";
        listaTareas.appendChild(vacio);
    }

    tareasVisibles.forEach(function (tarea) {
        const li = document.createElement("li");

        // Clases para que el CSS decida colores y estilos
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

        // Texto de la tarea
        const texto = document.createElement("span");
        const materia = nombresMaterias[tarea.materia] || tarea.materia;
        const tipo = nombresTipos[tarea.tipo] || tarea.tipo;
        texto.textContent = ` ${tipo} | ${materia} | ${tarea.descripcion} | ${formatearFecha(tarea.fecha)} `;

        // Botón para eliminar
        const botonEliminar = document.createElement("button");
        botonEliminar.textContent = "Eliminar";
        botonEliminar.addEventListener("click", function () {
            eliminarTarea(tarea.id);
        });

        // Meter las tres partes dentro del <li>
        li.append(casilla, texto, botonEliminar);
        listaTareas.appendChild(li);
    });

    // Cada vez que se redibuja la lista, también se actualiza el resumen
    actualizarResumen();
}

// Al abrir la página, dibujar las tareas que ya estaban guardadas
mostrarTareas();