// ===== Analizador de mensajes (copia del analizador.js de la app) =====
// Apps Script no puede importar archivos de tu repositorio de GitHub,
// por eso esta es una copia. Si mejoras uno, mejora también el otro.

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

const SENALES = [
    { patron: /consiste en/, puntos: 5 },
    { patron: /\b(deberan|deben|debe|debera|tienen que|favor de)\b/, puntos: 3 },
    { patron: /\b(tarea|actividad|trabajo|leccion|prueba|examen|evaluacion|exposicion|proyecto|consulta)\b/, puntos: 2 },
    { patron: /\b(realizar|realizarse|elaborar|traer|estudiar|investigar|repasar|resolver|dibujar|escribir|leer|presentar|asistir|llevar|comprar|descomponer|representar|pintar|recortar|completar)\b/, puntos: 2 },
    { patron: /\b(manana|lunes|martes|miercoles|jueves|viernes|\d{1,2} de [a-z]+)\b/, puntos: 1 }
];

const RUIDO = [
    { patron: /\b(agradezco|gracias|saludos|atencion|cordialmente|bendiciones)\b/, puntos: -4 },
    { patron: /\b(copiaron|se trabajo|fue trabajado)\b/, puntos: -1 }
];

function analizarMensaje(texto, asunto = "", hoy = new Date()) {
    const limpio = quitarEncabezadosWhatsApp(texto);
    const todo = `${asunto}\n${limpio}`;

    const principal = elegirOracionPrincipal(limpio);
    const enfoque = principal ? `${asunto}\n${principal.texto}` : todo;

    const tipo = detectarTipo(enfoque);
    const materiaEnfoque = detectarMateria(enfoque);

    return {
        tipo: tipo,
        materia: materiaEnfoque !== "otra" ? materiaEnfoque : detectarMateria(todo),
        fecha: (principal && detectarFecha(principal.texto, hoy))
            || detectarFecha(limpio, hoy)
            || detectarFecha(asunto, hoy),
        descripcion: detectarDescripcion(limpio, asunto, tipo, principal)
    };
}

function elegirOracionPrincipal(texto) {
    let mejor = null;

    dividirEnOraciones(texto).forEach(function (oracion) {
        const limpia = limpiarFrase(oracion);
        const t = normalizar(limpia);

        if (limpia.length < 15 || esSaludo(t)) {
            return;
        }

        let puntos = 0;
        [...SENALES, ...RUIDO].forEach(function (senal) {
            if (senal.patron.test(t)) {
                puntos += senal.puntos;
            }
        });

        if (puntos > 0 && (!mejor || puntos > mejor.puntos)) {
            mejor = { texto: limpia, puntos: puntos };
        }
    });

    return mejor;
}

function dividirEnOraciones(texto) {
    return texto
        .split(/\r?\n/)
        .flatMap(linea => linea.split(/(?<=[.!?])\s+/))
        .map(oracion => oracion.trim())
        .filter(Boolean);
}

function limpiarFrase(frase) {
    let resultado = frase.replace(/^([•·\-*]|\d+[.)])\s*/, "").trim();

    const prefijos = [
        /^estimad[oa]s?\s+(padres|representantes|familias)(\s+de\s+familia)?\s*[,:]?\s*/i,
        /^por medio del?\s+presente\s*,?\s*/i,
        /^(de igual manera|asimismo|adem[aá]s|finalmente|por [uú]ltimo|tambi[eé]n|por favor)\s*,?\s*/i,
        /^(les|le|se les)\s+(informo|informamos|comunico|comunicamos|recuerdo|recordamos|solicito|pido|indico)\s+(que\s+)?/i
    ];

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
    return /^(hola|estimad|buen[oa]s|saludos|reciban|querid|cordial|atentamente|notificaci|agradezco)/.test(textoNormalizado);
}

function redactarDescripcion(frase) {
    let texto = frase;

    const consiste = texto.match(/consiste en\s+(.+)/i);
    if (consiste) {
        texto = consiste[1];
    }

    texto = texto.replace(/,\s*(contenido|el cual|la cual|lo cual|que fue|mismo que|misma que)\b.*$/i, "");
    texto = texto.replace(/[.:;,\s]+$/, "").trim();

    return recortar(comoOracion(capitalizar(texto)), 160);
}

function detectarTipo(texto) {
    const t = normalizar(texto);

    if (/\b(reunion|asamblea|evento|festival|desfile|excursion|paseo|salida pedagogica|casa abierta|minuto civico|convivencia|uniforme)\b/.test(t)) {
        return "evento";
    }
    if (/\b(traer|comprar|material|materiales|utiles|llevar)\b/.test(t)) {
        return "comprar";
    }
    return "deber";
}

function detectarMateria(texto) {
    const t = normalizar(texto);
    const encontrada = MATERIAS.find(m => m.patron.test(t));
    return encontrada ? encontrada.valor : "otra";
}

function detectarFecha(texto, hoy) {
    if (!texto) {
        return "";
    }

    const t = normalizar(texto);
    const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    const nombresMeses = Object.keys(MESES).join("|");
    let m = t.match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${nombresMeses})(?:\\s+(?:de|del)\\s+(\\d{4}))?`));
    if (m) {
        return armarFecha(base, Number(m[1]), MESES[m[2]], m[3] ? Number(m[3]) : null);
    }

    m = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    if (m) {
        let anio = m[3] ? Number(m[3]) : null;
        if (anio && anio < 100) {
            anio += 2000;
        }
        return armarFecha(base, Number(m[1]), Number(m[2]) - 1, anio);
    }

    if (/pasado\s+manana/.test(t)) {
        return aTextoFecha(sumarDias(base, 2));
    }

    m = t.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
    if (m) {
        let dias = (DIAS_SEMANA[m[1]] - base.getDay() + 7) % 7;
        if (dias === 0) {
            dias = 7;
        }
        return aTextoFecha(sumarDias(base, dias));
    }

    if (/(?<!la\s)\bmanana\b/.test(t)) {
        return aTextoFecha(sumarDias(base, 1));
    }

    if (/\bhoy\b/.test(t)) {
        return aTextoFecha(base);
    }

    return "";
}

function detectarDescripcion(texto, asunto, tipo, principal) {
    const lineas = texto
        .split(/\r?\n/)
        .map(linea => linea.trim())
        .filter(Boolean);

    const marcaVineta = /^([•·\-*]|\d+[.)])\s*/;
    const vinetas = lineas
        .filter(linea => marcaVineta.test(linea))
        .map(linea => linea.replace(marcaVineta, "").split(/\.\s/)[0].replace(/\.$/, "").trim())
        .filter(Boolean);

    if (tipo === "comprar" && vinetas.length > 0) {
        return recortar(`Traer: ${vinetas.join(", ")}`, 160);
    }

    if (principal && principal.puntos >= 4) {
        return redactarDescripcion(principal.texto);
    }

    const asuntoLimpio = asunto.replace(/^\s*(notificaci[oó]n|re|fwd?)\s*:\s*/i, "").trim();
    if (asuntoLimpio) {
        return recortar(comoOracion(asuntoLimpio), 100);
    }

    if (principal) {
        return redactarDescripcion(principal.texto);
    }

    const primera = lineas.map(limpiarFrase).find(linea => linea && !esSaludo(normalizar(linea)));
    return primera ? recortar(comoOracion(primera), 100) : "";
}

function normalizar(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function quitarEncabezadosWhatsApp(texto) {
    return texto.replace(/^\[[^\]]*\]\s*[^:\n]{1,40}:\s*/gm, "");
}

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

function aTextoFecha(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

function comoOracion(texto) {
    if (texto === texto.toUpperCase()) {
        const minusculas = texto.toLowerCase();
        return minusculas.charAt(0).toUpperCase() + minusculas.slice(1);
    }
    return texto;
}

function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function recortar(texto, maximo) {
    return texto.length > maximo ? `${texto.slice(0, maximo - 1).trimEnd()}…` : texto;
}