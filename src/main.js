import { state } from './state.js';
import {
  cargarlconos,
  renderizarTareas,
  renderizarDetalles,
  renderizarSubtareas,
  actualizariconoTogglePanel,
  mostrarModal,
  cerrarModal,
  mostrarConfirmacion,
  mostrarAlerta,
  mostrarPrompt,
  popularSelectorDeCursos,
  popularFiltroDeCursos,
  popularSelectorDeProyectos,
  popularSelectorDeProyectosEdicion,
} from './ui.js';
import {
  updateRgbVariables,
  cargarDatos,
  guardarDatos,
  hexToRgb,
  getTextColorForBg,
  darkenColor,
  exportarDatosJSON,
  importarDatosJSON,
} from './utils.js';
import { actualizarDashboard } from './pages/dashboard.js';
import {
  renderizarCursos,
  agregarCurso,
  iniciarRenombrarCurso,
  renombrarCurso,
  eliminarCurso,
} from './pages/cursos.js';
import {
  inicializarCalendario,
  renderizarCalendario,
  agregarEvento,
} from './pages/calendario.js';
import {
  inicializarApuntes,
  renderizarPaginaApuntes,
  renderizarEditor,
  popularSelectorDeCursosApuntes,
} from './pages/apuntes.js';
import {
  inicializarProyectos,
  renderizarProyectos,
} from './pages/proyectos.js';

// --- INICIALIZACIÓN DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
  cargarDatos();
  aplicarTema();
  cargarlconos();
  updateRgbVariables();
  agregarEventListeners();
  inicializarCalendario();
  cambiarPagina(state.paginaActual);
});

// --- LÓGICA DE NAVEGACIÓN ---
function cambiarPagina(idPagina) {
  state.paginaActual = idPagina;
  document
    .querySelectorAll('.page')
    .forEach((page) => page.classList.remove('visible'));
  const pageToShow = document.getElementById(`page-${idPagina}`);
  if (pageToShow) pageToShow.classList.add('visible');

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.page === idPagina);
  });

  if (idPagina !== 'tareas') {
    document
      .querySelector('.app-container')
      .classList.remove('detalle-visible');
    state.tareaSeleccionadald = null;
  }

  if (idPagina === 'tareas') {
    popularSelectorDeCursos();
    popularFiltroDeCursos();
    popularSelectorDeProyectos();
    renderizarTareas();
    renderizarDetalles();
  }
  if (idPagina === 'dashboard') {
    actualizarDashboard();
  }
  if (idPagina === 'cursos') {
    renderizarCursos();
  }
  if (idPagina === 'calendario') {
    renderizarCalendario();
  }
  if (idPagina === 'apuntes') {
    inicializarApuntes();
    renderizarPaginaApuntes();
    renderizarEditor();
    popularSelectorDeCursosApuntes();
  }
  if (idPagina === 'proyectos') {
    inicializarProyectos();
    renderizarProyectos();
  }
}

// --- MANEJADORES DE LÓGICA ---
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
  if (!texto || state.tareaSeleccionadald === null) return;

  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  if (tarea) {
    if (!tarea.subtareas) tarea.subtareas = [];
    tarea.subtareas.push({ texto: texto, completada: false });
    input.value = '';
    guardarDatos();
    renderizarSubtareas(tarea);
  }
}

function toggleSubtarea(index) {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  if (tarea && tarea.subtareas[index]) {
    tarea.subtareas[index].completada = !tarea.subtareas[index].completada;
    guardarDatos();
    renderizarSubtareas(tarea);
  }
}

function eliminarSubtarea(index) {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
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

function aplicarTema() {
  document.body.classList.toggle('dark-theme', state.config.theme === 'dark');
  cambiarColorAcento(state.config.accent_color);
  updateRgbVariables();
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

function cambiarTemaBase() {
  state.config.theme = state.config.theme === 'light' ? 'dark' : 'light';
  aplicarTema();
  guardarDatos();
}

function cambiarColorAcento(color) {
  state.config.accent_color = color;
  const root = document.documentElement;
  root.style.setProperty('--accent-color', color);

  const activeColor = darkenColor(color, 15);
  root.style.setProperty('--accent-color-active', activeColor);

  const textColor = getTextColorForBg(activeColor);
  root.style.setProperty('--accent-text-color', textColor);

  const rgb = hexToRgb(color);
  if (rgb) {
    const hoverColor = `rgba(${rgb.join(', ')}, 0.15)`;
    root.style.setProperty('--accent-color-hover', hoverColor);
    root.style.setProperty('--accent-color-rgb', rgb.join(', '));
    guardarDatos();
  }
}

function iniciarEdicionTarea() {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  if (!tarea) return;

  document.getElementById('edit-titulo-tarea').value = tarea.titulo;
  document.getElementById('edit-desc-tarea').value = tarea.descripcion;
  document.getElementById('edit-fecha-tarea').value = tarea.fecha;
  document.getElementById('edit-prioridad-tarea').value = tarea.prioridad;

  popularSelectorDeProyectosEdicion(tarea.proyectoId);

  mostrarModal('modal-editar-tarea');
}

// --- EVENT LISTENERS ---
function agregarEventListeners() {
  const configBtn = document.getElementById('btn-config-dropdown');
  const configDropdown = document.getElementById('config-dropdown');

  document.getElementById('btn-toggle-panel').addEventListener('click', () => {
    document
      .getElementById('panel-lateral')
      .classList.toggle('panel-colapsado');
    actualizariconoTogglePanel();
  });

  document.getElementById('main-nav').addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (navItem) cambiarPagina(navItem.dataset.page);
  });

  if (configBtn)
    configBtn.addEventListener('click', () =>
      configDropdown.classList.toggle('visible'),
    );

  window.addEventListener('click', (e) => {
    if (
      configDropdown &&
      configBtn &&
      !configBtn.closest('.config-container').contains(e.target)
    ) {
      configDropdown.classList.remove('visible');
    }
  });

  document
    .getElementById('btn-cambiar-tema')
    ?.addEventListener('click', cambiarTemaBase);

  document.getElementById('color-palette')?.addEventListener('click', (e) => {
    if (e.target.matches('.color-swatch[data-color]'))
      cambiarColorAcento(e.target.dataset.color);
  });

  document
    .getElementById('input-color-custom')
    ?.addEventListener('input', (e) => cambiarColorAcento(e.target.value));

  const pageTareas = document.getElementById('page-tareas');
  if (pageTareas) {
    pageTareas.addEventListener('click', (e) => {
      const fila = e.target.closest('tr[data-id]');
      const header = e.target.closest('th[data-sort]');
      const filtroBtn = e.target.closest('.btn-filtro[data-sort]');
      const deleteSubtaskBtn = e.target.closest('.btn-delete-subtask');

      if (fila) {
        state.tareaSeleccionadald = parseInt(fila.dataset.id);
        renderizarTareas();
        renderizarDetalles();
        document
          .querySelector('.app-container')
          .classList.add('detalle-visible');
        return;
      }
      if (header) {
        ordenarPor(header.dataset.sort);
        return;
      }
      if (filtroBtn) {
        ordenarPor(filtroBtn.dataset.sort);
        return;
      }
      if (deleteSubtaskBtn) {
        eliminarSubtarea(parseInt(deleteSubtaskBtn.dataset.index));
        return;
      }

      switch (e.target.id) {
        case 'btn-cerrar-detalles':
          document
            .querySelector('.app-container')
            .classList.remove('detalle-visible');
          state.tareaSeleccionadald = null;
          renderizarTareas();
          break;
        case 'btn-completar-tarea':
          const tarea = state.tareas.find(
            (t) => t.id === state.tareaSeleccionadald,
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

    pageTareas.addEventListener('submit', (e) => {
      if (e.target.id === 'form-nueva-tarea') agregarTarea(e);
    });

    pageTareas.addEventListener('keyup', (e) => {
      if (e.target.id === 'input-nueva-subtarea' && e.key === 'Enter')
        agregarSubtarea();
    });

    pageTareas.addEventListener('change', (e) => {
      const filtroCursoSelect = document.getElementById('filtro-curso');
      if (e.target === filtroCursoSelect) {
        state.filtroCurso = e.target.value;
        renderizarTareas();
        return;
      }

      if (
        e.target.closest('#lista-subtareas') &&
        e.target.type === 'checkbox'
      ) {
        toggleSubtarea(parseInt(e.target.dataset.index));
      }
    });
  }

  const pageDashboard = document.getElementById('page-dashboard');
  if (pageDashboard) {
    pageDashboard.addEventListener('click', (e) => {
      const target = e.target.closest('button[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      if (action === 'ir-a-cursos') {
        cambiarPagina('cursos');
      } else if (action === 'nueva-tarea-modal') {
        cambiarPagina('tareas');
      }
    });
  }

  const pageCursos = document.getElementById('page-cursos');
  if (pageCursos) {
    pageCursos.addEventListener('click', (e) => {
      const btnEditar = e.target.closest('.btn-editar-curso');
      const btnEliminar = e.target.closest('.btn-eliminar-curso');
      if (btnEditar) {
        const nombreCurso = btnEditar.closest('.curso-card').dataset.curso;
        iniciarRenombrarCurso(nombreCurso);
      }
      if (btnEliminar) {
        const nombreCurso = btnEliminar.closest('.curso-card').dataset.curso;
        eliminarCurso(nombreCurso);
      }
    });
  }

  const btnNuevoCurso = document.getElementById('btn-nuevo-curso');
  if (btnNuevoCurso) {
    btnNuevoCurso.addEventListener('click', () => {
      mostrarModal('modal-nuevo-curso');
    });
  }

  const formNuevoCurso = document.getElementById('form-nuevo-curso');
  if (formNuevoCurso) {
    formNuevoCurso.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputNombre = document.getElementById('input-nombre-curso');
      const nuevoNombre = inputNombre.value.trim();
      agregarCurso(nuevoNombre);
      inputNombre.value = '';
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

  const btnNuevoEvento = document.getElementById('btn-nuevo-evento');
  if (btnNuevoEvento) {
    btnNuevoEvento.addEventListener('click', () => {
      const form = document.getElementById('form-nuevo-evento');
      form.reset();
      document.getElementById('input-evento-id').value = '';
      document.getElementById('modal-evento-titulo').textContent =
        'Agregar Nuevo Evento';
      document.getElementById('btn-guardar-evento').textContent =
        'Guardar Evento';
      mostrarModal('modal-nuevo-evento');
    });
  }

  const formNuevoEvento = document.getElementById('form-nuevo-evento');
  if (formNuevoEvento) {
    formNuevoEvento.addEventListener('submit', (e) => {
      e.preventDefault();
      const datosEvento = {
        titulo: document.getElementById('input-evento-titulo').value.trim(),
        fechaInicio: document.getElementById('input-evento-inicio').value,
        fechaFin: document.getElementById('input-evento-fin').value,
        color: document.getElementById('input-evento-color').value,
      };
      const eventoId = parseInt(
        document.getElementById('input-evento-id').value,
      );

      if (eventoId) {
        const index = state.eventos.findIndex((ev) => ev.id === eventoId);
        if (index !== -1) {
          state.eventos[index] = { ...state.eventos[index], ...datosEvento };
        }
      } else {
        agregarEvento(datosEvento);
      }
      guardarDatos();
      renderizarCalendario();
      cerrarModal('modal-nuevo-evento');
    });
  }

  const paleta = document.getElementById('evento-color-palette');
  const inputColorOculto = document.getElementById('input-evento-color');
  const inputColorCustom = document.getElementById('input-evento-color-custom');
  if (paleta && inputColorOculto && inputColorCustom) {
    paleta.addEventListener('click', (e) => {
      if (e.target.matches('.color-swatch[data-color]')) {
        const color = e.target.dataset.color;
        inputColorOculto.value = color;
        inputColorCustom.value = color;
        paleta
          .querySelectorAll('.color-swatch')
          .forEach((s) => s.classList.remove('active'));
        e.target.classList.add('active');
      }
    });

    inputColorCustom.addEventListener('input', (e) => {
      const color = e.target.value;
      inputColorOculto.value = color;
      paleta
        .querySelectorAll('.color-swatch')
        .forEach((s) => s.classList.remove('active'));
    });
  }

  document
    .getElementById('btn-confirm-cancelar')
    ?.addEventListener('click', () => cerrarModal('modal-confirmacion'));

  document.querySelectorAll('[data-action="cerrar-modal"]').forEach((btn) => {
    btn.addEventListener('click', () =>
      cerrarModal(btn.closest('.modal-overlay').id),
    );
  });

  const formEditarTarea = document.getElementById('form-editar-tarea');
  if (formEditarTarea) {
    formEditarTarea.addEventListener('submit', (e) => {
      e.preventDefault();
      const tarea = state.tareas.find(
        (t) => t.id === state.tareaSeleccionadald,
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
  }

  document
    .getElementById('btn-exportar-datos')
    ?.addEventListener('click', () => {
      exportarDatosJSON(mostrarPrompt);
      document.getElementById('config-dropdown').classList.remove('visible');
    });

  document
    .getElementById('btn-importar-datos')
    ?.addEventListener('click', () => {
      mostrarConfirmacion(
        'Importar Datos',
        '¿Estás seguro? Esta acción sobreescribirá todos tus datos actuales. Se recomienda exportar primero.',
        () => {
          document.getElementById('input-importar-datos').click();
          document
            .getElementById('config-dropdown')
            .classList.remove('visible');
        },
      );
    });

  const inputImportar = document.getElementById('input-importar-datos');
  inputImportar?.addEventListener('change', (event) => {
    importarDatosJSON(event, (error, message) => {
      if (error) {
        mostrarAlerta('Error de Importación', message);
      } else {
        mostrarAlerta('Éxito', message, () => {
          location.reload();
        });
      }
    });
  });
}
