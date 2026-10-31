/* =========================================================
   MI ESPACIO IA - MOTOR DINÁMICO
   Lee el index actual en tiempo de ejecución.
   No modifica módulos ni archivos JSON.
   ========================================================= */

const MiEspacioIA = (() => {

    const URL_COMANDOS =
        "https://raw.githubusercontent.com/pgaglian/Mi-Espacio-Datos/main/IA/IA-comandos.json";

    let comandosIA = null;

    let catalogoIndex = {
        modulos: [],
        elementos: [],
        fechaEscaneo: null
    };

    let observadorActivo = false;
    let temporizadorEscaneo = null;
    let ultimaConsulta = "";

    const MODULOS_EXCLUIDOS = new Set([
        "panelCliente",
        "acciones",
        "menu",
        "menuAndroid",
        "header",
        "panelMiEspacioIA",
        "contenidoMiEspacioIA",
        "respuestaMiEspacioIA",
        "entradaMiEspacioIA"
    ]);

    const VERBOS_DE_ACCION =
        /\b(abr[ií]|abrime|abrir|mostr[aá]|mostrame|mostrar|entr[aá]|entrar|ingres[aá]|ingresar|seleccion[aá]|seleccionar|eleg[ií]|elegir|activ[aá]|activar|inici[aá]|iniciar|reproduc[ií]|reproducir|pon[eé]|poner|us[aá]|usar)\b/;

    const VERBOS_DESTRUCTIVOS =
        /\b(elimin[aá]|eliminar|borr[aá]|borrar|quit[aá]|quitar|restablec[eé]|restablecer|formate[aá]|formatear)\b/;


    /* =====================================================
       RESPUESTAS
       ===================================================== */

    function responder(mensaje) {

        const salida =
            document.getElementById("respuestaMiEspacioIA");

        if (salida) {
            salida.textContent = mensaje;
        }
    }


    /* =====================================================
       NORMALIZACIÓN
       ===================================================== */

    function normalizar(texto) {

        return String(texto || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9_\s-]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }


    function limpiarPedido(texto) {

        let pedido = normalizar(texto);

        pedido = pedido.replace(
            /^(por favor|porfa)\s+/,
            ""
        );

        pedido = pedido.replace(
            /^(hola|che)\s+/,
            ""
        );

        pedido = pedido.replace(
            /^(mostrame|mostrarme|abrime|abrir|abri|quiero ver|quiero abrir|necesito ver|necesito abrir|ver|mostrar|buscame|buscar|busca|entra a|entrar a|ingresa a|ingresar a)\s+/,
            ""
        );

        pedido = pedido.replace(
            /^(mis|mi|el|la|los|las|un|una|unos|unas)\s+/,
            ""
        );

        pedido = pedido.replace(
            /\s+(por favor|porfa)$/,
            ""
        );

        return pedido.trim();
    }


    /* =====================================================
       OBTENER TEXTO DE UN ELEMENTO
       ===================================================== */

    function obtenerTexto(elemento) {

        if (!elemento) return "";

        const atributos = [
            elemento.getAttribute("aria-label"),
            elemento.getAttribute("title"),
            elemento.getAttribute("data-titulo"),
            elemento.getAttribute("data-nombre"),
            elemento.getAttribute("placeholder"),
            elemento.getAttribute("alt")
        ];

        const texto = [
            ...atributos,
            elemento.innerText,
            elemento.textContent
        ]
            .filter(Boolean)
            .join(" ");

        return texto
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 180);
    }


    /* =====================================================
       DETECTAR MÓDULOS
       ===================================================== */

    function obtenerLlamadasMostrar(codigo) {

        const resultados = [];

        const regex =
            /\bmostrar\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

        let coincidencia;

        while (
            (coincidencia = regex.exec(codigo || "")) !== null
        ) {

            resultados.push(coincidencia[1]);

        }

        return resultados;
    }


    function obtenerModulosDelIndex() {

        const encontrados = new Map();

        document.querySelectorAll("[onclick]")
            .forEach(elemento => {

                obtenerLlamadasMostrar(
                    elemento.getAttribute("onclick")
                ).forEach(destino => {

                    if (MODULOS_EXCLUIDOS.has(destino)) {
                        return;
                    }

                    const contenedor =
                        document.getElementById(destino);

                    encontrados.set(destino, {

                        nombre: destino,

                        destino: destino,

                        disponible: Boolean(contenedor),

                        elemento: contenedor || null

                    });

                });

            });

        return Array.from(encontrados.values());
    }


    /* =====================================================
       RELACIONAR ELEMENTOS CON SU MÓDULO PADRE
       ===================================================== */

    function obtenerModuloPadre(elemento, modulos) {

        let actual = elemento;

        while (
            actual &&
            actual !== document.body
        ) {

            if (
                actual.id &&
                modulos.some(
                    modulo => modulo.destino === actual.id
                )
            ) {

                return actual.id;

            }

            actual = actual.parentElement;
        }

        return null;
    }


    /* =====================================================
       ESCANEAR EL INDEX
       ===================================================== */

    function escanearIndex() {

        const modulos =
            obtenerModulosDelIndex();

        const elementos = [];

        const vistos = new WeakSet();

        const selector = [
            "[id]",
            "[onclick]",
            "button",
            "a",
            "input",
            "select",
            "textarea",
            "[role='button']",
            "[role='tab']",
            "label"
        ].join(",");

        document.querySelectorAll(selector)
            .forEach(elemento => {

                if (vistos.has(elemento)) return;

                vistos.add(elemento);

                if (
                    elemento.closest("#panelMiEspacioIA")
                ) {
                    return;
                }

                const id = elemento.id || "";

                const texto =
                    obtenerTexto(elemento);

                const codigo =
                    elemento.getAttribute("onclick") || "";

                const tag =
                    elemento.tagName.toLowerCase();

                const esInteractivo =
                    /^(button|a|input|select|textarea|label)$/.test(tag) ||
                    elemento.getAttribute("role") === "button" ||
                    elemento.getAttribute("role") === "tab" ||
                    Boolean(codigo);

                if (!id && !texto) return;

                if (
                    elemento.disabled ||
                    elemento.getAttribute("aria-disabled") === "true"
                ) {
                    return;
                }

                elementos.push({

                    id: id || null,

                    nombre: texto || id,

                    tipo: tag,

                    interactivo: esInteractivo,

                    tieneAccionDeclarada: Boolean(codigo),

                    modulo: obtenerModuloPadre(
                        elemento,
                        modulos
                    ),

                    elemento: elemento

                });

            });

        catalogoIndex = {

            modulos,

            elementos,

            fechaEscaneo: new Date().toISOString()

        };
            console.info(
            "🐸 Mi Espacio IA: index actualizado",
            {
                modulos: modulos.length,
                elementos: elementos.length
            }
        );

        return obtenerCatalogo();
    }


    /* =====================================================
       DEVOLVER CATÁLOGO
       ===================================================== */

    function obtenerCatalogo() {

        return {

            modulos: catalogoIndex.modulos.map(
                ({ elemento, ...modulo }) => modulo
            ),

            elementos: catalogoIndex.elementos.map(
                ({ elemento, ...item }) => item
            ),

            fechaEscaneo: catalogoIndex.fechaEscaneo

        };
    }


    /* =====================================================
       ACTUALIZAR ESCANEO AUTOMÁTICAMENTE
       ===================================================== */

    function programarEscaneo() {

        clearTimeout(temporizadorEscaneo);

        temporizadorEscaneo = setTimeout(() => {

            temporizadorEscaneo = null;

            escanearIndex();

        }, 700);
    }


    /* =====================================================
       OBSERVAR CAMBIOS EN EL INDEX
       ===================================================== */

    function observarIndex() {

        // Se desactiva la observación continua del documento.
        // Otros módulos modifican el DOM constantemente y eso
        // provocaba escaneos repetidos sin cambios útiles.
        // El catálogo se construye al iniciar Mi Espacio IA.

        observadorActivo = true;
    }


    /* =====================================================
       CARGAR Y VALIDAR COMANDOS JSON
       ===================================================== */

    async function cargarComandos() {

        if (
            comandosIA &&
            Array.isArray(comandosIA.acciones) &&
            Array.isArray(comandosIA.ambientes)
        ) {
            return comandosIA;
        }

        try {

            const respuesta = await fetch(
                URL_COMANDOS,
                { cache: "no-cache" }
            );

            if (!respuesta.ok) {
                throw new Error(
                    "HTTP " + respuesta.status
                );
            }

            const datos = await respuesta.json();

            if (
                !datos ||
                !Array.isArray(datos.acciones) ||
                !Array.isArray(datos.ambientes)
            ) {
                throw new Error(
                    "La estructura del JSON no es válida."
                );
            }

            const validarLista = lista => {

                return lista.filter(item => {

                    return (
                        item &&
                        typeof item.nombre === "string" &&
                        typeof item.destino === "string" &&
                        Array.isArray(item.comandos)
                    );

                }).map(item => ({

                    id: item.id || "",
                    nombre: item.nombre,
                    icono: item.icono || "",
                    destino: item.destino,

                    comandos: item.comandos.filter(
                        comando =>
                            typeof comando === "string" &&
                            comando.trim() !== ""
                    )

                }));

            };

            comandosIA = {

                acciones: validarLista(datos.acciones),

                ambientes: validarLista(datos.ambientes)

            };

            console.info(
                "🐸 Mi Espacio IA: comandos JSON cargados",
                {
                    acciones: comandosIA.acciones.length,
                    ambientes: comandosIA.ambientes.length
                }
            );

            return comandosIA;

        } catch (error) {

            console.warn(
                "Mi Espacio IA: error al cargar comandos JSON.",
                error
            );

            comandosIA = null;

            return null;
        }
    }


    /* =====================================================
       PUNTUAR COINCIDENCIAS
       ===================================================== */

    function puntuarCoincidencia(pedido, texto) {

        const candidato = normalizar(texto);

        if (!pedido || !candidato) return 0;

        // Una sola letra: buscar únicamente como inicio.
        if (pedido.length === 1) {

            return candidato.startsWith(pedido)
                ? 40
                : 0;
        }

        if (pedido === candidato) return 100;

        if (candidato.startsWith(pedido)) {
            return 82;
        }

        const palabras = candidato.split(/\s+/);

        if (
            palabras.some(
                palabra => palabra === pedido
            )
        ) {
            return 78;
        }

        if (
            palabras.some(
                palabra => palabra.startsWith(pedido)
            )
        ) {
            return 68;
        }

        if (
            pedido.length >= 4 &&
            candidato.includes(pedido)
        ) {
            return 55;
        }

        return 0;
    }


    /* =====================================================
       BUSCAR MÓDULOS Y ALIAS DEL JSON
       ===================================================== */

    function buscarModulos(pedido) {

        const configurados = [

            ...(comandosIA?.acciones || []),

            ...(comandosIA?.ambientes || [])

        ];

        return catalogoIndex.modulos

            .map(modulo => {

                const configuracion =
                    configurados.find(
                        item =>
                            item.destino === modulo.destino
                    );

                let puntaje =
                    puntuarCoincidencia(
                        pedido,
                        modulo.nombre
                    );

                if (configuracion) {

                    puntaje = Math.max(
                        puntaje,

                        puntuarCoincidencia(
                            pedido,
                            configuracion.nombre
                        )
                    );

                    configuracion.comandos.forEach(comando => {

                        puntaje = Math.max(
                            puntaje,

                            puntuarCoincidencia(
                                pedido,
                                comando
                            )
                        );

                    });

                }

                return {

                    modulo: configuracion
                        ? {
                            ...modulo,
                            nombre: configuracion.nombre,
                            icono: configuracion.icono
                        }
                        : modulo,

                    puntaje

                };

            })

            .filter(item => item.puntaje > 0)

            .sort(
                (a, b) => b.puntaje - a.puntaje
            );
    }


    /* =====================================================
       BUSCAR ELEMENTOS INTERNOS
       ===================================================== */

    function buscarElementos(pedido) {

        return catalogoIndex.elementos

            .map(item => ({

                item,

                puntaje: puntuarCoincidencia(
                    pedido,
                    item.nombre
                )

            }))

            .filter(
                resultado => resultado.puntaje > 0
            )

            .sort(
                (a, b) => b.puntaje - a.puntaje
            );
    }
        /* =====================================================
       ABRIR MÓDULO
       ===================================================== */

    function abrirModulo(modulo) {

        if (
            !modulo ||
            !modulo.disponible
        ) {
            return false;
        }

        if (
            typeof window.mostrar !== "function"
        ) {
            return false;
        }

        window.mostrar(modulo.destino);

        return true;
    }


    /* =====================================================
       MOSTRAR OPCIONES SELECCIONABLES
       ===================================================== */

    function describirOpciones(titulo, opciones) {

        const unicas = [];

        const claves = new Set();

        opciones.forEach(opcion => {

            const clave = normalizar(opcion);

            if (!clave || claves.has(clave)) {
                return;
            }

            claves.add(clave);

            unicas.push(opcion);

        });

        const contenedor =
            document.getElementById("respuestaMiEspacioIA");

        if (!contenedor) {
            responder(titulo);
            return;
        }

        contenedor.innerHTML = "";

        const encabezado =
            document.createElement("div");

        encabezado.textContent = titulo;

        encabezado.style.marginBottom = "10px";

        contenedor.appendChild(encabezado);

        unicas.slice(0, 12).forEach(opcion => {

            const boton =
                document.createElement("button");

            boton.type = "button";

            boton.textContent = opcion;

            boton.style.display = "block";
            boton.style.width = "100%";
            boton.style.margin = "6px 0";
            boton.style.padding = "9px 12px";
            boton.style.borderRadius = "8px";
            boton.style.border = "1px solid #D4AF37";
            boton.style.background = "#252525";
            boton.style.color = "#FFFFFF";
            boton.style.cursor = "pointer";
            boton.style.textAlign = "left";

            boton.addEventListener("click", () => {

                procesar(opcion);

            });

            contenedor.appendChild(boton);

        });

        const aclaracion =
            document.createElement("div");

        aclaracion.textContent =
            "Elegí una opción para continuar.";

        aclaracion.style.marginTop = "10px";

        contenedor.appendChild(aclaracion);

    }


    /* =====================================================
       VALIDAR ELEMENTO ANTES DE EJECUTAR
       ===================================================== */

    function encontrarElementoVisible(resultado) {

        const elemento =
            resultado &&
            resultado.item &&
            resultado.item.elemento;

        if (
            !elemento ||
            !elemento.isConnected
        ) {
            return null;
        }

        if (
            elemento.closest("#panelMiEspacioIA")
        ) {
            return null;
        }

        return elemento;
    }


    /* =====================================================
       EJECUTAR CONTROL REAL
       ===================================================== */

    function ejecutarElemento(resultado, textoOriginal) {

        const elemento =
            encontrarElementoVisible(resultado);

        if (!elemento) return false;

        if (
            VERBOS_DESTRUCTIVOS.test(
                normalizar(textoOriginal)
            )
        ) {

            responder(
                "Esa acción puede borrar o modificar información. Abrí el módulo y realizala desde sus controles para evitar una operación accidental."
            );

            return false;
        }

        if (!resultado.item.interactivo) {
            return false;
        }

        if (
            elemento.disabled ||
            elemento.getAttribute("aria-disabled") === "true"
        ) {
            return false;
        }

        // Evitar enviar formularios accidentalmente.

        if (
            elemento.tagName === "BUTTON" &&
            elemento.type === "submit"
        ) {
            return false;
        }

        if (
            elemento.tagName === "INPUT" ||
            elemento.tagName === "TEXTAREA" ||
            elemento.tagName === "SELECT"
        ) {
            return false;
        }

        elemento.click();

        return true;
    }
    /* =====================================================
   PROCESAR PEDIDOS
   ===================================================== */

async function procesar(texto) {

    const original = String(texto || "").trim();

    if (!original) {
        responder("Decime qué necesitás y te ayudo.");
        return;
    }

    ultimaConsulta = original;

    if (!catalogoIndex.fechaEscaneo) {
        escanearIndex();
    }

    const pedido = limpiarPedido(original);

    await cargarComandos();

    // No se vuelve a escanear el index en cada consulta.
    // El catálogo se construye al iniciar Mi Espacio IA.

    const modulos = buscarModulos(pedido);
    const elementos = buscarElementos(pedido);

    const quiereAccion =
        VERBOS_DE_ACCION.test(normalizar(original));

    /* -----------------------------------------
       PEDIDOS DE UNA SOLA LETRA
       ----------------------------------------- */

    if (pedido.length === 1) {

        if (modulos.length) {

            describirOpciones(modulos);
            return;

        }

        responder(
            "No encontré opciones que comiencen con esa letra."
        );

        return;
    }

    /* -----------------------------------------
       COINCIDENCIA EXACTA DE MÓDULO
       ----------------------------------------- */

    const moduloExacto = modulos.find(
        modulo => modulo.score >= 100
    );

    if (moduloExacto) {

        abrirModulo(moduloExacto);

        responder(
            "Abriendo " + moduloExacto.nombre + "."
        );

        return;
    }

    /* -----------------------------------------
       COINCIDENCIA EXACTA DE ELEMENTO
       ----------------------------------------- */

    const elementoExacto = elementos.filter(
        elemento => elemento.score >= 100
    );

    if (
        quiereAccion &&
        elementoExacto.length === 1
    ) {

        const ejecutado =
            ejecutarElemento(elementoExacto[0]);

        if (ejecutado) {

            responder(
                "Listo, ejecuté " +
                elementoExacto[0].nombre + "."
            );

            return;
        }

        if (elementoExacto[0].modulo) {

            abrirModulo({
                nombre: elementoExacto[0].modulo,
                destino: elementoExacto[0].destino
            });

            responder(
                "Abrí " +
                elementoExacto[0].modulo + "."
            );

            return;
        }
    }

    /* -----------------------------------------
       MEJORES COINCIDENCIAS DE ELEMENTOS
       ----------------------------------------- */

    const mejoresElementos = elementos.filter(
        elemento => elemento.score >= 68
    );

    if (mejoresElementos.length) {

        const modulosEncontrados = [
            ...new Set(
                mejoresElementos
                    .map(elemento => elemento.modulo)
                    .filter(Boolean)
            )
        ];

        if (modulosEncontrados.length === 1) {

            const nombreModulo =
                modulosEncontrados[0];

            const moduloEncontrado =
                modulos.find(
                    modulo =>
                        normalizar(modulo.nombre) ===
                        normalizar(nombreModulo)
                );

            if (moduloEncontrado) {

                abrirModulo(moduloEncontrado);

                responder(
                    "Abrí " + nombreModulo +
                    ". ¿Qué opción necesitás?"
                );

                return;
            }
        }
    }

    /* -----------------------------------------
       VARIAS COINCIDENCIAS
       ----------------------------------------- */

    const coincidenciasModulos =
        modulos.filter(modulo => modulo.score >= 55);

    const coincidenciasElementos =
        elementos.slice(0, 8).map(elemento => ({
            ...elemento,
            nombre:
                elemento.nombre +
                (elemento.modulo
                    ? " — " + elemento.modulo
                    : "")
        }));

    const coincidencias = [
        ...coincidenciasModulos,
        ...coincidenciasElementos
    ];

    if (coincidencias.length > 1) {

        describirOpciones(coincidencias);

        return;
    }

    /* -----------------------------------------
       SIN COINCIDENCIAS
       ----------------------------------------- */

    responder(
        "No encontré esa opción en Mi Espacio. " +
        "Probá con otro nombre o decime qué querés hacer."
    );
}


/* =====================================================
   INICIO
   ===================================================== */

function iniciar() {

    escanearIndex();

    observarIndex();

}

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        iniciar,
        { once: true }
    );

} else {

    iniciar();

}


/* =====================================================
   API PÚBLICA
   ===================================================== */

return {

    procesar,

    responder,

    cargarComandos,

    escanearIndex,

    obtenerCatalogo,

    observarIndex,

    limpiarPedido

};

})();
