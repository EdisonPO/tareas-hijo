// ===== Analizador de mensajes =====
// Lee el texto de un aviso (WhatsApp, correo, plataforma del colegio)
// e intenta adivinar: descripción, tipo, materia y fecha.

const MESES = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, setiembre: 8,
    octubre: 9, noviembre: 10, diciembre: 11
};

const DIAS_SEMANA = {
    domingo: 0, lunes: 1, martes: 2, miercoles: 3,
    jueves: 4, viernes: 5, sabado: 6
};

const MATERIAS = [
    { valor: "matematicas", patron: /matematic/ },
    { valor: "lengua", patron: /lengua|literatura|lectura|comunicacion|redaccion/ },
    { valor: "ciencias", patron: /ciencias|naturales|biologia|quimica/ },
    { valor: "ingles", patron: /ingles|english/ }
];


// ===== Función principal (la única que usa el resto de la app) =====
export function analizarMensaje(texto, asunto = "", hoy = new Date()) {
    const limpio = quitarEncabezadosWhatsApp(texto);
    const todo = `${asunto}\n${limpio}`;
    const tipo = detectarTipo(todo);

    return {
        tipo: tipo,
        materia: detectarMateria(todo),
        fecha: detectarFecha(limpio, hoy) || detectarFecha(asunto, hoy),
        descripcion: detectarDescripcion(limpio, asunto, tipo)
    };
}


// ===== Detectores =====

// "deber", "comprar" o "evento" según las palabras del mensaje
function detectarTipo(texto) {
    const t = normalizar(texto);

    if (/\b(reunion|asamblea|evento|festival|desfile|excursion|paseo|salida pedagogica|casa abierta|minuto civico|convivencia)\b/.test(t)) {
        return "evento";
    }
    if (/\b(traer|comprar|material|materiales|utiles|llevar)\b/.test(t)) {
        return "comprar";
    }
    return "deber";
}

// La primera materia que aparezca en el texto, o "otra"
function detectarMateria(texto) {
    const t = normalizar(texto);
    const encontrada = MATERIAS.find(m => m.patron.test(t));
    return encontrada ? encontrada.valor : "otra";
}

// Busca una fecha en varios formatos, de la más precisa a la menos precisa
function detectarFecha(texto, hoy) {
    if (!texto) {
        return "";
    }

    const t = normalizar(texto);
    const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    // 1. "2 de octubre" o "2 de octubre de 2026"
    const nombresMeses = Object.keys(MESES).join("|");
    let m = t.match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${nombresMeses})(?:\\s+(?:de|del)\\s+(\\d{4}))?`));
    if (m) {
        return armarFecha(base, Number(m[1]), MESES[m[2]], m[3] ? Number(m[3]) : null);
    }

    // 2. "02/10", "2-10" o "02/10/2026"
    m = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    if (m) {
        let anio = m[3] ? Number(m[3]) : null;
        if (anio && anio < 100) {
            anio += 2000;
        }
        return armarFecha(base, Number(m[1]), Number(m[2]) - 1, anio);
    }

    // 3. "pasado mañana"
    if (/pasado\s+manana/.test(t)) {
        return aTextoFecha(sumarDias(base, 2));
    }

    // 4. Día de la semana: el próximo lunes, martes, etc.
    m = t.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
    if (m) {
        let dias = (DIAS_SEMANA[m[1]] - base.getDay() + 7) % 7;
        if (dias === 0) {
            dias = 7;
        }
        return aTextoFecha(sumarDias(base, dias));
    }

    // 5. "mañana" (pero no "en la mañana" ni "por la mañana")
    if (/(?<!la\s)\bmanana\b/.test(t)) {
        return aTextoFecha(sumarDias(base, 1));
    }

    // 6. "hoy"
    if (/\bhoy\b/.test(t)) {
        return aTextoFecha(base);
    }

    return "";
}

// Arma la descripción: la lista de materiales, el asunto o la primera línea útil
function detectarDescripcion(texto, asunto, tipo) {
    const lineas = texto
        .split(/\r?\n/)
        .map(linea => linea.trim())
        .filter(Boolean);

    // Viñetas: líneas que empiezan con •, -, * o con "1." / "1)"
    const marcaVineta = /^([•·\-*]|\d+[.)])\s*/;
    const vinetas = lineas
        .filter(linea => marcaVineta.test(linea))
        .map(linea => linea.replace(marcaVineta, "").split(/\.\s/)[0].replace(/\.$/, "").trim())
        .filter(Boolean);

    if (tipo === "comprar" && vinetas.length > 0) {
        return recortar(`Traer: ${vinetas.join(", ")}`, 160);
    }

    // Asunto del correo sin "Notificación:", "RE:" o "FW:"
    const asuntoLimpio = asunto.replace(/^\s*(notificaci[oó]n|re|fwd?)\s*:\s*/i, "").trim();
    if (asuntoLimpio) {
        return recortar(comoOracion(asuntoLimpio), 100);
    }

    // Primera línea que no sea un saludo
    const saludo = /^(hola|estimad|buen[oa]s|saludos|reciban|querid|cordial|atentamente|notificaci)/;
    const principal = lineas.find(linea => !saludo.test(normalizar(linea)));
    return principal ? recortar(comoOracion(principal), 100) : "";
}


// ===== Funciones de ayuda =====

// Quita tildes y pasa a minúsculas: "Matemática" → "matematica"
function normalizar(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// Al copiar varios mensajes de WhatsApp aparece "[2/10/26, 19:06] Profe Luz: ..."
// Quitamos esa parte para que no se confunda con la fecha del aviso
function quitarEncabezadosWhatsApp(texto) {
    return texto.replace(/^\[[^\]]*\]\s*[^:\n]{1,40}:\s*/gm, "");
}

// Crea la fecha; si no dice el año y ya pasó hace más de 2 meses, usa el próximo año
function armarFecha(base, dia, mes, anio) {
    if (mes < 0 || mes > 11 || dia < 1 || dia > 31) {
        return "";
    }
    if (anio) {
        return aTextoFecha(new Date(anio, mes, dia));
    }

    let fecha = new Date(base.getFullYear(), mes, dia);
    if (fecha < sumarDias(base, -60)) {
        fecha = new Date(base.getFullYear() + 1, mes, dia);
    }
    return aTextoFecha(fecha);
}

function sumarDias(fecha, dias) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);
}

// Date → "aaaa-mm-dd" (el formato que usa <input type="date">)
function aTextoFecha(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

// "MATERIALES PARA MATEMÁTICA" → "Materiales para matemática"
function comoOracion(texto) {
    if (texto === texto.toUpperCase()) {
        const minusculas = texto.toLowerCase();
        return minusculas.charAt(0).toUpperCase() + minusculas.slice(1);
    }
    return texto;
}

function recortar(texto, maximo) {
    return texto.length > maximo ? `${texto.slice(0, maximo - 1).trimEnd()}…` : texto;
}