// ==========================================================================
// ==
// ==                          src/pages/pulsos.js
// ==
// ==    (MODIFICADO - CORRECCIÓN: 'marcarPulsosComoLeidos' ahora
// ==     guarda el estado en localStorage)
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
    // Marcar como leídos (visualmente)
    marcarPulsosComoLeidos();
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
    return;
  }

  // Ordenar: nuevos (no leídos) primero, luego por fecha (implícito)
  pulsos.sort((a, b) => (a.leido === b.leido ? 0 : a.leido ? 1 : -1));

  container.innerHTML = pulsos
    .map((pulso) => {
      return `
      <div class="pulso-item ${pulso.leido ? 'leido' : ''}" data-pulso-id="${pulso.id}">
        <span class="pulso-icono">${pulso.icono}</span>
        <div class="pulso-texto">
          <strong>${pulso.titulo}</strong>
          <p>${pulso.preview}</p>
        </div>
        ${!pulso.leido ? '<div class="pulso-punto-nuevo"></div>' : ''}
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

  const pulsosNoLeidos = (state.pulsosGenerados || []).filter(
    (p) => !p.leido,
  ).length;

  if (pulsosNoLeidos > 0) {
    contador.textContent = pulsosNoLeidos;
    contador.classList.remove('hidden');
  } else {
    contador.classList.add('hidden');
  }
}

/**
 * Marca todos los pulsos como "leídos" en el estado y actualiza la UI.
 */
function marcarPulsosComoLeidos() {
  if (!state.pulsosGenerados || state.pulsosGenerados.length === 0) return;

  let algunoNoLeido = false;
  state.pulsosGenerados.forEach((p) => {
    if (!p.leido) {
      p.leido = true;
      algunoNoLeido = true;
    }
  });

  if (algunoNoLeido) {
    renderizarContadorPulsos();
    // Re-renderizar el panel si está abierto
    const panel = document.getElementById('panel-pulsos-popover');
    if (panel && !panel.classList.contains('hidden')) {
      renderizarPanelPulsos();
    }

    // ✨ INICIO CORRECCIÓN: Guardar el estado "leído" en localStorage
    localStorage.setItem(
      'planivio_pulsos_generados',
      JSON.stringify(state.pulsosGenerados),
    );
    // ✨ FIN CORRECCIÓN
  }
}

// ===================================
// ==    MOTOR PRINCIPAL DE PULSOS  ==
// ===================================

/**
 * Función principal que genera todos los pulsos relevantes al iniciar la app.
 *
 */
export async function generarPulsosDelDia() {
  console.log('[Pulsos] Iniciando generación de Pulsos del Día...');
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
    if (config.update.activo) {
      nuevosPulsos.push(...(await generarPulsoUpdate()));
    }
    if (config.tareasVencidas.activo) {
      nuevosPulsos.push(...generarPulsosTareasVencidas());
    }
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
  const PULSO_ID = 'update-pulso-v2-con-modal'; // <-- Nuevo ID
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
      icono: '🚀', // <-- Nuevo ícono
      titulo: '¡Bienvenido a Planivio: Pulso!', // <-- Nuevo título
      preview: 'Tu app ha evolucionado. Haz clic para ver las novedades.', // <-- Nuevo preview
      leido: false,
      mostrarNotificacion: true, // Mostrar un push la primera vez
      silent: false, // ¡Ahora suena!
      accion: () => {
        mostrarModal('modal-update-pulso');
      },
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
        leido: false,
        mostrarNotificacion: true, // Mostrar notificación
        silent: false, // ¡Ahora suena!
        accion: () => {
          EventBus.emit('navegarA', { pagina: 'tareas', id: tarea.id });
        },
      });
    });
  }

  return pulsos;
}

/**
 * Genera un pulso de resumen si es después de la hora configurada.
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
    // Lógica simple de "hoy": si la fecha de inicio o fin es hoy
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
      leido: false,
      mostrarNotificacion: true,
      silent: false, // ¡Con sonido! Es el resumen del día
      accion: () => {
        EventBus.emit('navegarA', { pagina: 'dashboard' });
      },
    },
  ];
}

/**
 * Genera un pulso de resumen semanal el día y hora configurados.
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
      leido: false,
      mostrarNotificacion: true,
      silent: false, // Con sonido
      accion: () => {
        EventBus.emit('navegarA', { pagina: 'calendario' });
      },
    },
  ];
}

/**
 * Genera un recordatorio de racha si es 0 y es la hora.
 *
 */
function generarPulsoRecordatorioRacha(fechaActual, horaConfig) {
  // (Asumiendo que tienes una función para calcular la racha en otro lado)
  // Como no la tenemos aquí, simularemos una racha de 0
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
      leido: false,
      mostrarNotificacion: true,
      silent: false, // ¡Ahora suena!
      accion: () => {
        EventBus.emit('navegarA', { pagina: 'tareas' });
      },
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

    // Listener para clic en un item de pulso
    const pulsoItem = e.target.closest('.pulso-item[data-pulso-id]');
    if (pulsoItem) {
      const pulsoId = pulsoItem.dataset.pulsoId;
      const pulso = state.pulsosGenerados.find((p) => p.id === pulsoId);
      if (pulso && pulso.accion) {
        pulso.accion();
        abrirPanelPulsos(); // Cerrar panel después de la acción
      }
    }
  });

  // Listener global para cerrar el panel si se hace clic fuera
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('panel-pulsos-popover');
    const btn = document.getElementById('btn-pulsos-header');

    if (!panel || !btn) return;
    if (panel.classList.contains('hidden')) return; // Ya está cerrado

    // Si el clic NO fue en el botón Y NO fue dentro del panel... ciérralo.
    const clicEnBoton = btn.contains(e.target);
    const clicEnPanel = panel.contains(e.target);

    if (!clicEnBoton && !clicEnPanel) {
      panel.classList.add('hidden');
      btn.classList.remove('active');
    }
  });
}
