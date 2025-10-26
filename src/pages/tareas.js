// ===================================
// ==          IMPORTACIONES        ==
// ===================================
import { state } from '../state.js';
import { guardarDatos } from '../utils.js';
import {
  popularSelectorDeCursos,
  popularFiltroDeCursos, // AUNQUE EL FILTRO CAMBIÓ, LA FUNCIÓN DE UI PODRÍA USARSE EN OTRO LADO
  popularSelectorDeProyectos,
  popularSelectorDeProyectosEdicion,
  mostrarModal,
  cerrarModal,
  mostrarConfirmacion,
  cargarIconos,
} from '../ui.js';
import { ICONS } from '../icons.js';

let activeDropdown = null;
let activeDropdownButton = null;
let activeFiltroDropdown = null;
let tareasGlobalClickHandler = null;
// ======================================================
// ==        HELPER FUNCTIONS FOR THIS MODULE         ==
// ======================================================

// ... (renderizarTareas SIN CAMBIOS INTERNOS, llama a getTareasVisiblesFiltradas) ...
function renderizarTareas() {
  const tbody = document.getElementById('tabla-tareas-body');
  if (!tbody) {
    console.error('Error: Elemento #tabla-tareas-body no encontrado.');
    return;
  }
  const isMobileView = window.innerWidth <= 900;
  // --- Filtrado ---
  let tareasAMostrar = getTareasVisiblesFiltradas(); // <= YA INCLUYE FILTRO DE ARCHIVADOS
  // --- Ordenamiento ---
  const col = state.ordenamiento?.col || 'fecha';
  const reverse = state.ordenamiento?.reverse || false;
  const tareasOrdenadas = [...tareasAMostrar].sort((a, b) => {
    if (a.completada !== b.completada) return a.completada ? 1 : -1;
    let valA, valB;
    if (col === 'prioridad') {
      const orden = { Alta: 0, Media: 1, Baja: 2 };
      valA = orden[a.prioridad] ?? 3;
      valB = orden[b.prioridad] ?? 3;
    } else if (col === 'fecha') {
      valA = a.fecha
        ? new Date(a.fecha + 'T00:00:00')
        : reverse
          ? new Date(0)
          : new Date(8640000000000000);
      valB = b.fecha
        ? new Date(b.fecha + 'T00:00:00')
        : reverse
          ? new Date(0)
          : new Date(8640000000000000);
    } else {
      valA = String(a[col] || '').toLowerCase();
      valB = String(b[col] || '').toLowerCase();
    }
    if (valA < valB) return reverse ? 1 : -1;
    if (valA > valB) return reverse ? -1 : 1;
    return 0;
  });
  const tareasFinales = tareasOrdenadas;
  // --- Helper Clase Vencimiento ---
  const obtenerClaseVencimiento = (fechaTareaStr) => {
    if (!fechaTareaStr) return 'tarea-sin-fecha';
    let fechaTarea;
    try {
      fechaTarea = new Date(fechaTareaStr + 'T00:00:00');
      if (isNaN(fechaTarea.getTime())) throw new Error('Inv Date');
    } catch (e) {
      return 'tarea-sin-fecha';
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diffTiempo = fechaTarea.getTime() - hoy.getTime();
    const diffDias = Math.floor(diffTiempo / (1000 * 60 * 60 * 24));
    if (diffDias < 0) return 'tarea-vencida';
    if (diffDias === 0) return 'tarea-hoy';
    if (diffDias === 1) return 'tarea-manana';
    if (diffDias <= 3) return 'tarea-cercana';
    return 'tarea-lejana';
  };
  // --- Renderizado de Filas ---
  tbody.innerHTML = '';
  tareasFinales.forEach((tarea) => {
    const tr = document.createElement('tr');
    tr.dataset.id = tarea.id;
    let claseVencimiento = '';
    if (tarea.completada) {
      tr.classList.add('tarea-completada');
    } else {
      claseVencimiento = obtenerClaseVencimiento(tarea.fecha);
      tr.classList.add(claseVencimiento);
    }
    if (tarea.id === state.tareaSeleccionadald) {
      // Typo 'ld' mantenido
      tr.classList.add('selected-task');
    }
    const [year, month, day] =
      tarea.fecha && !isNaN(new Date(tarea.fecha + 'T00:00:00'))
        ? tarea.fecha.split('-')
        : ['--', '--', '--'];
    const fechaFormateada = `${day}/${month}/${year}`;
    let rowHTML = '';
    const menuButtonHTML = `
        <div class="tarea-menu-container">
             <button class="btn-icon btn-tarea-menu" data-action="toggle-menu" aria-label="Acciones para tarea ${tarea.titulo || ''}">
                 ${ICONS.dots_vertical || '...'}
             </button>
             <div class="tarea-actions-dropdown">
                 <button data-action="editar-tarea-menu"><span>${ICONS.edit || ''}</span>Editar</button>
                 <button data-action="seleccionar-tarea-menu"><span>${ICONS.select_mode || '☐'}</span>Seleccionar</button>
                 <button data-action="eliminar-tarea-menu" class="btn-eliminar-item"><span>${ICONS.delete || ''}</span>Eliminar</button>
             </div>
         </div>
    `;
    if (isMobileView) {
      rowHTML = `
        <td class="celda-muesca"><span class="muesca-vencimiento"></span></td>
        <td colspan="4" class="tarea-movil-celda">
            <div class="tarea-movil-contenido">
                <div class="tarea-movil-info-principal">
                    <span class="prioridad-indicador prioridad-${tarea.prioridad?.toLowerCase() || 'baja'}"></span>
                    <span class="tarea-movil-titulo">${tarea.titulo || '(Sin título)'}</span>
                </div>
                <div class="tarea-movil-info-secundaria">
                     <span class="tarea-movil-fecha">${fechaFormateada}</span>
                     <span class="tarea-movil-curso">${tarea.curso || 'General'}</span>
                </div>
            </div>
        </td>
      `;
    } else {
      rowHTML = `
        <td class="celda-muesca"><span class="muesca-vencimiento"></span></td>
        <td><div class="cell-content-wrapper">${tarea.curso || 'General'}</div></td>
        <td class="col-prioridad">
          <div class="cell-content-wrapper">
            <span class="prioridad-indicador prioridad-${tarea.prioridad?.toLowerCase() || 'baja'}"></span>
          </div>
        </td>
        <td><div class="cell-content-wrapper">${tarea.titulo || '(Sin título)'}</div></td>
        <td><div class="cell-content-wrapper">${fechaFormateada}</div></td>
        <td class="col-acciones">
               <div class="cell-content-wrapper">
                  ${menuButtonHTML}
               </div>
          </td>
      `;
    }
    tr.innerHTML = rowHTML;
    tbody.appendChild(tr);
  });
  // --- Actualizar Contador Título ---
  const tituloPendientes = document.getElementById('titulo-tareas-pendientes');
  if (tituloPendientes) {
    const countPendientes = tareasAMostrar.filter((t) => !t.completada).length;
    tituloPendientes.textContent = `Tareas Pendientes (${countPendientes})`;
  }
  // --- ACTUALIZAR BOTÓN DE FILTROS ---
  actualizarBotonFiltros();
}

/**
 * ACTUALIZADO: Obtiene la lista de tareas visibles filtradas
 * (por curso, proyecto Y ahora excluyendo archivados).
 */
function getTareasVisiblesFiltradas() {
  let tareasAMostrar = state.tareas;

  // 1. Filtrar por Curso seleccionado
  if (state.filtroCurso && state.filtroCurso !== 'todos') {
    tareasAMostrar = tareasAMostrar.filter(
      (t) => t.curso === state.filtroCurso,
    );
  }

  // 2. Filtrar por Proyecto seleccionado
  if (state.filtroProyecto && state.filtroProyecto !== 'todos') {
    tareasAMostrar = tareasAMostrar.filter(
      // (Mantenemos la lógica anterior, asumiendo proyectold es typo y debería ser proyectoId)
      (t) => t.proyectold === parseInt(state.filtroProyecto),
    );
  }

  // 3. NUEVO: Filtrar tareas cuyo curso esté archivado
  tareasAMostrar = tareasAMostrar.filter((tarea) => {
    // Busca el curso asociado a la tarea
    const cursoAsociado = state.cursos.find((c) => c.nombre === tarea.curso);
    // Si el curso existe Y está archivado, la tarea NO se muestra (retorna false)
    if (cursoAsociado && cursoAsociado.isArchivado) {
      return false;
    }
    // Si el curso no existe (ej. 'General' o un curso eliminado) o no está archivado, se muestra
    return true;
  });

  return tareasAMostrar;
}

// ... (El resto de las funciones: actualizarBotonFiltros, repopularMenuFiltros, completarTareasSeleccionadas, eliminarTareasSeleccionadas, seleccionarTodasTareasVisibles, renderizarDetalles, renderizarSubtareas, ordenarPor, agregarTarea, agregarSubtarea, eliminarSubtarea, toggleSubtarea, iniciarEdicionTarea, eliminarTarea, actualizarUIModoSeleccion, iniciarModoSeleccion, salirModoSeleccion, toggleSeleccionTarea, inicializarTareas SIN CAMBIOS INTERNOS) ...
function actualizarBotonFiltros() {
  const btnLabel = document.getElementById('btn-filtros-label');
  if (!btnLabel) return;
  const filtroCurso = state.filtroCurso;
  const filtroProyecto = state.filtroProyecto;
  const ordenCol = state.ordenamiento?.col || 'fecha';
  let label = '';
  let filtrosActivos = [];
  switch (ordenCol) {
    case 'fecha':
      label = 'Ordenar: Fecha';
      break;
    case 'prioridad':
      label = 'Ordenar: Prioridad';
      break;
    case 'titulo':
      label = 'Ordenar: Título';
      break;
    case 'curso':
      label = 'Ordenar: Curso';
      break;
    default:
      label = 'Ordenar';
  }
  if (filtroCurso && filtroCurso !== 'todos') {
    const cursoObj = state.cursos.find((c) => c.nombre === filtroCurso); // Busca el objeto
    const cursoNombre = cursoObj
      ? `${cursoObj.emoji ? cursoObj.emoji + ' ' : ''}${cursoObj.nombre}`
      : filtroCurso; // Usa emoji
    filtrosActivos.push(`Curso: ${cursoNombre}`);
  }
  if (filtroProyecto && filtroProyecto !== 'todos') {
    const proyecto = state.proyectos.find(
      (p) => p.id === parseInt(filtroProyecto),
    );
    const proyectoNombre = proyecto ? proyecto.nombre : 'Proyecto';
    filtrosActivos.push(`Proy: ${proyectoNombre}`);
  }
  if (filtrosActivos.length > 0) {
    label += ` | ${filtrosActivos.join(', ')}`;
  }
  btnLabel.textContent = label;
}
function repopularMenuFiltros(menuElement) {
  const menu = menuElement;
  if (!menu) {
    console.error(
      'Error: repopularMenuFiltros fue llamado sin un elemento de menú válido.',
    );
    return;
  }
  const ordenCol = state.ordenamiento.col;
  const ordenReverse = state.ordenamiento.reverse;
  const filtroCurso = state.filtroCurso;
  const filtroProyecto = state.filtroProyecto;
  const cursoSubmenuAbierto = menu.querySelector(
    '#filtro-submenu-cursos:not(.hidden)',
  );
  const proyectoSubmenuAbierto = menu.querySelector(
    '#filtro-submenu-proyectos:not(.hidden)',
  );
  const checkIconHTML = `<span class="opcion-icon">${ICONS.check || '✓'}</span>`;
  const sortAscIconHTML = `<span class="opcion-icon">▲</span>`;
  const sortDescIconHTML = `<span class="opcion-icon">▼</span>`;
  const subMenuIconHTML = `<span class="opcion-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg></span>`;
  const emptyIconHTML = `<span class="opcion-icon"></span>`;
  let htmlMenu = `<div class="filtro-seccion-titulo">Ordenar por</div>`;
  const sortOptions = [
    { value: 'fecha', label: 'Fecha' },
    { value: 'prioridad', label: 'Prioridad' },
    { value: 'titulo', label: 'Título' },
    { value: 'curso', label: 'Curso' },
  ];
  sortOptions.forEach((opt) => {
    let icon = emptyIconHTML;
    let activoClass = '';
    if (ordenCol === opt.value) {
      icon = ordenReverse ? sortAscIconHTML : sortDescIconHTML;
      activoClass = 'opcion-activa';
    }
    htmlMenu += `<button data-action="sort" data-value="${opt.value}" class="opcion-btn ${activoClass}">${opt.label} ${icon}</button>`;
  });

  // Filtro Cursos: Ahora usa state.cursos (objetos)
  const cursosFiltrables = state.cursos.filter((c) => !c.isArchivado); // Excluye archivados
  if (cursosFiltrables.length > 0) {
    htmlMenu += `<div class="filtro-seccion-titulo">Filtrar por Curso</div>`;
    const cursoSubmenuOpenClass = cursoSubmenuAbierto ? 'abierto' : '';
    const cursoSubmenuHiddenClass = cursoSubmenuAbierto ? '' : 'hidden';
    const cursoSeleccionado = cursosFiltrables.find(
      (c) => c.nombre === filtroCurso,
    );
    const nombreCursoActivo = cursoSeleccionado
      ? `${cursoSeleccionado.emoji ? cursoSeleccionado.emoji + ' ' : ''}${cursoSeleccionado.nombre}`
      : 'Todos los Cursos';

    htmlMenu += `<button data-action="toggle-submenu" data-submenu="cursos" class="opcion-btn filtro-submenu-container ${cursoSubmenuOpenClass}"><span>${filtroCurso === 'todos' ? 'Todos los Cursos' : nombreCursoActivo}</span>${subMenuIconHTML}</button>`;
    htmlMenu += `<div id="filtro-submenu-cursos" class="filtro-submenu ${cursoSubmenuHiddenClass}">`;
    htmlMenu += `<button data-action="filter-curso" data-value="todos" class="opcion-btn ${filtroCurso === 'todos' ? 'opcion-activa' : ''}">Todos los Cursos ${filtroCurso === 'todos' ? checkIconHTML : emptyIconHTML}</button>`;
    cursosFiltrables.forEach((curso) => {
      const activoClass = filtroCurso === curso.nombre ? 'opcion-activa' : '';
      const icon = filtroCurso === curso.nombre ? checkIconHTML : emptyIconHTML;
      htmlMenu += `<button data-action="filter-curso" data-value="${curso.nombre}" class="opcion-btn ${activoClass}">${curso.emoji ? curso.emoji + ' ' : ''}${curso.nombre} ${icon}</button>`;
    });
    htmlMenu += `</div>`;
  }

  // Filtro Proyectos (sin cambios funcionales aquí)
  if (state.proyectos && state.proyectos.length > 0) {
    htmlMenu += `<div class="filtro-seccion-titulo">Filtrar por Proyecto</div>`;
    const proyectoActivo = state.proyectos.find(
      (p) => p.id === parseInt(filtroProyecto),
    );
    const nombreProyectoActivo = proyectoActivo
      ? proyectoActivo.nombre
      : 'Todos los Proyectos';
    const proySubmenuOpenClass = proyectoSubmenuAbierto ? 'abierto' : '';
    const proySubmenuHiddenClass = proyectoSubmenuAbierto ? '' : 'hidden';
    htmlMenu += `<button data-action="toggle-submenu" data-submenu="proyectos" class="opcion-btn filtro-submenu-container ${proySubmenuOpenClass}"><span>${filtroProyecto === 'todos' ? 'Todos los Proyectos' : nombreProyectoActivo}</span>${subMenuIconHTML}</button>`;
    htmlMenu += `<div id="filtro-submenu-proyectos" class="filtro-submenu ${proySubmenuHiddenClass}">`;
    htmlMenu += `<button data-action="filter-proyecto" data-value="todos" class="opcion-btn ${filtroProyecto === 'todos' ? 'opcion-activa' : ''}">Todos los Proyectos ${filtroProyecto === 'todos' ? checkIconHTML : emptyIconHTML}</button>`;
    state.proyectos.forEach((proyecto) => {
      const activoClass =
        parseInt(filtroProyecto) === proyecto.id ? 'opcion-activa' : '';
      const icon =
        parseInt(filtroProyecto) === proyecto.id
          ? checkIconHTML
          : emptyIconHTML;
      htmlMenu += `<button data-action="filter-proyecto" data-value="${proyecto.id}" class="opcion-btn ${activoClass}">${proyecto.nombre} ${icon}</button>`;
    });
    htmlMenu += `</div>`;
  }
  menu.innerHTML = htmlMenu;
}
function completarTareasSeleccionadas() {
  if (state.tareasSeleccionadasIds.length === 0) return;
  state.tareas.forEach((tarea) => {
    if (state.tareasSeleccionadasIds.includes(tarea.id)) {
      if (!tarea.completada) {
        tarea.completada = true;
        tarea.fechaCompletado = new Date().toISOString().split('T')[0];
      }
    }
  });
  guardarDatos();
  renderizarTareas();
  salirModoSeleccion();
}
function eliminarTareasSeleccionadas() {
  const count = state.tareasSeleccionadasIds.length;
  if (count === 0) return;
  mostrarConfirmacion(
    'Eliminar Tareas',
    `¿Estás seguro de que quieres eliminar ${count} tarea(s)? Esta acción no se puede deshacer.`,
    () => {
      state.tareas = state.tareas.filter(
        (tarea) => !state.tareasSeleccionadasIds.includes(tarea.id),
      );
      guardarDatos();
      renderizarTareas();
      salirModoSeleccion();
    },
  );
}
function seleccionarTodasTareasVisibles(isChecked) {
  if (isChecked) {
    const tareasVisibles = getTareasVisiblesFiltradas();
    state.tareasSeleccionadasIds = tareasVisibles.map((t) => t.id);
  } else {
    state.tareasSeleccionadasIds = [];
  }
  if (state.tareasSeleccionadasIds.length === 0) {
    salirModoSeleccion();
  } else {
    actualizarUIModoSeleccion();
  }
}
function renderizarDetalles() {
  const panel = document.getElementById('panel-detalles');
  if (!panel) return;
  const titulo = document.getElementById('det-titulo');
  const descripcion = document.getElementById('det-descripcion');
  const btnCompletar = document.getElementById('btn-completar-tarea');
  const btnEditar = document.getElementById('btn-editar-tarea');
  const btnEliminar = document.getElementById('btn-eliminar-tarea');
  const subtareasContainer = document.querySelector('.subtareas-container');
  const listaSubtareas = document.getElementById('lista-subtareas');
  const proyectoContainer = document.getElementById('det-proyecto-container');
  const proyectoNombre = document.getElementById('det-proyecto-nombre');
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald); // Era tareaSeleccionadald
  if (tarea) {
    if (titulo) titulo.textContent = tarea.titulo || '(Sin título)';
    if (descripcion)
      descripcion.textContent = tarea.descripcion || 'Sin descripción.';
    if (btnCompletar) {
      btnCompletar.textContent = tarea.completada
        ? 'Marcar como Pendiente'
        : 'Marcar como Completada';
      btnCompletar.disabled = false;
    }
    if (btnEditar) btnEditar.disabled = false;
    if (btnEliminar) btnEliminar.disabled = false;
    if (proyectoContainer && proyectoNombre) {
      if (tarea.proyectold) {
        // Typo 'ld'
        const proyecto = state.proyectos.find((p) => p.id === tarea.proyectold); // Typo 'ld'
        if (proyecto) {
          proyectoNombre.textContent = proyecto.nombre;
          proyectoContainer.style.display = 'block';
        } else {
          proyectoContainer.style.display = 'none';
        }
      } else {
        proyectoContainer.style.display = 'none';
      }
    }
    if (subtareasContainer) {
      subtareasContainer.style.display = 'flex';
      renderizarSubtareas(tarea);
    }
  } else {
    if (titulo) titulo.textContent = 'Selecciona una tarea';
    if (descripcion) descripcion.textContent = '';
    if (btnCompletar) {
      btnCompletar.textContent = 'Marcar como Completada';
      btnCompletar.disabled = true;
    }
    if (btnEditar) btnEditar.disabled = true;
    if (btnEliminar) btnEliminar.disabled = true;
    if (proyectoContainer) proyectoContainer.style.display = 'none';
    if (subtareasContainer) subtareasContainer.style.display = 'none';
    if (listaSubtareas) listaSubtareas.innerHTML = '';
  }
}
function renderizarSubtareas(tarea) {
  const listaSubtareas = document.getElementById('lista-subtareas');
  if (!listaSubtareas) return;
  listaSubtareas.innerHTML = '';
  if (!tarea.subtareas || tarea.subtareas.length === 0) return;
  tarea.subtareas.forEach((sub, index) => {
    const li = document.createElement('li');
    const checkboxId = `subtarea-${tarea.id}-${index}`;
    li.innerHTML = `
          <div class="subtarea-check-control">
            <input type="checkbox" id="${checkboxId}" data-index="${index}" ${sub.completada ? 'checked' : ''} aria-labelledby="subtarea-texto-${tarea.id}-${index}">
            <label for="${checkboxId}" class="visual-checkbox" aria-hidden="true"></label>
          </div>
          <span class="subtarea-texto" id="subtarea-texto-${tarea.id}-${index}">${sub.texto || '(Subtarea vacía)'}</span>
          <button class="btn-icon btn-delete-subtask" data-index="${index}" title="Eliminar sub-tarea" aria-label="Eliminar sub-tarea ${sub.texto || ''}">
             ${ICONS.close || '&times;'}
          </button>
        `;
    listaSubtareas.appendChild(li);
  });
}
function ordenarPor(columna) {
  if (!columna) return;
  if (state.ordenamiento.col === columna) {
    state.ordenamiento.reverse = !state.ordenamiento.reverse;
  } else {
    state.ordenamiento.col = columna;
    state.ordenamiento.reverse = false;
  }
  renderizarTareas();
}
function agregarTarea(event) {
  event.preventDefault();
  const cursoSelect = document.getElementById('select-curso-tarea');
  const proyectoSelect = document.getElementById('select-proyecto-tarea');
  const tituloInput = document.getElementById('input-titulo-tarea');
  const descInput = document.getElementById('input-desc-tarea');
  const fechaInput = document.getElementById('input-fecha-tarea');
  const prioridadSelect = document.getElementById('select-prioridad-tarea');
  if (
    !tituloInput ||
    !fechaInput ||
    !cursoSelect ||
    !proyectoSelect ||
    !descInput ||
    !prioridadSelect
  ) {
    console.error('Error: Faltan elementos en el formulario de nueva tarea.');
    alert('Error interno al agregar tarea.');
    return;
  }
  const nuevaTarea = {
    id: Date.now(),
    curso: cursoSelect.value || 'General',
    proyectold: parseInt(proyectoSelect.value) || null, // Typo 'ld'
    titulo: tituloInput.value.trim(),
    descripcion: descInput.value.trim(),
    fecha: fechaInput.value,
    prioridad: prioridadSelect.value || 'Media',
    completada: false,
    fechaCompletado: null,
    subtareas: [],
  };
  if (!nuevaTarea.titulo || !nuevaTarea.fecha) {
    alert('El título y la fecha son obligatorios.');
    return;
  }
  state.tareas.push(nuevaTarea);
  guardarDatos();
  renderizarTareas();
  popularFiltroDeCursos();
  event.target.reset();
  if (fechaInput) fechaInput.valueAsDate = new Date();
  popularSelectorDeProyectos();
  if (cursoSelect && state.cursos.length > 0) {
    const primerCursoNoGeneral = state.cursos.find(
      (c) => c.nombre !== 'General' && !c.isArchivado,
    ); // Busca objeto
    cursoSelect.value = primerCursoNoGeneral
      ? primerCursoNoGeneral.nombre
      : state.cursos[0]?.nombre || 'General'; // Usa nombre
  }
}
function agregarSubtarea() {
  const input = document.getElementById('input-nueva-subtarea');
  const texto = input?.value.trim();
  if (!texto || state.tareaSeleccionadald === null) return; // Typo 'ld'
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald); // Typo 'ld'
  if (tarea) {
    if (!Array.isArray(tarea.subtareas)) tarea.subtareas = [];
    tarea.subtareas.push({ texto, completada: false });
    if (input) input.value = '';
    guardarDatos();
    renderizarSubtareas(tarea);
  }
}
function eliminarSubtarea(index) {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald); // Typo 'ld'
  if (
    !tarea ||
    !Array.isArray(tarea.subtareas) ||
    tarea.subtareas[index] === undefined
  )
    return;
  const subTexto = tarea.subtareas[index].texto;
  mostrarConfirmacion(
    'Eliminar Sub-tarea',
    `¿Eliminar "${subTexto || '(vacía)'}"?`,
    () => {
      tarea.subtareas.splice(index, 1);
      guardarDatos();
      renderizarSubtareas(tarea);
    },
  );
}
function toggleSubtarea(index) {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald); // Typo 'ld'
  if (
    tarea &&
    Array.isArray(tarea.subtareas) &&
    tarea.subtareas[index] !== undefined
  ) {
    tarea.subtareas[index].completada = !tarea.subtareas[index].completada;
    guardarDatos();
    const checkbox = document.querySelector(
      `#lista-subtareas input[data-index="${index}"]`,
    );
    const textoSpan = document.getElementById(
      `subtarea-texto-${tarea.id}-${index}`,
    );
    if (checkbox && textoSpan) {
      textoSpan.style.textDecoration = checkbox.checked
        ? 'line-through'
        : 'none';
      textoSpan.style.color = checkbox.checked
        ? 'var(--text-muted)'
        : 'var(--text-base)';
      checkbox.checked = tarea.subtareas[index].completada;
    } else {
      renderizarSubtareas(tarea);
    }
  }
}
function iniciarEdicionTarea() {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald); // Typo 'ld'
  if (!tarea) return;
  try {
    document.getElementById('edit-titulo-tarea').value = tarea.titulo || '';
    document.getElementById('edit-desc-tarea').value = tarea.descripcion || '';
    document.getElementById('edit-fecha-tarea').value = tarea.fecha || '';
    document.getElementById('edit-prioridad-tarea').value =
      tarea.prioridad || 'Media';
    popularSelectorDeProyectosEdicion(tarea.proyectold); // Typo 'ld'
    mostrarModal('modal-editar-tarea');
  } catch (error) {
    console.error('Error al poblar o mostrar el modal de edición:', error);
    alert('Error al abrir el editor de tareas.');
  }
}
function eliminarTarea(idAEliminar) {
  if (idAEliminar === null || idAEliminar === undefined) return;
  const tareaIndex = state.tareas.findIndex((t) => t.id === idAEliminar);
  if (tareaIndex === -1) return;
  state.tareas.splice(tareaIndex, 1);
  if (state.tareaSeleccionadald === idAEliminar) {
    // Typo 'ld'
    state.tareaSeleccionadald = null; // Typo 'ld'
    document
      .querySelector('.app-container')
      ?.classList.remove('detalle-visible');
    renderizarDetalles();
  }
  guardarDatos();
  renderizarTareas();
  popularFiltroDeCursos();
}
function eliminarTareaSeleccionada() {
  // Esta función parece redundante ahora
  console.warn(
    'eliminarTareaSeleccionada llamada - usar lógica del listener global',
  );
}
function actualizarUIModoSeleccion() {
  const panelCentral = document.querySelector('#page-tareas .panel-central');
  const headerNormal = panelCentral?.querySelector('.panel-header');
  const headerContextual = document.getElementById('tareas-header-contextual');
  const tablaBody = document.getElementById('tabla-tareas-body');
  const selectAllCheckbox = document.getElementById('seleccionar-todas-tareas');
  const totalSeleccionadas = state.tareasSeleccionadasIds.length;
  const tareasVisibles = getTareasVisiblesFiltradas();
  const totalVisibles = tareasVisibles.length;
  if (!panelCentral || !headerNormal || !headerContextual || !tablaBody) return;
  const enModoSeleccion = state.tareasEnModoSeleccion;
  headerNormal.style.display = enModoSeleccion ? 'none' : 'flex';
  headerContextual.style.display = enModoSeleccion ? 'flex' : 'none';
  tablaBody.classList.toggle('modo-seleccion-activo', enModoSeleccion);
  if (enModoSeleccion) {
    const contador = headerContextual.querySelector('#seleccion-contador');
    if (contador)
      contador.textContent = `${totalSeleccionadas} seleccionada(s)`;
    if (selectAllCheckbox) {
      if (totalSeleccionadas === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else if (totalSeleccionadas === totalVisibles && totalVisibles > 0) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
      }
    }
    const filas = tablaBody.querySelectorAll('tr[data-id]');
    filas.forEach((fila) => {
      const tareaId = parseInt(fila.dataset.id, 10);
      const isSelected = state.tareasSeleccionadasIds.includes(tareaId);
      fila.classList.toggle('seleccionada-en-modo', isSelected);
    });
  } else {
    tablaBody
      .querySelectorAll('tr.seleccionada-en-modo')
      .forEach((fila) => fila.classList.remove('seleccionada-en-modo'));
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  }
}
function iniciarModoSeleccion(tareaIdInicial) {
  if (!state.tareasEnModoSeleccion) {
    state.tareasEnModoSeleccion = true;
    state.tareasSeleccionadasIds = [];
    if (tareaIdInicial !== null && tareaIdInicial !== undefined) {
      state.tareasSeleccionadasIds.push(tareaIdInicial);
    }
    const appContainer = document.querySelector('.app-container');
    if (appContainer?.classList.contains('detalle-visible')) {
      state.tareaSeleccionadald = null; // Typo 'ld'
      appContainer.classList.remove('detalle-visible');
      renderizarDetalles();
    }
    actualizarUIModoSeleccion();
  } else {
    toggleSeleccionTarea(tareaIdInicial);
  }
}
function salirModoSeleccion() {
  if (state.tareasEnModoSeleccion) {
    state.tareasEnModoSeleccion = false;
    state.tareasSeleccionadasIds = [];
    actualizarUIModoSeleccion();
  }
}
function toggleSeleccionTarea(tareaId) {
  if (!state.tareasEnModoSeleccion || tareaId === null || tareaId === undefined)
    return;
  const index = state.tareasSeleccionadasIds.indexOf(tareaId);
  if (index > -1) {
    state.tareasSeleccionadasIds.splice(index, 1);
  } else {
    state.tareasSeleccionadasIds.push(tareaId);
  }
  if (state.tareasSeleccionadasIds.length === 0) {
    salirModoSeleccion();
  } else {
    actualizarUIModoSeleccion();
  }
}
export function inicializarTareas(pageElement) {
  let touchStartX = 0,
    touchStartY = 0,
    touchEndX = 0,
    touchEndY = 0;
  let swipedRow = null,
    swipeBackgroundBar = null;
  const swipeThreshold = 50,
    feedbackThreshold = 30,
    swipeMaxVertical = 30;
  let isSwiping = false,
    positioningParent = null;
  let longPressTimer = null;
  let pressStartX = 0,
    pressStartY = 0;
  const longPressDuration = 500;
  try {
    cargarIconos();
    popularSelectorDeCursos(
      document.getElementById('select-curso-tarea'),
      true,
    );
    popularSelectorDeProyectos();
    const btnCompletarSel = document.getElementById(
      'btn-completar-seleccionadas',
    );
    const btnEliminarSel = document.getElementById(
      'btn-eliminar-seleccionadas',
    );
    const btnCancelarSel = document.getElementById('btn-cancelar-seleccion');
    const checkAllIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.77 4.93l-1.41-1.41-8.36 8.36-3.54-3.54-1.41 1.41 4.95 4.95zM4.23 12.05l-1.41-1.41-1.41 1.41 1.41 1.41 1.41-1.41zM11.23 12.05l-1.41-1.41-1.41 1.41 1.41 1.41 1.41-1.41z"/></svg>';
    if (btnCompletarSel)
      btnCompletarSel.innerHTML = ICONS.check_all || checkAllIcon;
    if (btnEliminarSel) btnEliminarSel.innerHTML = ICONS.delete;
    if (btnCancelarSel) btnCancelarSel.innerHTML = ICONS.close;
  } catch (error) {
    console.error('Error durante initial setup:', error);
  }
  try {
    renderizarTareas();
    renderizarDetalles();
  } catch (error) {
    console.error('Error durante el renderizado inicial:', error);
  }
  if (state.tareaSeleccionadald) {
    // Usamos requestAnimationFrame simple para asegurar que el elemento exista
    requestAnimationFrame(() => {
      const tareaElemento = document.querySelector(
        `tr[data-id="${state.tareaSeleccionadald}"]`, // <--- El typo, lo dejamos como está
      );
      if (tareaElemento) {
        console.log(
          `Intentando hacer scroll (manual) a tarea ID: ${state.tareaSeleccionadald}`,
        );

        // ===========================================
        // ==          INICIO DE LA CORRECCIÓN      ==
        // ===========================================

        // 1. Identificamos el contenedor que SÍ debe hacer scroll
        //    (Lo tomo de tu código de swipe, línea 1222)
        const scrollContainer = document.querySelector(
          '#page-tareas .tabla-container',
        );

        if (scrollContainer) {
          // 2. Calculamos las posiciones relativas
          const containerRect = scrollContainer.getBoundingClientRect();
          const taskRect = tareaElemento.getBoundingClientRect();

          // 3. Posición del 'top' de la tarea RELATIVO al 'top' del contenedor
          const taskTopRelativeToContainer = taskRect.top - containerRect.top;

          // 4. Calculamos un offset para centrarla (imitando tu 'block: 'center'')
          const containerHeight = scrollContainer.clientHeight;
          const taskHeight = tareaElemento.offsetHeight;
          const offset = containerHeight / 2 - taskHeight / 2;

          // 5. El nuevo scrollTop es:
          //    (scroll actual) + (posición relativa de la tarea) - (offset para centrar)
          const newScrollTop =
            scrollContainer.scrollTop + taskTopRelativeToContainer - offset;

          // 6. Usamos scrollTo() en el contenedor correcto
          scrollContainer.scrollTo({
            top: newScrollTop,
            behavior: 'smooth',
          });
        } else {
          // Fallback por si no encuentra el contenedor (comportamiento antiguo)
          console.warn(
            "No se encontró '.tabla-container', usando scrollIntoView() de emergencia.",
          );
          tareaElemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // ===========================================
        // ==           FIN DE LA CORRECCIÓN        ==
        // ===========================================

        // Resaltado temporal
        tareaElemento.classList.add('resaltado-temporal');
        setTimeout(() => {
          tareaElemento.classList.remove('resaltado-temporal');
        }, 2500);
      } else {
        console.warn(
          `Elemento tarea no encontrado (rAF): ID ${state.tareaSeleccionadald}`,
        );
      }
    });
  }
  const appContainer = document.querySelector('.app-container');
  if (appContainer)
    appContainer.classList.toggle(
      'detalle-visible',
      state.tareaSeleccionadald !== null,
    );
  // Typo 'ld'
  else console.error("Contenedor principal '.app-container' no encontrado.");
  const pageTareas = pageElement;
  if (!pageTareas) {
    console.error(
      'Error: inicializarTareas fue llamado sin un elemento de página.',
    );
    return;
  }
  if (tareasGlobalClickHandler) {
    document.removeEventListener('click', tareasGlobalClickHandler);
    tareasGlobalClickHandler = null;
  }
  tareasGlobalClickHandler = (e) => {
    if (
      !activeDropdown &&
      !activeFiltroDropdown &&
      state.paginaActual !== 'tareas'
    )
      return;
    const currentPageTareas = document.getElementById('page-tareas');
    const isClickInsidePage = currentPageTareas
      ? currentPageTareas.contains(e.target)
      : false;
    const isClickInsideActiveDropdown = activeDropdown
      ? activeDropdown.contains(e.target)
      : false;
    const isClickInsideFiltroDropdown = activeFiltroDropdown
      ? activeFiltroDropdown.contains(e.target)
      : false;
    const menuButton = e.target.closest('.btn-tarea-menu');
    const dropdownOptionButton = e.target.closest(
      '.tarea-actions-dropdown-active button[data-action]',
    );
    const filtroMenuButton = e.target.closest('#btn-filtros-dropdown');
    const filtroDropdownOption = e.target.closest(
      '#menu-filtros-dropdown-active .opcion-btn',
    );
    if (dropdownOptionButton && isClickInsideActiveDropdown) {
      e.stopPropagation();
      const action = dropdownOptionButton.dataset.action;
      const taskId = activeDropdownButton
        ? parseInt(activeDropdownButton.closest('tr[data-id]')?.dataset.id, 10)
        : null;
      if (activeDropdown) activeDropdown.remove();
      activeDropdown = null;
      activeDropdownButton = null;
      if (taskId !== null) {
        switch (action) {
          case 'editar-tarea-menu':
            if (state.tareaSeleccionadald !== taskId)
              state.tareaSeleccionadald = taskId; // Typo 'ld'
            iniciarEdicionTarea();
            break;
          case 'seleccionar-tarea-menu':
            iniciarModoSeleccion(taskId);
            break;
          case 'eliminar-tarea-menu':
            const tarea = state.tareas.find((t) => t.id === taskId);
            if (tarea)
              mostrarConfirmacion(
                `Eliminar Tarea`,
                `¿Eliminar "${tarea.titulo}"?`,
                () => eliminarTarea(taskId),
              );
            break;
        }
      }
      return;
    } else if (filtroDropdownOption && isClickInsideFiltroDropdown) {
      e.stopPropagation();
      const action = filtroDropdownOption.dataset.action;
      const value = filtroDropdownOption.dataset.value;
      if (action === 'sort') {
        if (state.ordenamiento.col === value)
          state.ordenamiento.reverse = !state.ordenamiento.reverse;
        else {
          state.ordenamiento.col = value;
          state.ordenamiento.reverse = false;
        }
      } else if (action === 'filter-curso') {
        state.filtroCurso = value;
      } else if (action === 'filter-proyecto') {
        state.filtroProyecto = value;
      } else if (action === 'toggle-submenu') {
        const submenuId = `filtro-submenu-${filtroDropdownOption.dataset.submenu}`;
        const submenu = activeFiltroDropdown?.querySelector(`#${submenuId}`);
        if (submenu) {
          submenu.classList.toggle('hidden');
          filtroDropdownOption.classList.toggle('abierto');
        }
        return;
      } else {
        return;
      }
      renderizarTareas();
      if (activeFiltroDropdown) repopularMenuFiltros(activeFiltroDropdown);
      return;
    } else if (menuButton && isClickInsidePage) {
      e.stopPropagation();
      if (activeFiltroDropdown) {
        activeFiltroDropdown.remove();
        activeFiltroDropdown = null;
        document
          .getElementById('btn-filtros-dropdown')
          ?.classList.remove('active');
      }
      if (activeDropdown && activeDropdownButton !== menuButton) {
        activeDropdown.remove();
        activeDropdown = null;
        activeDropdownButton = null;
      }
      if (activeDropdown && activeDropdownButton === menuButton) {
        activeDropdown.remove();
        activeDropdown = null;
        activeDropdownButton = null;
        return;
      }
      const row = menuButton.closest('tr[data-id]');
      const template = row?.querySelector('.tarea-actions-dropdown');
      if (!template) return;
      activeDropdown = template.cloneNode(true);
      activeDropdown.classList.add('tarea-actions-dropdown-active');
      activeDropdown.style.visibility = 'hidden';
      document.body.appendChild(activeDropdown);
      activeDropdownButton = menuButton;
      const btnRect = menuButton.getBoundingClientRect();
      const menuRect = activeDropdown.getBoundingClientRect();
      const margin = 10;
      let left = btnRect.left - menuRect.width - 5;
      if (left < margin) left = btnRect.right + 5;
      let top = btnRect.top + btnRect.height / 2 - menuRect.height / 2;
      if (top + menuRect.height > window.innerHeight - margin)
        top = btnRect.bottom - menuRect.height;
      if (top < margin) top = margin;
      activeDropdown.style.left = `${left}px`;
      activeDropdown.style.top = `${top}px`;
      requestAnimationFrame(() => {
        if (activeDropdown) activeDropdown.style.visibility = 'visible';
      });
      return;
    } else if (filtroMenuButton && isClickInsidePage) {
      e.stopPropagation();
      if (activeDropdown) {
        activeDropdown.remove();
        activeDropdown = null;
        activeDropdownButton = null;
      }
      if (activeFiltroDropdown) {
        activeFiltroDropdown.remove();
        activeFiltroDropdown = null;
        filtroMenuButton.classList.remove('active');
      } else {
        const template = document.getElementById('menu-filtros-dropdown');
        if (template) {
          activeFiltroDropdown = template.cloneNode(true);
          activeFiltroDropdown.id = 'menu-filtros-dropdown-active';
          document.body.appendChild(activeFiltroDropdown);
          const btnRect = filtroMenuButton.getBoundingClientRect();
          activeFiltroDropdown.style.visibility = 'hidden';
          const menuRect = activeFiltroDropdown.getBoundingClientRect();
          const margin = 10;
          let left = btnRect.left;
          if (btnRect.left + menuRect.width > window.innerWidth - margin)
            left = btnRect.right - menuRect.width;
          if (left < margin) left = margin;
          let top = btnRect.bottom + 4;
          if (top + menuRect.height > window.innerHeight - margin)
            top = btnRect.top - menuRect.height - 4;
          if (top < margin) top = margin;
          activeFiltroDropdown.style.left = `${left}px`;
          activeFiltroDropdown.style.top = `${top}px`;
          repopularMenuFiltros(activeFiltroDropdown);
          requestAnimationFrame(() => {
            if (activeFiltroDropdown) {
              activeFiltroDropdown.style.visibility = 'visible';
              activeFiltroDropdown.classList.add('visible');
              filtroMenuButton.classList.add('active');
            }
          });
        }
      }
      return;
    } else {
      let menuFueCerrado = false;
      if (activeDropdown && !isClickInsideActiveDropdown) {
        activeDropdown.remove();
        activeDropdown = null;
        activeDropdownButton = null;
        menuFueCerrado = true;
      }
      if (activeFiltroDropdown && !isClickInsideFiltroDropdown) {
        activeFiltroDropdown.remove();
        document
          .getElementById('btn-filtros-dropdown')
          ?.classList.remove('active');
        activeFiltroDropdown = null;
        menuFueCerrado = true;
      }
      if (menuFueCerrado) return;
      if (isClickInsidePage) {
        const fila = e.target.closest('#tabla-tareas-body tr[data-id]');
        const cerrarDetallesBtn = e.target.closest('#btn-cerrar-detalles');
        const contextualHeaderButton = e.target.closest(
          '#tareas-header-contextual button[data-action]',
        );
        if (contextualHeaderButton) {
          const action = contextualHeaderButton.dataset.action;
          switch (action) {
            case 'cancelar-seleccion':
              salirModoSeleccion();
              break;
            case 'completar-seleccion':
              completarTareasSeleccionadas();
              break;
            case 'eliminar-seleccion':
              eliminarTareasSeleccionadas();
              break;
          }
          return;
        } else if (fila) {
          const taskId = parseInt(fila.dataset.id, 10);
          if (state.tareasEnModoSeleccion) toggleSeleccionTarea(taskId);
          else if (state.tareaSeleccionadald !== taskId) {
            // Typo 'ld'
            state.tareaSeleccionadald = taskId; // Typo 'ld'
            guardarDatos();
            renderizarTareas();
            renderizarDetalles();
            appContainer?.classList.add('detalle-visible');
          }
          return;
        } else if (cerrarDetallesBtn) {
          state.tareaSeleccionadald = null; // Typo 'ld'
          guardarDatos();
          appContainer?.classList.remove('detalle-visible');
          renderizarTareas();
          renderizarDetalles();
          return;
        }
      }
    }
  };
  document.addEventListener('click', tareasGlobalClickHandler);
  const checkSelectAll = document.getElementById('seleccionar-todas-tareas');
  if (checkSelectAll && !checkSelectAll.dataset.listenerAttached) {
    checkSelectAll.dataset.listenerAttached = 'true';
    checkSelectAll.addEventListener('change', (e) => {
      if (!state.tareasEnModoSeleccion) return;
      seleccionarTodasTareasVisibles(e.target.checked);
    });
  }
  const tablaBody = document.getElementById('tabla-tareas-body');
  if (tablaBody && !tablaBody.dataset.longPressListener) {
    tablaBody.dataset.longPressListener = 'true';
    tablaBody.addEventListener(
      'touchstart',
      (e) => {
        if (isSwiping || state.tareasEnModoSeleccion || e.touches.length > 1) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          return;
        }
        const touch = e.touches[0];
        pressStartX = touch.clientX;
        pressStartY = touch.clientY;
        touchEndX = touch.clientX;
        touchEndY = touch.clientY;
        const fila = e.target.closest('tr[data-id]');
        if (!fila) return;
        const tareaId = parseInt(fila.dataset.id, 10);
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          const currentDiffX = Math.abs(touchEndX - pressStartX);
          const currentDiffY = Math.abs(touchEndY - pressStartY);
          if (currentDiffX < 10 && currentDiffY < 10) {
            iniciarModoSeleccion(tareaId);
          }
          longPressTimer = null;
        }, longPressDuration);
      },
      { passive: true },
    );
    tablaBody.addEventListener(
      'touchmove',
      (e) => {
        const touch = e.touches[0];
        touchEndX = touch.clientX;
        touchEndY = touch.clientY;
        if (longPressTimer) {
          const diffX = Math.abs(touchEndX - pressStartX);
          const diffY = Math.abs(touchEndY - pressStartY);
          if (diffX > 10 || diffY > 10) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }
      },
      { passive: true },
    );
    const cancelLongPress = () => {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    };
    tablaBody.addEventListener('touchend', cancelLongPress);
    tablaBody.addEventListener('touchcancel', cancelLongPress);
  }
  if (tablaBody && !tablaBody.dataset.dblClickListener) {
    tablaBody.dataset.dblClickListener = 'true';
    tablaBody.addEventListener('dblclick', (e) => {
      const fila = e.target.closest('tr[data-id]');
      if (
        !fila ||
        window.getSelection().toString() ||
        state.tareasEnModoSeleccion
      )
        return;
      const tareaId = parseInt(fila.dataset.id, 10);
      const tarea = state.tareas.find((t) => t.id === tareaId);
      if (tarea) {
        tarea.completada = !tarea.completada;
        tarea.fechaCompletado = tarea.completada
          ? new Date().toISOString().split('T')[0]
          : null;
        guardarDatos();
        renderizarTareas();
        if (tareaId === state.tareaSeleccionadald) renderizarDetalles(); // Typo 'ld'
      }
    });
  }
  const panelDetalles = document.getElementById('panel-detalles');
  if (panelDetalles && !panelDetalles.dataset.clickListener) {
    panelDetalles.dataset.clickListener = 'true';
    panelDetalles.addEventListener('click', (e) => {
      const completarBtn = e.target.closest('#btn-completar-tarea');
      const editarBtn = e.target.closest('#btn-editar-tarea');
      const eliminarBtn = e.target.closest('#btn-eliminar-tarea');
      const addSubtareaBtn = e.target.closest('#btn-agregar-subtarea');
      const deleteSubtaskBtn = e.target.closest('.btn-delete-subtask');
      const subtareaCheckbox = e.target.closest(
        '#lista-subtareas input[type="checkbox"]',
      );
      if (completarBtn && !completarBtn.disabled) {
        const tarea = state.tareas.find(
          (t) => t.id === state.tareaSeleccionadald,
        ); // Typo 'ld'
        if (tarea) {
          tarea.completada = !tarea.completada;
          tarea.fechaCompletado = tarea.completada
            ? new Date().toISOString().split('T')[0]
            : null;
          guardarDatos();
          renderizarTareas();
          renderizarDetalles();
        }
        return;
      }
      if (editarBtn && !editarBtn.disabled) {
        iniciarEdicionTarea();
        return;
      }
      if (eliminarBtn && !eliminarBtn.disabled) {
        const tarea = state.tareas.find(
          (t) => t.id === state.tareaSeleccionadald,
        ); // Typo 'ld'
        if (tarea) {
          mostrarConfirmacion(
            'Eliminar Tarea',
            `¿Eliminar "${tarea.titulo}"?`,
            () => {
              eliminarTarea(state.tareaSeleccionadald);
            },
          );
        } // Typo 'ld'
        return;
      }
      if (addSubtareaBtn) {
        agregarSubtarea();
        return;
      }
      if (deleteSubtaskBtn) {
        const index = parseInt(deleteSubtaskBtn.dataset.index, 10);
        eliminarSubtarea(index);
        return;
      }
      if (subtareaCheckbox) {
        const index = parseInt(subtareaCheckbox.dataset.index, 10);
        toggleSubtarea(index);
        return;
      }
    });
  }
  if (tablaBody && !tablaBody.dataset.touchListenersBar) {
    tablaBody.dataset.touchListenersBar = 'true';
    positioningParent = document.querySelector('.tabla-container');
    if (
      positioningParent &&
      window.getComputedStyle(positioningParent).position === 'static'
    ) {
      positioningParent.style.position = 'relative';
    }
    tablaBody.addEventListener(
      'touchstart',
      (e) => {
        if (state.tareasEnModoSeleccion) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        swipedRow = e.target.closest('tr[data-id]');
        isSwiping = false;
        swipeBackgroundBar = null;
        touchEndX = touchStartX;
        touchEndY = touchStartY;
        document
          .querySelectorAll('.swipe-background-bar')
          .forEach((b) => b.remove());
      },
      { passive: true },
    );
    tablaBody.addEventListener(
      'touchmove',
      (e) => {
        if (state.tareasEnModoSeleccion || !swipedRow || !positioningParent)
          return;
        const touch = e.touches[0];
        touchEndX = touch.clientX;
        touchEndY = touch.clientY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        if (
          !isSwiping &&
          Math.abs(diffX) > 10 &&
          Math.abs(diffX) > Math.abs(diffY)
        ) {
          isSwiping = true;
          if (!swipeBackgroundBar) {
            try {
              const rowRect = swipedRow.getBoundingClientRect();
              const parentRect = positioningParent.getBoundingClientRect();
              swipeBackgroundBar = document.createElement('div');
              swipeBackgroundBar.classList.add('swipe-background-bar');
              swipeBackgroundBar.style.position = 'absolute';
              swipeBackgroundBar.style.width = `${rowRect.width}px`;
              swipeBackgroundBar.style.height = `${rowRect.height}px`;
              swipeBackgroundBar.style.top = `${rowRect.top - parentRect.top + positioningParent.scrollTop}px`;
              swipeBackgroundBar.style.left = `${rowRect.left - parentRect.left + positioningParent.scrollLeft}px`;
              positioningParent.appendChild(swipeBackgroundBar);
              requestAnimationFrame(() => {
                if (swipeBackgroundBar)
                  swipeBackgroundBar.classList.add('visible');
              });
            } catch (error) {
              isSwiping = false;
              if (swipeBackgroundBar) swipeBackgroundBar.remove();
              swipeBackgroundBar = null;
            }
          }
        }
        if (isSwiping) {
          const wrappers = swipedRow.querySelectorAll('.cell-content-wrapper');
          wrappers.forEach((wrapper) => {
            wrapper.style.transform = `translateX(${diffX}px)`;
          });
          if (swipeBackgroundBar) {
            if (diffX < -feedbackThreshold) {
              swipeBackgroundBar.classList.add('swiping-left', 'show-feedback');
              swipeBackgroundBar.classList.remove('swiping-right');
            } else if (diffX > feedbackThreshold) {
              swipeBackgroundBar.classList.add(
                'swiping-right',
                'show-feedback',
              );
              swipeBackgroundBar.classList.remove('swiping-left');
            } else {
              swipeBackgroundBar.classList.remove(
                'swiping-left',
                'swiping-right',
                'show-feedback',
              );
            }
          }
        }
      },
      { passive: true },
    );
    tablaBody.addEventListener('touchend', (e) => {
      if (state.tareasEnModoSeleccion || !swipedRow) return;
      const rowToAnimate = swipedRow;
      const barToRemove = swipeBackgroundBar;
      if (!rowToAnimate || !isSwiping || !barToRemove) {
        if (barToRemove) barToRemove.remove();
        swipedRow = null;
        swipeBackgroundBar = null;
        isSwiping = false;
        return;
      }
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      barToRemove.style.opacity = '0';
      setTimeout(() => {
        barToRemove.remove();
      }, 150);
      const wrappers = rowToAnimate.querySelectorAll('.cell-content-wrapper');
      wrappers.forEach((wrapper) => {
        wrapper.style.transform = '';
      });
      if (
        Math.abs(diffX) > swipeThreshold &&
        Math.abs(diffY) < swipeMaxVertical
      ) {
        const tareaId = parseInt(rowToAnimate.dataset.id, 10);
        setTimeout(() => {
          const tarea = state.tareas.find((t) => t.id === tareaId);
          if (!tarea) return;
          if (diffX < 0) {
            tarea.completada = !tarea.completada;
            tarea.fechaCompletado = tarea.completada
              ? new Date().toISOString().split('T')[0]
              : null;
            guardarDatos();
            renderizarTareas();
            if (tareaId === state.tareaSeleccionadald) renderizarDetalles(); // Typo 'ld'
          } else {
            mostrarConfirmacion(
              `Eliminar Tarea`,
              `¿Eliminar "${tarea.titulo}"?`,
              () => {
                eliminarTarea(tareaId);
              },
            );
          }
        }, 50);
      }
      swipedRow = null;
      swipeBackgroundBar = null;
      isSwiping = false;
    });
  }
  const formNuevaTarea = document.getElementById('form-nueva-tarea');
  if (formNuevaTarea && !formNuevaTarea.dataset.submitListener) {
    formNuevaTarea.dataset.submitListener = 'true';
    formNuevaTarea.addEventListener('submit', agregarTarea);
  }
  const formEditarTarea = document.getElementById('form-editar-tarea');
  if (formEditarTarea && !formEditarTarea.dataset.submitListener) {
    formEditarTarea.dataset.submitListener = 'true';
    formEditarTarea.addEventListener('submit', (e) => {
      e.preventDefault();
      const tarea = state.tareas.find(
        (t) => t.id === state.tareaSeleccionadald,
      ); // Typo 'ld'
      if (tarea) {
        tarea.titulo = document
          .getElementById('edit-titulo-tarea')
          .value.trim();
        tarea.descripcion = document
          .getElementById('edit-desc-tarea')
          .value.trim();
        tarea.proyectold =
          parseInt(
            document.getElementById('edit-select-proyecto-tarea').value,
          ) || null; // Typo 'ld'
        tarea.fecha = document.getElementById('edit-fecha-tarea').value;
        tarea.prioridad = document.getElementById('edit-prioridad-tarea').value;
        guardarDatos();
        renderizarTareas();
        renderizarDetalles();
        cerrarModal('modal-editar-tarea');
      } else {
        cerrarModal('modal-editar-tarea');
      }
    });
  }
  const btnAbrirCreacionMovil = document.getElementById(
    'btn-abrir-creacion-movil',
  );
  if (
    btnAbrirCreacionMovil &&
    !btnAbrirCreacionMovil.dataset.listenerAttached
  ) {
    btnAbrirCreacionMovil.dataset.listenerAttached = 'true';
    btnAbrirCreacionMovil.addEventListener('click', () => {
      const panelCreacion = document.getElementById('panel-creacion');
      const form = document.getElementById('form-nueva-tarea');
      const modalContenido = document.getElementById(
        'modal-form-movil-contenido',
      );
      const modalCerrarBtn = document.querySelector(
        '#modal-form-movil .btn-cerrar-modal',
      );
      const modalOverlay = document.getElementById('modal-form-movil');
      if (
        form &&
        modalContenido &&
        modalCerrarBtn &&
        modalOverlay &&
        panelCreacion
      ) {
        if (ICONS.close && modalCerrarBtn)
          modalCerrarBtn.innerHTML = ICONS.close;
        form.reset();
        document.getElementById('input-fecha-tarea').valueAsDate = new Date();
        popularSelectorDeCursos(
          document.getElementById('select-curso-tarea'),
          true,
        );
        popularSelectorDeProyectos();
        modalContenido.appendChild(form);
        mostrarModal('modal-form-movil');
        const onModalClose = (event) => {
          if (
            event.target === modalOverlay ||
            event.target.closest('[data-action="cerrar-modal"]')
          ) {
            panelCreacion.appendChild(form);
            cerrarModal('modal-form-movil');
            modalOverlay.removeEventListener('click', onModalClose);
          }
        };
        modalOverlay.removeEventListener('click', onModalClose);
        modalOverlay.addEventListener('click', onModalClose);
      }
    });
  }
} //=================================
