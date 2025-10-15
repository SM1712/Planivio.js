import { state } from './state.js';
import { ICONS } from './icons.js';

export function cargarlconos() {
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  if (btnToggleSidebar) btnToggleSidebar.innerHTML = ICONS.menu;

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
  document.querySelector('.nav-item[data-page="apuntes"] .nav-icon').innerHTML =
    ICONS.apuntes;
  document.querySelector(
    '.nav-item[data-page="proyectos"] .nav-icon',
  ).innerHTML = ICONS.proyectos;

  const btnCerrarDetalles = document.getElementById('btn-cerrar-detalles');
  if (btnCerrarDetalles) {
    btnCerrarDetalles.innerHTML = ICONS.close;
  }
  const btnCerrarDetallesProyecto = document.getElementById(
    'btn-cerrar-detalles-proyecto',
  );
  if (btnCerrarDetallesProyecto) {
    btnCerrarDetallesProyecto.innerHTML = ICONS.close;
  }
}

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
    if (tarea.id === state.tareaSeleccionadald)
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

  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);

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

export function renderizarSubtareas(tarea) {
  const listaSubtareas = document.getElementById('lista-subtareas');
  if (!listaSubtareas) return;
  listaSubtareas.innerHTML = '';
  if (!tarea.subtareas) tarea.subtareas = [];
  tarea.subtareas.forEach((sub, index) => {
    const li = document.createElement('li');
    const checkboxId = `subtarea-${tarea.id}-${index}`;
    li.innerHTML = `
      <input type="checkbox" id="${checkboxId}" data-index="${index}" ${
        sub.completada ? 'checked' : ''
      }>
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

export function mostrarModal(idModal) {
  document.getElementById(idModal)?.classList.add('visible');
}

export function cerrarModal(idModal) {
  document.getElementById(idModal)?.classList.remove('visible');
}

export function mostrarConfirmacion(titulo, msg, callback) {
  const confirmTitle = document.getElementById('confirm-title');
  const confirmMsg = document.getElementById('confirm-msg');
  const aceptarBtn = document.getElementById('btn-confirm-aceptar');
  const cancelarBtn = document.getElementById('btn-confirm-cancelar');

  if (confirmTitle) confirmTitle.textContent = titulo;
  if (confirmMsg) confirmMsg.textContent = msg;

  cancelarBtn.style.display = 'inline-block';

  mostrarModal('modal-confirmacion');

  const nuevoAceptarBtn = aceptarBtn.cloneNode(true);
  aceptarBtn.parentNode.replaceChild(nuevoAceptarBtn, aceptarBtn);
  nuevoAceptarBtn.addEventListener('click', () => {
    callback();
    cerrarModal('modal-confirmacion');
  });
}

export function mostrarAlerta(titulo, msg, callback) {
  const confirmTitle = document.getElementById('confirm-title');
  const confirmMsg = document.getElementById('confirm-msg');
  const aceptarBtn = document.getElementById('btn-confirm-aceptar');
  const cancelarBtn = document.getElementById('btn-confirm-cancelar');

  if (confirmTitle) confirmTitle.textContent = titulo;
  if (confirmMsg) confirmMsg.textContent = msg;

  cancelarBtn.style.display = 'none';

  const nuevoAceptarBtn = aceptarBtn.cloneNode(true);
  aceptarBtn.parentNode.replaceChild(nuevoAceptarBtn, aceptarBtn);

  nuevoAceptarBtn.addEventListener(
    'click',
    () => {
      cerrarModal('modal-confirmacion');
      if (callback) callback();
    },
    { once: true },
  );

  mostrarModal('modal-confirmacion');
}

export function mostrarPrompt(titulo, msg, defaultValue = '') {
  return new Promise((resolve, reject) => {
    const modal = document.getElementById('modal-prompt');
    const form = document.getElementById('form-prompt');
    const titleEl = document.getElementById('prompt-title');
    const msgEl = document.getElementById('prompt-msg');
    const inputEl = document.getElementById('prompt-input');
    const aceptarBtn = document.getElementById('btn-prompt-aceptar');
    const cancelarBtn = document.getElementById('btn-prompt-cancelar');

    titleEl.textContent = titulo;
    msgEl.textContent = msg;
    inputEl.value = defaultValue;

    mostrarModal('modal-prompt');
    setTimeout(() => inputEl.focus(), 100);

    const handleSubmit = (e) => {
      e.preventDefault();
      cleanup();
      resolve(inputEl.value.trim());
    };

    const handleCancel = () => {
      cleanup();
      reject();
    };

    const cleanup = () => {
      form.removeEventListener('submit', handleSubmit);
      cancelarBtn.removeEventListener('click', handleCancel);
      cerrarModal('modal-prompt');
    };

    form.addEventListener('submit', handleSubmit);
    cancelarBtn.addEventListener('click', handleCancel);
  });
}

export function popularSelectorDeCursos(selectorElement) {
  const selector =
    selectorElement || document.getElementById('select-curso-tarea');
  if (!selector) return;

  const valorSeleccionado = selector.value;
  selector.innerHTML = '';
  state.cursos.forEach((nombreCurso) => {
    if (
      nombreCurso === 'General' &&
      state.cursos.length > 1 &&
      selector.id !== 'quick-add-curso-tarea'
    )
      return;
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

export function popularSelectorDeProyectos() {
  const selector = document.getElementById('select-proyecto-tarea');
  if (!selector) return;

  const valorSeleccionado = selector.value;

  selector.innerHTML = '<option value="">Ninguno</option>';

  state.proyectos.forEach((proyecto) => {
    const opcion = document.createElement('option');
    opcion.value = proyecto.id;
    opcion.textContent = proyecto.nombre;
    selector.appendChild(opcion);
  });

  if (valorSeleccionado) {
    selector.value = valorSeleccionado;
  }
}

export function popularSelectorDeProyectosEdicion(proyectoIdSeleccionado) {
  const selector = document.getElementById('edit-select-proyecto-tarea');
  if (!selector) return;

  selector.innerHTML = '<option value="">Ninguno</option>';

  state.proyectos.forEach((proyecto) => {
    const opcion = document.createElement('option');
    opcion.value = proyecto.id;
    opcion.textContent = proyecto.nombre;
    selector.appendChild(opcion);
  });

  if (proyectoIdSeleccionado) {
    selector.value = proyectoIdSeleccionado;
  }
}
