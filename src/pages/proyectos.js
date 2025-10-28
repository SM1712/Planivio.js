import { state } from '../state.js';
import { guardarDatos } from '../utils.js';
import {
  mostrarModal,
  cerrarModal,
  mostrarConfirmacion,
  mostrarAlerta,
  popularSelectorDeCursos,
} from '../ui.js';
import { ICONS } from '../icons.js';
// ================== INICIO DE LÍNEAS AÑADIDAS (FASE 3) ==================
import { cambiarPagina } from '../main.js';
import { iniciarEdicionEvento } from './calendario.js';
// =================== FIN DE LÍNEAS AÑADIDAS (FASE 3) ==================

let graficaDeProyecto = null;
// ================== INICIO DE LÍNEA AÑADIDA (FASE 1) ==================
let searchTermProyectos = ''; // Variable para guardar la búsqueda
// =================== FIN DE LÍNEA AÑADIDA (FASE 1) ==================

// ... (calcularEstadisticasProyecto se mantiene igual) ...
export function calcularEstadisticasProyecto(proyectoId) {
  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );
  const tareasDelProyecto = state.tareas.filter(
    (t) => t.proyectoId === proyectoId && !cursosArchivadosNombres.has(t.curso), // <-- AÑADIDO ESTO
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

// ================== INICIO FUNCIÓN MODIFICADA (FASE 1 y Corrección) ==================
function renderizarProyectos() {
  const container = document.getElementById('lista-proyectos-container');
  if (!container) return;
  container.innerHTML = ''; // Limpia el contenedor

  // 1. Carga los cursos archivados
  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );

  // 2. Obtiene el término de búsqueda
  const terminoBusqueda = searchTermProyectos.toLowerCase();

  // 3. Filtra los proyectos
  const proyectosMostrables = state.proyectos.filter((proyecto) => {
    // Condición 1: El curso NO debe estar archivado
    const cursoArchivado =
      proyecto.curso && cursosArchivadosNombres.has(proyecto.curso);

    // Condición 2: Debe coincidir con la búsqueda
    const coincideBusqueda =
      terminoBusqueda === '' ||
      proyecto.nombre.toLowerCase().includes(terminoBusqueda);

    // El proyecto se muestra si NO está archivado Y coincide con la búsqueda
    return !cursoArchivado && coincideBusqueda;
  });

  // 4. Muestra el mensaje de "Vacío"
  if (proyectosMostrables.length === 0) {
    if (searchTermProyectos !== '') {
      // Mensaje si no hay resultados de búsqueda
      container.innerHTML =
        '<p style="padding: 15px; color: var(--text-muted);">No se encontraron proyectos que coincidan con tu búsqueda.</p>';
    } else {
      // Mensaje si no hay proyectos en general
      container.innerHTML =
        '<p style="padding: 15px; color: var(--text-muted);">No tienes proyectos creados. ¡Añade el primero!</p>';
    }
    return; // Importante salir aquí
  }

  // 5. Renderiza las tarjetas (Tu código original)
  proyectosMostrables.forEach((proyecto) => {
    const stats = calcularEstadisticasProyecto(proyecto.id);
    const card = document.createElement('div');
    card.className = 'proyecto-card';
    if (proyecto.id === state.proyectoSeleccionadoId)
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
                <button class="btn-icon btn-editar-proyecto" title="Editar Proyecto">${ICONS.edit}</button>
                <button class="btn-icon btn-eliminar-proyecto" title="Eliminar Proyecto">${ICONS.delete}</button>
            </div>
        `;
    container.appendChild(card);
  });
}
// ================== FIN FUNCIÓN MODIFICADA (FASE 1 y Corrección) ==================

// ... (renderizarGraficaProyecto se mantiene igual) ...
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

// ================== INICIO FUNCIÓN MODIFICADA (FASE 3) ==================
function renderizarListasDeTareas(proyectoId) {
  const container = document.getElementById('proyecto-det-tareas-container');
  if (!container) return;

  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );
  const tareasPendientes = state.tareas.filter(
    (t) =>
      t.proyectoId === proyectoId &&
      !t.completada &&
      !cursosArchivadosNombres.has(t.curso),
  );

  const totalTareasProyecto = state.tareas.filter(
    (t) => t.proyectold === proyectoId && !cursosArchivadosNombres.has(t.curso),
  ).length;

  let html = '<div class="tareas-por-prioridad">';

  if (tareasPendientes.length > 0) html += '<h4>Tareas Pendientes</h4>';

  ['Alta', 'Media', 'Baja'].forEach((prioridad) => {
    const tareas = tareasPendientes.filter((t) => t.prioridad === prioridad);
    if (tareas.length > 0) {
      html += `<h5>Prioridad ${prioridad}</h5><ul>`;
      tareas.forEach((t) => {
        const [y, m, d] = t.fecha.split('-');
        // --- LÍNEA MODIFICADA ---
        html += `<li class="detalle-item" data-task-id="${t.id}">
                    <div>
                      <span class="prioridad-indicador prioridad-${prioridad.toLowerCase()}"></span>
                      <span>${t.titulo}</span>
                    </div>
                    <span class="fecha-tarea">${d}/${m}/${y}</span>
                  </li>`;
        // --- FIN LÍNEA MODIFICADA ---
      });
      html += '</ul>';
    }
  });

  if (tareasPendientes.length === 0 && totalTareasProyecto > 0) {
    html +=
      '<p class="detalle-lista-vacia">¡Todas las tareas de este proyecto están completadas!</p>';
  }

  html += '</div>';
  container.innerHTML = html;
}
// ================== FIN FUNCIÓN MODIFICADA (FASE 3) ==================

// ================== INICIO NUEVAS FUNCIONES (FASE 2) ==================
function renderizarListaEventos(proyectoId, container) {
  if (!container) return;

  const eventosDelProyecto = state.eventos.filter(
    (e) => String(e.proyectoId) === String(proyectoId), // Usamos String() por seguridad
  );

  if (eventosDelProyecto.length === 0) {
    container.innerHTML =
      '<p class="detalle-lista-vacia">Este proyecto no tiene eventos asociados.</p>';
    return;
  }

  // Ordenar por fecha de inicio
  eventosDelProyecto.sort(
    (a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio),
  );

  let html = '<ul class="detalle-lista">';
  eventosDelProyecto.forEach((evento) => {
    // Formatear fecha
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

function renderizarListaApuntes(proyectold, container) {
  if (!container) return;

  const apuntesDelProyecto = state.apuntes.filter(
    (a) => String(a.proyectoId) === String(proyectold), // 'proyectold'
  );

  if (apuntesDelProyecto.length === 0) {
    container.innerHTML =
      '<p class="detalle-lista-vacia">Este proyecto no tiene apuntes asociados.</p>';
    return;
  }

  // Ordenar por fecha de modificación
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
        <span class="tab-icon">${ICONS.apuntes || ''}</span>
        <div class="detalle-item-contenido">
          <span class="detalle-item-titulo">${titulo}</span>
          <span class="detalle-item-meta">${tags}</span>
        </div>
      </li>
    `;
  });
  html += '</ul>';
  container.innerHTML = html;
}
// ================== FIN NUEVAS FUNCIONES (FASE 2) ==================

// ================== INICIO FUNCIÓN MODIFICADA (FASE 2) ==================
function renderizarDetallesProyecto() {
  const headerInfo = document.getElementById('proyecto-det-header-info');
  const descEl = document.getElementById('proyecto-det-descripcion');

  // --- Contenedores de las pestañas ---
  const statsContainer = document.getElementById(
    'proyecto-det-stats-container',
  ); // Tab 1
  const tareasContainer = document.getElementById(
    'proyecto-det-tareas-container',
  ); // Tab 1
  const eventosContainer = document.getElementById('proyectos-tab-eventos'); // Tab 2
  const apuntesContainer = document.getElementById('proyectos-tab-apuntes'); // Tab 3

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
    console.error(
      'Error: Faltan elementos esenciales del DOM en el panel de detalles del proyecto (quizás las pestañas no se cargaron).',
    );
    return;
  }

  const proyecto = state.proyectos.find(
    (p) => p.id === state.proyectoSeleccionadoId,
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

    // --- Renderizar Pestaña 1: Resumen (Tareas + Gráfica) ---
    if (stats.total === 0) {
      statsContainer.style.display = 'none'; // Oculta gráfica
      tareasContainer.innerHTML =
        '<p class="detalle-lista-vacia">¡No hay tareas asignadas a este proyecto!</p>';
    } else {
      statsContainer.style.display = 'grid'; // Muestra gráfica
      renderizarListasDeTareas(proyecto.id); // Función que ya tenías
      setTimeout(() => {
        const canvasEl = document.getElementById('proyecto-grafica-progreso');
        if (canvasEl && document.contains(canvasEl)) {
          renderizarGraficaProyecto(stats); // Función que ya tenías
        }
      }, 50);
    }

    // --- Renderizar Pestaña 2: Eventos ---
    renderizarListaEventos(proyecto.id, eventosContainer);

    // --- Renderizar Pestaña 3: Apuntes ---
    renderizarListaApuntes(proyecto.id, apuntesContainer);
  } else {
    // Estado vacío (cuando no hay proyecto seleccionado)
    headerInfo.innerHTML = '<h3>Selecciona un proyecto</h3>';
    descEl.textContent = '';
    statsContainer.style.display = 'none';
    tareasContainer.innerHTML = '';
    eventosContainer.innerHTML =
      '<p class="detalle-lista-vacia">Selecciona un proyecto para ver sus eventos.</p>';
    apuntesContainer.innerHTML =
      '<p class="detalle-lista-vacia">Selecciona un proyecto para ver sus apuntes.</p>';
  }
}
// ================== FIN FUNCIÓN MODIFICADA (FASE 2) ==================

// ... (agregarOEditarProyecto, iniciarEdicionProyecto, eliminarProyecto, abrirModalQuickAdd, agregarTareaDesdeModal se mantienen iguales) ...
function agregarOEditarProyecto() {
  const idInput = document.getElementById('input-proyecto-id');
  const id = idInput ? parseInt(idInput.value) : null;
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
  if (id) {
    const proyecto = state.proyectos.find((p) => p.id === id);
    if (proyecto)
      Object.assign(proyecto, { nombre, descripcion, curso: curso || null });
  } else {
    state.proyectos.push({
      id: Date.now(),
      nombre,
      descripcion,
      curso: curso || null,
    });
  }
  guardarDatos();
  renderizarProyectos();
  renderizarDetallesProyecto();
  cerrarModal('modal-nuevo-proyecto');
}

function iniciarEdicionProyecto(id) {
  const proyecto = id ? state.proyectos.find((p) => p.id === id) : null;
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

function eliminarProyecto(id) {
  const proyecto = state.proyectos.find((p) => p.id === id);
  if (!proyecto) return;
  mostrarConfirmacion(
    'Eliminar Proyecto',
    `¿Estás seguro de que quieres eliminar el proyecto "${proyecto.nombre}"? Las tareas asociadas no se borrarán, solo se desvincularán.`,
    () => {
      state.proyectos = state.proyectos.filter((p) => p.id !== id);
      state.tareas.forEach((t) => {
        if (t.proyectoId === id) t.proyectoId = null;
      });
      // --- MODIFICACIÓN: Desvincular Eventos y Apuntes también ---
      state.eventos.forEach((e) => {
        if (String(e.proyectoId) === String(id)) e.proyectoId = null;
      });
      state.apuntes.forEach((a) => {
        if (String(a.proyectoId) === String(id)) a.proyectoId = null;
      });
      // --- FIN MODIFICACIÓN ---
      if (state.proyectoSeleccionadoId === id) {
        state.proyectoSeleccionadoId = null;
        document
          .getElementById('page-proyectos')
          ?.classList.remove('detalle-visible');
      }
      guardarDatos();
      renderizarProyectos();
      renderizarDetallesProyecto();
    },
  );
}

function abrirModalQuickAdd() {
  const proyecto = state.proyectos.find(
    (p) => p.id === state.proyectoSeleccionadoId,
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

function agregarTareaDesdeModal() {
  const nuevaTarea = {
    id: Date.now(),
    curso: document.getElementById('quick-add-curso-tarea').value,
    proyectoId: state.proyectoSeleccionadoId,
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
  state.tareas.push(nuevaTarea);
  guardarDatos();
  renderizarProyectos();
  renderizarDetallesProyecto();
  cerrarModal('modal-quick-add-tarea');
}

// ================== INICIO FUNCIÓN MODIFICADA (FASE 1, 2 y 3) ==================
export function inicializarProyectos() {
  const btnCerrarDetalles = document.getElementById(
    'btn-cerrar-detalles-proyecto',
  );
  if (btnCerrarDetalles) {
    btnCerrarDetalles.innerHTML = ICONS.close;
  }
  const btnMenuProyecto = document.getElementById('btn-proyecto-menu');
  if (btnMenuProyecto) {
    btnMenuProyecto.innerHTML = ICONS.dots_vertical;
  }

  // --- INICIO CÓDIGO AÑADIDO (FASE 2) ---
  // Cargar iconos en las pestañas
  const iconResumen = document.getElementById('proyectos-tab-icon-resumen');
  const iconEventos = document.getElementById('proyectos-tab-icon-eventos');
  const iconApuntes = document.getElementById('proyectos-tab-icon-apuntes');
  if (iconResumen) iconResumen.innerHTML = ICONS.tareas;
  if (iconEventos) iconEventos.innerHTML = ICONS.calendario;
  if (iconApuntes) iconApuntes.innerHTML = ICONS.apuntes;

  // Listener para el cambio de pestañas
  const tabsNav = document.getElementById('proyectos-tabs-nav');
  if (tabsNav) {
    tabsNav.addEventListener('click', (e) => {
      const tabButton = e.target.closest('.tab-item');
      if (!tabButton) return;

      const tabId = tabButton.dataset.tab;
      if (!tabId) return;

      document
        .querySelectorAll('#panel-proyecto-detalles .tab-pane')
        .forEach((pane) => {
          pane.classList.remove('active');
        });
      tabsNav.querySelectorAll('.tab-item').forEach((btn) => {
        btn.classList.remove('active');
      });

      document.getElementById(tabId)?.classList.add('active');
      tabButton.classList.add('active');
    });
  }
  // --- FIN CÓDIGO AÑADIDO (FASE 2) ---

  renderizarProyectos();
  renderizarDetallesProyecto();

  if (state.proyectoSeleccionadoId !== null) {
    document.getElementById('page-proyectos')?.classList.add('detalle-visible');
  } else {
    document
      .getElementById('page-proyectos')
      ?.classList.remove('detalle-visible');
  }

  const btnNuevoProyecto = document.getElementById('btn-nuevo-proyecto');
  if (btnNuevoProyecto && !btnNuevoProyecto.dataset.initialized) {
    btnNuevoProyecto.addEventListener('click', () =>
      iniciarEdicionProyecto(null),
    );
    btnNuevoProyecto.dataset.initialized = 'true';
  }

  const formNuevoProyecto = document.getElementById('form-nuevo-proyecto');
  if (formNuevoProyecto) {
    formNuevoProyecto.addEventListener('submit', (e) => {
      e.preventDefault();
      agregarOEditarProyecto();
    });
  }

  const container = document.getElementById('lista-proyectos-container');
  if (container) {
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.proyecto-card');
      if (!card) return;

      if (e.target.closest('.btn-editar-proyecto')) {
        e.stopPropagation();
        iniciarEdicionProyecto(parseInt(card.dataset.id));
        return;
      }
      if (e.target.closest('.btn-eliminar-proyecto')) {
        e.stopPropagation();
        eliminarProyecto(parseInt(card.dataset.id));
        return;
      }

      state.proyectoSeleccionadoId = parseInt(card.dataset.id);
      document
        .getElementById('page-proyectos')
        ?.classList.add('detalle-visible');
      renderizarProyectos();
      renderizarDetallesProyecto();
    });
  }

  if (btnCerrarDetalles) {
    btnCerrarDetalles.addEventListener('click', () => {
      state.proyectoSeleccionadoId = null;
      document
        .getElementById('page-proyectos')
        ?.classList.remove('detalle-visible');
      renderizarProyectos();
      renderizarDetallesProyecto();
    });
  }

  const formQuickAdd = document.getElementById('form-quick-add-tarea');
  if (formQuickAdd) {
    formQuickAdd.addEventListener('submit', (e) => {
      e.preventDefault();
      agregarTareaDesdeModal();
    });
  }

  const menuDropdown = document.getElementById('proyecto-menu-dropdown');
  if (btnMenuProyecto && menuDropdown) {
    btnMenuProyecto.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown.classList.toggle('visible');
    });
  }

  document
    .getElementById('btn-detalles-editar-proyecto')
    ?.addEventListener('click', () => {
      iniciarEdicionProyecto(state.proyectoSeleccionadoId);
      if (menuDropdown) menuDropdown.classList.remove('visible');
    });

  document
    .getElementById('btn-detalles-agregar-tarea')
    ?.addEventListener('click', () => {
      abrirModalQuickAdd();
      if (menuDropdown) menuDropdown.classList.remove('visible');
    });

  document
    .getElementById('btn-detalles-eliminar-proyecto')
    ?.addEventListener('click', () => {
      eliminarProyecto(state.proyectoSeleccionadoId);
      if (menuDropdown) menuDropdown.classList.remove('visible');
    });

  // --- INICIO CÓDIGO AÑADIDO (FASE 1) ---
  const inputBusqueda = document.getElementById('input-buscar-proyectos');
  if (inputBusqueda) {
    inputBusqueda.value = searchTermProyectos;
    inputBusqueda.addEventListener('input', (e) => {
      searchTermProyectos = e.target.value;
      renderizarProyectos();
    });
  }
  // --- FIN CÓDIGO AÑADIDO (FASE 1) ---

  // --- INICIO CÓDIGO AÑADIDO (FASE 3) ---
  const panelDetalles = document.getElementById('panel-proyecto-detalles');
  if (panelDetalles) {
    panelDetalles.addEventListener('click', (e) => {
      // 1. Clic en una TAREA
      const tareaItem = e.target.closest('li[data-task-id]');
      if (tareaItem) {
        const tareaId = tareaItem.dataset.taskId;
        if (tareaId) {
          state.tareaSeleccionadald = parseInt(tareaId);
          guardarDatos();
          cambiarPagina('tareas');
          return;
        }
      }

      // 2. Clic en un APUNTE
      const apunteItem = e.target.closest('li[data-apunte-id]');
      if (apunteItem) {
        const apunteId = apunteItem.dataset.apunteId;
        if (apunteId) {
          state.apunteActivoId = parseInt(apunteId);
          guardarDatos();
          cambiarPagina('apuntes');
          return;
        }
      }

      // 3. Clic en un EVENTO
      const eventoItem = e.target.closest('li[data-evento-id]');
      if (eventoItem) {
        const eventoId = eventoItem.dataset.eventoId;
        const evento = state.eventos.find(
          (e) => String(e.id) === String(eventoId),
        );
        if (evento) {
          iniciarEdicionEvento(evento);
          return;
        }
      }
    });
  }
  // --- FIN CÓDIGO AÑADIDO (FASE 3) ---
}
// ================== FIN FUNCIÓN MODIFICADA (FASE 1, 2 y 3) ==================
