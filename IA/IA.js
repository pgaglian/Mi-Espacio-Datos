
const MiEspacioIA = (() => {

    const URL_COMANDOS =
        "https://raw.githubusercontent.com/pgaglian/Mi-Espacio-Datos/main/IA/IA-comandos.json";

    let comandosIA = null;

    async function cargarComandos() {

        if (comandosIA) {
            return comandosIA;
        }

        try {

            const respuesta = await fetch(URL_COMANDOS);

            if (!respuesta.ok) {
                throw new Error("No se pudo cargar IA-comandos.json");
            }

            comandosIA = await respuesta.json();

            return comandosIA;

        } catch (error) {

            console.error("Mi Espacio IA:", error);

            responder("No pude cargar mis comandos. Intentá nuevamente.");

            return null;
        }
    }

    function responder(mensaje) {

        const elemento =
            document.getElementById("respuestaMiEspacioIA");

        if (elemento) {
            elemento.textContent = mensaje;
        }
    }

    function normalizar(texto) {

        return texto
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    async function procesar(texto) {

        const pedido = normalizar(texto);

        if (!pedido) {
            responder("Decime qué te gustaría hacer.");
            return;
        }

        const datos = await cargarComandos();

        if (!datos) return;

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

                return pedido === comando ||
                       pedido.includes(comando);
            });

            if (encontrado) {

                const destino = modulo.destino;

                if (typeof mostrar === "function") {

                    mostrar(destino);

                    responder("Abriendo " + modulo.nombre + "…");

                    return;
                }
            }
        }

        responder("Todavía no tengo esa opción disponible en Mi Espacio.");
    }

    return {
        procesar,
        responder,
        cargarComandos
    };

})();
