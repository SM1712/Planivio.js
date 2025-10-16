import { state } from '../state.js';
import { guardarDatos } from '../utils.js';
import { mostrarConfirmacion, mostrarModal, cerrarModal } from '../ui.js';

function renderizarCursos() {
  const container = document.getElementById('lista-cursos-container');
  if (!container) return;

  container.innerHTML = '';
  const cursosMostrables = state.cursos.filter(
    (c) => !(c === 'General' && state.cursos.length > 1),
  );

  if (cursosMostrables.length === 0) {
    container.innerHTML =
      '<p style="padding: 15px; color: var(--text-muted);">No hay cursos creados. ¡Añade el primero!</p>';
    if (!state.cursos.includes('General')) {
      state.cursos.push('General');
    }
    return;
  }

  cursosMostrables.forEach((nombreCurso) => {
    const tareasDelCurso = state.tareas.filter((t) => t.curso === nombreCurso);
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
    card.dataset.curso = nombreCurso;
    card.innerHTML = `
            <h4>${nombreCurso}</h4>
            <div class="curso-stats">
                <span class="stat-texto">${tareasCompletadas} de ${totalTareas} tareas completadas</span>
                <div class="progreso-barra-container">
                    <div class="progreso-barra-relleno" style="width: ${porcentaje}%;"></div>
                </div>
                <span class="proxima-entrega">${textoProximaEntrega}</span>
            </div>
            <div class="curso-card-actions">
                ${
                  nombreCurso !== 'General'
                    ? `
                <button class="btn-icon btn-editar-curso" title="Renombrar Curso"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                <button class="btn-icon btn-eliminar-curso" title="Eliminar Curso"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                `
                    : ''
                }
            </div>
        `;
    container.appendChild(card);
  });
}

function agregarCurso(nombre) {
  if (
    !nombre ||
    state.cursos.map((c) => c.toLowerCase()).includes(nombre.toLowerCase())
  ) {
    alert('El nombre del curso no puede estar vacío o ya existe.');
    return;
  }
  if (state.cursos[0] === 'General' && state.cursos.length === 1) {
    state.cursos.shift();
  }
  state.cursos.push(nombre);
  state.cursos.sort();
  guardarDatos();
  renderizarCursos();
}

function iniciarRenombrarCurso(nombreOriginal) {
  const inputOriginal = document.getElementById('input-curso-original-nombre');
  const inputNuevo = document.getElementById('input-renombrar-curso-nombre');
  if (inputOriginal) inputOriginal.value = nombreOriginal;
  if (inputNuevo) inputNuevo.value = nombreOriginal;
  mostrarModal('modal-renombrar-curso');
}

function renombrarCurso(nombreOriginal, nuevoNombre) {
  if (
    !nuevoNombre ||
    (nuevoNombre.toLowerCase() !== nombreOriginal.toLowerCase() &&
      state.cursos
        .map((c) => c.toLowerCase())
        .includes(nuevoNombre.toLowerCase()))
  ) {
    alert('El nuevo nombre del curso no puede estar vacío o ya existe.');
    return;
  }
  const index = state.cursos.indexOf(nombreOriginal);
  if (index > -1) {
    state.cursos[index] = nuevoNombre;
    state.cursos.sort();
    state.tareas.forEach((tarea) => {
      if (tarea.curso === nombreOriginal) {
        tarea.curso = nuevoNombre;
      }
    });
    guardarDatos();
    renderizarCursos();
    if (state.paginaActual === 'tareas') {
      document.querySelector('.nav-item[data-page="tareas"]')?.click();
    }
  }
}

function eliminarCurso(nombreCurso) {
  mostrarConfirmacion(
    'Eliminar Curso',
    `¿Seguro que quieres eliminar "${nombreCurso}"? Se borrarán también todas las tareas y apuntes asociados.`,
    () => {
      state.cursos = state.cursos.filter((c) => c !== nombreCurso);
      state.tareas = state.tareas.filter((t) => t.curso !== nombreCurso);
      state.apuntes = state.apuntes.filter((a) => a.curso !== nombreCurso);
      if (state.cursos.length === 0) {
        state.cursos.push('General');
      }
      guardarDatos();
      renderizarCursos();
    },
  );
}

export function inicializarCursos() {
  renderizarCursos();

  const pageCursos = document.getElementById('page-cursos');
  if (pageCursos) {
    pageCursos.addEventListener('click', (e) => {
      if (e.target.closest('#btn-nuevo-curso')) {
        mostrarModal('modal-nuevo-curso');
      }

      const card = e.target.closest('.curso-card');
      if (!card) return;

      const btnEditar = e.target.closest('.btn-editar-curso');
      if (btnEditar) {
        iniciarRenombrarCurso(card.dataset.curso);
        return;
      }

      const btnEliminar = e.target.closest('.btn-eliminar-curso');
      if (btnEliminar) {
        eliminarCurso(card.dataset.curso);
        return;
      }
    });
  }

  const formNuevoCurso = document.getElementById('form-nuevo-curso');
  if (formNuevoCurso) {
    formNuevoCurso.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputNombre = document.getElementById('input-nombre-curso');
      if (inputNombre) {
        agregarCurso(inputNombre.value.trim());
        inputNombre.value = '';
      }
      cerrarModal('modal-nuevo-curso');
    });
  }

  const formRenombrarCurso = document.getElementById('form-renombrar-curso');
  if (formRenombrarCurso) {
    formRenombrarCurso.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombreOriginal = document.getElementById(
        'input-curso-original-nombre',
      ).value;
      const nuevoNombre = document
        .getElementById('input-renombrar-curso-nombre')
        .value.trim();
      renombrarCurso(nombreOriginal, nuevoNombre);
      cerrarModal('modal-renombrar-curso');
    });
  }
}
