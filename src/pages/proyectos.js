// ==========================================================================
// ==
// ==                      src/pages/proyectos.js
// ==
// ==    (MODIFICADO - CORREGIDO BUG DE FILTRO DE APUNTES ARCHIVADOS
// ==     Y APUNTES SIN CURSO)
// ==
// ==========================================================================

import { state } from '../state.js';
import { EventBus } from '../eventBus.js';
import {
  agregarDocumento,
  actualizarDocumento,
  eliminarDocumento,
  crearBatch,
  crearConsulta,
  ejecutarConsulta,
  db,
  doc,
} from '../firebase.js';
import {
  mostrarModal,
  cerrarModal,
  mostrarConfirmacion,
  mostrarAlerta,
  popularSelectorDeCursos,
} from '../ui.js';
import { ICONS } from '../icons.js';
import { iniciarEdicionEvento } from './calendario.js';

let graficaDeProyecto = null;
let searchTermProyectos = ''; // Variable local para búsqueda

/**
 * Lee 'proyectoId' O 'proyectold'
 */
export function calcularEstadisticasProyecto(proyectoId) {
  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );
  const strId = String(proyectoId);

  // CORRECCIÓN: Comprueba ambos campos para ser robusto con datos antiguos
  const tareasDelProyecto = state.tareas.filter(
    (t) =>
      (String(t.proyectoId) === strId || String(t.proyectold) === strId) &&
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
  if (!container) return;
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

  // Ordenar
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
 * Renderiza la gráfica
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
 * Lee 'proyectoId' O 'proyectold' y filtra archivados
 */
function renderizarListasDeTareas(proyectoId) {
  const container = document.getElementById('proyecto-det-tareas-container');
  if (!container) return;

  const strId = String(proyectoId);
  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );

  const tareasPendientes = state.tareas.filter(
    (t) =>
      (String(t.proyectoId) === strId || String(t.proyectold) === strId) &&
      !t.completada &&
      !cursosArchivadosNombres.has(t.curso),
  );

  const totalTareasProyecto = state.tareas.filter(
    (t) =>
      (String(t.proyectoId) === strId || String(t.proyectold) === strId) &&
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
 * Lee 'proyectoId' O 'proyectold' y filtra archivados
 */
function renderizarListaEventos(proyectoId, container) {
  if (!container) return;
  const strId = String(proyectoId);

  // ==========================================================
  // ==           INICIO CORRECCIÓN LÓGICA APUNTES           ==
  // ==========================================================
  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );

  const eventosDelProyecto = state.eventos.filter((e) => {
    const coincideProyecto =
      String(e.proyectoId) === strId || String(e.proyectold) === strId;
    if (!coincideProyecto) return false;

    // Si tiene curso, verificar que no esté archivado.
    if (e.curso) {
      return !cursosArchivadosNombres.has(e.curso);
    }

    // Si no tiene curso, mostrarlo (es un evento de proyecto general)
    return true;
  });
  // ==========================================================
  // ==             FIN CORRECCIÓN LÓGICA APUNTES            ==
  // ==========================================================

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
 * =========================================================================
 * ==        MODIFICADO (BUG CORREGIDO): Filtra apuntes archivados      ==
 * ==        y permite apuntes sin curso asignado.                    ==
 * =========================================================================
 */
function renderizarListaApuntes(proyectoId, container) {
  if (!container) return;
  const strId = String(proyectoId);

  // 1. Obtener cursos archivados
  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );

  // 2. Filtrar apuntes
  const apuntesDelProyecto = state.apuntes.filter((a) => {
    // 2a. Comprobar que pertenece al proyecto (con robustez)
    const coincideProyecto =
      String(a.proyectoId) === strId || String(a.proyectold) === strId;
    if (!coincideProyecto) return false;

    // 2b. Comprobar que su curso (si tiene) no esté archivado
    if (a.curso) {
      return !cursosArchivadosNombres.has(a.curso);
    }

    // 2c. Si no tiene curso, es un apunte "general" del proyecto. Mostrarlo.
    return true;
  });

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

    const stats = calcularEstadisticasProyecto(proyecto.id); // ¡Ahora usa la lógica corregida!

    // Pestaña 1: Resumen (Tareas + Gráfica)
    if (stats.total === 0) {
      statsContainer.style.display = 'none';
      renderizarListasDeTareas(proyecto.id); // Llama para mostrar mensaje de "sin tareas"
    } else {
      statsContainer.style.display = 'grid';
      renderizarListasDeTareas(proyecto.id); // ¡Ahora usa la lógica corregida!
      setTimeout(() => {
        const canvasEl = document.getElementById('proyecto-grafica-progreso');
        if (canvasEl && document.contains(canvasEl)) {
          renderizarGraficaProyecto(stats);
        }
      }, 50);
    }

    // Pestaña 2: Eventos
    renderizarListaEventos(proyecto.id, eventosContainer); // ¡Ahora usa la lógica corregida!

    // Pestaña 3: Apuntes
    renderizarListaApuntes(proyecto.id, apuntesContainer); // ¡Ahora usa la lógica corregida!
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
 * Agrega o edita un proyecto en Firestore.
 */
async function agregarOEditarProyecto() {
  const idInput = document.getElementById('input-proyecto-id');
  const id = idInput ? idInput.value : null;
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
      // Editar
      await actualizarDocumento('proyectos', String(id), datosProyecto);
      console.log(`[Proyectos] Proyecto ${id} actualizado en Firestore.`);
    } else {
      // Nuevo
      const nuevoId = await agregarDocumento('proyectos', datosProyecto);
      console.log(
        `[Proyectos] Proyecto nuevo guardado en Firestore con ID: ${nuevoId}`,
      );
    }
    cerrarModal('modal-nuevo-proyecto');
  } catch (error) {
    console.error('[Proyectos] Error al guardar proyecto:', error);
    mostrarAlerta('Error', 'No se pudo guardar el proyecto.');
  }
}

/**
 * Carga datos en el modal de edición
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
 * (P3.2 Robusto y Corregido con 'await'): Elimina un proyecto
 */
async function eliminarProyecto(id) {
  const proyecto = state.proyectos.find((p) => String(p.id) === String(id));
  if (!proyecto) return;

  const confirmado = await mostrarConfirmacion(
    'Eliminar Proyecto',
    `¿Estás seguro de que quieres eliminar el proyecto "${proyecto.nombre}"? Las tareas, eventos y apuntes asociados NO se borrarán, solo se desvincularán.`,
  );

  if (!confirmado) return;

  console.log(
    `[Proyectos-P3.2] Iniciando desvinculación y eliminación de ${proyecto.nombre}...`,
  );
  try {
    const batch = crearBatch();
    const strId = String(id);
    let contador = { tareas: 0, eventos: 0, apuntes: 0 };

    // --- Tareas (Busca en 'proyectoId' y 'proyectold') ---
    const consultaTareasId = crearConsulta('tareas', [
      'proyectoId',
      '==',
      strId,
    ]);
    const tareasId = await ejecutarConsulta(consultaTareasId);
    const consultaTareasLd = crearConsulta('tareas', [
      'proyectold',
      '==',
      strId,
    ]);
    const tareasLd = await ejecutarConsulta(consultaTareasLd);

    const tareasUnicas = new Map();
    [...tareasId, ...tareasLd].forEach((t) => tareasUnicas.set(t.id, t));

    tareasUnicas.forEach((t) => {
      const tareaRef = doc(db, 'usuarios', state.currentUserId, 'tareas', t.id);
      batch.update(tareaRef, { proyectoId: null, proyectold: null });
      contador.tareas++;
    });

    // --- Eventos (Busca en 'proyectoId' y 'proyectold') ---
    const consultaEventosId = crearConsulta('eventos', [
      'proyectoId',
      '==',
      strId,
    ]);
    const eventosId = await ejecutarConsulta(consultaEventosId);
    const consultaEventosLd = crearConsulta('eventos', [
      'proyectold',
      '==',
      strId,
    ]);
    const eventosLd = await ejecutarConsulta(consultaEventosLd);

    const eventosUnicos = new Map();
    [...eventosId, ...eventosLd].forEach((e) => eventosUnicos.set(e.id, e));

    eventosUnicos.forEach((e) => {
      const eventoRef = doc(
        db,
        'usuarios',
        state.currentUserId,
        'eventos',
        e.id,
      );
      batch.update(eventoRef, { proyectoId: null, proyectold: null });
      contador.eventos++;
    });

    // --- Apuntes (Busca en 'proyectoId' y 'proyectold') ---
    const consultaApuntesId = crearConsulta('apuntes', [
      'proyectoId',
      '==',
      strId,
    ]);
    const apuntesId = await ejecutarConsulta(consultaApuntesId);
    const consultaApuntesLd = crearConsulta('apuntes', [
      'proyectold',
      '==',
      strId,
    ]);
    const apuntesLd = await ejecutarConsulta(consultaApuntesLd);

    const apuntesUnicos = new Map();
    [...apuntesId, ...apuntesLd].forEach((a) => apuntesUnicos.set(a.id, a));

    apuntesUnicos.forEach((a) => {
      const apunteRef = doc(
        db,
        'usuarios',
        state.currentUserId,
        'apuntes',
        a.id,
      );
      batch.update(apunteRef, { proyectoId: null, proyectold: null });
      contador.apuntes++;
    });

    // 4. Eliminar el documento del PROYECTO
    const proyectoRef = doc(
      db,
      'usuarios',
      state.currentUserId,
      'proyectos',
      strId,
    );
    batch.delete(proyectoRef);

    console.log(
      `[Proyectos-P3.2] Batch listo para eliminar 1 proyecto y desvincular ${contador.tareas} tareas, ${contador.eventos} eventos, ${contador.apuntes} apuntes.`,
    );

    // 5. Ejecutar el batch
    await batch.commit();

    console.log(
      `[Proyectos] Proyecto ${id} eliminado y desvinculado (Consistencia aplicada).`,
    );

    if (String(state.proyectoSeleccionadoId) === String(id)) {
      state.proyectoSeleccionadoId = null;
    }
  } catch (error) {
    console.error('[Proyectos] Error al eliminar proyecto (P3.2):', error);
    mostrarAlerta(
      'Error',
      'No se pudo eliminar el proyecto y desvincular sus tareas.',
    );
  }
}

/**
 * Carga datos en el modal Quick Add
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
 * Agrega una tarea desde el modal Quick Add a Firestore.
 */
async function agregarTareaDesdeModal() {
  const nuevaTarea = {
    curso: document.getElementById('quick-add-curso-tarea').value,
    proyectoId: state.proyectoSeleccionadoId, // <-- Correcto
    // proyectold: null, // <-- ELIMINADO (Typo)
    titulo: document.getElementById('quick-add-titulo-tarea').value.trim(),
    descripcion: document.getElementById('quick-add-desc-tarea').value.trim(),
    fecha: document.getElementById('quick-add-fecha-tarea').value,
    prioridad: document.getElementById('quick-add-prioridad-tarea').value,
    completada: false,
    subtareas: [],
  };
  if (!nuevaTarea.titulo || !nuevaTarea.fecha) {
    return mostrarAlerta(
      'Campos Requerido',
      'El título y la fecha son obligatorios.',
    );
  }

  try {
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
 * Inicializa la página de Proyectos, suscribiéndose a eventos.
 */
export function inicializarProyectos() {
  console.log('[Proyectos] Inicializando y suscribiendo a eventos...');

  // --- Listeners de Modales (se adjuntan una sola vez al inicio) ---
  const formNuevoProyecto = document.getElementById('form-nuevo-proyecto');
  if (formNuevoProyecto && !formNuevoProyecto.dataset.listenerAttached) {
    formNuevoProyecto.addEventListener('submit', async (e) => {
      e.preventDefault();
      await agregarOEditarProyecto();
    });
    formNuevoProyecto.dataset.listenerAttached = 'true';
  }

  const formQuickAdd = document.getElementById('form-quick-add-tarea');
  if (formQuickAdd && !formQuickAdd.dataset.listenerAttached) {
    formQuickAdd.addEventListener('submit', async (e) => {
      e.preventDefault();
      await agregarTareaDesdeModal();
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

    // Renderizado inicial
    renderizarProyectos();
    renderizarDetallesProyecto(); // Renderiza el panel (vacío o con datos)

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
      if (inputBusqueda.dataset.listenerAttached !== 'true') {
        inputBusqueda.dataset.listenerAttached = 'true';
        inputBusqueda.addEventListener('input', (e) => {
          searchTermProyectos = e.target.value;
          renderizarProyectos();
        });
      }
    }

    // --- Listeners de UI (se conectan cada vez que se carga la página) ---
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
            eliminarProyecto(proyectoId);
            return;
          }
          state.proyectoSeleccionadoId = proyectoId;
          pageElement.classList.add('detalle-visible');
          renderizarProyectos();
          renderizarDetallesProyecto();
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
                id: tareaId,
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
              try {
                iniciarEdicionEvento(evento);
              } catch (e) {
                console.error(
                  '[Proyectos] Error al llamar a iniciarEdicionEvento:',
                  e,
                );
                mostrarAlerta(
                  'Error',
                  'No se pudo abrir la edición del evento.',
                );
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
            eliminarProyecto(state.proyectoSeleccionadoId);
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
    } // Fin if(dataset.clickHandlerAttached)

    // Listener para cerrar menú dropdown si se hace clic fuera
    if (!document.body.dataset.proyectoMenuListener) {
      document.body.dataset.proyectoMenuListener = 'true';
      document.addEventListener('click', (e) => {
        if (state.paginaActual !== 'proyectos') return;
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
      renderizarDetallesProyecto();
    }
  });

  const refrescarDependencias = () => {
    if (state.paginaActual === 'proyectos') {
      console.log(
        '[Proyectos] Evento: dependencias (tareas, etc) actualizadas. Renderizando...',
      );
      renderizarProyectos();
      if (state.proyectoSeleccionadoId) {
        renderizarDetallesProyecto();
      }
    }
  };

  EventBus.on('tareasActualizadas', refrescarDependencias);
  EventBus.on('eventosActualizados', refrescarDependencias);
  EventBus.on('apuntesActualizados', refrescarDependencias);
  EventBus.on('cursosActualizados', refrescarDependencias);
} // Fin de inicializarProyectos
