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

        if (
            observadorActivo ||
            !document.body
        ) {
            return;
        }

        const observador =
            new MutationObserver(cambios => {

                const cambioRelevante =
                    cambios.some(cambio => {

                        if (cambio.type === "childList") {
                            return true;
                        }

                        if (cambio.type === "attributes") {

                            return [
                                "id",
                                "onclick",
                                "aria-label",
                                "title",
                                "data-titulo",
                                "data-nombre",
                                "placeholder",
                                "disabled",
                                "aria-disabled"
                            ].includes(cambio.attributeName);

                        }

                        return cambio.type === "characterData";

                    });

                if (cambioRelevante) {
                    programarEscaneo();
                }

            });

        observador.observe(
            document.body,
            {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    "id",
                    "onclick",
                    "aria-label",
                    "title",
                    "data-titulo",
                    "data-nombre",
                    "placeholder",
                    "disabled",
                    "aria-disabled"
                ],
                characterData: true
            }
        );

        observadorActivo = true;
    }


    /* =====================================================
       CARGAR JSON EXISTENTE
       ===================================================== */

    async function cargarComandos() {

        if (comandosIA) {
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

            comandosIA = await respuesta.json();

            return comandosIA;

        } catch (error) {

            console.warn(
                "Mi Espacio IA: no se pudo cargar el archivo opcional de comandos.",
                error
            );

            return null;
        }
    }


    /* =====================================================
       PUNTUAR COINCIDENCIAS
       ===================================================== */

    function puntuarCoincidencia(pedido, texto) {

        const candidato = normalizar(texto);

        if (!pedido || !candidato) return 0;

        if (pedido === candidato) return 100;

        if (
            candidato.startsWith(pedido) &&
            pedido.length >= 2
        ) {
            return 82;
        }

        const palabras =
            candidato.split(/\s+/);

        if (
            palabras.some(
                palabra => palabra === pedido
            )
        ) {
            return 78;
        }

        if (
            palabras.some(
                palabra =>
                    palabra.startsWith(pedido) &&
                    pedido.length >= 2
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
       BUSCAR MÓDULOS
       ===================================================== */

    function buscarModulos(pedido) {

        return catalogoIndex.modulos

            .map(modulo => ({

                modulo,

                puntaje: puntuarCoincidencia(
                    pedido,
                    modulo.nombre
                )

            }))

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
       MOSTRAR OPCIONES
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

        responder(
            titulo +
            "\n" +
            unicas.slice(0, 12)
                .map(
                    (opcion, indice) =>
                        (indice + 1) + ". " + opcion
                )
                .join("\n") +
            "\n\nAgregá alguna palabra para precisar qué querés abrir."
        );
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

            return true;
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

        const original =
            String(texto || "").trim();

        if (!original) {

            responder(
                "Decime qué necesitás y lo busco en Mi Espacio."
            );

            return;
        }

        ultimaConsulta = original;

        if (!catalogoIndex.fechaEscaneo) {
            escanearIndex();
        }

        const pedido =
            limpiarPedido(original);

        if (!pedido) {

            responder(
                "Decime qué módulo o contenido querés encontrar."
            );

            return;
        }

        // Carga opcional del JSON existente.

        await cargarComandos();

        // Actualizar el catálogo antes de buscar.

        escanearIndex();

        const modulos =
            buscarModulos(pedido);

        const elementos =
            buscarElementos(pedido);

        const quiereAccion =
            VERBOS_DE_ACCION.test(
                normalizar(original)
            );


        /* -----------------------------------------------
           1. NOMBRE EXACTO DE MÓDULO
           ----------------------------------------------- */

        const moduloExacto =
            modulos.find(
                item => item.puntaje === 100
            );

        if (
            moduloExacto &&
            modulos.filter(
                item => item.puntaje === 100
            ).length === 1
        ) {

            if (
                abrirModulo(moduloExacto.modulo)
            ) {

                responder(
                    "Abriendo " +
                    moduloExacto.modulo.nombre +
                    "."
                );

                return;
            }
        }


        /* -----------------------------------------------
           2. CONTROL INTERNO EXACTO
           ----------------------------------------------- */

        const elementoExacto =
            elementos.find(
                item => item.puntaje === 100
            );

        const exactosElementos =
            elementos.filter(
                item => item.puntaje === 100
            );

        if (
            quiereAccion &&
            exactosElementos.length === 1
        ) {

            const resultado =
                elementoExacto;

            if (
                ejecutarElemento(
                    resultado,
                    original
                )
            ) {

                responder(
                    "Listo. Activé " +
                    resultado.item.nombre +
                    "."
                );

                return;
            }

            if (resultado.item.modulo) {

                const padre =
                    catalogoIndex.modulos.find(
                        modulo =>
                            modulo.destino ===
                            resultado.item.modulo
                    );

                if (
                    padre &&
                    abrirModulo(padre)
                ) {

                    responder(
                        "Abrí " +
                        padre.nombre +
                        ". El elemento está dentro de ese módulo; completá la acción desde allí."
                    );

                    return;
                }
            }
        }


        /* -----------------------------------------------
           3. CONTENIDO INTERNO Y MÓDULO PADRE
           ----------------------------------------------- */

        const mejoresElementos =
            elementos.filter(
                item => item.puntaje >= 68
            );

        const padres = [
            ...new Set(
                mejoresElementos
                    .map(item => item.item.modulo)
                    .filter(Boolean)
            )
        ];

        if (
            mejoresElementos.length &&
            padres.length === 1
        ) {

            const padre =
                catalogoIndex.modulos.find(
                    modulo =>
                        modulo.destino === padres[0]
                );

            if (
                padre &&
                abrirModulo(padre)
            ) {

                responder(
                    "Encontré ‘" +
                    mejoresElementos[0].item.nombre +
                    "’ dentro de " +
                    padre.nombre +
                    ". Abrí ese módulo."
                );

                return;
            }
        }


        /* -----------------------------------------------
           4. VARIAS COINCIDENCIAS
           ----------------------------------------------- */

        const opciones = [];

        modulos
            .filter(item => item.puntaje >= 55)
            .forEach(item => {

                opciones.push(
                    item.modulo.nombre
                );

            });

        mejoresElementos
            .slice(0, 8)
            .forEach(item => {

                const nombre =
                    item.item.nombre;

                opciones.push(
                    item.item.modulo
                        ? nombre + " — " + item.item.modulo
                        : nombre
                );

            });

        if (opciones.length) {

            describirOpciones(
                "Encontré estas coincidencias:",
                opciones
            );

            return;
        }


        /* -----------------------------------------------
           5. SIN COINCIDENCIAS
           ----------------------------------------------- */

        responder(
            "Todavía no encuentro ‘" +
            original +
            "’ en los elementos visibles de Mi Espacio. Probá con el nombre del módulo o con otra palabra."
        );

    }


    /* =====================================================
       INICIALIZAR
       ===================================================== */

    function iniciar() {

        escanearIndex();

        observarIndex();

    }


    if (
        document.readyState === "loading"
    ) {

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