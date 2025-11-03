// ==========================================================================
// ==
// ==                          src/pages/cursos.js
// ==
// ==    (MODIFICADO - CORREGIDO BUG DE CONSISTENCIA EN 'renombrarCurso'
// ==     QUE OLVIDÓ ACTUALIZAR LOS PROYECTOS)
// ==
// ==========================================================================

import { state } from '../state.js';
import { EventBus } from '../eventBus.js';
import {
  db,
  doc,
  agregarDocumento,
  actualizarDocumento,
  eliminarDocumento,
  crearConsulta,
  ejecutarConsulta,
  crearBatch,
} from '../firebase.js';
import {
  mostrarConfirmacion,
  mostrarModal,
  cerrarModal,
  mostrarAlerta,
} from '../ui.js';
import { generarEventosRecurrentes } from './calendario.js';
import { ICONS } from '../icons.js';

// ===== Variables locales para búsqueda y filtro =====
let searchTerm = '';
let mostrarArchivados = false;
// ==========================================================

let emojiPicker = null;
let currentEmojiButton = null;
let currentEmojiInputHidden = null;

// --- Helpers (Sin cambios) ---
function formatFechaDDMMYYYY(fechaStr) {
  try {
    const [year, month, day] = fechaStr.split('-');
    return `${day}/${month}/${year}`;
  } catch (e) {
    return 'Fecha inválida';
  }
}
function getEstadoTarea(tarea) {
  if (tarea.completada) return 'completada';
  if (!tarea.fecha) return 'pendiente';
  let fechaTarea;
  try {
    fechaTarea = new Date(tarea.fecha + 'T00:00:00');
    if (isNaN(fechaTarea.getTime())) throw new Error('Inv Date');
  } catch (e) {
    return 'pendiente';
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diffTiempo = fechaTarea.getTime() - hoy.getTime();
  if (diffTiempo < 0) return 'vencida';
  if (diffTiempo === 0) return 'hoy';
  return 'pendiente';
}

/**
 * Renderiza las tarjetas de curso basándose en el 'state' actual.
 */
export function renderizarCursos() {
  const container = document.getElementById('lista-cursos-container');
  if (!container) return;

  container.innerHTML = '';

  const terminoBusqueda = searchTerm.toLowerCase();
  const cursosFiltrados = state.cursos.filter((curso) => {
    if (!mostrarArchivados && curso.isArchivado) {
      return false;
    }
    if (
      !mostrarArchivados &&
      curso.nombre === 'General' &&
      state.cursos.filter((c) => !c.isArchivado).length > 1
    ) {
      return false;
    }
    if (terminoBusqueda) {
      return curso.nombre.toLowerCase().includes(terminoBusqueda);
    }
    return true;
  });

  if (cursosFiltrados.length === 0) {
    container.innerHTML =
      '<p style="padding: 15px; color: var(--text-muted);">No se encontraron cursos.</p>';
    return;
  }

  cursosFiltrados.sort((a, b) => {
    if (a.isArchivado !== b.isArchivado) {
      return a.isArchivado ? 1 : -1;
    }
    if (a.nombre === 'General' && !a.isArchivado) return -1;
    if (b.nombre === 'General' && !b.isArchivado) return 1;
    return a.nombre.localeCompare(b.nombre);
  });

  cursosFiltrados.forEach((curso) => {
    const tareasDelCurso = state.tareas.filter((t) => t.curso === curso.nombre);
    const tareasCompletadas = tareasDelCurso.filter((t) => t.completada).length;
    const totalTareas = tareasDelCurso.length;
    const porcentaje =
      totalTareas > 0 ? (tareasCompletadas / totalTareas) * 100 : 0;
    const tareasPendientes = tareasDelCurso.filter((t) => !t.completada);
    const ordenPrioridad = { Alta: 0, Media: 1, Baja: 2 };
    const tareasPendientesOrdenadas = tareasPendientes.sort((a, b) => {
      const fechaA = a.fecha ? new Date(a.fecha) : new Date(8640000000000000);
      const fechaB = b.fecha ? new Date(b.fecha) : new Date(8640000000000000);
      if (fechaA - fechaB !== 0) return fechaA - fechaB;
      return (
        (ordenPrioridad[a.prioridad] ?? 3) - (ordenPrioridad[b.prioridad] ?? 3)
      );
    });
    const proximaTarea = tareasPendientesOrdenadas[0];
    let textoProximaEntrega = '¡Todo al día!';
    if (proximaTarea && proximaTarea.fecha) {
      try {
        const [, month, day] = proximaTarea.fecha.split('-');
        textoProximaEntrega = `Próxima: ${proximaTarea.titulo} (${day}/${month})`;
      } catch (e) {
        textoProximaEntrega = `Próxima: ${proximaTarea.titulo} (Fecha inválida)`;
      }
    } else if (proximaTarea) {
      textoProximaEntrega = `Próxima: ${proximaTarea.titulo} (Sin fecha)`;
    }

    const card = document.createElement('div');
    card.className = 'curso-card';
    card.dataset.cursoId = curso.id;
    if (curso.isArchivado) card.classList.add('archivado');

    let actionButtons = '';
    if (curso.nombre !== 'General') {
      actionButtons += `<button class="btn-icon btn-editar-curso" title="Editar Curso">${ICONS.edit}</button>`;
      if (curso.isArchivado) {
        actionButtons += `<button class="btn-icon btn-desarchivar-curso" title="Desarchivar Curso">${ICONS.unarchive || 'D'}</button>`;
      } else {
        actionButtons += `<button class="btn-icon btn-archivar-curso" title="Archivar Curso">${ICONS.archive || 'A'}</button>`;
      }
      actionButtons += `<button class="btn-icon btn-eliminar-curso" title="Eliminar Curso Permanentemente">${ICONS.delete}</button>`;
    }

    card.innerHTML = `
            <h4>${curso.emoji ? `<span class="curso-emoji">${curso.emoji}</span> ` : ''}${curso.nombre}</h4>
            <div class="curso-stats">
                <span class="stat-texto">${tareasCompletadas} de ${totalTareas} tareas completadas</span>
                <div class="progreso-barra-container">
                    <div class="progreso-barra-relleno" style="width: ${porcentaje}%;"></div>
                </div>
                <span class="proxima-entrega">${textoProximaEntrega}</span>
            </div>
            <div class="curso-card-actions">
                ${actionButtons}
            </div>
        `;
    container.appendChild(card);
  });
}

/**
 * Helper para actualizar la apariencia del botón emoji
 */
function actualizarBotonEmoji(buttonEl, emoji) {
  if (!buttonEl) return;
  if (emoji) {
    buttonEl.innerHTML = emoji;
    buttonEl.classList.add('has-emoji');
  } else {
    buttonEl.innerHTML = ICONS.emoji_wink || '😉';
    buttonEl.classList.remove('has-emoji');
  }
}

/**
 * Guarda un nuevo curso en Firestore.
 */
async function agregarCurso(nombre, emoji) {
  if (!state.currentUserId) {
    console.error('[Cursos] No hay User ID para guardar el curso.');
    mostrarAlerta('Error', 'No se pudo guardar el curso. Intenta recargar.');
    return;
  }
  if (
    !nombre ||
    state.cursos
      .map((c) => c.nombre.toLowerCase())
      .includes(nombre.toLowerCase())
  ) {
    alert('El nombre del curso no puede estar vacío o ya existe.');
    return;
  }

  const emojiSeleccionado =
    document.getElementById('input-emoji-curso-hidden')?.value || null;

  const nuevoCurso = {
    nombre: nombre,
    emoji: emojiSeleccionado,
    isArchivado: false,
  };

  try {
    const nuevoId = await agregarDocumento('cursos', nuevoCurso);
    console.log('[Cursos] Nuevo curso guardado en Firestore con ID:', nuevoId);
  } catch (error) {
    console.error('[Cursos] Error al agregar curso a Firestore:', error);
    mostrarAlerta('Error', 'No se pudo guardar el nuevo curso.');
  }
}

/**
 * Carga datos en el modal de renombrar
 */
function iniciarRenombrarCurso(cursoId) {
  const curso = state.cursos.find((c) => String(c.id) === String(cursoId));
  if (!curso) return;
  const inputId = document.getElementById('input-renombrar-curso-id');
  const inputNuevoNombre = document.getElementById(
    'input-renombrar-curso-nombre',
  );
  const btnEmoji = document.getElementById('btn-renombrar-emoji-curso');
  const inputEmojiHidden = document.getElementById(
    'input-renombrar-emoji-curso-hidden',
  );

  if (inputId) inputId.value = curso.id;
  if (inputNuevoNombre) inputNuevoNombre.value = curso.nombre;
  if (inputEmojiHidden) inputEmojiHidden.value = curso.emoji || '';
  if (btnEmoji) actualizarBotonEmoji(btnEmoji, curso.emoji);

  mostrarModal('modal-renombrar-curso');
}

/**
 * (P3.2): Renombra un curso y aplica consistencia.
 */
async function renombrarCurso(cursoId, nuevoNombre) {
  if (!state.currentUserId) return mostrarAlerta('Error', 'No autenticado.');

  const curso = state.cursos.find((c) => String(c.id) === String(cursoId));
  if (!curso) return;
  const nombreOriginal = curso.nombre;

  if (
    !nuevoNombre ||
    (nuevoNombre.toLowerCase() !== nombreOriginal.toLowerCase() &&
      state.cursos
        .map((c) => c.nombre.toLowerCase())
        .includes(nuevoNombre.toLowerCase()))
  ) {
    alert('El nuevo nombre del curso no puede estar vacío o ya existe.');
    return;
  }

  const emojiSeleccionado =
    document.getElementById('input-renombrar-emoji-curso-hidden')?.value ||
    null;

  const necesitaConsistencia =
    nuevoNombre.toLowerCase() !== nombreOriginal.toLowerCase();

  try {
    const batch = crearBatch();
    const cursoRef = doc(
      db,
      'usuarios',
      state.currentUserId,
      'cursos',
      String(cursoId),
    );
    batch.update(cursoRef, {
      nombre: nuevoNombre,
      emoji: emojiSeleccionado,
    });

    if (necesitaConsistencia) {
      console.log(
        `[Cursos-P3.2] Aplicando consistencia para renombrar: ${nombreOriginal} -> ${nuevoNombre}`,
      );
      const consultaTareas = crearConsulta('tareas', [
        'curso',
        '==',
        nombreOriginal,
      ]);
      const tareas = await ejecutarConsulta(consultaTareas);
      tareas.forEach((t) => {
        const tareaRef = doc(
          db,
          'usuarios',
          state.currentUserId,
          'tareas',
          t.id,
        );
        batch.update(tareaRef, { curso: nuevoNombre });
      });

      const consultaApuntes = crearConsulta('apuntes', [
        'curso',
        '==',
        nombreOriginal,
      ]);
      const apuntes = await ejecutarConsulta(consultaApuntes);
      apuntes.forEach((a) => {
        const apunteRef = doc(
          db,
          'usuarios',
          state.currentUserId,
          'apuntes',
          a.id,
        );
        batch.update(apunteRef, { curso: nuevoNombre });
      });

      const consultaEventos = crearConsulta('eventos', [
        'curso',
        '==',
        nombreOriginal,
      ]);
      const eventos = await ejecutarConsulta(consultaEventos);
      eventos.forEach((e) => {
        const eventoRef = doc(
          db,
          'usuarios',
          state.currentUserId,
          'eventos',
          e.id,
        );
        batch.update(eventoRef, { curso: nuevoNombre });
      });

      // ==========================================================
      // ==           INICIO CORRECCIÓN PROYECTOS              ==
      // ==========================================================
      const consultaProyectos = crearConsulta('proyectos', [
        'curso',
        '==',
        nombreOriginal,
      ]);
      const proyectos = await ejecutarConsulta(consultaProyectos);
      proyectos.forEach((p) => {
        const proyectoRef = doc(
          db,
          'usuarios',
          state.currentUserId,
          'proyectos',
          p.id,
        );
        batch.update(proyectoRef, { curso: nuevoNombre });
      });
      // ==========================================================
      // ==             FIN CORRECCIÓN PROYECTOS               ==
      // ==========================================================

      console.log(
        `[Cursos-P3.2] Batch listo para actualizar: ${tareas.length} tareas, ${apuntes.length} apuntes, ${eventos.length} eventos y ${proyectos.length} proyectos.`,
      );
    }
    await batch.commit();
    console.log(
      `[Cursos] Curso ${nombreOriginal} renombrado a ${nuevoNombre} en Firestore (Consistencia aplicada).`,
    );
  } catch (error) {
    console.error('[Cursos] Error al renombrar curso en Firestore:', error);
    mostrarAlerta('Error', 'No se pudo renombrar el curso.');
  }
}

/**
 * Archiva un curso
 */
async function archivarCurso(cursoId) {
  if (!state.currentUserId) return mostrarAlerta('Error', 'No autenticado.');

  const curso = state.cursos.find((c) => String(c.id) === String(cursoId));
  if (!curso || curso.nombre === 'General') return;

  const confirmado = await mostrarConfirmacion(
    'Archivar Curso',
    `¿Archivar "${curso.nombre}"? El curso se ocultará, pero sus tareas y apuntes no se borrarán. Podrás verlo activando "Mostrar archivados".`,
  );

  if (!confirmado) return;

  try {
    await actualizarDocumento('cursos', String(cursoId), {
      isArchivado: true,
    });
    console.log(`[Cursos] Curso ${curso.nombre} archivado en Firestore.`);

    if (String(state.cursoSeleccionadoId) === String(cursoId)) {
      cerrarPanelDetalles();
    }
  } catch (error) {
    console.error('[Cursos] Error al archivar curso:', error);
    mostrarAlerta('Error', 'No se pudo archivar el curso.');
  }
}

/**
 * Marca un curso como no archivado en Firestore.
 */
async function desarchivarCurso(cursoId) {
  if (!state.currentUserId) return mostrarAlerta('Error', 'No autenticado.');

  const curso = state.cursos.find((c) => String(c.id) === String(cursoId));
  if (!curso) return;

  try {
    await actualizarDocumento('cursos', String(cursoId), {
      isArchivado: false,
    });
    console.log(`[Cursos] Curso ${curso.nombre} desarchivado en Firestore.`);
  } catch (error) {
    console.error('[Cursos] Error al desarchivar curso:', error);
    mostrarAlerta('Error', 'No se pudo desarchivar el curso.');
  }
}

/**
 * (P3.2): Elimina un curso y aplica consistencia (BORRADO).
 */
async function eliminarCurso(cursoId) {
  if (!state.currentUserId) return mostrarAlerta('Error', 'No autenticado.');

  const curso = state.cursos.find((c) => String(c.id) === String(cursoId));
  if (!curso || curso.nombre === 'General') return;
  const nombreCurso = curso.nombre;

  const confirmado = await mostrarConfirmacion(
    'Eliminar Curso Permanentemente',
    `¡ACCIÓN PERMANENTE! ¿Eliminar "${curso.nombre}"? Se borrarán el curso, todas sus tareas y todos sus apuntes asociados. Esta acción NO se puede deshacer.`,
  );

  if (!confirmado) return;

  console.log(
    `[Cursos-P3.2] Iniciando eliminación permanente de ${nombreCurso}...`,
  );
  try {
    const batch = crearBatch();

    // 1. Buscar y eliminar TAREAS relacionadas
    const consultaTareas = crearConsulta('tareas', [
      'curso',
      '==',
      nombreCurso,
    ]);
    const tareas = await ejecutarConsulta(consultaTareas);
    tareas.forEach((t) => {
      const tareaRef = doc(db, 'usuarios', state.currentUserId, 'tareas', t.id);
      batch.delete(tareaRef);
    });

    // 2. Buscar y eliminar APUNTES relacionados
    const consultaApuntes = crearConsulta('apuntes', [
      'curso',
      '==',
      nombreCurso,
    ]);
    const apuntes = await ejecutarConsulta(consultaApuntes);
    apuntes.forEach((a) => {
      const apunteRef = doc(
        db,
        'usuarios',
        state.currentUserId,
        'apuntes',
        a.id,
      );
      batch.delete(apunteRef);
    });

    // 3. Buscar y eliminar EVENTOS relacionados
    const consultaEventos = crearConsulta('eventos', [
      'curso',
      '==',
      nombreCurso,
    ]);
    const eventos = await ejecutarConsulta(consultaEventos);
    eventos.forEach((e) => {
      const eventoRef = doc(
        db,
        'usuarios',
        state.currentUserId,
        'eventos',
        e.id,
      );
      batch.delete(eventoRef);
    });

    // 4. Buscar y *DESVINCULAR* PROYECTOS (no borrarlos)
    const consultaProyectos = crearConsulta('proyectos', [
      'curso',
      '==',
      nombreCurso,
    ]);
    const proyectos = await ejecutarConsulta(consultaProyectos);
    proyectos.forEach((p) => {
      const proyectoRef = doc(
        db,
        'usuarios',
        state.currentUserId,
        'proyectos',
        p.id,
      );
      batch.update(proyectoRef, { curso: null }); // Desvincular, no borrar
    });

    // 5. Eliminar el documento del CURSO
    const cursoRef = doc(
      db,
      'usuarios',
      state.currentUserId,
      'cursos',
      String(cursoId),
    );
    batch.delete(cursoRef);

    console.log(
      `[Cursos-P3.2] Batch listo para eliminar: 1 curso, ${tareas.length} tareas, ${apuntes.length} apuntes, ${eventos.length} eventos y desvincular ${proyectos.length} proyectos.`,
    );

    // 6. Ejecutar el batch
    await batch.commit();

    console.log(
      `[Cursos] Eliminación de ${nombreCurso} completada en Firestore (Consistencia aplicada).`,
    );

    if (String(state.cursoSeleccionadoId) === String(cursoId)) {
      cerrarPanelDetalles();
    }
  } catch (error) {
    console.error('[Cursos] Error al eliminar curso en Firestore:', error);
    mostrarAlerta('Error', 'No se pudo eliminar el curso.');
  }
}

// ... (Lógica del Emoji Picker: sin cambios) ...
function showEmojiPicker(buttonElement, inputHiddenElement) {
  if (!emojiPicker) {
    emojiPicker = document.querySelector('emoji-picker');
    if (!emojiPicker) {
      console.error('Elemento <emoji-picker> no encontrado.');
      return;
    }
    emojiPicker.addEventListener('emoji-click', (event) => {
      if (currentEmojiButton && currentEmojiInputHidden) {
        const emoji = event.detail.unicode;
        currentEmojiInputHidden.value = emoji;
        actualizarBotonEmoji(currentEmojiButton, emoji);
      }
      hideEmojiPicker();
    });
    document.addEventListener('click', handleClickOutsidePicker, true);
  }
  currentEmojiButton = buttonElement;
  currentEmojiInputHidden = inputHiddenElement;
  const btnRect = buttonElement.getBoundingClientRect();
  emojiPicker.style.top = `${window.scrollY + btnRect.bottom + 5}px`;
  let leftPos = window.scrollX + btnRect.left;
  if (leftPos + emojiPicker.offsetWidth > window.innerWidth - 10) {
    leftPos = window.innerWidth - emojiPicker.offsetWidth - 10;
  }
  if (leftPos < 10) leftPos = 10;
  emojiPicker.style.left = `${leftPos}px`;
  emojiPicker.className = document.body.classList.contains('dark-theme')
    ? 'dark emoji-picker-popup visible'
    : 'light emoji-picker-popup visible';
  emojiPicker.classList.add('visible');
}
function hideEmojiPicker() {
  if (emojiPicker) emojiPicker.classList.remove('visible');
  currentEmojiButton = null;
  currentEmojiInputHidden = null;
}
function handleClickOutsidePicker(event) {
  if (
    emojiPicker &&
    emojiPicker.classList.contains('visible') &&
    !emojiPicker.contains(event.target) &&
    !currentEmojiButton?.contains(event.target)
  ) {
    hideEmojiPicker();
  }
}

// ... (Funciones de renderizado del panel de detalles: sin cambios) ...
function abrirPanelDetalles(cursoId) {
  if (!cursoId) return;
  const curso = state.cursos.find((c) => String(c.id) === String(cursoId));
  if (!curso) return;

  document
    .querySelectorAll('.curso-card.selected')
    .forEach((c) => c.classList.remove('selected'));
  document
    .querySelector(`.curso-card[data-curso-id="${cursoId}"]`)
    ?.classList.add('selected');

  state.cursoSeleccionadoId = cursoId;
  document.getElementById('page-cursos').classList.add('detalle-visible');

  const headerEl = document.querySelector(
    '#cursos-details-panel .panel-lateral-header',
  );
  const tituloEl = document.getElementById('curso-detalle-titulo');
  const btnCerrar = document.getElementById('btn-cerrar-detalles-curso');

  if (headerEl && tituloEl && btnCerrar) {
    tituloEl.innerHTML = `${curso.emoji ? `<span class="curso-emoji">${curso.emoji}</span> ` : ''}${curso.nombre}`;
    let btnEditar = headerEl.querySelector('.btn-editar-curso-panel');
    if (!btnEditar) {
      btnEditar = document.createElement('button');
      btnEditar.className = 'btn-icon btn-editar-curso-panel';
      btnEditar.title = 'Editar Curso';
      headerEl.insertBefore(btnEditar, btnCerrar);
    }
    btnEditar.innerHTML = ICONS.edit;
    btnEditar.style.display =
      curso.nombre === 'General' || curso.isArchivado ? 'none' : 'flex';
  } else {
    console.error('Faltan elementos del header del panel de detalles.');
  }
  renderizarPanelDetalles();
}
function cerrarPanelDetalles() {
  document
    .querySelectorAll('.curso-card.selected')
    .forEach((c) => c.classList.remove('selected'));
  state.cursoSeleccionadoId = null;
  document.getElementById('page-cursos').classList.remove('detalle-visible');
  const contenidoEl = document.getElementById('curso-detalle-contenido');
  if (contenidoEl) contenidoEl.innerHTML = '<p>Cargando...</p>';
}
function renderizarPanelDetalles() {
  const contenidoEl = document.getElementById('curso-detalle-contenido');
  const curso = state.cursos.find(
    (c) => String(c.id) === String(state.cursoSeleccionadoId),
  );
  if (!contenidoEl || !curso) return;
  const iconoGeneral =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 15.5L8 10.5L13 15.5L21 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7.5H21V13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const iconoApuntes = ICONS.apuntes || 'A';
  contenidoEl.innerHTML = `
      <nav class="tabs-nav">
        <button class="tab-item active" data-tab="general"><span class="tab-icon">${iconoGeneral}</span>General</button>
        <button class="tab-item" data-tab="apuntes"><span class="tab-icon">${iconoApuntes}</span>Apuntes</button>
      </nav>
      <div class="tab-content">
        <div id="tab-general" class="tab-pane active"></div>
        <div id="tab-apuntes" class="tab-pane"></div>
      </div>
      <div class="panel-lateral-actions">
        <button id="btn-nuevo-apunte-curso" class="btn-secondary">Nuevo Apunte</button>
        <button id="btn-agregar-rapido-curso" class="btn-accent btn-icon">${ICONS.add || '+'}</button>
      </div>
    `;
  setTimeout(() => {
    renderizarTabGeneral(curso);
    renderizarTabApuntes(curso);
  }, 0);
}
function renderizarTabGeneral(curso) {
  const tabGeneral = document.getElementById('tab-general');
  if (!tabGeneral) return;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const tareasDelCurso = state.tareas.filter((t) => t.curso === curso.nombre);
  const eventosExpandidos = generarEventosRecurrentes(
    state.eventos,
    hoy,
    new Date(hoy.getFullYear() + 5, 0, 1),
  );
  const eventosDelCurso = eventosExpandidos.filter(
    (e) => e.curso === curso.nombre && new Date(e.fechaFin) >= hoy,
  );
  const stats = { pendientes: 0, completadas: 0, vencidas: 0 };
  const tareas = { pendientes: [], completadas: [], vencidas: [] };
  tareasDelCurso.forEach((t) => {
    const estado = getEstadoTarea(t);
    if (estado === 'completada') {
      stats.completadas++;
      tareas.completadas.push(t);
    } else if (estado === 'vencida') {
      stats.vencidas++;
      tareas.vencidas.push(t);
    } else {
      stats.pendientes++;
      tareas.pendientes.push(t);
    }
  });
  let html = `
      <div class="detalle-stats-grid">
        <div class="stat-item"><span class="stat-numero">${stats.pendientes}</span><span class="stat-etiqueta">Pendientes</span></div>
        <div class="stat-item"><span class="stat-numero">${stats.vencidas}</span><span class="stat-etiqueta">Vencidas</span></div>
        <div class="stat-item"><span class="stat-numero">${stats.completadas}</span><span class="stat-etiqueta">Completadas</span></div>
      </div>`;
  html += '<div class="detalle-listas-container">';
  if (tareas.vencidas.length > 0) {
    html +=
      '<h5 class="detalle-lista-titulo">Tareas Vencidas</h5><ul class="detalle-lista">';
    tareas.vencidas
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .forEach((t) => (html += renderizarItemTarea(t)));
    html += '</ul>';
  }
  if (tareas.pendientes.length > 0) {
    html +=
      '<h5 class="detalle-lista-titulo">Tareas Pendientes</h5><ul class="detalle-lista">';
    tareas.pendientes
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .forEach((t) => (html += renderizarItemTarea(t)));
    html += '</ul>';
  }
  if (eventosDelCurso.length > 0) {
    html +=
      '<h5 class="detalle-lista-titulo">Eventos Próximos</h5><ul class="detalle-lista">';
    eventosDelCurso
      .sort((a, b) => new Date(a.fechaInicio) - new Date(a.fechaInicio))
      .forEach((e) => (html += renderizarItemEvento(e)));
    html += '</ul>';
  }
  if (tareas.completadas.length > 0) {
    html +=
      '<h5 class="detalle-lista-titulo">Tareas Completadas</h5><ul class="detalle-lista">';
    tareas.completadas
      .sort((a, b) => new Date(b.fechaCompletado) - new Date(a.fechaCompletado))
      .forEach((t) => (html += renderizarItemTarea(t)));
    html += '</ul>';
  }
  if (
    tareasDelCurso.length === 0 &&
    eventosDelCurso.length === 0 &&
    tareas.vencidas.length === 0
  ) {
    html +=
      '<p class="detalle-lista-vacia">No hay tareas ni eventos asociados a este curso.</p>';
  }
  html += '</div>';
  tabGeneral.innerHTML = html;
}
function renderizarTabApuntes(curso) {
  const tabApuntes = document.getElementById('tab-apuntes');
  if (!tabApuntes) return;
  const apuntesDelCurso = state.apuntes.filter((a) => a.curso === curso.nombre);
  if (apuntesDelCurso.length === 0) {
    tabApuntes.innerHTML =
      '<p class="detalle-lista-vacia">No hay apuntes asociados a este curso.</p>';
    return;
  }
  let html = '<ul class="detalle-lista">';
  apuntesDelCurso
    .sort(
      (a, b) => new Date(b.fechaModificacion) - new Date(a.fechaModificacion),
    )
    .forEach((apunte) => {
      html += `
              <li class="detalle-item item-apunte" data-apunte-id="${apunte.id}">
                <span class="prioridad-indicador" style="background-color: var(--text-muted);"></span>
                <div class="detalle-item-contenido">
                  <span class="detalle-item-titulo">${apunte.titulo || 'Apunte sin título'}</span>
                  <div class="detalle-item-meta">
                    <span class="detalle-item-fecha">Modif: ${formatFechaDDMMYYYY(apunte.fechaModificacion.split('T')[0])}</span>
                  </div>
                </div>
              </li>`;
    });
  html += '</ul>';
  tabApuntes.innerHTML = html;
}
function renderizarItemTarea(tarea) {
  const proyecto = tarea.proyectoId
    ? state.proyectos.find(
        (p) =>
          String(p.id) === String(tarea.proyectoId) ||
          String(p.id) === String(tarea.proyectold),
      ) // Robustez por typo
    : null;
  const estado = getEstadoTarea(tarea);
  return `
      <li class="detalle-item item-tarea ${estado}" data-tarea-id="${tarea.id}">
        <span class="prioridad-indicador prioridad-${tarea.prioridad.toLowerCase()}"></span>
        <div class="detalle-item-contenido">
          <span class="detalle-item-titulo">${tarea.titulo}</span>
          <div class="detalle-item-meta">
            <span class="detalle-item-fecha">${tarea.fecha ? formatFechaDDMMYYYY(tarea.fecha) : 'Sin fecha'}</span>
            ${proyecto ? `<span class="detalle-item-proyecto">${proyecto.nombre}</span>` : ''}
          </div>
        </div>
      </li>`;
}
function renderizarItemEvento(evento) {
  const proyecto = evento.proyectoId
    ? state.proyectos.find(
        (p) =>
          String(p.id) === String(evento.proyectoId) ||
          String(p.id) === String(evento.proyectold),
      ) // Robustez por typo
    : null;
  const fechaStr =
    evento.fechaInicio === evento.fechaFin
      ? formatFechaDDMMYYYY(evento.fechaInicio)
      : `${formatFechaDDMMYYYY(evento.fechaInicio)} - ${formatFechaDDMMYYYY(evento.fechaFin)}`;
  return `
      <li class="detalle-item item-evento" data-evento-id="${evento.originalId || evento.id}">
        <span class="prioridad-indicador" style="background-color: ${evento.color};"></span>
        <div class="detalle-item-contenido">
          <span class="detalle-item-titulo">${evento.titulo}</span>
          <div class="detalle-item-meta">
            <span class="detalle-item-fecha">${fechaStr}</span>
            ${proyecto ? `<span class="detalle-item-proyecto">${proyecto.nombre}</span>` : ''}
          </div>
        </div>
      </li>`;
}

/**
 * Navega a la página correspondiente emitiendo un evento.
 */
function navegarAItem(tipo, id) {
  if (tipo === 'tarea') {
    EventBus.emit('navegarA', { pagina: 'tareas', id: id });
  } else if (tipo === 'apunte') {
    EventBus.emit('navegarA', { pagina: 'apuntes', id: id });
  }
}

/**
 * Inicializa la página de Cursos, suscribiéndose a eventos.
 */
export function inicializarCursos() {
  console.log('[Cursos] Inicializando y suscribiendo a eventos...');

  // 1. Escuchar cuándo el HTML de esta página se carga en el DOM
  EventBus.on('paginaCargada:cursos', () => {
    console.log(
      '[Cursos] Evento: paginaCargada:cursos recibido. Conectando listeners de UI...',
    );

    renderizarCursos();
    cerrarPanelDetalles();

    const inputBuscar = document.getElementById('input-buscar-cursos');
    const toggleArchivados = document.getElementById(
      'toggle-mostrar-archivados',
    );
    if (inputBuscar) inputBuscar.value = searchTerm;
    if (toggleArchivados) {
      toggleArchivados.checked = mostrarArchivados;
      if (!toggleArchivados.nextElementSibling?.querySelector('svg')) {
        const label = toggleArchivados.nextElementSibling;
        if (label) {
          const iconSpan = document.createElement('span');
          iconSpan.className = 'toggle-icon';
          iconSpan.innerHTML = ICONS.archive || '<svg>Archivados</svg>';
          label.prepend(iconSpan);
        }
      }
    }

    const pageCursos = document.getElementById('page-cursos');
    if (pageCursos) {
      const oldListener = pageCursos._clickHandler;
      if (oldListener) pageCursos.removeEventListener('click', oldListener);
      const oldInputListener = pageCursos._inputHandler;
      if (oldInputListener)
        pageCursos.removeEventListener('input', oldInputListener);
      const oldChangeListener = pageCursos._changeHandler;
      if (oldChangeListener)
        pageCursos.removeEventListener('change', oldChangeListener);

      // --- Definición del Listener Principal de Clic (Delegado) ---
      const clickHandler = (e) => {
        const panelLateral = document.getElementById('cursos-details-panel');
        const isMobile = window.innerWidth <= 900;
        const panelVisible =
          panelLateral && pageCursos.classList.contains('detalle-visible');

        if (
          isMobile &&
          panelVisible &&
          !panelLateral.contains(e.target) &&
          !e.target.closest('.curso-card')
        ) {
          e.stopPropagation();
          cerrarPanelDetalles();
          return;
        }

        if (e.target.closest('#btn-nuevo-curso')) {
          const btnEmojiNuevo = document.getElementById('btn-emoji-curso');
          const inputEmojiHiddenNuevo = document.getElementById(
            'input-emoji-curso-hidden',
          );
          const inputNombreNuevo =
            document.getElementById('input-nombre-curso');
          if (btnEmojiNuevo) actualizarBotonEmoji(btnEmojiNuevo, null);
          if (inputEmojiHiddenNuevo) inputEmojiHiddenNuevo.value = '';
          if (inputNombreNuevo) inputNombreNuevo.value = '';
          mostrarModal('modal-nuevo-curso');
          return;
        }

        if (panelLateral && panelLateral.contains(e.target)) {
          if (e.target.closest('#btn-cerrar-detalles-curso')) {
            cerrarPanelDetalles();
            return;
          }
          const btnEditarPanel = e.target.closest('.btn-editar-curso-panel');
          if (btnEditarPanel) {
            iniciarRenombrarCurso(String(state.cursoSeleccionadoId));
            return;
          }
          const tabButton = e.target.closest('.tab-item[data-tab]');
          if (tabButton) {
            e.preventDefault();
            const tabId = tabButton.dataset.tab;
            panelLateral
              .querySelectorAll('.tab-item.active')
              .forEach((btn) => btn.classList.remove('active'));
            panelLateral
              .querySelectorAll('.tab-pane.active')
              .forEach((pane) => pane.classList.remove('active'));
            tabButton.classList.add('active');
            panelLateral
              .querySelector(`#tab-${tabId}`)
              ?.classList.add('active');
            return;
          }
          if (e.target.closest('#btn-agregar-rapido-curso')) {
            const curso = state.cursos.find(
              (c) => String(c.id) === String(state.cursoSeleccionadoId),
            );
            const modalChooser = document.getElementById('modal-chooser-crear');
            if (modalChooser && curso) {
              modalChooser.dataset.fechaSeleccionada = new Date()
                .toISOString()
                .split('T')[0];
              modalChooser.dataset.cursoPreseleccionado = curso.nombre;
              mostrarModal('modal-chooser-crear');
            }
            return;
          }
          if (e.target.closest('#btn-nuevo-apunte-curso')) {
            if (state.cursoSeleccionadoId) {
              EventBus.emit('navegarA', {
                pagina: 'apuntes',
                id: null,
                cursoId: state.cursoSeleccionadoId,
              });
            }
            return;
          }
          const itemTarea = e.target.closest(
            '.detalle-item.item-tarea[data-tarea-id]',
          );
          if (itemTarea) {
            navegarAItem('tarea', itemTarea.dataset.tareaId);
            return;
          }
          const itemApunte = e.target.closest(
            '.detalle-item.item-apunte[data-apunte-id]',
          );
          if (itemApunte) {
            navegarAItem('apunte', itemApunte.dataset.apunteId);
            return;
          }
          return;
        }

        const card = e.target.closest('.curso-card[data-curso-id]');
        if (card && (!panelLateral || !panelLateral.contains(e.target))) {
          const cursoId = card.dataset.cursoId;
          const btnArchivar = e.target.closest('.btn-archivar-curso');
          if (btnArchivar) {
            archivarCurso(cursoId); // CORREGIDO con await
            return;
          }
          const btnDesarchivar = e.target.closest('.btn-desarchivar-curso');
          if (btnDesarchivar) {
            desarchivarCurso(cursoId);
            return;
          }
          const btnEditar = e.target.closest('.btn-editar-curso');
          if (btnEditar) {
            iniciarRenombrarCurso(cursoId);
            return;
          }
          const btnEliminar = e.target.closest('.btn-eliminar-curso');
          if (btnEliminar) {
            eliminarCurso(cursoId); // CORREGIDO con await
            return;
          }
          abrirPanelDetalles(cursoId);
          return;
        }
      }; // Fin clickHandler

      const inputHandler = (e) => {
        if (e.target.id === 'input-buscar-cursos') {
          searchTerm = e.target.value;
          renderizarCursos();
        }
      };

      const changeHandler = (e) => {
        if (e.target.id === 'toggle-mostrar-archivados') {
          mostrarArchivados = e.target.checked;
          renderizarCursos();
        }
      };

      pageCursos.addEventListener('click', clickHandler);
      pageCursos.addEventListener('input', inputHandler);
      pageCursos.addEventListener('change', changeHandler);
      pageCursos._clickHandler = clickHandler;
      pageCursos._inputHandler = inputHandler;
      pageCursos._changeHandler = changeHandler;
    }

    // --- Listeners para Modales (se adjuntan una sola vez) ---
    const formNuevoCurso = document.getElementById('form-nuevo-curso');
    if (formNuevoCurso && !formNuevoCurso.dataset.listenerAttached) {
      formNuevoCurso.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputNombre = document.getElementById('input-nombre-curso');
        if (inputNombre) {
          await agregarCurso(inputNombre.value.trim());
        }
        cerrarModal('modal-nuevo-curso');
      });
      const btnEmojiNuevo = document.getElementById('btn-emoji-curso');
      const inputEmojiHiddenNuevo = document.getElementById(
        'input-emoji-curso-hidden',
      );
      if (btnEmojiNuevo && inputEmojiHiddenNuevo) {
        btnEmojiNuevo.addEventListener('click', (e) => {
          e.stopPropagation();
          showEmojiPicker(btnEmojiNuevo, inputEmojiHiddenNuevo);
        });
      }
      formNuevoCurso.dataset.listenerAttached = 'true';
    }

    const formRenombrarCurso = document.getElementById('form-renombrar-curso');
    if (formRenombrarCurso && !formRenombrarCurso.dataset.listenerAttached) {
      formRenombrarCurso.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cursoId = document.getElementById(
          'input-renombrar-curso-id',
        ).value;
        const nuevoNombre = document
          .getElementById('input-renombrar-curso-nombre')
          .value.trim();
        if (cursoId) {
          await renombrarCurso(cursoId, nuevoNombre);
        }
        cerrarModal('modal-renombrar-curso');
      });
      const btnEmojiRenombrar = document.getElementById(
        'btn-renombrar-emoji-curso',
      );
      const inputEmojiHiddenRenombrar = document.getElementById(
        'input-renombrar-emoji-curso-hidden',
      );
      if (btnEmojiRenombrar && inputEmojiHiddenRenombrar) {
        btnEmojiRenombrar.addEventListener('click', (e) => {
          e.stopPropagation();
          showEmojiPicker(btnEmojiRenombrar, inputEmojiHiddenRenombrar);
        });
      }
      formRenombrarCurso.dataset.listenerAttached = 'true';
    }
  }); // Fin de 'paginaCargada:cursos'

  // 2. Escuchar cuándo cambian los datos de cursos
  EventBus.on('cursosActualizados', () => {
    if (state.paginaActual === 'cursos') {
      console.log(
        '[Cursos] Evento: cursosActualizados recibido. Renderizando...',
      );
      renderizarCursos();
      if (state.cursoSeleccionadoId) {
        if (
          !state.cursos.find(
            (c) => String(c.id) === String(state.cursoSeleccionadoId),
          )
        ) {
          cerrarPanelDetalles();
        } else {
          const curso = state.cursos.find(
            (c) => String(c.id) === String(state.cursoSeleccionadoId),
          );
          const tituloEl = document.getElementById('curso-detalle-titulo');
          if (tituloEl && curso) {
            tituloEl.innerHTML = `${curso.emoji ? `<span class="curso-emoji">${curso.emoji}</span> ` : ''}${curso.nombre}`;
          }
          renderizarPanelDetalles();
        }
      }
    }
  });

  // 3. Escuchar cuándo cambian las tareas o proyectos (para contadores)
  const refrescarPorDependencia = () => {
    if (state.paginaActual === 'cursos') {
      console.log(
        '[Cursos] Evento: tareas/proyectos actualizado. Renderizando para actualizar contadores...',
      );
      renderizarCursos();
      if (state.cursoSeleccionadoId) {
        renderizarTabGeneral(
          state.cursos.find(
            (c) => String(c.id) === String(state.cursoSeleccionadoId),
          ),
        );
      }
    }
  };
  EventBus.on('tareasActualizadas', refrescarPorDependencia);
  EventBus.on('proyectosActualizados', refrescarPorDependencia);
  EventBus.on('eventosActualizados', refrescarPorDependencia);
  EventBus.on('apuntesActualizados', () => {
    if (state.paginaActual === 'cursos' && state.cursoSeleccionadoId) {
      renderizarTabApuntes(
        state.cursos.find(
          (c) => String(c.id) === String(state.cursoSeleccionadoId),
        ),
      );
    }
  });
} // Fin de inicializarCursos

window.renderizarCursosGlobal = renderizarCursos;
