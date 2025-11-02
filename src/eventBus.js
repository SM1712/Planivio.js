// ==========================================================================
// ==                          src/eventBus.js                           ==
// ==========================================================================
//
// Este es el "Event Bus" (o Pub/Sub) de Planivio.
// Es el núcleo de la arquitectura "Pulso".
//
// 1. Un módulo (ej. state.js) "emite" un evento cuando algo pasa:
//    EventBus.emit('cursosActualizados');
//
// 2. Otros módulos (ej. cursos.js) se "suscriben" a ese evento:
//    EventBus.on('cursosActualizados', () => { renderizarCursos(); });
//
// Esto permite que los módulos se comuniquen sin necesidad de importarse mutuamente.
//
// ==========================================================================

const events = {};

/**
 * Se suscribe a un evento.
 * @param {string} eventName - El nombre del evento (ej: 'cursosActualizados').
 * @param {Function} callback - La función a ejecutar cuando el evento se emita.
 */
function on(eventName, callback) {
  if (!events[eventName]) {
    events[eventName] = [];
  }
  events[eventName].push(callback);
}

/**
 * Se desuscribe de un evento.
 * @param {string} eventName - El nombre del evento.
 * @param {Function} callback - La función específica que se quiere remover.
 */
function off(eventName, callback) {
  if (!events[eventName]) {
    return;
  }
  events[eventName] = events[eventName].filter((cb) => cb !== callback);
}

/**
 * Emite (o "dispara") un evento.
 * @param {string} eventName - El nombre del evento a emitir.
 * @param {*} [data] - Datos opcionales para pasar a los callbacks.
 */
function emit(eventName, data) {
  if (!events[eventName]) {
    return;
  }
  // Llama a todos los callbacks registrados para este evento
  events[eventName].forEach((callback) => {
    try {
      callback(data);
    } catch (error) {
      console.error(`Error en callback de evento "${eventName}":`, error);
    }
  });
}

// Exportamos las funciones para que otros módulos las puedan usar
export const EventBus = {
  on,
  off,
  emit,
};
