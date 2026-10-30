
const MiEspacioIA = (() => {

    const URL_COMANDOS =
        "https://raw.githubusercontent.com/pgaglian/Mi-Espacio-Datos/main/IA/IA-comandos.json";

    let comandosIA = null;
    let catalogoIndex = {
        modulos: [],
        tarjetas: [],
        controles: [],
        funciones: [],
        fechaEscaneo: null
    };

    let observadorActivo = false;
    let escaneoPendiente = false;


    /* =====================================================
       RESPUESTAS
       ===================================================== */

    function responder(mensaje) {

        const elemento =
            document.getElementById("respuestaMiEspacioIA");

        if (elemento) {
            elemento.textContent = mensaje;
        }
    }


    /* =====================================================
       NORMALIZAR TEXTOS
       ===================================================== */

    function normalizar(texto) {

        return String(texto || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }


    /* =====================================================
       CARGAR COMANDOS DEL JSON
       ===================================================== */

    async function cargarComandos() {

        if (comandosIA) {
            return comandosIA;
        }

        try {

            const respuesta = await fetch(URL_COMANDOS);

            if (!respuesta.ok) {
                throw new Error(
                    "No se pudo cargar IA-comandos.json"
                );
            }

            comandosIA = await respuesta.json();

            return comandosIA;

        } catch (error) {

            console.error(
                "Mi Espacio IA:",
                error
            );

            responder(
                "No pude cargar mis comandos. Intentá nuevamente."
            );

            return null;
        }
    }


    /* =====================================================
       OBTENER TEXTO DESCRIPTIVO DE UN ELEMENTO
       ===================================================== */

    function obtenerTexto(elemento) {

        if (!elemento) {
            return "";
        }

        const partes = [
            elemento.getAttribute("aria-label"),
            elemento.getAttribute("title"),
            elemento.getAttribute("data-titulo"),
            elemento.getAttribute("data-nombre"),
            elemento.getAttribute("placeholder"),
            elemento.innerText,
            elemento.textContent
        ];

        return partes
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 250);
    }


    /* =====================================================
       EXTRAER NOMBRES DE FUNCIONES
       ===================================================== */

    function obtenerFunciones(codigo) {

        if (!codigo) {
            return [];
        }

        const coincidencias = [
            ...codigo.matchAll(
                /([a-zA-Z_$][\w$]*)\s*\(/g
            )
        ];

        return coincidencias
            .map(coincidencia => coincidencia[1])
            .filter(nombre =>
                ![
                    "if",
                    "for",
                    "while",
                    "switch",
                    "function"
                ].includes(nombre)
            );
    }


    /* =====================================================
       ESCANEAR EL INDEX COMPLETO
       ===================================================== */

    function escanearIndex() {

        const nuevoCatalogo = {
            modulos: [],
            tarjetas: [],
            controles: [],
            funciones: [],
            fechaEscaneo: new Date().toISOString()
        };

        const elementos = document.querySelectorAll(
            "[id], [onclick], button, a, input, select, textarea, [role='button']"
        );

        const destinosRegistrados = new Set();
        const elementosRegistrados = new Set();
        const funcionesRegistradas = new Set();

        elementos.forEach(elemento => {

            const id = elemento.id || "";

            const texto = obtenerTexto(elemento);

            const codigo =
                elemento.getAttribute("onclick") || "";

            const tag = elemento.tagName.toLowerCase();

            const esControl =
                [
                    "button",
                    "a",
                    "input",
                    "select",
                    "textarea"
                ].includes(tag) ||
                elemento.getAttribute("role") === "button";

            /* ---------------------------------------------
               DETECTAR MÓDULOS QUE SE ABREN CON mostrar()
               --------------------------------------------- */

            const destinos = [
                ...codigo.matchAll(
                    /mostrar\s*\(\s*['"]([^'"]+)['"]\s*\)/g
                )
            ];

            destinos.forEach(coincidencia => {

                const destino = coincidencia[1];

                if (destinosRegistrados.has(destino)) {
                    return;
                }

                destinosRegistrados.add(destino);

                const destinoReal =
                    document.getElementById(destino);

                nuevoCatalogo.modulos.push({

                    nombre: destino,

                    destino: destino,

                    disponible: Boolean(destinoReal),

                    elemento: destinoReal
                        ? destinoReal.tagName.toLowerCase()
                        : null

                });

            });


            /* ---------------------------------------------
               DETECTAR TARJETAS Y ELEMENTOS CON IDENTIDAD
               --------------------------------------------- */

            if (
                id &&
                !elementosRegistrados.has(id)
            ) {

                elementosRegistrados.add(id);

                nuevoCatalogo.tarjetas.push({

                    id: id,

                    nombre: texto || id,

                    etiqueta: tag,

                    tieneDestino: destinos.length > 0,

                    destinos: destinos.map(
                        coincidencia => coincidencia[1]
                    )

                });

            }


            /* ---------------------------------------------
               DETECTAR CONTROLES
               --------------------------------------------- */

            if (esControl) {

                const opciones = [];

                if (tag === "select") {

                    elemento.querySelectorAll("option")
                        .forEach(opcion => {

                            opciones.push({
                                valor: opcion.value,
                                texto: opcion.textContent.trim()
                            });

                        });

                }

                nuevoCatalogo.controles.push({

                    id: id || null,

                    tipo: tag,

                    nombre: texto,

                    opciones: opciones,

                    tieneAccion: Boolean(codigo)

                });

            }


            /* ---------------------------------------------
               DETECTAR FUNCIONES DECLARADAS EN onclick
               --------------------------------------------- */

            if (codigo) {

                const funciones =
                    obtenerFunciones(codigo);

                funciones.forEach(nombre => {

                    if (
                        funcionesRegistradas.has(nombre)
                    ) {
                        return;
                    }

                    funcionesRegistradas.add(nombre);

                    nuevoCatalogo.funciones.push({

                        nombre: nombre,

                        elemento: id || tag,

                        codigo: codigo.slice(0, 300)

                    });

                });

            }

        });


        catalogoIndex = nuevoCatalogo;

        console.info(
            "🐸 Mi Espacio IA: escaneo del index terminado",
            {
                modulos: nuevoCatalogo.modulos.length,
                tarjetas: nuevoCatalogo.tarjetas.length,
                controles: nuevoCatalogo.controles.length,
                funciones: nuevoCatalogo.funciones.length
            }
        );

        return obtenerCatalogo();

    }


    /* =====================================================
       DEVOLVER CATÁLOGO DETECTADO
       ===================================================== */

    function obtenerCatalogo() {

        return JSON.parse(
            JSON.stringify(catalogoIndex)
        );

    }


    /* =====================================================
       ACTUALIZAR ESCANEO CUANDO CAMBIA EL INDEX
       ===================================================== */

    function programarEscaneo() {

        if (escaneoPendiente) {
            return;
        }

        escaneoPendiente = true;

        Promise.resolve().then(() => {

            escaneoPendiente = false;

            escanearIndex();

        });

    }


    /* =====================================================
       OBSERVAR ELEMENTOS NUEVOS Y CAMBIOS
       ===================================================== */

    function observarIndex() {

        if (
            observadorActivo ||
            !document.body
        ) {
            return;
        }

        const observador = new MutationObserver(
            cambios => {

                const hayCambiosRelevantes =
                    cambios.some(cambio => {

                        if (
                            cambio.type === "childList"
                        ) {
                            return true;
                        }

                        return [
                            "id",
                            "onclick",
                            "title",
                            "aria-label",
                            "data-titulo",
                            "data-nombre"
                        ].includes(cambio.attributeName);

                    });

                if (hayCambiosRelevantes) {
                    programarEscaneo();
                }

            }
        );

        observador.observe(
            document.body,
            {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    "id",
                    "onclick",
                    "title",
                    "aria-label",
                    "data-titulo",
                    "data-nombre"
                ]
            }
        );

        observadorActivo = true;

    }


    /* =====================================================
       PROCESAR COMANDOS
       ===================================================== */

    async function procesar(texto) {

        const pedido = normalizar(texto);

        if (!pedido) {

            responder(
                "Decime qué te gustaría hacer."
            );

            return;
        }

        const datos = await cargarComandos();

        if (!datos) {
            return;
        }

        const grupos = [
            ...(datos.acciones || []),
            ...(datos.ambientes || [])
        ];

        for (const modulo of grupos) {

            const opciones = [
                modulo.nombre,
                modulo.destino,
                ...(modulo.comandos || [])
            ];

            const encontrado = opciones.some(opcion => {

                const comando = normalizar(opcion);

                return (
                    pedido === comando ||
                    (
                        comando.length >= 4 &&
                        pedido.includes(comando)
                    )
                );

            });

            if (encontrado) {

                const destino = modulo.destino;

                if (typeof mostrar === "function") {

                    mostrar(destino);

                    responder(
                        "Abriendo " + modulo.nombre + "…"
                    );

                    return;
                }

            }

        }

        responder(
            "Todavía no tengo esa opción disponible en Mi Espacio."
        );

    }


    /* =====================================================
       INICIALIZAR RECONOCIMIENTO
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

        observarIndex

    };

})();
