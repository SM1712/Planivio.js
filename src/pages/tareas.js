import { state } from '../state.js';
import { guardarDatos } from '../utils.js';
import {
  popularSelectorDeCursos,
  popularFiltroDeCursos,
  popularSelectorDeProyectos,
  popularSelectorDeProyectosEdicion,
  mostrarModal,
  cerrarModal,
  mostrarConfirmacion,
  cargarIconos,
} from '../ui.js';

// ==========================================================
// == FUNCIONES DE RENDERIZADO DE LA PÁGINA DE TAREAS      ==
// ==========================================================

function renderizarTareas() {
  const tbody = document.getElementById('tabla-tareas-body');
  if (!tbody) return;

  let tareasAMostrar = state.tareas;
  if (state.filtroCurso !== 'todos') {
    tareasAMostrar = state.tareas.filter((t) => t.curso === state.filtroCurso);
  }

  const col = state.ordenamiento.col;
  const reverse = state.ordenamiento.reverse;
  const tareasOrdenadas = [...tareasAMostrar].sort((a, b) => {
    let valA, valB;
    if (col === 'prioridad') {
      const orden = { Alta: 0, Media: 1, Baja: 2 };
      valA = orden[a.prioridad];
      valB = orden[b.prioridad];
    } else if (col === 'fecha') {
      valA = new Date(a.fecha);
      valB = new Date(b.fecha);
    } else {
      valA = String(a[col] || '').toLowerCase();
      valB = String(b[col] || '').toLowerCase();
    }
    if (valA < valB) return reverse ? 1 : -1;
    if (valA > valB) return reverse ? -1 : 1;
    return 0;
  });

  const tareasFinales = tareasOrdenadas.sort(
    (a, b) => a.completada - b.completada,
  );

  tbody.innerHTML = '';
  tareasFinales.forEach((tarea) => {
    const tr = document.createElement('tr');
    tr.dataset.id = tarea.id;
    if (tarea.completada) tr.classList.add('tarea-completada');
    if (tarea.id === state.tareaSeleccionadaId)
      tr.classList.add('selected-task');

    const [year, month, day] = tarea.fecha.split('-');
    const fechaFormateada = `${day}/${month}/${year}`;

    tr.innerHTML = `
            <td>${tarea.curso}</td>
            <td><span class="prioridad-indicador prioridad-${tarea.prioridad.toLowerCase()}"></span></td>
            <td>${tarea.titulo}</td>
            <td>${fechaFormateada}</td>
        `;
    tbody.appendChild(tr);
  });

  document.getElementById('titulo-tareas-pendientes').textContent =
    `Tareas Pendientes (${tareasAMostrar.filter((t) => !t.completada).length})`;

  // Actualizar botones de filtro
  document.querySelectorAll('.btn-filtro[data-sort]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sort === state.ordenamiento.col);
  });
}

function renderizarDetalles() {
  const panel = document.getElementById('panel-detalles');
  if (!panel) return;
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadaId);

  const titulo = document.getElementById('det-titulo');
  const descripcion = document.getElementById('det-descripcion');
  const btnCompletar = document.getElementById('btn-completar-tarea');
  const btnEditar = document.getElementById('btn-editar-tarea');
  const subtareasContainer = document.querySelector('.subtareas-container');
  const proyectoContainer = document.getElementById('det-proyecto-container');
  const proyectoNombre = document.getElementById('det-proyecto-nombre');

  if (tarea) {
    titulo.textContent = tarea.titulo;
    descripcion.textContent = tarea.descripcion || 'Sin descripción.';
    btnCompletar.textContent = tarea.completada
      ? 'Marcar como Pendiente'
      : 'Marcar como Completada';
    btnCompletar.disabled = false;
    btnEditar.disabled = false;
    subtareasContainer.style.display = 'flex';
    renderizarSubtareas(tarea);

    if (tarea.proyectoId) {
      const proyecto = state.proyectos.find((p) => p.id === tarea.proyectoId);
      if (proyecto) {
        proyectoNombre.textContent = proyecto.nombre;
        proyectoContainer.style.display = 'block';
      } else {
        proyectoContainer.style.display = 'none';
      }
    } else {
      proyectoContainer.style.display = 'none';
    }
  } else {
    titulo.textContent = 'Selecciona una tarea';
    descripcion.textContent = '';
    btnCompletar.textContent = 'Marcar como Completada';
    btnCompletar.disabled = true;
    btnEditar.disabled = true;
    if (subtareasContainer) subtareasContainer.style.display = 'none';
    if (proyectoContainer) proyectoContainer.style.display = 'none';
    const listaSubtareas = document.getElementById('lista-subtareas');
    if (listaSubtareas) listaSubtareas.innerHTML = '';
  }
}

function renderizarSubtareas(tarea) {
  const listaSubtareas = document.getElementById('lista-subtareas');
  if (!listaSubtareas) return;
  listaSubtareas.innerHTML = '';
  if (!tarea.subtareas) tarea.subtareas = [];
  tarea.subtareas.forEach((sub, index) => {
    const li = document.createElement('li');
    const checkboxId = `subtarea-${tarea.id}-${index}`;
    li.innerHTML = `
            <input type="checkbox" id="${checkboxId}" data-index="${index}" ${sub.completada ? 'checked' : ''}>
            <label for="${checkboxId}">${sub.texto}</label>
            <button class="btn-delete-subtask" data-index="${index}">&times;</button>
        `;
    listaSubtareas.appendChild(li);
  });
}

// ===================================
// == LÓGICA DE MANEJO DE TAREAS    ==
// ===================================

function agregarTarea(event) {
  event.preventDefault();
  const nuevaTarea = {
    id: Date.now(),
    curso: document.getElementById('select-curso-tarea').value,
    proyectoId:
      parseInt(document.getElementById('select-proyecto-tarea').value) || null,
    titulo: document.getElementById('input-titulo-tarea').value.trim(),
    descripcion: document.getElementById('input-desc-tarea').value.trim(),
    fecha: document.getElementById('input-fecha-tarea').value,
    prioridad: document.getElementById('select-prioridad-tarea').value,
    completada: false,
    subtareas: [],
  };
  if (!nuevaTarea.titulo || !nuevaTarea.fecha) {
    alert('El título y la fecha son obligatorios.');
    return;
  }
  state.tareas.push(nuevaTarea);
  guardarDatos();
  renderizarTareas();
  document.getElementById('form-nueva-tarea').reset();
  document.getElementById('input-fecha-tarea').valueAsDate = new Date();
  popularSelectorDeProyectos();
}

function agregarSubtarea() {
  const input = document.getElementById('input-nueva-subtarea');
  const texto = input.value.trim();
  if (!texto || state.tareaSeleccionadaId === null) return;
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadaId);
  if (tarea) {
    if (!tarea.subtareas) tarea.subtareas = [];
    tarea.subtareas.push({ texto, completada: false });
    input.value = '';
    guardarDatos();
    renderizarSubtareas(tarea);
  }
}

function toggleSubtarea(index) {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadaId);
  if (tarea && tarea.subtareas[index]) {
    tarea.subtareas[index].completada = !tarea.subtareas[index].completada;
    guardarDatos();
    renderizarSubtareas(tarea);
  }
}

function eliminarSubtarea(index) {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadaId);
  if (!tarea || !tarea.subtareas[index]) return;
  const subTexto = tarea.subtareas[index].texto;
  mostrarConfirmacion(
    'Eliminar Sub-tarea',
    `¿Estás seguro de que deseas eliminar la sub-tarea "${subTexto}"?`,
    () => {
      tarea.subtareas.splice(index, 1);
      guardarDatos();
      renderizarSubtareas(tarea);
    },
  );
}

function iniciarEdicionTarea() {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadaId);
  if (!tarea) return;
  document.getElementById('edit-titulo-tarea').value = tarea.titulo;
  document.getElementById('edit-desc-tarea').value = tarea.descripcion;
  document.getElementById('edit-fecha-tarea').value = tarea.fecha;
  document.getElementById('edit-prioridad-tarea').value = tarea.prioridad;
  popularSelectorDeProyectosEdicion(tarea.proyectoId);
  mostrarModal('modal-editar-tarea');
}

function ordenarPor(columna) {
  if (state.ordenamiento.col === columna) {
    state.ordenamiento.reverse = !state.ordenamiento.reverse;
  } else {
    state.ordenamiento.col = columna;
    state.ordenamiento.reverse = false;
  }
  renderizarTareas();
}

// ===================================
// == FUNCIÓN PRINCIPAL DE INICIALIZACIÓN ==
// ===================================

export function inicializarTareas() {
  cargarIconos(); // Carga iconos específicos de la página
  popularSelectorDeCursos(document.getElementById('select-curso-tarea'), true);
  popularFiltroDeCursos();
  popularSelectorDeProyectos();
  renderizarTareas();
  renderizarDetalles();

  const pageTareas = document.getElementById('page-tareas');
  if (!pageTareas) return;

  pageTareas.addEventListener('click', (e) => {
    const fila = e.target.closest('tr[data-id]');
    if (fila) {
      state.tareaSeleccionadaId = parseInt(fila.dataset.id);
      renderizarTareas();
      renderizarDetalles();
      document.querySelector('.app-container').classList.add('detalle-visible');
      return;
    }

    const header = e.target.closest('th[data-sort]');
    if (header) {
      ordenarPor(header.dataset.sort);
    }

    const filtroBtn = e.target.closest('.btn-filtro[data-sort]');
    if (filtroBtn) {
      ordenarPor(filtroBtn.dataset.sort);
    }

    const deleteSubtaskBtn = e.target.closest('.btn-delete-subtask');
    if (deleteSubtaskBtn) {
      eliminarSubtarea(parseInt(deleteSubtaskBtn.dataset.index));
    }

    switch (e.target.id) {
      case 'btn-cerrar-detalles':
        document
          .querySelector('.app-container')
          .classList.remove('detalle-visible');
        state.tareaSeleccionadaId = null;
        renderizarTareas();
        break;
      case 'btn-completar-tarea':
        const tarea = state.tareas.find(
          (t) => t.id === state.tareaSeleccionadaId,
        );
        if (tarea) {
          tarea.completada = !tarea.completada;
          guardarDatos();
          renderizarTareas();
          renderizarDetalles();
        }
        break;
      case 'btn-editar-tarea':
        iniciarEdicionTarea();
        break;
      case 'btn-agregar-subtarea':
        agregarSubtarea();
        break;
    }
  });

  document
    .getElementById('form-nueva-tarea')
    ?.addEventListener('submit', agregarTarea);

  document
    .getElementById('form-editar-tarea')
    ?.addEventListener('submit', (e) => {
      e.preventDefault();
      const tarea = state.tareas.find(
        (t) => t.id === state.tareaSeleccionadaId,
      );
      if (tarea) {
        tarea.titulo = document.getElementById('edit-titulo-tarea').value;
        tarea.descripcion = document.getElementById('edit-desc-tarea').value;
        tarea.proyectoId =
          parseInt(
            document.getElementById('edit-select-proyecto-tarea').value,
          ) || null;
        tarea.fecha = document.getElementById('edit-fecha-tarea').value;
        tarea.prioridad = document.getElementById('edit-prioridad-tarea').value;
        guardarDatos();
        renderizarTareas();
        renderizarDetalles();
      }
      cerrarModal('modal-editar-tarea');
    });

  pageTareas.addEventListener('change', (e) => {
    if (e.target.id === 'filtro-curso') {
      state.filtroCurso = e.target.value;
      renderizarTareas();
    }
    if (e.target.closest('#lista-subtareas') && e.target.type === 'checkbox') {
      toggleSubtarea(parseInt(e.target.dataset.index));
    }
  });

  pageTareas.addEventListener('keyup', (e) => {
    if (e.target.id === 'input-nueva-subtarea' && e.key === 'Enter') {
      agregarSubtarea();
    }
  });
}
