// ==========================================================================
// ==
// ==                  functions/index.js (ETAPA 3 - CORREGIDO v2)
// ==                  El "Guardián de Completado"
// ==
// ==========================================================================

// Importar los módulos necesarios (Sintaxis v2 de Firebase Functions)
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

// Inicializar la app de Admin para tener permisos de superusuario
admin.initializeApp();
const db = admin.firestore();

/**
 * ETAPA 3: El "Guardián de Completado" (Sintaxis v2)
 *
 * Esta función se dispara cada vez que un documento
 * en /grupos/{grupoId}/tareas/{tareaId} es modificado.
 */
exports.guardianDeCompletado = onDocumentUpdated(
  '/grupos/{grupoId}/tareas/{tareaId}',
  async (event) => {
    // 1. En v2, los datos 'before' y 'after' están en event.data
    if (!event.data) {
      console.log('[Guardián] No event data found. Exiting.');
      return;
    }
    const datosAntes = event.data.before.data();
    const datosDespues = event.data.after.data();

    // Los parámetros (wildcards) están en event.params
    const { grupoId, tareaId } = event.params;

    // 2. Imprimir en los logs
    console.log(
      `[Guardián] Tarea de grupo actualizada: ${tareaId} en ${grupoId}`,
    );

    // 3. LA LÓGICA CLAVE:
    // ¿Se marcó como "completada" EN ESTE CAMBIO?
    if (datosAntes.isCompleted === false && datosDespues.isCompleted === true) {
      console.log(
        `[Guardián] ¡Tarea marcada como completada! Verificando 'padrePrivado'...`,
      );

      // 4. VERIFICAR EL "PUENTE":
      // ¿Existe el campo 'padrePrivado' y tiene los datos que esperamos?
      const padre = datosDespues.padrePrivado;
      if (padre && typeof padre === 'object' && padre.ownerId && padre.id) {
        console.log(
          `[Guardián] ¡'padrePrivado' encontrado! Sincronizando Tarea privada...`,
        );
        console.log(
          `[Guardián] -> Ruta: /usuarios/${padre.ownerId}/tareas/${padre.id}`,
        );

        // 5. CONSTRUIR LA RUTA a la tarea privada
        const tareaPrivadaRef = db
          .collection('usuarios')
          .doc(padre.ownerId)
          .collection('tareas')
          .doc(padre.id);

        try {
          // 6. EJECUTAR LA SINCRONIZACIÓN:
          // Usar permisos de admin para escribir en la colección del usuario.
          await tareaPrivadaRef.update({
            isCompleted: true,
            fechaCompletado: new Date().toISOString().split('T')[0],
          });
          console.log(
            `[Guardián] ¡ÉXITO! Tarea privada ${padre.id} sincronizada.`,
          );
        } catch (error) {
          console.error(
            `[Guardián] ¡ERROR! No se pudo actualizar la tarea privada ${padre.id}.`,
            error,
          );
        }
      } else {
        console.log(
          `[Guardián] Tarea completada, pero no tiene 'padrePrivado'. Ignorando.`,
        );
      }
    } else {
      // Si el cambio fue otro (ej. cambiar título), no hacer nada.
      console.log(
        `[Guardián] Cambio detectado, pero 'isCompleted' no cambió a true. Ignorando.`,
      );
    }

    // Terminar la función
    return null;
  },
);
