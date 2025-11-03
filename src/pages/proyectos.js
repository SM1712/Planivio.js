// ==========================================================================
// ==                      src/pages/proyectos.js                        ==
// ==========================================================================
//
// Módulo de Proyectos, modificado para la arquitectura "Pulso".
// (Versión 3 - Corregido el listener del modal para evitar recarga)
//
// ==========================================================================

import { state } from '../state.js';
import { EventBus } from '../eventBus.js';
// --- INICIO CORRECCIÓN IMPORTACIONES ---
// Importamos las funciones de SERVICIO de firebase.js, no las internas de Firebase
import {
  agregarDocumento,
  actualizarDocumento,
  eliminarDocumento,
} from '../firebase.js'; // <-- CORREGIDO
// --- FIN CORRECCIÓN IMPORTACIONES ---
import {
  mostrarModal,
  cerrarModal,
  mostrarConfirmacion,
  mostrarAlerta,
  popularSelectorDeCursos,
} from '../ui.js';
import { ICONS } from '../icons.js';
// import { cambiarPagina } from '../main.js'; // <-- ELIMINADO
import { iniciarEdicionEvento } from './calendario.js'; // (Este módulo también necesita migración)

let graficaDeProyecto = null;
let searchTermProyectos = ''; // Variable local para búsqueda

// (calcularEstadisticasProyecto se mantiene igual, lee el 'state' global)
export function calcularEstadisticasProyecto(proyectoId) {
  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );
  const tareasDelProyecto = state.tareas.filter(
    (t) =>
      String(t.proyectoId) === String(proyectoId) &&
      !cursosArchivadosNombres.has(t.curso),
  );
  const totalTareas = tareasDelProyecto.length;
  if (totalTareas === 0) {
    return {
      total: 0,
      completadas: 0,
      alta: 0,
      media: 0,
      baja: 0,
      porcentaje: 0,
    };
  }
  const completadas = tareasDelProyecto.filter((t) => t.completada).length;
  const alta = tareasDelProyecto.filter(
    (t) => !t.completada && t.prioridad === 'Alta',
  ).length;
  const media = tareasDelProyecto.filter(
    (t) => !t.completada && t.prioridad === 'Media',
  ).length;
  const baja = tareasDelProyecto.filter(
    (t) => !t.completada && t.prioridad === 'Baja',
  ).length;
  const porcentaje = Math.round((completadas / totalTareas) * 100);
  return { total: totalTareas, completadas, alta, media, baja, porcentaje };
}

/**
 * Renderiza las tarjetas de proyecto basándose en el 'state' actual.
 */
export function renderizarProyectos() {
  const container = document.getElementById('lista-proyectos-container');
  if (!container) return; // Si la página no está cargada, no hace nada
  container.innerHTML = '';

  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );
  const terminoBusqueda = searchTermProyectos.toLowerCase();

  const proyectosMostrables = state.proyectos.filter((proyecto) => {
    const cursoArchivado =
      proyecto.curso && cursosArchivadosNombres.has(proyecto.curso);
    const coincideBusqueda =
      terminoBusqueda === '' ||
      proyecto.nombre.toLowerCase().includes(terminoBusqueda);
    return !cursoArchivado && coincideBusqueda;
  });

  if (proyectosMostrables.length === 0) {
    if (searchTermProyectos !== '') {
      container.innerHTML =
        '<p style="padding: 15px; color: var(--text-muted);">No se encontraron proyectos que coincidan con tu búsqueda.</p>';
    } else {
      container.innerHTML =
        '<p style="padding: 15px; color: var(--text-muted);">No tienes proyectos creados. ¡Añade el primero!</p>';
    }
    return;
  }

  // Ordenar (Aseguramos que 'General' no esté aquí, pero si lo estuviera, lo maneja)
  proyectosMostrables.sort((a, b) => {
    if (a.isArchivado !== b.isArchivado) {
      return a.isArchivado ? 1 : -1;
    }
    return a.nombre.localeCompare(b.nombre);
  });

  proyectosMostrables.forEach((proyecto) => {
    const stats = calcularEstadisticasProyecto(proyecto.id);
    const card = document.createElement('div');
    card.className = 'proyecto-card';
    if (String(proyecto.id) === String(state.proyectoSeleccionadoId))
      card.classList.add('selected');
    card.dataset.id = proyecto.id;

    let statsHtml = '';
    if (stats.total > 0) {
      statsHtml = `
            <div class="proyecto-stats">
                <div class="proyecto-stats-header">
                    <span class="proyecto-stats-texto">${stats.completadas} de ${stats.total} tareas</span>
                    <span class="proyecto-stats-porcentaje">${stats.porcentaje}%</span>
                </div>
                <div class="progreso-barra-container">
                    <div class="progreso-barra-relleno" style="width: ${stats.porcentaje}%;"></div>
                </div>
            </div>`;
    } else {
      statsHtml =
        '<span class="proyecto-stats-texto">Sin tareas asignadas.</span>';
    }

    let cursoAsignadoHtml = '';
    if (proyecto.curso && proyecto.curso !== 'General') {
      cursoAsignadoHtml = `<h5 class="proyecto-curso-asignado">${proyecto.curso}</h5>`;
    }

    card.innerHTML = `
            <div class="proyecto-card-header">
                <h4>${proyecto.nombre}</h4>
                ${cursoAsignadoHtml}
            </div>
            <p>${proyecto.descripcion || 'Sin descripción.'}</p>
            ${statsHtml}
            <div class="proyecto-card-actions">
                <button class="btn-icon btn-editar-proyecto" title="Editar Proyecto">${ICONS.edit || 'E'}</button>
                <button class="btn-icon btn-eliminar-proyecto" title="Eliminar Proyecto">${ICONS.delete || 'X'}</button>
            </div>
        `;
    container.appendChild(card);
  });
}

/**
 * Renderiza la gráfica (Sin cambios internos)
 */
function renderizarGraficaProyecto(stats) {
  const ctx = document
    .getElementById('proyecto-grafica-progreso')
    ?.getContext('2d');
  if (!ctx) return;
  if (graficaDeProyecto) {
    graficaDeProyecto.destroy();
  }
  graficaDeProyecto = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [
        'Completadas',
        'Prioridad Alta',
        'Prioridad Media',
        'Prioridad Baja',
      ],
      datasets: [
        {
          data: [stats.completadas, stats.alta, stats.media, stats.baja],
          backgroundColor: ['#3498db', '#e74c3c', '#f39c12', '#2ecc71'],
          borderColor: getComputedStyle(document.body)
            .getPropertyValue('--bg-content')
            .trim(),
          borderWidth: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: { padding: 20, usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          callbacks: { label: (c) => ` ${c.label}: ${c.parsed} tarea(s)` },
        },
      },
    },
  });
}

/**
 * Renderiza la lista de tareas (Sin cambios internos, lee 'state' global)
 */
function renderizarListasDeTareas(proyectoId) {
  const container = document.getElementById('proyecto-det-tareas-container');
  if (!container) return;

  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );
  const tareasPendientes = state.tareas.filter(
    (t) =>
      String(t.proyectoId) === String(proyectoId) &&
      !t.completada &&
      !cursosArchivadosNombres.has(t.curso),
  );
  const totalTareasProyecto = state.tareas.filter(
    (t) =>
      String(t.proyectoId) === String(proyectoId) &&
      !cursosArchivadosNombres.has(t.curso),
  ).length;

  let html = '<div class="tareas-por-prioridad">';
  if (tareasPendientes.length > 0) html += '<h4>Tareas Pendientes</h4>';

  ['Alta', 'Media', 'Baja'].forEach((prioridad) => {
    const tareas = tareasPendientes.filter((t) => t.prioridad === prioridad);
    if (tareas.length > 0) {
      html += `<h5>Prioridad ${prioridad}</h5><ul>`;
      tareas.forEach((t) => {
        const [y, m, d] = t.fecha ? t.fecha.split('-') : ['--', '--', '--'];
        html += `<li class="detalle-item" data-task-id="${t.id}">
                    <div>
                      <span class="prioridad-indicador prioridad-${prioridad.toLowerCase()}"></span>
                      <span>${t.titulo}</span>
                    </div>
                    <span class="fecha-tarea">${d}/${m}/${y}</span>
                  </li>`;
      });
      html += '</ul>';
    }
  });

  if (tareasPendientes.length === 0 && totalTareasProyecto > 0) {
    html +=
      '<p class="detalle-lista-vacia">¡Todas las tareas de este proyecto están completadas!</p>';
  } else if (tareasPendientes.length === 0 && totalTareasProyecto === 0) {
    html +=
      '<p class="detalle-lista-vacia">¡No hay tareas asignadas a este proyecto!</p>';
  }

  html += '</div>';
  container.innerHTML = html;
}

/**
 * Renderiza la lista de eventos (Sin cambios internos, lee 'state' global)
 */
function renderizarListaEventos(proyectoId, container) {
  if (!container) return;
  const eventosDelProyecto = state.eventos.filter(
    (e) => String(e.proyectoId) === String(proyectoId),
  );
  if (eventosDelProyecto.length === 0) {
    container.innerHTML =
      '<p class="detalle-lista-vacia">Este proyecto no tiene eventos asociados.</p>';
    return;
  }
  eventosDelProyecto.sort(
    (a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio),
  );
  let html = '<ul class="detalle-lista">';
  eventosDelProyecto.forEach((evento) => {
    const inicio = new Date(evento.fechaInicio + 'T00:00:00');
    const fin = new Date(evento.fechaFin + 'T00:00:00');
    const diaInicio = inicio.getDate().toString().padStart(2, '0');
    const mesInicio = (inicio.getMonth() + 1).toString().padStart(2, '0');
    let meta = `${diaInicio}/${mesInicio}`;
    if (evento.fechaInicio !== evento.fechaFin) {
      const diaFin = fin.getDate().toString().padStart(2, '0');
      const mesFin = (fin.getMonth() + 1).toString().padStart(2, '0');
      meta += ` - ${diaFin}/${mesFin}`;
    }
    html += `
      <li class="detalle-item" data-evento-id="${evento.id}">
        <span class="prioridad-indicador" style="background-color: ${evento.color};"></span>
        <div class="detalle-item-contenido">
          <span class="detalle-item-titulo">${evento.titulo}</span>
          <span class="detalle-item-meta">${meta}</span>
        </div>
      </li>
    `;
  });
  html += '</ul>';
  container.innerHTML = html;
}

/**
 * Renderiza la lista de apuntes (Sin cambios internos, lee 'state' global)
 */
function renderizarListaApuntes(proyectoId, container) {
  if (!container) return;
  const apuntesDelProyecto = state.apuntes.filter(
    (a) => String(a.proyectoId) === String(proyectoId),
  );
  if (apuntesDelProyecto.length === 0) {
    container.innerHTML =
      '<p class="detalle-lista-vacia">Este proyecto no tiene apuntes asociados.</p>';
    return;
  }
  apuntesDelProyecto.sort(
    (a, b) => new Date(b.fechaModificacion) - new Date(a.fechaModificacion),
  );
  let html = '<ul class="detalle-lista">';
  apuntesDelProyecto.forEach((apunte) => {
    const titulo = apunte.titulo || 'Apunte sin título';
    const tags =
      apunte.tags && apunte.tags.length > 0
        ? apunte.tags.map((tag) => `#${tag}`).join(' ')
        : 'Sin etiquetas';
    html += `
      <li class="detalle-item" data-apunte-id="${apunte.id}">
        <span class="tab-icon">${ICONS.apuntes || 'A'}</span>
        <div class="detalle-item-contenido">
          <span class="detalle-item-titulo">${titulo}</span>
          <span class="detalle-item-meta">${tags}</span>
        </div>
      </li>`;
  });
  html += '</ul>';
  container.innerHTML = html;
}

/**
 * Renderiza el panel de detalles completo (gráfica, tareas, eventos, apuntes).
 */
export function renderizarDetallesProyecto() {
  const headerInfo = document.getElementById('proyecto-det-header-info');
  const descEl = document.getElementById('proyecto-det-descripcion');
  const statsContainer = document.getElementById(
    'proyecto-det-stats-container',
  );
  const tareasContainer = document.getElementById(
    'proyecto-det-tareas-container',
  );
  const eventosContainer = document.getElementById('proyectos-tab-eventos');
  const apuntesContainer = document.getElementById('proyectos-tab-apuntes');

  if (graficaDeProyecto) {
    graficaDeProyecto.destroy();
    graficaDeProyecto = null;
  }

  if (
    !headerInfo ||
    !descEl ||
    !statsContainer ||
    !tareasContainer ||
    !eventosContainer ||
    !apuntesContainer
  ) {
    return; // No hacer nada si el panel no está cargado
  }

  const proyecto = state.proyectos.find(
    (p) => String(p.id) === String(state.proyectoSeleccionadoId),
  );

  if (proyecto) {
    headerInfo.innerHTML = `<h3>${proyecto.nombre}</h3>${
      proyecto.curso && proyecto.curso !== 'General'
        ? `<h5 class="proyecto-curso-asignado">${proyecto.curso}</h5>`
        : ''
    }`;
    descEl.textContent =
      proyecto.descripcion || 'Este proyecto no tiene una descripción.';

    const stats = calcularEstadisticasProyecto(proyecto.id);

    // Pestaña 1: Resumen (Tareas + Gráfica)
    if (stats.total === 0) {
      statsContainer.style.display = 'none';
      renderizarListasDeTareas(proyecto.id); // Llama para mostrar mensaje de "sin tareas"
    } else {
      statsContainer.style.display = 'grid';
      renderizarListasDeTareas(proyecto.id);
      setTimeout(() => {
        const canvasEl = document.getElementById('proyecto-grafica-progreso');
        if (canvasEl && document.contains(canvasEl)) {
          renderizarGraficaProyecto(stats);
        }
      }, 50);
    }

    // Pestaña 2: Eventos
    renderizarListaEventos(proyecto.id, eventosContainer);

    // Pestaña 3: Apuntes
    renderizarListaApuntes(proyecto.id, apuntesContainer);
  } else {
    // Estado vacío
    headerInfo.innerHTML = '<h3>Selecciona un proyecto</h3>';
    descEl.textContent =
      'Elige un proyecto de la lista para ver sus detalles, tareas, eventos y apuntes asociados.';
    statsContainer.style.display = 'none';
    tareasContainer.innerHTML = '';
    eventosContainer.innerHTML =
      '<p class="detalle-lista-vacia">Selecciona un proyecto para ver sus eventos.</p>';
    apuntesContainer.innerHTML =
      '<p class="detalle-lista-vacia">Selecciona un proyecto para ver sus apuntes.</p>';
  }
}

/**
 * MODIFICADO: Agrega o edita un proyecto en Firestore.
 */
async function agregarOEditarProyecto() {
  const idInput = document.getElementById('input-proyecto-id');
  const id = idInput ? idInput.value : null; // ID es string (o null)
  const nombre = document.getElementById('input-nombre-proyecto').value.trim();
  const descripcion = document
    .getElementById('input-desc-proyecto')
    .value.trim();
  const curso = document.getElementById('select-curso-proyecto').value;

  if (!nombre) {
    return mostrarAlerta(
      'Campo Requerido',
      'El nombre del proyecto no puede estar vacío.',
    );
  }

  const datosProyecto = {
    nombre,
    descripcion,
    curso: curso || null,
  };

  try {
    if (id) {
      // --- CORREGIDO ---
      // Editar (Actualizar)
      await actualizarDocumento('proyectos', String(id), datosProyecto);
      console.log(`[Proyectos] Proyecto ${id} actualizado en Firestore.`);
    } else {
      // --- CORREGIDO ---
      // Nuevo (Crear con ID auto)
      const nuevoId = await agregarDocumento('proyectos', datosProyecto);
      console.log(
        `[Proyectos] Proyecto nuevo guardado en Firestore con ID: ${nuevoId}`,
      );
    }
    cerrarModal('modal-nuevo-proyecto');
    // Ya NO llamamos a renderizar...()
  } catch (error) {
    console.error('[Proyectos] Error al guardar proyecto:', error);
    mostrarAlerta('Error', 'No se pudo guardar el proyecto.');
  }
}

/**
 * Carga datos en el modal de edición (Sin cambios internos)
 */
function iniciarEdicionProyecto(id) {
  const proyecto = id
    ? state.proyectos.find((p) => String(p.id) === String(id))
    : null;
  const form = document.getElementById('form-nuevo-proyecto');
  if (form) form.reset();

  const selectorCurso = document.getElementById('select-curso-proyecto');
  if (selectorCurso) {
    popularSelectorDeCursos(selectorCurso, true);
    const opcionNinguno = document.createElement('option');
    opcionNinguno.value = '';
    opcionNinguno.textContent = 'Ninguno';
    selectorCurso.prepend(opcionNinguno);
    selectorCurso.value = proyecto?.curso || '';
  }

  document.getElementById('modal-proyecto-titulo').textContent = proyecto
    ? 'Editar Proyecto'
    : 'Agregar Nuevo Proyecto';
  document.getElementById('btn-guardar-proyecto').textContent = proyecto
    ? 'Actualizar Proyecto'
    : 'Guardar Proyecto';
  document.getElementById('input-proyecto-id').value = proyecto?.id || '';
  document.getElementById('input-nombre-proyecto').value =
    proyecto?.nombre || '';
  document.getElementById('input-desc-proyecto').value =
    proyecto?.descripcion || '';

  mostrarModal('modal-nuevo-proyecto');
}

/**
 * MODIFICADO: Elimina un proyecto de Firestore.
 */
async function eliminarProyecto(id) {
  const proyecto = state.proyectos.find((p) => String(p.id) === String(id));
  if (!proyecto) return;

  mostrarConfirmacion(
    'Eliminar Proyecto',
    `¿Estás seguro de que quieres eliminar el proyecto "${proyecto.nombre}"? Las tareas, eventos y apuntes asociados NO se borrarán, solo se desvincularán.`,
    async () => {
      try {
        // Fase P3.2 - TODO: Implementar batch para desvincular tareas, eventos, apuntes
        console.warn(
          `[Proyectos] TODO: Desvincular tareas/eventos/apuntes del proyecto ${id} (Fase P3)`,
        );

        // --- CORREGIDO ---
        // Fase P2 - Eliminación simple del proyecto
        await eliminarDocumento('proyectos', String(id));
        console.log(`[Proyectos] Proyecto ${id} eliminado de Firestore.`);

        if (String(state.proyectoSeleccionadoId) === String(id)) {
          state.proyectoSeleccionadoId = null;
          // El listener de 'proyectosActualizados' llamará a renderizarDetallesProyecto()
        }
      } catch (error) {
        console.error('[Proyectos] Error al eliminar proyecto:', error);
        mostrarAlerta('Error', 'No se pudo eliminar el proyecto.');
      }
    },
  );
}

/**
 * Carga datos en el modal Quick Add (Sin cambios internos)
 */
function abrirModalQuickAdd() {
  const proyecto = state.proyectos.find(
    (p) => String(p.id) === String(state.proyectoSeleccionadoId),
  );
  if (!proyecto) return;

  const form = document.getElementById('form-quick-add-tarea');
  if (form) form.reset();

  document.getElementById('quick-add-proyecto-nombre').value = proyecto.nombre;
  const selectorCurso = document.getElementById('quick-add-curso-tarea');
  if (selectorCurso) {
    popularSelectorDeCursos(selectorCurso);
    if (proyecto.curso) {
      selectorCurso.value = proyecto.curso;
    } else {
      const primerCurso = state.cursos.find(
        (c) => c.nombre !== 'General' && !c.isArchivado,
      );
      if (primerCurso) selectorCurso.value = primerCurso.nombre;
    }
  }
  const inputFecha = document.getElementById('quick-add-fecha-tarea');
  if (inputFecha) inputFecha.valueAsDate = new Date();

  mostrarModal('modal-quick-add-tarea');
}

/**
 * MODIFICADO: Agrega una tarea desde el modal Quick Add a Firestore.
 */
async function agregarTareaDesdeModal() {
  const nuevaTarea = {
    // id: Date.now(), // <-- ELIMINADO
    curso: document.getElementById('quick-add-curso-tarea').value,
    proyectoId: state.proyectoSeleccionadoId, // <-- CORREGIDO a proyectoId (deberías revisar tu state.js)
    proyectold: state.proyectoSeleccionadoId, // <-- Mantenemos tu typo por si acaso
    titulo: document.getElementById('quick-add-titulo-tarea').value.trim(),
    descripcion: document.getElementById('quick-add-desc-tarea').value.trim(),
    fecha: document.getElementById('quick-add-fecha-tarea').value,
    prioridad: document.getElementById('quick-add-prioridad-tarea').value,
    completada: false,
    subtareas: [],
  };
  if (!nuevaTarea.titulo || !nuevaTarea.fecha) {
    return mostrarAlerta(
      'Campos Requeridos',
      'El título y la fecha son obligatorios.',
    );
  }

  try {
    // --- CORREGIDO ---
    // (proyectos.js puede agregar 'tareas')
    const nuevoId = await agregarDocumento('tareas', nuevaTarea);
    console.log(
      `[Proyectos] Tarea rápida agregada a Firestore con ID: ${nuevoId}`,
    );
    cerrarModal('modal-quick-add-tarea');
  } catch (error) {
    console.error('[Proyectos] Error al agregar tarea rápida:', error);
    mostrarAlerta('Error', 'No se pudo guardar la tarea.');
  }
}

/**
 * MODIFICADO: Inicializa la página de Proyectos, suscribiéndose a eventos.
 */
export function inicializarProyectos() {
  console.log('[Proyectos] Inicializando y suscribiendo a eventos...');

  // --- Listeners de Modales (se adjuntan una sola vez al inicio) ---
  // (Estos modales están en index.html, por eso se adjuntan aquí)
  const formNuevoProyecto = document.getElementById('form-nuevo-proyecto');
  if (formNuevoProyecto && !formNuevoProyecto.dataset.listenerAttached) {
    formNuevoProyecto.addEventListener('submit', async (e) => {
      // <-- async
      e.preventDefault(); // <-- ¡CLAVE PARA EVITAR RECARGA!
      await agregarOEditarProyecto(); // <-- await
    });
    formNuevoProyecto.dataset.listenerAttached = 'true';
  }

  const formQuickAdd = document.getElementById('form-quick-add-tarea');
  if (formQuickAdd && !formQuickAdd.dataset.listenerAttached) {
    formQuickAdd.addEventListener('submit', async (e) => {
      // <-- async
      e.preventDefault(); // <-- ¡CLAVE PARA EVITAR RECARGA!
      await agregarTareaDesdeModal(); // <-- await
    });
    formQuickAdd.dataset.listenerAttached = 'true';
  }

  // --- SUSCRIPCIÓN A EVENTOS ---

  // 1. Escuchar cuándo el HTML de esta página se carga en el DOM
  EventBus.on('paginaCargada:proyectos', () => {
    console.log(
      '[Proyectos] Evento: paginaCargada:proyectos recibido. Conectando listeners de UI...',
    );

    const pageElement = document.getElementById('page-proyectos');
    if (!pageElement) return;

    // Renderizado inicial (muestra lo que 'state' tenga en este momento)
    renderizarProyectos();
    renderizarDetallesProyecto(); // Renderiza el panel vacío

    if (state.proyectoSeleccionadoId !== null) {
      pageElement.classList.add('detalle-visible');
    } else {
      pageElement.classList.remove('detalle-visible');
    }

    // Cargar iconos en botones
    const btnCerrarDetalles = document.getElementById(
      'btn-cerrar-detalles-proyecto',
    );
    if (btnCerrarDetalles) btnCerrarDetalles.innerHTML = ICONS.close;
    const btnMenuProyecto = document.getElementById('btn-proyecto-menu');
    if (btnMenuProyecto) btnMenuProyecto.innerHTML = ICONS.dots_vertical;
    const iconResumen = document.getElementById('proyectos-tab-icon-resumen');
    const iconEventos = document.getElementById('proyectos-tab-icon-eventos');
    const iconApuntes = document.getElementById('proyectos-tab-icon-apuntes');
    if (iconResumen) iconResumen.innerHTML = ICONS.tareas;
    if (iconEventos) iconEventos.innerHTML = ICONS.calendario;
    if (iconApuntes) iconApuntes.innerHTML = ICONS.apuntes;

    // Sincronizar UI de búsqueda
    const inputBusqueda = document.getElementById('input-buscar-proyectos');
    if (inputBusqueda) {
      inputBusqueda.value = searchTermProyectos;
      // Adjuntar listener de input (solo si no existe)
      if (inputBusqueda.dataset.listenerAttached !== 'true') {
        inputBusqueda.dataset.listenerAttached = 'true';
        inputBusqueda.addEventListener('input', (e) => {
          searchTermProyectos = e.target.value;
          renderizarProyectos(); // Búsqueda es local, SÍ renderiza manual
        });
      }
    }

    // --- Listeners de UI (se conectan cada vez que se carga la página) ---
    // (Usamos el patrón de un solo listener de clic por página)
    if (pageElement.dataset.clickHandlerAttached !== 'true') {
      pageElement.dataset.clickHandlerAttached = 'true';

      pageElement.addEventListener('click', (e) => {
        // Clic en Pestañas
        const tabButton = e.target.closest('.tab-item');
        if (tabButton) {
          e.stopPropagation();
          const tabId = tabButton.dataset.tab;
          if (!tabId) return;
          document
            .querySelectorAll('#panel-proyecto-detalles .tab-pane')
            .forEach((pane) => pane.classList.remove('active'));
          document
            .querySelectorAll('#panel-proyecto-detalles .tab-item')
            .forEach((btn) => btn.classList.remove('active'));
          document.getElementById(tabId)?.classList.add('active');
          tabButton.classList.add('active');
          return;
        }

        // Clic en Tarjeta de Proyecto
        const card = e.target.closest('.proyecto-card');
        if (card) {
          const proyectoId = card.dataset.id;
          if (e.target.closest('.btn-editar-proyecto')) {
            e.stopPropagation();
            iniciarEdicionProyecto(proyectoId);
            return;
          }
          if (e.target.closest('.btn-eliminar-proyecto')) {
            e.stopPropagation();
            eliminarProyecto(proyectoId); // ya es async
            return;
          }
          state.proyectoSeleccionadoId = proyectoId;
          pageElement.classList.add('detalle-visible');
          renderizarProyectos(); // Re-render lista para highlight
          renderizarDetallesProyecto(); // Carga detalles
          return;
        }

        // Clic en panel de detalles
        const panelDetalles = document.getElementById(
          'panel-proyecto-detalles',
        );
        if (panelDetalles && panelDetalles.contains(e.target)) {
          // Clic en Tarea
          const tareaItem = e.target.closest('li[data-task-id]');
          if (tareaItem) {
            const tareaId = tareaItem.dataset.taskId;
            if (tareaId) {
              EventBus.emit('navegarA', {
                pagina: 'tareas',
                id: tareaId, // ID ya es string (o debería serlo)
              });
              return;
            }
          }
          // Clic en Apunte
          const apunteItem = e.target.closest('li[data-apunte-id]');
          if (apunteItem) {
            const apunteId = apunteItem.dataset.apunteId;
            if (apunteId) {
              EventBus.emit('navegarA', {
                pagina: 'apuntes',
                id: apunteId,
              });
              return;
            }
          }
          // Clic en Evento
          const eventoItem = e.target.closest('li[data-evento-id]');
          if (eventoItem) {
            const eventoId = eventoItem.dataset.eventId;
            const evento = state.eventos.find(
              (e) => String(e.id) === String(eventoId),
            );
            if (evento) {
              // Asumiendo que calendario.js está migrado o desactivado
              if (window.iniciarEdicionEvento) {
                window.iniciarEdicionEvento(evento);
              } else {
                console.warn(
                  'iniciarEdicionEvento no está disponible globalmente.',
                );
                // Mantenemos tu import original por si acaso
                try {
                  iniciarEdicionEvento(evento);
                } catch (e) {
                  /* no hacer nada si falla */
                }
              }
            }
            return;
          }
          // Clic en botón "Cerrar"
          if (e.target.closest('#btn-cerrar-detalles-proyecto')) {
            state.proyectoSeleccionadoId = null;
            pageElement.classList.remove('detalle-visible');
            renderizarProyectos();
            renderizarDetallesProyecto();
            return;
          }
          // Clic en menú ...
          const menuDropdown = document.getElementById(
            'proyecto-menu-dropdown',
          );
          if (e.target.closest('#btn-proyecto-menu')) {
            e.stopPropagation();
            menuDropdown?.classList.toggle('visible');
            return;
          }
          // Clic en opciones de menú
          if (e.target.closest('#btn-detalles-editar-proyecto')) {
            iniciarEdicionProyecto(state.proyectoSeleccionadoId);
            if (menuDropdown) menuDropdown.classList.remove('visible');
            return;
          }
          if (e.target.closest('#btn-detalles-agregar-tarea')) {
            abrirModalQuickAdd();
            if (menuDropdown) menuDropdown.classList.remove('visible');
            return;
          }
          if (e.target.closest('#btn-detalles-eliminar-proyecto')) {
            eliminarProyecto(state.proyectoSeleccionadoId); // ya es async
            if (menuDropdown) menuDropdown.classList.remove('visible');
            return;
          }
        } // Fin clics panel detalles

        // Clic en "Nuevo Proyecto" (header)
        if (e.target.closest('#btn-nuevo-proyecto')) {
          iniciarEdicionProyecto(null);
          return;
        }
      }); // Fin clickHandler

      pageElement.addEventListener('click', clickHandler);
    } // Fin if(dataset.clickHandlerAttached)

    // Listener para cerrar menú dropdown si se hace clic fuera
    if (!document.body.dataset.proyectoMenuListener) {
      document.body.dataset.proyectoMenuListener = 'true';
      document.addEventListener('click', (e) => {
        if (state.paginaActual !== 'proyectos') return; // Solo actuar si estamos en la pág
        const menu = document.getElementById('proyecto-menu-dropdown');
        const btn = document.getElementById('btn-proyecto-menu');
        if (
          menu &&
          btn &&
          menu.classList.contains('visible') &&
          !menu.contains(e.target) &&
          !btn.contains(e.target)
        ) {
          menu.classList.remove('visible');
        }
      });
    }
  }); // Fin 'paginaCargada:proyectos'

  // 2. Escuchar cuándo cambian los datos (cursos, tareas, etc.)
  EventBus.on('proyectosActualizados', () => {
    if (state.paginaActual === 'proyectos') {
      console.log('[Proyectos] Evento: proyectosActualizados. Renderizando...');
      renderizarProyectos();
      renderizarDetallesProyecto(); // Refrescar detalles también
    }
  });

  const refrescarDependencias = () => {
    if (state.paginaActual === 'proyectos') {
      console.log(
        '[Proyectos] Evento: dependencias (tareas, etc) actualizadas. Renderizando...',
      );
      renderizarProyectos(); // Para actualizar contadores
      if (state.proyectoSeleccionadoId) {
        renderizarDetallesProyecto(); // Para actualizar listas en pestañas
      }
    }
  };

  EventBus.on('tareasActualizadas', refrescarDependencias);
  EventBus.on('eventosActualizados', refrescarDependencias);
  EventBus.on('apuntesActualizados', refrescarDependencias);
  EventBus.on('cursosActualizados', refrescarDependencias); // Para actualizar nombre de curso
} // Fin de inicializarProyectos
