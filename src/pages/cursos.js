import { state } from '../state.js';
import { guardarDatos } from '../utils.js';
import {
  mostrarConfirmacion,
  mostrarModal,
  cerrarModal,
  mostrarAlerta,
} from '../ui.js';
import { generarEventosRecurrentes } from './calendario.js';
import { ICONS } from '../icons.js';
import { cambiarPagina } from '../main.js';

// ===== PASO 6: Variables locales para búsqueda y filtro =====
let searchTerm = '';
let mostrarArchivados = false;
// ==========================================================

// ... (Helpers: formatFechaDDMMYYYY, getEstadoTarea sin cambios) ...
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
 * ACTUALIZADO: Renderiza las tarjetas de curso aplicando búsqueda y filtro.
 */
function renderizarCursos() {
  const container = document.getElementById('lista-cursos-container');
  if (!container) return;

  container.innerHTML = '';

  // ===== PASO 6: Filtrado por búsqueda y archivado =====
  const terminoBusqueda = searchTerm.toLowerCase();
  const cursosFiltrados = state.cursos.filter((curso) => {
    // 1. Filtrar por archivado
    if (!mostrarArchivados && curso.isArchivado) {
      return false;
    }
    // Ocultar 'General' si hay más cursos y no se muestran archivados
    if (
      !mostrarArchivados &&
      curso.nombre === 'General' &&
      state.cursos.filter((c) => !c.isArchivado).length > 1
    ) {
      return false;
    }
    // 2. Filtrar por término de búsqueda (si existe)
    if (terminoBusqueda) {
      return curso.nombre.toLowerCase().includes(terminoBusqueda);
    }
    // 3. Si no hay término de búsqueda, mostrar según el filtro de archivado
    return true;
  });
  // =======================================================

  if (cursosFiltrados.length === 0) {
    container.innerHTML =
      '<p style="padding: 15px; color: var(--text-muted);">No se encontraron cursos.</p>';
    // Asegurar que 'General' exista si todo está vacío (tras filtrar/buscar)
    if (
      state.cursos.length === 0 ||
      state.cursos.every((c) => c.isArchivado && !mostrarArchivados)
    ) {
      if (!state.cursos.find((c) => c.nombre === 'General')) {
        state.cursos.push({
          id: 1,
          nombre: 'General',
          emoji: null,
          isArchivado: false,
        });
        guardarDatos(); // Guardar el estado corregido
      }
    }
    return;
  }

  // Ordenar: No archivados primero, luego por nombre
  cursosFiltrados.sort((a, b) => {
    if (a.isArchivado !== b.isArchivado) {
      return a.isArchivado ? 1 : -1;
    }
    return a.nombre.localeCompare(b.nombre);
  });

  cursosFiltrados.forEach((curso) => {
    // ... (Cálculo de estadísticas SIN CAMBIOS) ...
    const tareasDelCurso = state.tareas.filter((t) => t.curso === curso.nombre);
    const tareasCompletadas = tareasDelCurso.filter((t) => t.completada).length;
    const totalTareas = tareasDelCurso.length;
    const porcentaje =
      totalTareas > 0 ? (tareasCompletadas / totalTareas) * 100 : 0;
    const tareasPendientes = tareasDelCurso.filter((t) => !t.completada);
    const ordenPrioridad = { Alta: 0, Media: 1, Baja: 2 };
    const tareasPendientesOrdenadas = tareasPendientes.sort((a, b) => {
      const fechaA = new Date(a.fecha);
      const fechaB = new Date(b.fecha);
      if (fechaA - fechaB !== 0) return fechaA - fechaB;
      return ordenPrioridad[a.prioridad] - ordenPrioridad[b.prioridad];
    });
    const proximaTarea = tareasPendientesOrdenadas[0];
    let textoProximaEntrega = '¡Todo al día!';
    if (proximaTarea) {
      const [, month, day] = proximaTarea.fecha.split('-');
      textoProximaEntrega = `Próxima: ${proximaTarea.titulo} (${day}/${month})`;
    }

    const card = document.createElement('div');
    card.className = 'curso-card';
    card.dataset.cursoId = curso.id;
    if (curso.isArchivado) card.classList.add('archivado'); // Estilo visual para archivados

    // ===== PASO 6: Botones de acción dinámicos =====
    let actionButtons = '';
    if (curso.nombre !== 'General') {
      actionButtons += `<button class="btn-icon btn-editar-curso" title="Editar Curso">${ICONS.edit}</button>`;
      if (curso.isArchivado) {
        // Usa ICONS.unarchive o el placeholder SVG
        actionButtons += `<button class="btn-icon btn-desarchivar-curso" title="Desarchivar Curso">${ICONS.unarchive || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 11h4V5h6v6h4l-7 7-7-7zM5 18v2h14v-2H5z"/></svg>'}</button>`;
      } else {
        // Usa ICONS.archive o el placeholder SVG
        actionButtons += `<button class="btn-icon btn-archivar-curso" title="Archivar Curso">${ICONS.archive || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>'}</button>`;
      }
      actionButtons += `<button class="btn-icon btn-eliminar-curso" title="Eliminar Curso Permanentemente">${ICONS.delete}</button>`;
    }
    // ===============================================

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
 * @param {HTMLButtonElement} buttonEl - El botón a actualizar
 * @param {string | null} emoji - El emoji a mostrar, o null/vacío para mostrar placeholder
 */
function actualizarBotonEmoji(buttonEl, emoji) {
  if (!buttonEl) return;
  if (emoji) {
    buttonEl.innerHTML = emoji; // Muestra el emoji directamente
    buttonEl.classList.add('has-emoji');
  } else {
    buttonEl.innerHTML = ICONS.emoji_wink || '😉'; // Muestra icono placeholder
    buttonEl.classList.remove('has-emoji');
  }
}

function agregarCurso(nombre, emoji) {
  if (
    !nombre ||
    state.cursos
      .map((c) => c.nombre.toLowerCase())
      .includes(nombre.toLowerCase())
  ) {
    alert('El nombre del curso no puede estar vacío o ya existe.');
    return;
  }
  const generalIndex = state.cursos.findIndex((c) => c.nombre === 'General');
  if (
    generalIndex > -1 &&
    state.cursos.length === 1 &&
    !state.cursos[generalIndex].isArchivado
  ) {
    state.cursos.splice(generalIndex, 1);
  }
  // Lee el emoji del input oculto
  const emojiSeleccionado =
    document.getElementById('input-emoji-curso-hidden')?.value || null;

  const nuevoCurso = {
    id: Date.now(),
    nombre: nombre,
    emoji: emojiSeleccionado,
    isArchivado: false,
  };
  state.cursos.push(nuevoCurso);
  guardarDatos();
  renderizarCursos();
}

/**
 * ACTUALIZADO: Carga el emoji en el modal.
 */
function iniciarRenombrarCurso(cursoId) {
  const curso = state.cursos.find((c) => c.id === cursoId);
  if (!curso) return;
  const inputId = document.getElementById('input-renombrar-curso-id');
  const inputNuevoNombre = document.getElementById(
    'input-renombrar-curso-nombre',
  );
  const btnEmoji = document.getElementById('btn-renombrar-emoji-curso'); // Ahora es botón
  const inputEmojiHidden = document.getElementById(
    'input-renombrar-emoji-curso-hidden',
  ); // Input oculto

  if (inputId) inputId.value = curso.id;
  if (inputNuevoNombre) inputNuevoNombre.value = curso.nombre;
  // Actualiza el botón y el input oculto
  if (inputEmojiHidden) inputEmojiHidden.value = curso.emoji || '';
  if (btnEmoji) actualizarBotonEmoji(btnEmoji, curso.emoji);

  mostrarModal('modal-renombrar-curso');
}

function renombrarCurso(cursoId, nuevoNombre, nuevoEmoji) {
  // ya no recibe emoji directamente
  const curso = state.cursos.find((c) => c.id === cursoId);
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
  // Lee el emoji del input oculto correspondiente al modal de renombrar
  const emojiSeleccionado =
    document.getElementById('input-renombrar-emoji-curso-hidden')?.value ||
    null;

  curso.nombre = nuevoNombre;
  curso.emoji = emojiSeleccionado; // <-- Actualiza el emoji

  // Actualizar nombre en tareas y apuntes
  state.tareas.forEach((tarea) => {
    if (tarea.curso === nombreOriginal) tarea.curso = nuevoNombre;
  });
  state.apuntes.forEach((apunte) => {
    if (apunte.curso === nombreOriginal) apunte.curso = nuevoNombre;
  });
  // Actualizar nombre en proyectos
  state.proyectos.forEach((proyecto) => {
    if (proyecto.curso === nombreOriginal) proyecto.curso = nuevoNombre;
  });

  guardarDatos();
  renderizarCursos();
  // Actualizar panel si estaba abierto
  if (state.cursoSeleccionadoId === cursoId) {
    abrirPanelDetalles(cursoId);
  }
  // Recargar otras páginas si es necesario (ej: si Tareas está abierta)
  if (state.paginaActual === 'tareas') cambiarPagina('tareas');
  if (state.paginaActual === 'apuntes') cambiarPagina('apuntes');
  if (state.paginaActual === 'proyectos') cambiarPagina('proyectos');
  if (state.paginaActual === 'calendario') cambiarPagina('calendario');
}

// ===== PASO 6: Nuevas funciones para Archivar/Desarchivar =====
function archivarCurso(cursoId) {
  const curso = state.cursos.find((c) => c.id === cursoId);
  if (!curso || curso.nombre === 'General') return;

  mostrarConfirmacion(
    'Archivar Curso',
    `¿Archivar "${curso.nombre}"? El curso se ocultará, pero sus tareas y apuntes no se borrarán. Podrás verlo activando "Mostrar archivados".`,
    () => {
      curso.isArchivado = true;
      if (state.cursoSeleccionadoId === cursoId) {
        cerrarPanelDetalles(); // Cierra el panel si estaba abierto
      }
      guardarDatos();
      renderizarCursos();
    },
  );
}

function desarchivarCurso(cursoId) {
  const curso = state.cursos.find((c) => c.id === cursoId);
  if (!curso) return;

  curso.isArchivado = false;
  guardarDatos();
  renderizarCursos(); // Re-renderiza para que aparezca en la lista normal
}
// ==============================================================
let emojiPicker = null; // Referencia al elemento <emoji-picker>
let currentEmojiButton = null; // Botón que abrió el picker
let currentEmojiInputHidden = null; // Input oculto asociado al botón

// Función para mostrar el picker cerca de un botón
function showEmojiPicker(buttonElement, inputHiddenElement) {
  if (!emojiPicker) {
    emojiPicker = document.querySelector('emoji-picker');
    if (!emojiPicker) {
      console.error('Elemento <emoji-picker> no encontrado.');
      return;
    }
    // Listener para cuando se selecciona un emoji
    emojiPicker.addEventListener('emoji-click', (event) => {
      if (currentEmojiButton && currentEmojiInputHidden) {
        const emoji = event.detail.unicode;
        currentEmojiInputHidden.value = emoji; // Guarda en input oculto
        actualizarBotonEmoji(currentEmojiButton, emoji); // Actualiza botón
      }
      hideEmojiPicker(); // Cierra el picker
    });
    // Listener para cerrar si se hace clic fuera
    document.addEventListener('click', handleClickOutsidePicker, true); // Use capture phase
  }

  // Guardar referencias
  currentEmojiButton = buttonElement;
  currentEmojiInputHidden = inputHiddenElement;

  // Posicionar el picker
  const btnRect = buttonElement.getBoundingClientRect();
  emojiPicker.style.top = `${window.scrollY + btnRect.bottom + 5}px`; // Debajo del botón
  let leftPos = window.scrollX + btnRect.left;
  // Ajustar si se sale por la derecha
  if (leftPos + emojiPicker.offsetWidth > window.innerWidth - 10) {
    leftPos = window.innerWidth - emojiPicker.offsetWidth - 10;
  }
  // Ajustar si se sale por la izquierda
  if (leftPos < 10) {
    leftPos = 10;
  }
  emojiPicker.style.left = `${leftPos}px`;

  // Ajustar tema (claro/oscuro)
  emojiPicker.className = document.body.classList.contains('dark-theme')
    ? 'dark emoji-picker-popup visible'
    : 'light emoji-picker-popup visible';

  // Mostrar picker
  emojiPicker.classList.add('visible');
}

// Función para ocultar el picker
function hideEmojiPicker() {
  if (emojiPicker) {
    emojiPicker.classList.remove('visible');
  }
  currentEmojiButton = null;
  currentEmojiInputHidden = null;
}

// Función para detectar clics fuera del picker
function handleClickOutsidePicker(event) {
  if (
    emojiPicker &&
    emojiPicker.classList.contains('visible') &&
    !emojiPicker.contains(event.target) &&
    !currentEmojiButton?.contains(event.target)
  ) {
    // No cerrar si se vuelve a hacer clic en el botón
    hideEmojiPicker();
  }
}
/**
 * ACTUALIZADO: Cambia el mensaje de confirmación para borrado permanente.
 */
function eliminarCurso(cursoId) {
  const curso = state.cursos.find((c) => c.id === cursoId);
  if (!curso || curso.nombre === 'General') return;

  mostrarConfirmacion(
    'Eliminar Curso Permanentemente',
    `¡ACCIÓN PERMANENTE! ¿Eliminar "${curso.nombre}"? Se borrarán el curso, todas sus tareas y todos sus apuntes asociados. Esta acción NO se puede deshacer.`,
    () => {
      const nombreCurso = curso.nombre;
      state.cursos = state.cursos.filter((c) => c.id !== cursoId);
      state.tareas = state.tareas.filter((t) => t.curso !== nombreCurso);
      state.apuntes = state.apuntes.filter((a) => a.curso !== nombreCurso);
      // Desvincular proyectos asociados (no borrarlos)
      state.proyectos.forEach((p) => {
        if (p.curso === nombreCurso) p.curso = null;
      });

      // Asegurar que 'General' exista si es necesario
      const hayCursosVisibles = state.cursos.some((c) => !c.isArchivado);
      if (
        !hayCursosVisibles &&
        !state.cursos.find((c) => c.nombre === 'General')
      ) {
        state.cursos.push({
          id: 1,
          nombre: 'General',
          emoji: null,
          isArchivado: false,
        });
      }

      if (state.cursoSeleccionadoId === cursoId) {
        cerrarPanelDetalles();
      }
      guardarDatos();
      renderizarCursos();
    },
  );
}

function abrirPanelDetalles(cursoId) {
  if (!cursoId) return;
  const curso = state.cursos.find((c) => c.id === cursoId);
  if (!curso) return;

  // Resaltar tarjeta
  document
    .querySelectorAll('.curso-card.selected')
    .forEach((c) => c.classList.remove('selected'));
  document
    .querySelector(`.curso-card[data-curso-id="${cursoId}"]`)
    ?.classList.add('selected');

  state.cursoSeleccionadoId = cursoId;
  document.getElementById('page-cursos').classList.add('detalle-visible');

  // === INICIO MODIFICACIÓN HEADER PANEL ===
  const headerEl = document.querySelector(
    '#cursos-details-panel .panel-lateral-header',
  );
  const tituloEl = document.getElementById('curso-detalle-titulo');
  const btnCerrar = document.getElementById('btn-cerrar-detalles-curso');

  if (headerEl && tituloEl && btnCerrar) {
    // 1. Actualizar título
    tituloEl.innerHTML = `${curso.emoji ? `<span class="curso-emoji">${curso.emoji}</span> ` : ''}${curso.nombre}`;

    // 2. Crear/Actualizar botón Editar (si no existe o es incorrecto)
    let btnEditar = headerEl.querySelector('.btn-editar-curso-panel');
    if (!btnEditar) {
      btnEditar = document.createElement('button');
      btnEditar.className = 'btn-icon btn-editar-curso-panel'; // Nueva clase específica
      btnEditar.title = 'Editar Curso';
      // Insertar ANTES del botón de cerrar
      headerEl.insertBefore(btnEditar, btnCerrar);
    }
    btnEditar.innerHTML = ICONS.edit; // Asegura el icono correcto
    // Ocultar si es "General" o si el curso está archivado
    btnEditar.style.display =
      curso.nombre === 'General' || curso.isArchivado ? 'none' : 'flex';
  } else {
    console.error('Faltan elementos del header del panel de detalles.');
  }
  // === FIN MODIFICACIÓN HEADER PANEL ===

  renderizarPanelDetalles(); // Renderiza el contenido (pestañas, etc.)
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
  const curso = state.cursos.find((c) => c.id === state.cursoSeleccionadoId);
  if (!contenidoEl || !curso) return;
  const iconoGeneral =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 15.5L8 10.5L13 15.5L21 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7.5H21V13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'; // Graph Up
  const iconoApuntes = ICONS.apuntes;
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
      <button id="btn-agregar-rapido-curso" class="btn-accent btn-icon">${ICONS.add}</button>
    </div>
  `;
  renderizarTabGeneral(curso);
  renderizarTabApuntes(curso);
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
      <div class="stat-item">
        <span class="stat-numero">${stats.pendientes}</span>
        <span class="stat-etiqueta">Pendientes</span>
      </div>
      <div class="stat-item">
        <span class="stat-numero">${stats.vencidas}</span>
        <span class="stat-etiqueta">Vencidas</span>
      </div>
      <div class="stat-item">
        <span class="stat-numero">${stats.completadas}</span>
        <span class="stat-etiqueta">Completadas</span>
      </div>
    </div>
  `;
  html += '<div class="detalle-listas-container">';
  if (tareas.vencidas.length > 0) {
    html += '<h5 class="detalle-lista-titulo">Tareas Vencidas</h5>';
    html += '<ul class="detalle-lista">';
    tareas.vencidas
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .forEach((t) => (html += renderizarItemTarea(t)));
    html += '</ul>';
  }
  if (tareas.pendientes.length > 0) {
    html += '<h5 class="detalle-lista-titulo">Tareas Pendientes</h5>';
    html += '<ul class="detalle-lista">';
    tareas.pendientes
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .forEach((t) => (html += renderizarItemTarea(t)));
    html += '</ul>';
  }
  if (eventosDelCurso.length > 0) {
    html += '<h5 class="detalle-lista-titulo">Eventos Próximos</h5>';
    html += '<ul class="detalle-lista">';
    eventosDelCurso
      .sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio))
      .forEach((e) => (html += renderizarItemEvento(e)));
    html += '</ul>';
  }
  if (tareas.completadas.length > 0) {
    html += '<h5 class="detalle-lista-titulo">Tareas Completadas</h5>';
    html += '<ul class="detalle-lista">';
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
              <span class="detalle-item-fecha">Modif: ${formatFechaDDMMYYYY(
                apunte.fechaModificacion.split('T')[0],
              )}</span>
            </div>
          </div>
        </li>
      `;
    });
  html += '</ul>';
  tabApuntes.innerHTML = html;
}
function renderizarItemTarea(tarea) {
  const proyecto = tarea.proyectoId
    ? state.proyectos.find((p) => p.id === tarea.proyectoId)
    : null;
  const estado = getEstadoTarea(tarea);
  return `
    <li class="detalle-item item-tarea ${estado}" data-tarea-id="${tarea.id}">
      <span class="prioridad-indicador prioridad-${tarea.prioridad.toLowerCase()}"></span>
      <div class="detalle-item-contenido">
        <span class="detalle-item-titulo">${tarea.titulo}</span>
        <div class="detalle-item-meta">
          <span class="detalle-item-fecha">${formatFechaDDMMYYYY(
            tarea.fecha,
          )}</span>
          ${
            proyecto
              ? `<span class="detalle-item-proyecto">${proyecto.nombre}</span>`
              : ''
          }
        </div>
      </div>
    </li>
  `;
}
function renderizarItemEvento(evento) {
  const proyecto = evento.proyectoId
    ? state.proyectos.find((p) => String(p.id) === String(evento.proyectoId))
    : null;
  const fechaStr =
    evento.fechaInicio === evento.fechaFin
      ? formatFechaDDMMYYYY(evento.fechaInicio)
      : `${formatFechaDDMMYYYY(evento.fechaInicio)} - ${formatFechaDDMMYYYY(
          evento.fechaFin,
        )}`;
  return `
    <li class="detalle-item item-evento" data-evento-id="${
      evento.originalId || evento.id
    }">
      <span class="prioridad-indicador" style="background-color: ${
        evento.color
      };"></span>
      <div class="detalle-item-contenido">
        <span class="detalle-item-titulo">${evento.titulo}</span>
        <div class="detalle-item-meta">
          <span class="detalle-item-fecha">${fechaStr}</span>
          ${
            proyecto
              ? `<span class="detalle-item-proyecto">${proyecto.nombre}</span>`
              : ''
          }
        </div>
      </div>
    </li>
  `;
}
function navegarAItem(tipo, id) {
  if (tipo === 'tarea') {
    state.tareaSeleccionadald = id;
    guardarDatos();
    cambiarPagina('tareas');
  } else if (tipo === 'apunte') {
    state.apunteSeleccionadoId = id;
    guardarDatos();
    cambiarPagina('apuntes');
  }
}

/**
 * Inicializa la página de Cursos, configura listeners y renderiza la vista inicial.
 */
export function inicializarCursos() {
  // 1. Renderizado inicial y estado
  renderizarCursos(); // Dibuja las tarjetas de curso
  cerrarPanelDetalles(); // Asegura que el panel esté cerrado al cargar

  // 2. Sincronizar UI con estado de búsqueda/filtro (si existía)
  const inputBuscar = document.getElementById('input-buscar-cursos');
  const toggleArchivados = document.getElementById('toggle-mostrar-archivados');
  if (inputBuscar) inputBuscar.value = searchTerm; // Restaura texto de búsqueda
  if (toggleArchivados) toggleArchivados.checked = mostrarArchivados; // Restaura estado del toggle

  // 3. Configuración de Listeners Principales (evitando duplicados)
  const pageCursos = document.getElementById('page-cursos'); // Elemento raíz de la página
  if (pageCursos) {
    // Limpieza de listeners previos para evitar fugas de memoria o comportamiento inesperado
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
      const panelLateral = document.getElementById('cursos-details-panel'); // Panel de detalles
      const isMobile = window.innerWidth <= 900; // ¿Es vista móvil?
      const panelVisible =
        panelLateral && pageCursos.classList.contains('detalle-visible'); // ¿Panel visible?

      // Lógica para Cerrar al Tocar Fuera (Solo Móvil)
      // Si es móvil, panel visible, y el clic NO fue DENTRO del panel
      if (isMobile && panelVisible && !panelLateral.contains(e.target)) {
        // Y además, asegurarse de que el clic no fue en una tarjeta (para evitar cerrar al abrir)
        if (!e.target.closest('.curso-card')) {
          e.stopPropagation(); // Detener otras posibles acciones (importante)
          cerrarPanelDetalles(); // Cerrar el panel
          return; // Terminar ejecución del handler aquí
        }
      }

      // --- Acciones de Botones y Elementos Específicos ---

      // Botón "+ Nuevo Curso" (Header principal)
      if (e.target.closest('#btn-nuevo-curso')) {
        // Resetear campos del modal antes de mostrarlo
        const btnEmojiNuevo = document.getElementById('btn-emoji-curso');
        const inputEmojiHiddenNuevo = document.getElementById(
          'input-emoji-curso-hidden',
        );
        const inputNombreNuevo = document.getElementById('input-nombre-curso');
        if (btnEmojiNuevo) actualizarBotonEmoji(btnEmojiNuevo, null); // Poner icono placeholder
        if (inputEmojiHiddenNuevo) inputEmojiHiddenNuevo.value = ''; // Limpiar valor oculto
        if (inputNombreNuevo) inputNombreNuevo.value = ''; // Limpiar nombre
        mostrarModal('modal-nuevo-curso'); // Mostrar modal
        return; // Terminar
      }

      // --- Acciones DENTRO del Panel Lateral de Detalles ---
      // Verifica si el clic ocurrió dentro del panel
      if (panelLateral && panelLateral.contains(e.target)) {
        // Botón Cerrar (X) del panel lateral
        if (e.target.closest('#btn-cerrar-detalles-curso')) {
          cerrarPanelDetalles();
          return;
        }
        // Botón Editar (lápiz) del header del panel lateral
        const btnEditarPanel = e.target.closest('.btn-editar-curso-panel');
        if (btnEditarPanel) {
          iniciarRenombrarCurso(state.cursoSeleccionadoId);
          return;
        }
        // Clic en una Pestaña (General / Apuntes)
        const tabButton = e.target.closest('.tab-item[data-tab]');
        if (tabButton) {
          e.preventDefault(); // Evitar comportamiento por defecto
          const tabId = tabButton.dataset.tab; // Obtener ID de la pestaña
          // Quitar clase 'active' de todas las pestañas y paneles
          panelLateral
            .querySelectorAll('.tab-item.active')
            .forEach((btn) => btn.classList.remove('active'));
          panelLateral
            .querySelectorAll('.tab-pane.active')
            .forEach((pane) => pane.classList.remove('active'));
          // Añadir clase 'active' a la pestaña y panel clicados
          tabButton.classList.add('active');
          panelLateral.querySelector(`#tab-${tabId}`)?.classList.add('active');
          return; // Terminar
        }
        // Botón "+" (Agregar Rápido) en la parte inferior del panel
        if (e.target.closest('#btn-agregar-rapido-curso')) {
          const curso = state.cursos.find(
            (c) => c.id === state.cursoSeleccionadoId,
          ); // Obtener curso actual
          const modalChooser = document.getElementById('modal-chooser-crear'); // Modal selector
          if (modalChooser && curso) {
            // Pasar datos al modal selector
            modalChooser.dataset.fechaSeleccionada = new Date()
              .toISOString()
              .split('T')[0]; // Fecha hoy
            modalChooser.dataset.cursoPreseleccionado = curso.nombre; // Nombre del curso
            mostrarModal('modal-chooser-crear'); // Mostrar modal selector
          }
          return; // Terminar
        }
        // Botón "Nuevo Apunte" en la parte inferior del panel
        if (e.target.closest('#btn-nuevo-apunte-curso')) {
          // Si hay un curso seleccionado, guardar su ID y navegar a 'apuntes'
          if (state.cursoSeleccionadoId) {
            // apuntes.js leerá este ID para preseleccionar el curso
            guardarDatos(); // Guardar state.cursoSeleccionadoId
            cambiarPagina('apuntes'); // Ir a la página de apuntes
          }
          return; // Terminar
        }
        // Clic en un item de Tarea dentro de las listas del panel
        const itemTarea = e.target.closest(
          '.detalle-item.item-tarea[data-tarea-id]',
        );
        if (itemTarea) {
          navegarAItem('tarea', parseInt(itemTarea.dataset.tareaId));
          return;
        }
        // Clic en un item de Apunte dentro de las listas del panel
        const itemApunte = e.target.closest(
          '.detalle-item.item-apunte[data-apunte-id]',
        );
        if (itemApunte) {
          navegarAItem('apunte', parseInt(itemApunte.dataset.apunteId));
          return;
        }

        // Si el clic fue dentro del panel pero no accionable, simplemente termina
        return;
      } // Fin if (panelLateral && panelLateral.contains(e.target))

      // --- Acciones en las Tarjetas de Curso (FUERA del panel lateral) ---
      const card = e.target.closest('.curso-card'); // Busca la tarjeta más cercana al clic
      // Asegura que el clic fue en una tarjeta Y NO dentro del panel lateral
      if (card && (!panelLateral || !panelLateral.contains(e.target))) {
        const cursoId = Number(card.dataset.cursoId); // ID del curso de la tarjeta

        // Botón Archivar (flecha abajo) en la tarjeta
        const btnArchivar = e.target.closest('.btn-archivar-curso');
        if (btnArchivar) {
          archivarCurso(cursoId);
          return;
        }
        // Botón Desarchivar (flecha arriba) en la tarjeta
        const btnDesarchivar = e.target.closest('.btn-desarchivar-curso');
        if (btnDesarchivar) {
          desarchivarCurso(cursoId);
          return;
        }
        // Botón Editar (lápiz) en la tarjeta
        const btnEditar = e.target.closest('.btn-editar-curso');
        if (btnEditar) {
          iniciarRenombrarCurso(cursoId);
          return;
        }
        // Botón Eliminar (papelera) en la tarjeta
        const btnEliminar = e.target.closest('.btn-eliminar-curso');
        if (btnEliminar) {
          eliminarCurso(cursoId);
          return;
        }

        // Si el clic fue directamente en la tarjeta (no en un botón) -> Abrir Panel de Detalles
        abrirPanelDetalles(cursoId);
        return; // Terminar
      }
    }; // Fin de la definición de clickHandler

    // --- Definición del Listener para Búsqueda (evento 'input') ---
    const inputHandler = (e) => {
      // Si el evento ocurrió en el input con ID 'input-buscar-cursos'
      if (e.target.id === 'input-buscar-cursos') {
        searchTerm = e.target.value; // Actualiza la variable global 'searchTerm'
        renderizarCursos(); // Vuelve a dibujar las tarjetas filtradas
      }
    };

    // --- Definición del Listener para Filtro Archivados (evento 'change') ---
    const changeHandler = (e) => {
      // Si el evento ocurrió en el checkbox con ID 'toggle-mostrar-archivados'
      if (e.target.id === 'toggle-mostrar-archivados') {
        mostrarArchivados = e.target.checked; // Actualiza la variable global 'mostrarArchivados'
        renderizarCursos(); // Vuelve a dibujar las tarjetas filtradas/sin filtrar
      }
    };

    // --- Adjuntar Listeners al Elemento Principal de la Página ---
    pageCursos.addEventListener('click', clickHandler);
    pageCursos.addEventListener('input', inputHandler);
    pageCursos.addEventListener('change', changeHandler);
    // Guardar referencias a los listeners para poder quitarlos después si es necesario
    pageCursos._clickHandler = clickHandler;
    pageCursos._inputHandler = inputHandler;
    pageCursos._changeHandler = changeHandler;
  } // Fin del if (pageCursos)

  // --- Listeners para los Formularios de los Modales ---
  // (Se adjuntan una sola vez usando 'dataset.listenerAttached' para evitar duplicados)

  // Formulario "Nuevo Curso"
  const formNuevoCurso = document.getElementById('form-nuevo-curso');
  if (formNuevoCurso && !formNuevoCurso.dataset.listenerAttached) {
    // Listener para el envío (submit) del formulario
    formNuevoCurso.addEventListener('submit', (e) => {
      e.preventDefault(); // Evita el envío real
      const inputNombre = document.getElementById('input-nombre-curso');
      // No leemos el emoji aquí, 'agregarCurso' lo toma del input oculto
      if (inputNombre) {
        agregarCurso(inputNombre.value.trim()); // Llama a la función para agregar el curso
      }
      cerrarModal('modal-nuevo-curso'); // Cierra el modal
    });
    // Listener para el BOTÓN de emoji (Modal Nuevo Curso)
    const btnEmojiNuevo = document.getElementById('btn-emoji-curso');
    const inputEmojiHiddenNuevo = document.getElementById(
      'input-emoji-curso-hidden',
    );
    if (btnEmojiNuevo && inputEmojiHiddenNuevo) {
      btnEmojiNuevo.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que el clic cierre el modal si está dentro
        showEmojiPicker(btnEmojiNuevo, inputEmojiHiddenNuevo); // Llama a la función que muestra el picker
      });
    }
    formNuevoCurso.dataset.listenerAttached = 'true'; // Marca que ya tiene listener
  }

  // Formulario "Renombrar Curso"
  const formRenombrarCurso = document.getElementById('form-renombrar-curso');
  if (formRenombrarCurso && !formRenombrarCurso.dataset.listenerAttached) {
    // Listener para el envío (submit) del formulario
    formRenombrarCurso.addEventListener('submit', (e) => {
      e.preventDefault(); // Evita el envío real
      const cursoId = Number(
        document.getElementById('input-renombrar-curso-id').value,
      ); // ID del curso a renombrar
      const nuevoNombre = document
        .getElementById('input-renombrar-curso-nombre')
        .value.trim(); // Nuevo nombre
      // No leemos el emoji aquí, 'renombrarCurso' lo toma del input oculto
      if (cursoId) {
        renombrarCurso(cursoId, nuevoNombre); // Llama a la función para renombrar
      }
      cerrarModal('modal-renombrar-curso'); // Cierra el modal
    });
    // Listener para el BOTÓN de emoji (Modal Renombrar Curso)
    const btnEmojiRenombrar = document.getElementById(
      'btn-renombrar-emoji-curso',
    );
    const inputEmojiHiddenRenombrar = document.getElementById(
      'input-renombrar-emoji-curso-hidden',
    );
    if (btnEmojiRenombrar && inputEmojiHiddenRenombrar) {
      btnEmojiRenombrar.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que el clic cierre el modal
        showEmojiPicker(btnEmojiRenombrar, inputEmojiHiddenRenombrar); // Llama a la función que muestra el picker
      });
    }
    formRenombrarCurso.dataset.listenerAttached = 'true'; // Marca que ya tiene listener
  }
} // Fin de la función inicializarCursos
