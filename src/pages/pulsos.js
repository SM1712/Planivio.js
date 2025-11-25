// ==========================================================================
// ==
// ==                          src/pages/pulsos.js
// ==
// ==    (MODIFICADO - ETAPA 18: Refactorización a actionType/payload
// ==     para persistencia en localStorage y contenido rico)
// ==
// ==========================================================================

import { state } from '../state.js';
import { EventBus } from '../eventBus.js';
import { guardarConfig } from '../firebase.js';
import { mostrarNotificacion, mostrarModal } from '../ui.js';

// ===================================
// ==        FUNCIONES DE UI        ==
// ===================================

/**
 * Muestra u oculta el panel pop-up de Pulsos.
 * Renderiza el contenido del panel.
 */
export function abrirPanelPulsos() {
  const panel = document.getElementById('panel-pulsos-popover');
  const btn = document.getElementById('btn-pulsos-header');
  if (!panel || !btn) return;

  const estaAbierto = !panel.classList.contains('hidden');

  if (estaAbierto) {
    panel.classList.add('hidden');
    btn.classList.remove('active');
  } else {
    // Renderizar antes de mostrar
    renderizarPanelPulsos();
    panel.classList.remove('hidden');
    btn.classList.add('active');
  }
}

/**
 * Renderiza la lista de pulsos generados dentro del panel.
 */
function renderizarPanelPulsos() {
  const container = document.getElementById('pulsos-lista-container');
  if (!container) return;

  const pulsos = state.pulsosGenerados || [];

  if (pulsos.length === 0) {
    container.innerHTML = `
      <div class="pulso-item pulso-vacio">
        <span class="pulso-icono">😴</span>
        <div class="pulso-texto">
          <strong>Todo tranquilo</strong>
          <p>No hay pulsos nuevos por ahora.</p>
        </div>
      </div>
    `;
    const btnMarcarLeidos = document.getElementById('btn-pulsos-marcar-leidos');
    if (btnMarcarLeidos) btnMarcarLeidos.style.display = 'none';
    return;
  }

  const btnMarcarLeidos = document.getElementById('btn-pulsos-marcar-leidos');
  if (btnMarcarLeidos) btnMarcarLeidos.style.display = 'block';

  container.innerHTML = pulsos
    .map((pulso) => {
      return `
      <div class="pulso-item" data-pulso-id="${pulso.id}">
        <span class="pulso-icono">${pulso.icono}</span>
        <div class="pulso-texto">
          <strong>${pulso.titulo}</strong>
          <p>${pulso.preview}</p>
        </div>
        <div class="pulso-punto-nuevo"></div>
      </div>
    `;
    })
    .join('');
}

/**
 * Actualiza el contador rojo del ícono del header.
 */
function renderizarContadorPulsos() {
  const contador = document.getElementById('pulsos-contador');
  if (!contador) return;

  const pulsosNoLeidos = (state.pulsosGenerados || []).length;

  if (pulsosNoLeidos > 0) {
    contador.textContent = pulsosNoLeidos;
    contador.classList.remove('hidden');
  } else {
    contador.classList.add('hidden');
  }
}

/**
 * Elimina todos los pulsos.
 */
function marcarPulsosComoLeidos() {
  if (!state.pulsosGenerados || state.pulsosGenerados.length === 0) return;

  console.log('[Pulsos] Eliminando todos los pulsos...');

  // 1. Borrar del estado
  state.pulsosGenerados = [];

  // 2. Actualizar UI
  renderizarContadorPulsos(); // Actualiza el contador a 0
  renderizarPanelPulsos(); // Muestra el panel vacío

  // 3. Guardar el estado vacío en localStorage
  localStorage.setItem(
    'planivio_pulsos_generados',
    JSON.stringify(state.pulsosGenerados),
  );
}

// ===================================
// ==    MOTOR PRINCIPAL DE PULSOS  ==
// ===================================

/**
 * Función principal que genera todos los pulsos relevantes al iniciar la app.
 * (Función de "Ponerse al día")
 *
 */
export async function generarPulsosDelDia() {
  console.log('[Pulsos] Iniciando generación de Pulsos del Día (Catch-up)...');
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split('T')[0];
  const config = state.config.pulsos;

  // 1. Revisar si los pulsos ya se generaron hoy
  const ultimoCheck = localStorage.getItem('planivio_pulsos_check');
  if (ultimoCheck === hoyStr) {
    console.log('[Pulsos] Los pulsos de hoy ya fueron generados. Cargando...');
    try {
      // Cargar los pulsos guardados de la sesión
      const pulsosGuardados = localStorage.getItem('planivio_pulsos_generados');
      if (pulsosGuardados) {
        state.pulsosGenerados = JSON.parse(pulsosGuardados);
      }
    } catch (e) {
      console.error('[Pulsos] Error al cargar pulsos guardados:', e);
      state.pulsosGenerados = []; // Resetear en caso de error
    }
    renderizarContadorPulsos();
    return; // No continuar
  }

  // Si es un nuevo día, limpiar pulsos anteriores
  console.log('[Pulsos] Nuevo día detectado. Generando nuevos pulsos...');
  localStorage.setItem('planivio_pulsos_check', hoyStr);
  let nuevosPulsos = [];

  // 2. Generar pulsos según configuración
  try {
    // Generadores "Instantáneos" (se ejecutan siempre al inicio)
    if (config.update.activo) {
      nuevosPulsos.push(...(await generarPulsoUpdate()));
    }
    if (config.tareasVencidas.activo) {
      nuevosPulsos.push(...generarPulsosTareasVencidas());
    }

    // Generadores "Programados" (solo se ejecutan si ya pasó la hora)
    if (config.resumenHoy.activo) {
      nuevosPulsos.push(...generarPulsoResumenHoy(hoy, config.resumenHoy.hora));
    }
    if (config.eventosSemana.activo) {
      nuevosPulsos.push(
        ...generarPulsoEventosSemana(
          hoy,
          config.eventosSemana.dia,
          config.eventosSemana.hora,
        ),
      );
    }
    if (config.recordatorioRacha.activo) {
      nuevosPulsos.push(
        ...generarPulsoRecordatorioRacha(hoy, config.recordatorioRacha.hora),
      );
    }
  } catch (e) {
    console.error('[Pulsos] Error durante la generación de pulsos:', e);
  }

  // 3. Guardar y renderizar
  state.pulsosGenerados = nuevosPulsos;
  localStorage.setItem(
    'planivio_pulsos_generados',
    JSON.stringify(nuevosPulsos),
  );
  renderizarContadorPulsos(); //
  console.log(
    `[Pulsos] Generación completa. ${nuevosPulsos.length} pulsos creados.`,
  );

  // 4. Disparar notificaciones push para los pulsos que lo requieran
  nuevosPulsos.forEach((pulso) => {
    if (pulso.mostrarNotificacion) {
      mostrarNotificacion(pulso.titulo, {
        body: pulso.preview,
        silent: pulso.silent || false,
      });
    }
  });
}

// ===================================
// ==   SUB-FUNCIONES GENERADORAS   ==
// ===================================
// (Estas funciones crean los objetos de pulso)
//

/**
 * Genera un pulso sobre la nueva versión "Pulsos".
 *
 */
async function generarPulsoUpdate() {
  const PULSO_ID = 'update-pulso-v2-rich-content'; // <-- ID Único para esta versión
  if (state.config.pulsosVistos.includes(PULSO_ID)) {
    return []; // El usuario ya vio este pulso
  }

  // Marcar como visto en Firebase para que no vuelva a salir
  const nuevosVistos = [...state.config.pulsosVistos, PULSO_ID];
  state.config.pulsosVistos = nuevosVistos; // Actualiza estado local
  await guardarConfig({ pulsosVistos: nuevosVistos }); // Actualiza Firebase

  return [
    {
      id: PULSO_ID,
      icono: '🚀',
      titulo: '¡Planivio ha evolucionado!',
      preview: 'Descubre las nuevas herramientas: Rachas, Pulsos y más.',
      mostrarNotificacion: true,
      silent: false,
      actionType: 'modal', // <-- Tipo de acción serializable
      payload: 'modal-update-pulso', // <-- ID del modal
    },
  ];
}

/**
 * Genera un pulso por cada tarea vencida.
 *
 */
function generarPulsosTareasVencidas() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const pulsos = [];

  const tareasVencidas = state.tareas.filter((t) => {
    if (t.completada || !t.fecha) return false;
    const fechaTarea = new Date(t.fecha + 'T00:00:00'); // Asumir T00:00:00 local
    return fechaTarea < hoy;
  });

  if (tareasVencidas.length > 0) {
    // Generar un pulso individual por cada tarea vencida
    tareasVencidas.forEach((tarea) => {
      pulsos.push({
        id: `vencida-${tarea.id}`,
        icono: '⏰',
        titulo: `¡Tarea Vencida!`,
        preview: `"${tarea.titulo}" venció el ${tarea.fecha}.`,
        mostrarNotificacion: true,
        silent: false,
        actionType: 'navigate', // <-- Tipo de acción serializable
        payload: { pagina: 'tareas', id: tarea.id }, // <-- Datos para navegar
      });
    });
  }

  return pulsos;
}

/**
 * Genera un pulso de resumen si es después de la hora configurada. (Catch-up)
 *
 */
function generarPulsoResumenHoy(fechaActual, horaConfig) {
  const [hora, min] = horaConfig.split(':').map(Number);
  const horaActual = fechaActual.getHours();
  const minActual = fechaActual.getMinutes();
  const horaDisparo = hora * 60 + min;
  const horaActualEnMin = horaActual * 60 + minActual;

  if (horaActualEnMin < horaDisparo) {
    return []; // Aún no es la hora
  }

  const hoyStr = fechaActual.toISOString().split('T')[0];
  const tareasHoy = state.tareas.filter(
    (t) => !t.completada && t.fecha === hoyStr,
  ).length;
  const eventosHoy = state.eventos.filter((e) => {
    return e.fechaInicio === hoyStr || e.fechaFin === hoyStr;
  }).length;

  if (tareasHoy === 0 && eventosHoy === 0) {
    return []; // No hay nada que resumir
  }

  return [
    {
      id: `resumen-hoy-${hoyStr}`,
      icono: '⚡',
      titulo: 'Resumen de Hoy',
      preview: `¡A pulsar! Tienes ${tareasHoy} tareas y ${eventosHoy} eventos hoy.`,
      mostrarNotificacion: true,
      silent: false,
      actionType: 'navigate',
      payload: { pagina: 'dashboard' },
    },
  ];
}

/**
 * Genera un pulso de resumen semanal el día y hora configurados. (Catch-up)
 *
 */
function generarPulsoEventosSemana(fechaActual, diaConfig, horaConfig) {
  const diaActual = fechaActual.getDay(); // 0 = Domingo, 1 = Lunes
  if (diaActual !== parseInt(diaConfig, 10)) {
    return []; // No es el día correcto
  }

  const [hora, min] = horaConfig.split(':').map(Number);
  const horaActual = fechaActual.getHours();
  const minActual = fechaActual.getMinutes();
  const horaDisparo = hora * 60 + min;
  const horaActualEnMin = horaActual * 60 + minActual;

  if (horaActualEnMin < horaDisparo) {
    return []; // Aún no es la hora
  }

  // Calcular rango de la próxima semana
  const manana = new Date(fechaActual);
  manana.setDate(fechaActual.getDate() + 1);
  manana.setHours(0, 0, 0, 0);

  const sieteDiasDespues = new Date(manana);
  sieteDiasDespues.setDate(manana.getDate() + 7);

  const eventosSemana = state.eventos.filter((e) => {
    const fechaInicio = new Date(e.fechaInicio + 'T00:00:00');
    return fechaInicio >= manana && fechaInicio < sieteDiasDespues;
  }).length;

  if (eventosSemana === 0) {
    return []; // No hay eventos
  }

  return [
    {
      id: `resumen-semana-${fechaActual.toISOString().split('T')[0]}`,
      icono: '🗓️',
      titulo: 'Resumen Semanal',
      preview: `¡Prepárate! Tienes ${eventosSemana} eventos la próxima semana.`,
      mostrarNotificacion: true,
      silent: false,
      actionType: 'navigate',
      payload: { pagina: 'calendario' },
    },
  ];
}

/**
 * Genera un recordatorio de racha si es 0 y es la hora. (Catch-up)
 *
 */
function generarPulsoRecordatorioRacha(fechaActual, horaConfig) {
  const rachaActual = 0; // Reemplazar con: calcularRacha()
  if (rachaActual > 0) {
    return []; // El usuario tiene racha, no molestar
  }

  const [hora, min] = horaConfig.split(':').map(Number);
  const horaActual = fechaActual.getHours();
  const minActual = fechaActual.getMinutes();
  const horaDisparo = hora * 60 + min;
  const horaActualEnMin = horaActual * 60 + minActual;

  if (horaActualEnMin < horaDisparo) {
    return []; // Aún no es la hora
  }

  return [
    {
      id: `racha-cero-${fechaActual.toISOString().split('T')[0]}`,
      icono: '🔥',
      titulo: '¡No pierdas la racha!',
      preview: '¡Aún puedes completar una tarea hoy para iniciar tu racha!',
      mostrarNotificacion: true,
      silent: false,
      actionType: 'navigate',
      payload: { pagina: 'tareas' },
    },
  ];
}

// ===================================
// ==  INICIALIZADOR DE LISTENERS   ==
// ===================================

/**
 * Añade los listeners para la UI del panel de Pulsos.
 *
 */
export function inicializarPulsos() {
  // Listener para "Marcar como leídos"
  document.body.addEventListener('click', (e) => {
    const btnMarcarLeidos = e.target.closest('#btn-pulsos-marcar-leidos');
    if (btnMarcarLeidos) {
      e.preventDefault();
      marcarPulsosComoLeidos();
    }

    // (Modificado Etapa 18) Manejo de clics con actionType
    const pulsoItem = e.target.closest('.pulso-item[data-pulso-id]');
    if (pulsoItem) {
      const pulsoId = pulsoItem.dataset.pulsoId;
      const pulso = state.pulsosGenerados.find((p) => p.id === pulsoId);
      
      if (pulso) {
        // 1. Ejecutar la acción según el tipo
        if (pulso.actionType === 'modal') {
            mostrarModal(pulso.payload);
        } else if (pulso.actionType === 'navigate') {
            EventBus.emit('navegarA', pulso.payload);
        } else if (pulso.accion && typeof pulso.accion === 'function') {
            // Fallback para pulsos antiguos o generados en tiempo de ejecución sin persistencia
            pulso.accion();
        }

        // 2. Eliminar el pulso del estado
        state.pulsosGenerados = state.pulsosGenerados.filter(
          (p) => p.id !== pulsoId,
        );

        // 3. Guardar la lista actualizada en localStorage
        localStorage.setItem(
          'planivio_pulsos_generados',
          JSON.stringify(state.pulsosGenerados),
        );

        // 4. Actualizar el contador
        renderizarContadorPulsos();

        // 5. Cerrar el panel
        abrirPanelPulsos();
      }
    }
  });
  
  // --- Gestión de Permisos ---
  verificarPermisosNotificaciones();
  
  const btnActivar = document.getElementById('btn-activar-notificaciones');
  if (btnActivar) {
    btnActivar.addEventListener('click', () => {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          mostrarNotificacion('¡Notificaciones Activas!', { body: 'Ahora recibirás los pulsos de Planivio.' });
          verificarPermisosNotificaciones();
        } else {
          mostrarAlerta('Permiso Denegado', 'No podremos enviarte notificaciones. Revisa la configuración de tu navegador.');
        }
      });
    });
  }
}

function verificarPermisosNotificaciones() {
  const container = document.getElementById('container-permiso-notificaciones');
  if (!container) return;
  
  if (Notification.permission === 'granted') {
    container.style.display = 'none';
  } else {
    container.style.display = 'block';
  }
}

// ===================================
// == ✨ Funciones Trigger para Tiempo Real
// ===================================

/**
 * Añade un pulso a la lista, guarda y actualiza la UI.
 * @param {object} pulso - El objeto de pulso a añadir.
 */
function agregarNuevoPulso(pulso) {
  // 1. Añadir al estado
  state.pulsosGenerados.push(pulso);

  // 2. Guardar en localStorage
  localStorage.setItem(
    'planivio_pulsos_generados',
    JSON.stringify(state.pulsosGenerados),
  );

  // 3. Actualizar contador
  renderizarContadorPulsos();

  // 4. Mostrar notificación push
  if (pulso.mostrarNotificacion) {
    mostrarNotificacion(pulso.titulo, {
      body: pulso.preview,
      silent: pulso.silent || false,
    });
  }

  // 5. Actualizar el panel si está abierto
  const panel = document.getElementById('panel-pulsos-popover');
  if (panel && !panel.classList.contains('hidden')) {
    renderizarPanelPulsos();
  }
}

/**
 * Revisa si un pulso ya existe en el estado.
 * @param {string} idBase - El ID base del pulso (ej. "resumen-hoy-")
 */
function pulsoYaExiste(idBase) {
  const hoyStr = new Date().toISOString().split('T')[0];
  const idCompleto = `${idBase}${hoyStr}`;
  return state.pulsosGenerados.some((p) => p.id === idCompleto);
}

/**
 * (Para el temporizador) Revisa y genera el Resumen del Día.
 */
export function triggerPulsoResumenHoy() {
  const config = state.config.pulsos.resumenHoy;
  if (!config.activo) return;

  const ahora = new Date();
  const horaActual = ahora.getHours().toString().padStart(2, '0');
  const minActual = ahora.getMinutes().toString().padStart(2, '0');
  const horaMinActual = `${horaActual}:${minActual}`; // ej: "07:00"

  // 1. Comprobar si es la hora exacta
  if (horaMinActual === config.hora) {
    // 2. Comprobar si ya existe
    if (pulsoYaExiste('resumen-hoy-')) return;

    // 3. Generar el pulso (usando la función original)
    const pulsoArray = generarPulsoResumenHoy(ahora, config.hora);
    if (pulsoArray.length > 0) {
      console.log('[Pulsos] ¡TRIGGER TIEMPO REAL: Resumen del Día!');
      agregarNuevoPulso(pulsoArray[0]);
    }
  }
}

/**
 * (Para el temporizador) Revisa y genera el Resumen Semanal.
 */
export function triggerPulsoEventosSemana() {
  const config = state.config.pulsos.eventosSemana;
  if (!config.activo) return;

  const ahora = new Date();
  const diaActual = ahora.getDay().toString(); // "0" = Domingo
  const horaActual = ahora.getHours().toString().padStart(2, '0');
  const minActual = ahora.getMinutes().toString().padStart(2, '0');
  const horaMinActual = `${horaActual}:${minActual}`; // ej: "12:00"

  // 1. Comprobar si es el día Y la hora exacta
  if (diaActual === config.dia && horaMinActual === config.hora) {
    // 2. Comprobar si ya existe
    if (pulsoYaExiste('resumen-semana-')) return;

    // 3. Generar el pulso
    const pulsoArray = generarPulsoEventosSemana(
      ahora,
      config.dia,
      config.hora,
    );
    if (pulsoArray.length > 0) {
      console.log('[Pulsos] ¡TRIGGER TIEMPO REAL: Resumen Semanal!');
      agregarNuevoPulso(pulsoArray[0]);
    }
  }
}

/**
 * (Para el temporizador) Revisa y genera el Recordatorio de Racha.
 */
export function triggerPulsoRecordatorioRacha() {
  const config = state.config.pulsos.recordatorioRacha;
  if (!config.activo) return;

  const ahora = new Date();
  const horaActual = ahora.getHours().toString().padStart(2, '0');
  const minActual = ahora.getMinutes().toString().padStart(2, '0');
  const horaMinActual = `${horaActual}:${minActual}`; // ej: "18:00"

  // 1. Comprobar si es la hora exacta
  if (horaMinActual === config.hora) {
    // 2. Comprobar si ya existe
    if (pulsoYaExiste('racha-cero-')) return;

    // 3. Generar el pulso
    const pulsoArray = generarPulsoRecordatorioRacha(ahora, config.hora);
    if (pulsoArray.length > 0) {
      console.log('[Pulsos] ¡TRIGGER TIEMPO REAL: Recordatorio de Racha!');
      agregarNuevoPulso(pulsoArray[0]);
    }
  }
}
