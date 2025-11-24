import { state } from './state.js';
import { escucharGruposDelUsuario, escucharColeccionDeGrupo } from './firebase.js';
import { mostrarNotificacion } from './ui.js';

let unsubscribeGrupos = null;
const unsubscribeComentariosMap = new Map(); // Map<grupoId, unsubscribeFn>
let isInitialized = false;
let sessionStartTime = Date.now();

/**
 * Inicializa el servicio de notificaciones globales.
 * Escucha los grupos del usuario y, para cada grupo, escucha nuevos comentarios.
 */
export function inicializarNotificacionesGlobales() {
  if (isInitialized) return;
  isInitialized = true;
  sessionStartTime = Date.now();
  console.log('[Notificaciones] Servicio inicializado.');

  // Escuchar la lista de grupos a los que pertenece el usuario
  unsubscribeGrupos = escucharGruposDelUsuario((grupos) => {
    actualizarListenersDeComentarios(grupos);
  });
}

/**
 * Actualiza los listeners de comentarios basándose en la lista actual de grupos.
 * @param {Array} grupos - Lista de objetos grupo.
 */
function actualizarListenersDeComentarios(grupos) {
  const gruposIdsActuales = new Set(grupos.map(g => g.id));

  // 1. Eliminar listeners de grupos que ya no están (o si el usuario salió)
  for (const [grupoId, unsubscribe] of unsubscribeComentariosMap.entries()) {
    if (!gruposIdsActuales.has(grupoId)) {
      console.log(`[Notificaciones] Dejando de escuchar grupo: ${grupoId}`);
      unsubscribe();
      unsubscribeComentariosMap.delete(grupoId);
    }
  }

  // 2. Agregar listeners para nuevos grupos
  grupos.forEach(grupo => {
    if (!unsubscribeComentariosMap.has(grupo.id)) {
      console.log(`[Notificaciones] Escuchando nuevos mensajes en grupo: ${grupo.nombre}`);
      
      const unsubscribe = escucharColeccionDeGrupo(
        grupo.id,
        'comentarios',
        (comentarios) => {
          procesarNuevosComentarios(comentarios, grupo.nombre);
        },
        'fechaCreacion',
        'desc' // Orden descendente para obtener los más recientes primero
      );
      
      unsubscribeComentariosMap.set(grupo.id, unsubscribe);
    }
  });
}

/**
 * Procesa la actualización de comentarios para detectar nuevos mensajes.
 * @param {Array} comentarios - Lista de comentarios del grupo.
 * @param {string} nombreGrupo - Nombre del grupo para la notificación.
 */
function procesarNuevosComentarios(comentarios, nombreGrupo) {
  if (!comentarios || comentarios.length === 0) return;

  // Tomamos solo los comentarios recientes que cumplan:
  // 1. No son míos.
  // 2. Fueron creados DESPUÉS de que inicié sesión (para evitar notificar históricos al cargar).
  // 3. (Opcional) Podríamos guardar el último ID notificado para ser más precisos, 
  //    pero comparar timestamp vs sessionStartTime es una buena aproximación inicial.

  comentarios.forEach(comentario => {
    // Verificar autoría
    if (comentario.autorId === state.currentUserId) return;

    // Verificar timestamp (si existe)
    let fechaComentario = 0;
    if (comentario.fechaCreacion && comentario.fechaCreacion.seconds) {
      fechaComentario = comentario.fechaCreacion.seconds * 1000;
    } else {
      // Si es local y aún no tiene timestamp de servidor, lo ignoramos o usamos Date.now()
      // Generalmente queremos notificar lo que viene del servidor.
      return; 
    }

    // Si el mensaje es más nuevo que el inicio de sesión + un pequeño buffer (e.g. 2 seg)
    // El buffer ayuda a evitar notificar mensajes que se cargan en la carga inicial masiva.
    if (fechaComentario > sessionStartTime + 2000) {
      // Para evitar notificaciones repetidas del mismo mensaje (snapshots repetidos),
      // podríamos usar un Set de IDs notificados.
      if (!comentario.notificadoLocalmente) {
        mostrarNotificacion(`Nuevo mensaje en ${nombreGrupo}`, {
          body: `${comentario.autorNombre}: ${comentario.texto}`,
          silent: false
        });
        // Marcamos en el objeto en memoria para no repetir en este snapshot (aunque el snapshot suele traer objetos nuevos)
        // Una mejor forma es rastrear IDs procesados globalmente si fuera necesario.
        comentario.notificadoLocalmente = true; 
      }
    }
  });
}

/**
 * Detiene todos los listeners. Útil para logout.
 */
export function detenerNotificacionesGlobales() {
  if (unsubscribeGrupos) {
    unsubscribeGrupos();
    unsubscribeGrupos = null;
  }
  
  for (const unsubscribe of unsubscribeComentariosMap.values()) {
    unsubscribe();
  }
  unsubscribeComentariosMap.clear();
  isInitialized = false;
  console.log('[Notificaciones] Servicio detenido.');
}
