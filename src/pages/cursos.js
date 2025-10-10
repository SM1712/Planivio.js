import { state } from '../state.js';
import { guardarDatos } from '../utils.js';
import {
  mostrarConfirmacion,
  mostrarModal,
  cerrarModal,
  renderizarTareas,
} from '../ui.js';

/**
 * Renderiza las tarjetas de los cursos en la página de Cursos.
 */
export function renderizarCursos() {
  const container = document.getElementById('lista-cursos-container');
  if (!container) return;

  container.innerHTML = '';
  const cursosMostrables = state.cursos.filter(
    (c) => !(c === 'General' && state.cursos.length > 1),
  );

  if (cursosMostrables.length === 0) {
    container.innerHTML = '<p>No hay cursos creados. ¡Añade el primero!</p>';
    if (!state.cursos.includes('General')) state.cursos.push('General');
    return;
  }

  cursosMostrables.forEach((nombreCurso) => {
    const tareasDelCurso = state.tareas.filter((t) => t.curso === nombreCurso);
    const tareasCompletadas = tareasDelCurso.filter((t) => t.completada).length;
    const totalTareas = tareasDelCurso.length;
    const tareasPendientes = tareasDelCurso.filter((t) => !t.completada);
    const porcentaje =
      totalTareas > 0 ? (tareasCompletadas / totalTareas) * 100 : 0;

    const ordenPrioridad = { Alta: 0, Media: 1, Baja: 2 };
    const tareasPendientesOrdenadas = tareasPendientes.sort((a, b) => {
      const fechaA = new Date(a.fecha);
      const fechaB = new Date(b.fecha);
      if (fechaA - fechaB !== 0) return fechaA - fechaB;
      return ordenPrioridad[a.prioridad] - ordenPrioridad[b.prioridad];
    });
    const proximaTarea = tareasPendientesOrdenadas[0];

    let textoProximaEntrega = '¡Todo al día! 🎉';
    if (proximaTarea) {
      const [_, month, day] = proximaTarea.fecha.split('-');
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
          <button class="btn-editar-curso" title="Renombrar Curso">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="btn-eliminar-curso" title="Eliminar Curso">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        `
            : ''
        }
      </div>
    `;
    container.appendChild(card);
  });
}

export function agregarCurso(nombre) {
  if (!nombre || state.cursos.includes(nombre)) {
    alert('El nombre del curso no puede estar vacío o ya existe.');
    return;
  }
  if (state.cursos[0] === 'General' && state.cursos.length === 1) {
    state.cursos.shift();
  }
  state.cursos.push(nombre);
  guardarDatos();
  renderizarCursos();
}

export function iniciarRenombrarCurso(nombreOriginal) {
  document.getElementById('input-curso-original-nombre').value = nombreOriginal;
  document.getElementById('input-renombrar-curso-nombre').value =
    nombreOriginal;
  mostrarModal('modal-renombrar-curso');
}

export function renombrarCurso(nombreOriginal, nuevoNombre) {
  if (!nuevoNombre || state.cursos.includes(nuevoNombre)) {
    alert('El nombre del curso no puede estar vacío o ya existe.');
    return;
  }

  const index = state.cursos.indexOf(nombreOriginal);
  if (index > -1) {
    state.cursos[index] = nuevoNombre;
    state.tareas.forEach((tarea) => {
      if (tarea.curso === nombreOriginal) {
        tarea.curso = nuevoNombre;
      }
    });
    guardarDatos();
    renderizarCursos();
    if (state.paginaActual === 'tareas') renderizarTareas();
  }
}

export function eliminarCurso(nombreCurso) {
  mostrarConfirmacion(
    'Eliminar Curso',
    `¿Seguro que quieres eliminar "${nombreCurso}"? Se borrarán también todas las tareas asociadas.`,
    () => {
      state.cursos = state.cursos.filter((c) => c !== nombreCurso);
      state.tareas = state.tareas.filter((t) => t.curso !== nombreCurso);

      if (state.cursos.length === 0) {
        state.cursos.push('General');
      }

      guardarDatos();
      renderizarCursos();
      if (state.paginaActual === 'tareas') renderizarTareas();
    },
  );
}
