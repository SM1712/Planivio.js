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

let graficaDeProyecto = null;

function calcularEstadisticasProyecto(proyectoId) {
  const tareasDelProyecto = state.tareas.filter(
    (t) => t.proyectoId === proyectoId,
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
  const porcentaje =
    totalTareas > 0 ? Math.round((completadas / totalTareas) * 100) : 0;

  return { total: totalTareas, completadas, alta, media, baja, porcentaje };
}

export function inicializarProyectos() {
  const btnNuevoProyecto = document.getElementById('btn-nuevo-proyecto');
  if (btnNuevoProyecto.dataset.initialized) return;

  const formNuevoProyecto = document.getElementById('form-nuevo-proyecto');
  const container = document.getElementById('lista-proyectos-container');
  const btnCerrarDetalles = document.getElementById(
    'btn-cerrar-detalles-proyecto',
  );
  const formQuickAdd = document.getElementById('form-quick-add-tarea');

  const btnMenuProyecto = document.getElementById('btn-proyecto-menu');
  const menuDropdown = document.getElementById('proyecto-menu-dropdown');
  btnMenuProyecto.innerHTML = ICONS.dots_vertical;

  btnMenuProyecto.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle('visible');
  });

  document
    .getElementById('btn-detalles-editar-proyecto')
    .addEventListener('click', () => {
      iniciarEdicionProyecto(state.proyectoSeleccionadoId);
      menuDropdown.classList.remove('visible');
    });

  document
    .getElementById('btn-detalles-agregar-tarea')
    .addEventListener('click', () => {
      abrirModalQuickAdd();
      menuDropdown.classList.remove('visible');
    });

  document
    .getElementById('btn-detalles-eliminar-proyecto')
    .addEventListener('click', () => {
      eliminarProyecto(state.proyectoSeleccionadoId);
      menuDropdown.classList.remove('visible');
    });

  btnNuevoProyecto.addEventListener('click', () =>
    iniciarEdicionProyecto(null),
  );

  formNuevoProyecto.addEventListener('submit', (e) => {
    e.preventDefault();
    agregarOEditarProyecto();
  });

  container.addEventListener('click', (e) => {
    const card = e.target.closest('.proyecto-card');
    const editBtn = e.target.closest('.btn-editar-proyecto');
    const deleteBtn = e.target.closest('.btn-eliminar-proyecto');

    if (editBtn) {
      e.stopPropagation();
      iniciarEdicionProyecto(parseInt(card.dataset.id));
      return;
    }
    if (deleteBtn) {
      e.stopPropagation();
      eliminarProyecto(parseInt(card.dataset.id));
      return;
    }
    if (card) {
      state.proyectoSeleccionadoId = parseInt(card.dataset.id);
      document
        .getElementById('page-proyectos')
        .classList.add('detalle-visible');
      renderizarProyectos();
      renderizarDetallesProyecto();
    }
  });

  if (btnCerrarDetalles) {
    btnCerrarDetalles.addEventListener('click', () => {
      state.proyectoSeleccionadoId = null;
      document
        .getElementById('page-proyectos')
        .classList.remove('detalle-visible');
      renderizarProyectos();
      renderizarDetallesProyecto();
    });
  }

  formQuickAdd.addEventListener('submit', (e) => {
    e.preventDefault();
    agregarTareaDesdeModal();
  });

  btnNuevoProyecto.dataset.initialized = 'true';
}

// REEMPLAZA ESTA FUNCIÓN EN proyectos.js

// REEMPLAZA ESTA FUNCIÓN EN proyectos.js

export function renderizarProyectos() {
  const container = document.getElementById('lista-proyectos-container');
  if (!container) return;
  container.innerHTML = '';

  if (state.proyectos.length === 0) {
    container.innerHTML =
      '<p style="padding: 15px; color: var(--text-muted);">No tienes proyectos creados. ¡Añade el primero!</p>';
    return;
  }

  state.proyectos.forEach((proyecto) => {
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

function renderizarDetallesProyecto() {
  const headerInfo = document.getElementById('proyecto-det-header-info');
  const descEl = document.getElementById('proyecto-det-descripcion');
  const statsContainer = document.getElementById(
    'proyecto-det-stats-container',
  );

  if (graficaDeProyecto) graficaDeProyecto.destroy();

  const proyecto = state.proyectos.find(
    (p) => p.id === state.proyectoSeleccionadoId,
  );

  if (proyecto) {
    let cursoAsignadoHtml = '';
    if (proyecto.curso && proyecto.curso !== 'General') {
      cursoAsignadoHtml = `<h5 class="proyecto-curso-asignado">${proyecto.curso}</h5>`;
    }
    headerInfo.innerHTML = `<h3>${proyecto.nombre}</h3>${cursoAsignadoHtml}`;
    descEl.textContent =
      proyecto.descripcion || 'Este proyecto no tiene una descripción.';

    const stats = calcularEstadisticasProyecto(proyecto.id);

    if (stats.total === 0) {
      statsContainer.style.display = 'none';
      document.getElementById('proyecto-det-tareas-container').innerHTML =
        '<h4>¡No hay tareas asignadas a este proyecto!</h4>';
    } else {
      statsContainer.style.display = 'block';
      renderizarGraficaProyecto(stats);
      renderizarListasDeTareas(proyecto.id);
    }
  } else {
    statsContainer.style.display = 'none';
    headerInfo.innerHTML = `<h3>Selecciona un proyecto</h3>`;
    descEl.textContent = '';
  }
}

function renderizarGraficaProyecto(stats) {
  const ctx = document
    .getElementById('proyecto-grafica-progreso')
    .getContext('2d');
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
          backgroundColor: ['#3498db', '#e74c3c', '#f39c12', '#2ecc71'], // CORREGIDO
          borderColor: getComputedStyle(document.body)
            .getPropertyValue('--bg-content')
            .trim(),
          borderWidth: 4,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: { padding: 20, usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          callbacks: { label: (c) => `${c.label}: ${c.parsed} tarea(s)` },
        },
      },
    },
  });
}

function renderizarListasDeTareas(proyectoId) {
  const container = document.getElementById('proyecto-det-tareas-container');
  const tareasPendientes = state.tareas.filter(
    (t) => t.proyectoId === proyectoId && !t.completada,
  );

  let html = '<div class="tareas-por-prioridad">';
  if (tareasPendientes.length > 0) html += '<h4>Tareas Pendientes</h4>';

  ['Alta', 'Media', 'Baja'].forEach((prioridad) => {
    const tareas = tareasPendientes.filter((t) => t.prioridad === prioridad);
    if (tareas.length > 0) {
      html += `<h5>Prioridad ${prioridad}</h5><ul>`;
      tareas.forEach((t) => {
        const [y, m, d] = t.fecha.split('-');
        html += `<li><div><span class="prioridad-indicador prioridad-${prioridad.toLowerCase()}"></span><span>${t.titulo}</span></div><span class="fecha-tarea">${d}/${m}/${y}</span></li>`;
      });
      html += '</ul>';
    }
  });

  if (
    tareasPendientes.length === 0 &&
    state.tareas.filter((t) => t.proyectoId === proyectoId).length > 0
  ) {
    html += '<h4>¡Todas las tareas de este proyecto están completadas! 🎉</h4>';
  }

  html += '</div>';
  container.innerHTML = html;
}

function agregarOEditarProyecto() {
  const id = parseInt(document.getElementById('input-proyecto-id').value);
  const nombre = document.getElementById('input-nombre-proyecto').value.trim();
  const descripcion = document
    .getElementById('input-desc-proyecto')
    .value.trim();
  const curso = document.getElementById('select-curso-proyecto').value;

  if (!nombre)
    return mostrarAlerta(
      'Campo Requerido',
      'El nombre del proyecto no puede estar vacío.',
    );

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
  document.getElementById('form-nuevo-proyecto').reset();

  const selectorCurso = document.getElementById('select-curso-proyecto');
  selectorCurso.innerHTML = '<option value="">Ninguno</option>';
  state.cursos.forEach((c) => {
    if (c === 'General') return;
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    selectorCurso.appendChild(opt);
  });

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
  selectorCurso.value = proyecto?.curso || '';

  mostrarModal('modal-nuevo-proyecto');
}

function eliminarProyecto(id) {
  const proyecto = state.proyectos.find((p) => p.id === id);
  if (!proyecto) return;

  mostrarConfirmacion(
    'Eliminar Proyecto',
    `¿Estás seguro de que quieres eliminar el proyecto "${proyecto.nombre}"?`,
    () => {
      state.proyectos = state.proyectos.filter((p) => p.id !== id);
      state.tareas.forEach((t) => {
        if (t.proyectoId === id) delete t.proyectoId;
      });

      if (state.proyectoSeleccionadoId === id) {
        state.proyectoSeleccionadoId = null;
        document
          .getElementById('page-proyectos')
          .classList.remove('detalle-visible');
        renderizarDetallesProyecto();
      }

      guardarDatos();
      renderizarProyectos();
    },
  );
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

function abrirModalQuickAdd() {
  const proyecto = state.proyectos.find(
    (p) => p.id === state.proyectoSeleccionadoId,
  );
  if (!proyecto) return;

  document.getElementById('form-quick-add-tarea').reset();
  document.getElementById('quick-add-proyecto-nombre').value = proyecto.nombre;

  const selectorCurso = document.getElementById('quick-add-curso-tarea');
  popularSelectorDeCursos(selectorCurso);
  if (proyecto.curso) {
    selectorCurso.value = proyecto.curso;
  } else {
    // Si el proyecto no tiene curso, selecciona el primer curso disponible que no sea "General"
    const primerCurso = state.cursos.find((c) => c !== 'General');
    if (primerCurso) selectorCurso.value = primerCurso;
  }

  document.getElementById('quick-add-fecha-tarea').valueAsDate = new Date();
  mostrarModal('modal-quick-add-tarea');
}
