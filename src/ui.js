import { state } from './state.js';
import { ICONS } from './icons.js';

export function cargarIconos() {
  actualizarIconoTogglePanel();
  document.getElementById('btn-config-dropdown').innerHTML = ICONS.settings;
  document.querySelector(
    '.nav-item[data-page="dashboard"] .nav-icon',
  ).innerHTML = ICONS.dashboard;
  document.querySelector('.nav-item[data-page="tareas"] .nav-icon').innerHTML =
    ICONS.tareas;
  document.querySelector(
    '.nav-item[data-page="calendario"] .nav-icon',
  ).innerHTML = ICONS.calendario;
  document.querySelector('.nav-item[data-page="cursos"] .nav-icon').innerHTML =
    ICONS.cursos;

  // --- NOVEDAD: Cargamos el icono de cierre en el panel de tareas ---
  const btnCerrarDetalles = document.getElementById('btn-cerrar-detalles');
  if (btnCerrarDetalles) {
    btnCerrarDetalles.innerHTML = ICONS.close;
  }
}

// ... (resto del archivo sin cambios) ...

export function renderizarTareas() {
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

  const tituloTareas = document.getElementById('titulo-tareas-pendientes');
  if (tituloTareas)
    tituloTareas.textContent = `Tareas Pendientes (${tareasAMostrar.length})`;

  actualizarFiltrosActivos();
}

export function renderizarDetalles() {
  const panel = document.getElementById('panel-detalles');
  if (!panel) return;

  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadaId);
  const titulo = document.getElementById('det-titulo');
  const descripcion = document.getElementById('det-descripcion');
  const btnCompletar = document.getElementById('btn-completar-tarea');
  const btnEditar = document.getElementById('btn-editar-tarea');
  const subtareasContainer = document.querySelector('.subtareas-container');

  if (tarea) {
    titulo.textContent = tarea.titulo;
    descripcion.textContent = tarea.descripcion;
    btnCompletar.textContent = tarea.completada
      ? 'Marcar como Pendiente'
      : 'Marcar como Completada';
    btnCompletar.disabled = false;
    btnEditar.disabled = false;
    subtareasContainer.style.display = 'flex';
    renderizarSubtareas(tarea);
  } else {
    titulo.textContent = 'Selecciona una tarea';
    descripcion.textContent = '';
    btnCompletar.textContent = 'Marcar como Completada';
    btnCompletar.disabled = true;
    btnEditar.disabled = true;
    if (subtareasContainer) subtareasContainer.style.display = 'none';
    const listaSubtareas = document.getElementById('lista-subtareas');
    if (listaSubtareas) listaSubtareas.innerHTML = '';
  }
}

export function renderizarSubtareas(tarea) {
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

export function actualizarFiltrosActivos() {
  document.querySelectorAll('.btn-filtro[data-sort]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sort === state.ordenamiento.col);
  });
}

export function actualizarIconoTogglePanel() {
  const panel = document.getElementById('panel-lateral');
  const btn = document.getElementById('btn-toggle-panel');
  if (panel.classList.contains('panel-colapsado')) {
    btn.innerHTML = ICONS.expand;
  } else {
    btn.innerHTML = ICONS.collapse;
  }
}

export function mostrarModal(idModal) {
  document.getElementById(idModal)?.classList.add('visible');
}

export function cerrarModal(idModal) {
  document.getElementById(idModal)?.classList.remove('visible');
}

export function mostrarConfirmacion(titulo, msg, callback) {
  const confirmTitle = document.getElementById('confirm-title');
  const confirmMsg = document.getElementById('confirm-msg');
  if (confirmTitle) confirmTitle.textContent = titulo;
  if (confirmMsg) confirmMsg.textContent = msg;
  mostrarModal('modal-confirmacion');

  const aceptarBtn = document.getElementById('btn-confirm-aceptar');
  if (aceptarBtn) {
    const nuevoAceptarBtn = aceptarBtn.cloneNode(true);
    aceptarBtn.parentNode.replaceChild(nuevoAceptarBtn, aceptarBtn);
    nuevoAceptarBtn.addEventListener('click', () => {
      callback();
      cerrarModal('modal-confirmacion');
    });
  }
}

export function popularSelectorDeCursos() {
  const selector = document.getElementById('select-curso-tarea');
  if (!selector) return;

  const valorSeleccionado = selector.value;

  selector.innerHTML = '';

  state.cursos.forEach((nombreCurso) => {
    if (nombreCurso === 'General' && state.cursos.length > 1) return;

    const opcion = document.createElement('option');
    opcion.value = nombreCurso;
    opcion.textContent = nombreCurso;
    selector.appendChild(opcion);
  });

  if (state.cursos.includes(valorSeleccionado)) {
    selector.value = valorSeleccionado;
  }
}

export function popularFiltroDeCursos() {
  const selector = document.getElementById('filtro-curso');
  if (!selector) return;

  selector.innerHTML = '<option value="todos">Todos los Cursos</option>';

  const cursosUnicos = [...new Set(state.tareas.map((t) => t.curso))];
  cursosUnicos.sort().forEach((nombreCurso) => {
    const opcion = document.createElement('option');
    opcion.value = nombreCurso;
    opcion.textContent = nombreCurso;
    selector.appendChild(opcion);
  });

  selector.value = state.filtroCurso;
}
