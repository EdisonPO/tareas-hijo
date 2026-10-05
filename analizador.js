// ===== Analizador de mensajes =====
// Lee el texto de un aviso (WhatsApp, correo, plataforma del colegio)
// y lo convierte en una o varias tareas: descripción, tipo, materia y fecha.

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

// Verbos de acción: forma escrita (sin tildes) → instrucción en infinitivo
const VERBOS = {
    traer: "traer", traigan: "traer", traiga: "traer", traeran: "traer",
    enviar: "enviar", envien: "enviar", envie: "enviar", enviaran: "enviar",
    llevar: "llevar", lleven: "llevar", lleve: "llevar",
    comprar: "comprar", compren: "comprar", compre: "comprar",
    donar: "donar", donen: "donar",
    realizar: "realizar", realicen: "realizar", realizarse: "realizar",
    elaborar: "elaborar", elaboren: "elaborar",
    estudiar: "estudiar", estudien: "estudiar",
    repasar: "repasar", repasen: "repasar",
    investigar: "investigar", investiguen: "investigar",
    leer: "leer", lean: "leer",
    escribir: "escribir", escriban: "escribir",
    resolver: "resolver", resuelvan: "resolver",
    completar: "completar", completen: "completar",
    copiar: "copiar", copien: "copiar",
    terminar: "terminar", terminen: "terminar", terminaron: "terminar",
    presentar: "presentar", presenten: "presentar",
    asistir: "asistir", asistan: "asistir",
    descomponer: "descomponer", representar: "representar",
    dibujar: "dibujar", dibujen: "dibujar",
    pintar: "pintar", pinten: "pintar",
    recortar: "recortar", recorten: "recortar",
    colaborar: "colaborar", colaboren: "colaborar",
    participar: "participar", participen: "participar",
    revisar: "revisar", revisen: "revisar",
    descargar: "descargar", descarguen: "descargar",
    imprimir: "imprimir", impriman: "imprimir",
    firmar: "firmar", firmen: "firmar"
};

// Verbos poco específicos: si en la misma oración hay otro verbo, se prefiere el otro
const VERBOS_DEBILES = ["colaborar", "participar", "realizar", "asistir"];

// Puntos mínimos para que una oración cuente como aviso
const PUNTOS_MINIMOS = 3;


// ===== Varios avisos: separa el mensaje en bloques y analiza cada uno =====
export function analizarAvisos(texto, asunto = "", hoy = new Date()) {
    const limpio = quitarEncabezadosWhatsApp(texto);
    const avisos = [];

    dividirEnBloques(limpio).forEach(function (bloque) {
        const aviso = analizarBloque(bloque, hoy);

        // Evitar avisos vacíos o repetidos
        if (aviso && !avisos.some(a => a.descripcion === aviso.descripcion)) {
            avisos.push(completarAviso(aviso, limpio, asunto, hoy));
        }
    });

    // Si no se encontró ninguna instrucción clara, usar un aviso de respaldo
    if (avisos.length === 0) {
        return [avisoDeRespaldo(limpio, asunto, hoy)];
    }

    return avisos;
}

// ===== Un solo aviso: el más importante del mensaje =====
// (lo usa el script de Gmail)
export function analizarMensaje(texto, asunto = "", hoy = new Date()) {
    const avisos = analizarAvisos(texto, asunto, hoy);
    return avisos.reduce((mejor, aviso) => (aviso.puntos > mejor.puntos ? aviso : mejor));
}


// ===== Analizar un bloque =====

function analizarBloque(bloque, hoy) {
    // 1. ¿El bloque es una lista de cosas para traer o donar?
    const lista = extraerLista(bloque);

    if (lista) {
        const verbo = /donaci|donar|donen/.test(normalizar(lista.intro)) ? "Donar" : "Traer";
        return {
            tipo: "comprar",
            materia: detectarMateria(bloque),
            fecha: detectarFecha(bloque, hoy),
            descripcion: recortar(`${verbo}: ${lista.items.join(", ")}`, 160),
            puntos: 10
        };
    }

    // 2. Si no, buscar la oración que mejor dice qué hay que hacer
    const principal = elegirOracionPrincipal(bloque);

    if (!principal || principal.puntos < PUNTOS_MINIMOS) {
        return null;
    }

    const materiaOracion = detectarMateria(principal.texto);

    return {
        tipo: detectarTipo(principal.texto),
        materia: materiaOracion !== "otra" ? materiaOracion : detectarMateria(bloque),
        fecha: detectarFecha(principal.texto, hoy) || detectarFecha(bloque, hoy),
        descripcion: redactarDescripcion(principal.texto),
        puntos: principal.puntos
    };
}

// Completa materia y fecha con el resto del mensaje cuando el bloque no los tiene
function completarAviso(aviso, textoCompleto, asunto, hoy) {
    const todo = `${asunto}\n${textoCompleto}`;

    if (aviso.materia === "otra" && aviso.tipo !== "evento") {
        aviso.materia = detectarMateria(todo);
    }

    // Los deberes sin fecha suelen ser para la próxima clase indicada en el mensaje
    if (!aviso.fecha && aviso.tipo === "deber") {
        aviso.fecha = detectarFecha(textoCompleto, hoy) || detectarFecha(asunto, hoy);
    }

    return aviso;
}

// Cuando no hay ninguna instrucción clara: usar el asunto o la primera línea útil
function avisoDeRespaldo(texto, asunto, hoy) {
    const todo = `${asunto}\n${texto}`;
    const asuntoLimpio = asunto.replace(/^\s*(notificaci[oó]n|re|fwd?)\s*:\s*/i, "").trim();

    const primera = texto
        .split(/\r?\n/)
        .map(linea => limpiarFrase(linea.trim()))
        .find(linea => linea.length >= 10 && !esSaludo(normalizar(linea)));

    return {
        tipo: detectarTipo(todo),
        materia: detectarMateria(todo),
        fecha: detectarFecha(texto, hoy) || detectarFecha(asunto, hoy),
        descripcion: recortar(comoOracion(asuntoLimpio || primera || ""), 120),
        puntos: 0
    };
}


// ===== Dividir el mensaje =====

// Párrafos (separados por línea en blanco). Un párrafo que termina en ":" se une
// con el siguiente, porque suele presentar una lista. También se corta antes de
// palabras que suelen iniciar otro aviso.
function dividirEnBloques(texto) {
    const parrafos = texto
        .split(/\n\s*\n/)
        .map(parrafo => parrafo.trim())
        .filter(Boolean);

    const unidos = [];
    parrafos.forEach(function (parrafo) {
        const anterior = unidos[unidos.length - 1];
        if (anterior && /:\s*$/.test(anterior)) {
            unidos[unidos.length - 1] = `${anterior}\n${parrafo}`;
        } else {
            unidos.push(parrafo);
        }
    });

    const conector = /(?<=[.!?])\s+(?=(?:de igual manera|asimismo|adem[aá]s|finalmente|por [uú]ltimo|tambi[eé]n)\b)/i;

    return unidos
        .flatMap(bloque => bloque.split(conector))
        .map(bloque => bloque.trim())
        .filter(Boolean);
}

// Separa el texto por líneas y luego por puntos (., ! o ?)
function dividirEnOraciones(texto) {
    return texto
        .split(/\r?\n/)
        .flatMap(linea => linea.split(/(?<=[.!?])\s+/))
        .map(oracion => oracion.trim())
        .filter(Boolean);
}


// ===== Listas (materiales, donaciones) =====

// Devuelve { intro, items } si el bloque tiene una lista de cosas, o null
function extraerLista(bloque) {
    const lineas = bloque
        .split(/\r?\n/)
        .map(linea => linea.trim())
        .filter(Boolean);

    // Caso 1: una línea que termina en ":" y debajo los elementos
    let indice = -1;
    lineas.forEach(function (linea, i) {
        if (/:\s*$/.test(linea) && i < lineas.length - 1) {
            indice = i;
        }
    });

    let intro;
    let items;

    if (indice >= 0) {
        intro = lineas.slice(0, indice + 1).join(" ");
        items = lineas.slice(indice + 1);
    } else {
        // Caso 2: líneas con viñetas o emojis, sin dos puntos
        intro = lineas.filter(linea => !esVineta(linea)).join(" ");
        items = lineas.filter(esVineta);
    }

    items = items
        .filter(item => item.length <= 100 && !/agradezco|gracias|saludos|importante|atentamente/i.test(item))
        .map(limpiarItem)
        .filter(Boolean);

    // Debe tener al menos 2 elementos y una presentación que hable de traer o donar
    const presentaCosas = /siguiente|material|elemento|traer|traigan|donaci|lista|utiles|necesit|lleven|comprar/;

    if (items.length < 2 || !presentaCosas.test(normalizar(intro))) {
        return null;
    }

    return { intro: intro, items: items };
}

function esVineta(linea) {
    return /^([•·\-*]|\d+[.)]|\p{Extended_Pictographic})/u.test(linea);
}

// "🕯️ 2 cirios blancos." → "2 cirios blancos"
function limpiarItem(item) {
    return item
        .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D•·*\-\s]+/u, "")
        .replace(/^\d+[.)]\s+/, "")
        .split(/\.\s/)[0]
        .replace(/\.$/, "")
        .trim();
}


// ===== Elegir la oración principal =====

// Da puntos a cada oración y devuelve la mejor: { texto, puntos }, o null
function elegirOracionPrincipal(texto) {
    let mejor = null;

    dividirEnOraciones(texto).forEach(function (oracion) {
        const limpia = limpiarFrase(oracion);

        // Ignorar frases muy cortas o que solo son saludos
        if (limpia.length < 15 || esSaludo(normalizar(limpia))) {
            return;
        }

        const puntos = puntuar(limpia);

        if (puntos > 0 && (!mejor || puntos > mejor.puntos)) {
            mejor = { texto: limpia, puntos: puntos };
        }
    });

    return mejor;
}

// ¿Cuánto parece esta oración una instrucción?
function puntuar(frase) {
    const t = normalizar(frase);
    let puntos = 0;

    const verbo = buscarVerbo(frase);
    if (verbo) {
        puntos += verbo.debil ? 1 : 3;
    }

    if (/consiste en/.test(t)) puntos += 3;
    if (/\b(deberan|deben|debe|debera|tienen que|favor|solicitamos|solicito|pedimos|necesitamos|se solicita)\b/.test(t)) puntos += 2;
    if (/\b(tarea|deber|deberes|actividad|actividades|leccion|prueba|examen|evaluacion|exposicion|proyecto|consulta|materia)\b/.test(t)) puntos += 1;
    if (/\b(manana|lunes|martes|miercoles|jueves|viernes|\d{1,2} de [a-z]+)\b/.test(t)) puntos += 1;

    // Agradecimientos, despedidas y prohibiciones no son tareas
    if (/\b(agradezco|gracias|saludos|cordialmente|bendiga|bendiciones|atencion)\b/.test(t)) puntos -= 4;
    if (/^no\s/.test(t) || /\bno (traer|enviar|llevar)\b/.test(t)) puntos -= 3;
    if (/\b(copiaron|se trabajo|fue trabajado)\b/.test(t)) puntos -= 1;

    return puntos;
}

// Busca el verbo de acción más concreto de la oración
function buscarVerbo(frase) {
    let elegido = null;

    for (const palabra of frase.matchAll(/\p{L}+/gu)) {
        const infinitivo = VERBOS[normalizar(palabra[0])];
        if (!infinitivo) {
            continue;
        }

        const encontrado = {
            infinitivo: infinitivo,
            original: palabra[0],
            posicion: palabra.index,
            largo: palabra[0].length,
            debil: VERBOS_DEBILES.includes(infinitivo)
        };

        if (!elegido) {
            elegido = encontrado;
            if (!encontrado.debil) {
                break;
            }
        } else if (elegido.debil && !encontrado.debil) {
            elegido = encontrado;
            break;
        }
    }

    return elegido;
}


// ===== Limpiar y redactar =====

// Quita lo que sobra al inicio: emojis, viñetas, saludos y frases de cortesía
function limpiarFrase(frase) {
    let resultado = frase.trim();

    const prefijos = [
        /^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u,
        /^([•·\-*]|\d+[.)])\s*/,
        /^buen[oa]s\s+(d[ií]as|tardes|noches)\s*,?\s*/i,
        /^estimad[oa]s?\s+(padres|representantes|familias)(\s+de\s+familia)?\s*[,:]?\s*/i,
        /^por medio del?\s+presente\s*,?\s*/i,
        /^(de igual manera|asimismo|adem[aá]s|finalmente|por [uú]ltimo|tambi[eé]n|por favor|por este motivo|por tal motivo|por lo tanto|para la celebraci[oó]n)\s*,?\s*/i,
        /^(les|le|se les)\s+(informo|informamos|comunico|comunicamos|recuerdo|recordamos|solicito|solicitamos|pido|pedimos|indico|indicamos)\s*,?\s*(que\s+)?/i,
        /^importante\s*:\s*/i
    ];

    // Repetir mientras se siga quitando algo ("Finalmente, les recuerdo que...")
    let cambio = true;
    while (cambio) {
        cambio = false;
        prefijos.forEach(function (prefijo) {
            const nuevo = resultado.replace(prefijo, "");
            if (nuevo !== resultado) {
                resultado = nuevo.trim();
                cambio = true;
            }
        });
    }

    return resultado;
}

function esSaludo(textoNormalizado) {
    return /^(hola|estimad|buen[oa]s|saludos|reciban|querid|cordial|atentamente|notificaci|agradezco|muchas gracias)/.test(textoNormalizado);
}

// Convierte la oración principal en una instrucción clara
function redactarDescripcion(frase) {
    let texto = frase;

    // 1. "La actividad consiste en descomponer..." → "descomponer..."
    const consiste = texto.match(/consiste en\s+(.+)/i);

    if (consiste) {
        texto = consiste[1];
    } else {
        // 2. Empezar desde el verbo: "solicitamos que traigan un rosario" → "Traer un rosario"
        //    (con verbos como "realizarse" se deja la oración completa)
        const verbo = buscarVerbo(texto);
        if (verbo && !/se$/i.test(verbo.original)) {
            texto = capitalizar(verbo.infinitivo) + texto.slice(verbo.posicion + verbo.largo);
        }
    }

    // 3. Dónde está el material: "está subida en el aula virtual"
    let lugar = "";
    const disponible = texto.match(/\s+(?:est[aá]|se encuentra)\s+(?:subid[oa]|disponible|publicad[oa]|cargad[oa])\s+en\s+(.+)$/i);
    if (disponible) {
        lugar = disponible[1].replace(/[.\s]+$/, "");
        texto = texto.slice(0, disponible.index);
    }

    // 4. Quitar complementos que no aportan: ", para participar...", ", contenido que..."
    texto = texto.replace(/,\s*(para|con el fin|a fin|ya que|porque|contenido|el cual|la cual|lo cual|que fue|mismo que|misma que)\b.*$/i, "");

    // 5. Quitar la fecha (ya va en su propio campo) y la puntuación del final
    texto = quitarFechas(texto).replace(/[.:;,\s]+$/, "").trim();

    if (lugar) {
        texto += ` (está en ${lugar})`;
    }

    return recortar(comoOracion(capitalizar(texto)), 160);
}

// Quita expresiones de fecha: "hasta el lunes 12 de octubre", "para mañana"...
function quitarFechas(texto) {
    const dias = "lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo";
    const meses = Object.keys(MESES).join("|");

    return texto
        .replace(new RegExp(`\\s*(?:hasta|para|desde)?\\s*(?:el\\s+)?(?:d[ií]a\\s+)?(?:(?:${dias})\\s+)?\\d{1,2}\\s+de\\s+(?:${meses})(?:\\s+(?:de|del)\\s+\\d{4})?`, "gi"), "")
        .replace(/\s*(?:hasta|para)\s+(?:el\s+)?(?:d[ií]a\s+de\s+)?(?:pasado\s+)?ma[nñ]ana\b/gi, "")
        .replace(new RegExp(`\\s*(?:hasta|para)\\s+el\\s+(?:${dias})\\b`, "gi"), "");
}


// ===== Detectores =====

// "deber", "comprar" o "evento" según las palabras
function detectarTipo(texto) {
    const t = normalizar(texto);

    if (/\b(reunion|asamblea|evento|festival|desfile|excursion|paseo|salida pedagogica|casa abierta|minuto civico|convivencia|uniforme)\b/.test(t)) {
        return "evento";
    }
    if (/\b(traer|traigan|traiga|comprar|compren|material|materiales|utiles|llevar|lleven|donar|donen|donacion|sobre)\b/.test(t)) {
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


// ===== Funciones de ayuda =====

// Quita tildes y pasa a minúsculas: "Matemática" → "matematica"
function normalizar(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// Al copiar varios mensajes de WhatsApp aparece "[2/10/26, 19:06] Profe Luz: ..."
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
    if (texto && texto === texto.toUpperCase()) {
        const minusculas = texto.toLowerCase();
        return minusculas.charAt(0).toUpperCase() + minusculas.slice(1);
    }
    return texto;
}

// "descomponer los números" → "Descomponer los números"
function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function recortar(texto, maximo) {
    return texto.length > maximo ? `${texto.slice(0, maximo - 1).trimEnd()}…` : texto;
}