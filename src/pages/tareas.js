// ==========================================================================
// ==                      src/pages/tareas.js                           ==
// ==========================================================================
//
// Módulo de Tareas, migrado a la arquitectura "Pulso".
// (MODIFICADO - ETAPA 1: Añadida lógica del "Puente" para
//  enviar tareas a grupos)
//
// ==========================================================================

// ===================================
// ==          IMPORTACIONES        ==
// ===================================
import { state } from '../state.js';
import { EventBus } from '../eventBus.js';
// --- INICIO NUEVAS IMPORTACIONES FIREBASE ---
import {
  db, // <-- CORREGIDO: Importado para Batches
  doc, // <-- CORREGIDO: Importado para Batches
  agregarDocumento,
  actualizarDocumento,
  eliminarDocumento,
  crearBatch,
  agregarDocumentoAGrupo, // <-- AÑADIDO (ETAPA 1)
} from '../firebase.js'; // <-- Importamos de firebase.js
// --- FIN NUEVAS IMPORTACIONES FIREBASE ---
import {
  popularSelectorDeCursos,
  popularFiltroDeCursos,
  popularSelectorDeProyectos,
  popularSelectorDeProyectosEdicion,
  mostrarModal,
  cerrarModal,
  mostrarConfirmacion,
  cargarIconos,
  mostrarAlerta, // <-- AÑADIDO (ETAPA 1)
} from '../ui.js';
import { obtenerFechaLocalISO } from '../utils.js'; // <-- AÑADIDO
import { ICONS } from '../icons.js';

let activeDropdown = null;
let activeDropdownButton = null;
let activeFiltroDropdown = null;
// Eliminamos tareasGlobalClickHandler, la lógica se moverá al listener 'paginaCargada'

// ======================================================
// ==        HELPER FUNCTIONS FOR THIS MODULE         ==
// ======================================================

// ... (renderizarTareas SIN CAMBIOS INTERNOS, llama a getTareasVisiblesFiltradas) ...
function renderizarTareas() {
  const tbody = document.getElementById('tabla-tareas-body');
  if (!tbody) {
    // console.error('Error: Elemento #tabla-tareas-body no encontrado.');
    // No loguear error, la página puede no estar cargada aún
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
    if (String(tarea.id) === String(state.tareaSeleccionadald)) {
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
      (t) => String(t.proyectold) === String(state.filtroProyecto), // Corregido a String(proyectold)
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

// ... (actualizarBotonFiltros, repopularMenuFiltros SIN CAMBIOS INTERNOS) ...
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
      (p) => String(p.id) === String(filtroProyecto), // Corregido a String(p.id)
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

  // Filtro Proyectos (Corregido para comparar string IDs)
  if (state.proyectos && state.proyectos.length > 0) {
    htmlMenu += `<div class="filtro-seccion-titulo">Filtrar por Proyecto</div>`;
    const proyectoActivo = state.proyectos.find(
      (p) => String(p.id) === String(filtroProyecto),
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
        String(filtroProyecto) === String(proyecto.id) ? 'opcion-activa' : '';
      const icon =
        String(filtroProyecto) === String(proyecto.id)
          ? checkIconHTML
          : emptyIconHTML;
      htmlMenu += `<button data-action="filter-proyecto" data-value="${proyecto.id}" class="opcion-btn ${activoClass}">${proyecto.nombre} ${icon}</button>`;
    });
    htmlMenu += `</div>`;
  }
  menu.innerHTML = htmlMenu;
}

/**
 * MODIFICADO: Completa tareas seleccionadas usando un Batch de Firebase.
 */
async function completarTareasSeleccionadas() {
  if (state.tareasSeleccionadasIds.length === 0) return;

  console.log(
    `[Tareas] Iniciando batch para completar ${state.tareasSeleccionadasIds.length} tareas.`,
  );
  try {
    const batch = crearBatch();

    const fechaCompletado = obtenerFechaLocalISO();
    const userId = state.currentUserId;


    state.tareasSeleccionadasIds.forEach((tareaId) => {
      const tarea = state.tareas.find((t) => String(t.id) === String(tareaId));
      if (tarea && !tarea.completada) {
        // --- CORREGIDO: Usamos 'db' y 'doc' importados ---
        const docRef = doc(db, 'usuarios', userId, 'tareas', String(tareaId));
        batch.update(docRef, {
          completada: true,
          fechaCompletado: fechaCompletado,
        });
      }
    });

    await batch.commit();
    console.log('[Tareas] Batch de completar tareas exitoso.');
    // No llamamos a renderizar, el listener 'tareasActualizadas' lo hará.
    salirModoSeleccion();
  } catch (error) {
    console.error('[Tareas] Error al completar tareas en batch:', error);
    mostrarAlerta('Error', 'No se pudieron completar las tareas.');
  }
}

/**
 * MODIFICADO: Elimina tareas seleccionadas usando un Batch de Firebase.
 */
function eliminarTareasSeleccionadas() {
  const count = state.tareasSeleccionadasIds.length;
  if (count === 0) return;

  mostrarConfirmacion(
    'Eliminar Tareas',
    `¿Estás seguro de que quieres eliminar ${count} tarea(s)? Esta acción no se puede deshacer.`,
    async () => {
      console.log(`[Tareas] Iniciando batch para eliminar ${count} tareas.`);
      try {
        const batch = crearBatch();
        const userId = state.currentUserId;

        state.tareasSeleccionadasIds.forEach((tareaId) => {
          // --- CORREGIDO: Usamos 'db' y 'doc' importados ---
          const docRef = doc(db, 'usuarios', userId, 'tareas', String(tareaId));
          batch.delete(docRef);
        });

        await batch.commit();
        console.log('[Tareas] Batch de eliminar tareas exitoso.');
        // No llamamos a renderizar, el listener 'tareasActualizadas' lo hará.
        salirModoSeleccion();
      } catch (error) {
        console.error('[Tareas] Error al eliminar tareas en batch:', error);
        mostrarAlerta('Error', 'No se pudieron eliminar las tareas.');
      }
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
  const btnEnviarAGrupo = document.getElementById('btn-enviar-a-grupo'); // <-- ETAPA 1
  const btnEliminar = document.getElementById('btn-eliminar-tarea');
  const subtareasContainer = document.querySelector('.subtareas-container');
  const listaSubtareas = document.getElementById('lista-subtareas');
  const proyectoContainer = document.getElementById('det-proyecto-container');
  const proyectoNombre = document.getElementById('det-proyecto-nombre');

  const tarea = state.tareas.find(
    (t) => String(t.id) === String(state.tareaSeleccionadald),
  ); // Era tareaSeleccionadald

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
    // --- INICIO ETAPA 1: Lógica de visibilidad del botón ---
    if (btnEnviarAGrupo) {
      // El botón solo se activa si hay grupos
      btnEnviarAGrupo.disabled = !(state.grupos && state.grupos.length > 0);
    }
    // --- FIN ETAPA 1 ---
    if (btnEliminar) btnEliminar.disabled = false;
    if (proyectoContainer && proyectoNombre) {
      if (tarea.proyectold) {
        // Typo 'ld'
        const proyecto = state.proyectos.find(
          (p) => String(p.id) === String(tarea.proyectold),
        ); // Typo 'ld'
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
    if (btnEnviarAGrupo) btnEnviarAGrupo.disabled = true; // <-- ETAPA 1
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
  renderizarTareas(); // Esto es local, SÍ renderiza manual
}

/**
 * MODIFICADO: Agrega una tarea a Firestore.
 */
async function agregarTarea(event) {
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
    // id: Date.now(), // <-- ID ELIMINADO, Firestore lo genera
    curso: cursoSelect.value || 'General',
    proyectold: proyectoSelect.value ? String(proyectoSelect.value) : null, // Typo 'ld', aseguramos String
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

  try {
    await agregarDocumento('tareas', nuevaTarea);
    console.log('[Tareas] Nueva tarea agregada a Firestore.');
    // No llamamos a renderizar, el listener 'tareasActualizadas' lo hará.
    // No llamamos a guardarDatos().
    event.target.reset();
    if (fechaInput) fechaInput.valueAsDate = new Date();
    // No necesitamos repopular selectores aquí, los listeners de
    // 'cursosActualizados' y 'proyectosActualizados' lo harán.
    if (cursoSelect && state.cursos.length > 0) {
      const primerCursoNoGeneral = state.cursos.find(
        (c) => c.nombre !== 'General' && !c.isArchivado,
      ); // Busca objeto
      cursoSelect.value = primerCursoNoGeneral
        ? primerCursoNoGeneral.nombre
        : state.cursos[0]?.nombre || 'General'; // Usa nombre
    }
  } catch (error) {
    console.error('[Tareas] Error al agregar tarea:', error);
    mostrarAlerta('Error', 'No se pudo guardar la tarea.');
  }
}

/**
 * MODIFICADO: Agrega una subtarea (actualiza doc en Firestore).
 */
async function agregarSubtarea() {
  const input = document.getElementById('input-nueva-subtarea');
  const texto = input?.value.trim();
  if (!texto || state.tareaSeleccionadald === null) return; // Typo 'ld'
  const tarea = state.tareas.find(
    (t) => String(t.id) === String(state.tareaSeleccionadald),
  ); // Typo 'ld'
  if (tarea) {
    if (!Array.isArray(tarea.subtareas)) tarea.subtareas = [];
    const nuevasSubtareas = [...tarea.subtareas, { texto, completada: false }];
    if (input) input.value = '';

    try {
      await actualizarDocumento('tareas', String(tarea.id), {
        subtareas: nuevasSubtareas,
      });
      console.log(`[Tareas] Subtarea agregada a Tarea ${tarea.id}.`);
      // No llamamos a renderizar, el listener 'tareasActualizadas' lo hará.
    } catch (error) {
      console.error('[Tareas] Error al agregar subtarea:', error);
      mostrarAlerta('Error', 'No se pudo agregar la subtarea.');
    }
  }
}

/**
 * MODIFICADO: Elimina una subtarea (actualiza doc en Firestore).
 */
function eliminarSubtarea(index) {
  const tarea = state.tareas.find(
    (t) => String(t.id) === String(state.tareaSeleccionadald),
  ); // Typo 'ld'
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
    async () => {
      const nuevasSubtareas = [...tarea.subtareas];
      nuevasSubtareas.splice(index, 1);
      try {
        await actualizarDocumento('tareas', String(tarea.id), {
          subtareas: nuevasSubtareas,
        });
        console.log(`[Tareas] Subtarea eliminada de Tarea ${tarea.id}.`);
        // No llamamos a renderizar.
      } catch (error) {
        console.error('[Tareas] Error al eliminar subtarea:', error);
        mostrarAlerta('Error', 'No se pudo eliminar la subtarea.');
      }
    },
  );
}

/**
 * MODIFICADO: Cambia estado de subtarea (actualiza doc en Firestore).
 */
async function toggleSubtarea(index) {
  const tarea = state.tareas.find(
    (t) => String(t.id) === String(state.tareaSeleccionadald),
  ); // Typo 'ld'
  if (
    tarea &&
    Array.isArray(tarea.subtareas) &&
    tarea.subtareas[index] !== undefined
  ) {
    const nuevasSubtareas = [...tarea.subtareas]; // Copia
    nuevasSubtareas[index] = {
      ...nuevasSubtareas[index],
      completada: !nuevasSubtareas[index].completada,
    };

    try {
      await actualizarDocumento('tareas', String(tarea.id), {
        subtareas: nuevasSubtareas,
      });
      console.log(`[Tareas] Subtarea toggled en Tarea ${tarea.id}.`);
      // No llamamos a guardarDatos() ni renderizar.
      // El renderizado local (checkbox) SÍ se mantiene para feedback inmediato.
      const checkbox = document.querySelector(
        `#lista-subtareas input[data-index="${index}"]`,
      );
      const textoSpan = document.getElementById(
        `subtarea-texto-${tarea.id}-${index}`,
      );
      if (checkbox && textoSpan) {
        checkbox.checked = nuevasSubtareas[index].completada; // Usa el nuevo estado
        textoSpan.style.textDecoration = checkbox.checked
          ? 'line-through'
          : 'none';
        textoSpan.style.color = checkbox.checked
          ? 'var(--text-muted)'
          : 'var(--text-base)';
      }
    } catch (error) {
      console.error('[Tareas] Error al togglear subtarea:', error);
      mostrarAlerta('Error', 'No se pudo actualizar la subtarea.');
    }
  }
}
function iniciarEdicionTarea() {
  const tarea = state.tareas.find(
    (t) => String(t.id) === String(state.tareaSeleccionadald),
  ); // Typo 'ld'
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

/**
 * MODIFICADO: Elimina una tarea de Firestore.
 */
async function eliminarTarea(idAEliminar) {
  if (idAEliminar === null || idAEliminar === undefined) return;
  const tareaIdStr = String(idAEliminar);

  try {
    await eliminarDocumento('tareas', tareaIdStr);
    console.log(`[Tareas] Tarea ${tareaIdStr} eliminada de Firestore.`);
    if (String(state.tareaSeleccionadald) === tareaIdStr) {
      // Typo 'ld'
      state.tareaSeleccionadald = null; // Typo 'ld'
      document
        .querySelector('.app-container')
        ?.classList.remove('detalle-visible');
      renderizarDetalles(); // Renderiza el panel vacío
    }
    // No llamamos a renderizarTareas() ni guardarDatos().
  } catch (error) {
    console.error(`[Tareas] Error al eliminar tarea ${tareaIdStr}:`, error);
    mostrarAlerta('Error', 'No se pudo eliminar la tarea.');
  }
}

function eliminarTareaSeleccionada() {
  // Esta función es redundante, eliminada por eliminarTareasSeleccionadas()
  console.warn('eliminarTareaSeleccionada (obsoleta) llamada.');
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
      const tareaId = fila.dataset.id; // ID es string
      // Comparamos IDs como strings o números consistentes
      const isSelected = state.tareasSeleccionadasIds.some(
        (id) => String(id) === tareaId,
      );
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
  const tareaId = String(tareaIdInicial); // Asegurar string
  if (!state.tareasEnModoSeleccion) {
    state.tareasEnModoSeleccion = true;
    state.tareasSeleccionadasIds = [];
    if (tareaIdInicial !== null && tareaIdInicial !== undefined) {
      state.tareasSeleccionadasIds.push(tareaId);
    }
    const appContainer = document.querySelector('.app-container');
    if (appContainer?.classList.contains('detalle-visible')) {
      state.tareaSeleccionadald = null; // Typo 'ld'
      appContainer.classList.remove('detalle-visible');
      renderizarDetalles();
    }
    actualizarUIModoSeleccion();
  } else {
    toggleSeleccionTarea(tareaId);
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
  const idStr = String(tareaId); // Asegurar string
  if (!state.tareasEnModoSeleccion || tareaId === null || tareaId === undefined)
    return;
  const index = state.tareasSeleccionadasIds.indexOf(idStr);
  if (index > -1) {
    state.tareasSeleccionadasIds.splice(index, 1);
  } else {
    state.tareasSeleccionadasIds.push(idStr);
  }
  if (state.tareasSeleccionadasIds.length === 0) {
    salirModoSeleccion();
  } else {
    actualizarUIModoSeleccion();
  }
}

// ========================================================
// ==     INICIO ETAPA 1: FUNCIONES "ENVIAR A GRUPO"
// ========================================================

/**
 * ETAPA 1: Abre y puebla el modal "Enviar a Grupo"
 */
function abrirModalEnviarAGrupo() {
  const tarea = state.tareas.find(
    (t) => String(t.id) === String(state.tareaSeleccionadald), // Typo 'ld'
  );
  if (!tarea) return;

  const modal = document.getElementById('modal-enviar-a-grupo');
  const select = document.getElementById('select-enviar-a-grupo');

  if (!modal || !select) {
    console.error('[Tareas] Modal de Enviar a Grupo no encontrado.');
    return;
  }

  // Poblar selector de grupos
  select.innerHTML = '<option value="">Selecciona un grupo...</option>';
  if (state.grupos && state.grupos.length > 0) {
    state.grupos.forEach((grupo) => {
      const option = document.createElement('option');
      option.value = grupo.id;
      option.textContent = grupo.nombre || 'Grupo sin nombre';
      select.appendChild(option);
    });
  } else {
    // Esto no debería pasar si el botón está habilitado, pero por si acaso.
    select.innerHTML = '<option value="">No se encontraron grupos</option>';
  }

  mostrarModal('modal-enviar-a-grupo');
}

/**
 * ETAPA 1: Lógica para "Enviar Tarea a Grupo"
 */
async function handleEnviarAGrupo() {
  const tarea = state.tareas.find(
    (t) => String(t.id) === String(state.tareaSeleccionadald), // Typo 'ld'
  );
  const selectGrupo = document.getElementById('select-enviar-a-grupo');
  if (!tarea || !selectGrupo) return;

  const grupoId = selectGrupo.value;
  if (!grupoId) {
    mostrarAlerta('Error', 'Debes seleccionar un grupo.');
    return;
  }

  // 1. Crear el objeto "Dato Clave" (padrePrivado)
  const padrePrivado = {
    id: tarea.id,
    ownerId: state.currentUserId,
  };

  // 2. Crear la nueva tarea de grupo (copia de la privada)
  const tareaDeGrupo = {
    titulo: tarea.titulo,
    descripcion: tarea.descripcion,
    prioridad: tarea.prioridad,
    // Datos específicos del "Foro"
    padrePrivado: padrePrivado,
    isCompleted: tarea.completada, // Sincronizar estado actual
    creadaPor: state.currentUserId,
    fechaCreacion: new Date().toISOString(),
    asignados: [], // Se deja vacío (Principio #1 - No Complicarse)
    comentarios: [],
  };

  // 3. Llamar a la nueva función de firebase
  try {
    await agregarDocumentoAGrupo(grupoId, 'tareas', tareaDeGrupo);
    mostrarAlerta('¡Éxito!', `Tarea "${tarea.titulo}" enviada al grupo.`);
    cerrarModal('modal-enviar-a-grupo');
  } catch (error) {
    console.error('Error al enviar tarea a grupo:', error);
    mostrarAlerta('Error', 'No se pudo enviar la tarea.');
  }
}

// ========================================================
// ==     FIN ETAPA 1
// ========================================================

/**
 * MODIFICADO: Inicializa la página de Tareas, suscribiéndose a eventos.
 */
export function inicializarTareas() {
  console.log('[Tareas] Inicializando y suscribiendo a eventos...');

  // --- SUSCRIPCIÓN A EVENTOS DE DATOS ---
  // (Se adjuntan una sola vez al cargar main.js)

  EventBus.on('tareasActualizadas', () => {
    if (state.paginaActual === 'tareas') {
      console.log('[Tareas] Evento: tareasActualizadas. Renderizando...');
      renderizarTareas();
      renderizarDetalles(); // Refrescar detalles también
    }
  });

  const refrescarDependencias = () => {
    if (state.paginaActual === 'tareas') {
      console.log(
        '[Tareas] Evento: dependencias (cursos/proyectos) actualizadas. Renderizando...',
      );
      // Repopular selectores en formularios
      popularSelectorDeCursos(
        document.getElementById('select-curso-tarea'),
        true,
      );
      popularSelectorDeProyectos();
      // Renderizar tareas (para filtros, nombres, etc.)
      renderizarTareas();
      renderizarDetalles(); // Nombres de proyecto/curso pueden haber cambiado
    }
  };
  EventBus.on('cursosActualizados', refrescarDependencias);
  EventBus.on('proyectosActualizados', refrescarDependencias);
  // AÑADIDO (ETAPA 1): Refrescar detalles si cambian los grupos
  EventBus.on('gruposActualizados', () => {
    if (state.paginaActual === 'tareas') {
      renderizarDetalles(); // Para habilitar/deshabilitar el botón "Enviar"
    }
  });

  // --- SUSCRIPCIÓN AL EVENTO DE CARGA DE PÁGINA ---
  EventBus.on('paginaCargada:tareas', (data) => {
    console.log(
      '[Tareas] Evento: paginaCargada:tareas recibido. Conectando listeners de UI...',
    );

    const pageElement = document.getElementById('page-tareas');
    if (!pageElement) {
      console.error('[Tareas] ¡Error crítico! #page-tareas no encontrado.');
      return;
    }

    // --- Lógica de Navegación (Scroll-to-task) ---
    if (data && data.id) {
      state.tareaSeleccionadald = String(data.id); // Typo 'ld', asegurar string
      // Abrir panel de detalles
      document
        .querySelector('.app-container')
        ?.classList.add('detalle-visible');

      // Usamos requestAnimationFrame para asegurar que el DOM esté pintado
      requestAnimationFrame(() => {
        const tareaElemento = document.querySelector(
          `tr[data-id="${state.tareaSeleccionadald}"]`, // <--- El typo
        );
        if (tareaElemento) {
          console.log(
            `[Tareas] Navegación: Haciendo scroll a tarea ID: ${state.tareaSeleccionadald}`,
          );
          // (Lógica de scroll corregida de tu versión anterior)
          const scrollContainer = document.querySelector(
            '#page-tareas .tabla-container',
          );
          if (scrollContainer) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const taskRect = tareaElemento.getBoundingClientRect();
            const taskTopRelativeToContainer = taskRect.top - containerRect.top;
            const containerHeight = scrollContainer.clientHeight;
            const taskHeight = tareaElemento.offsetHeight;
            const offset = containerHeight / 2 - taskHeight / 2;
            const newScrollTop =
              scrollContainer.scrollTop + taskTopRelativeToContainer - offset;
            scrollContainer.scrollTo({ top: newScrollTop, behavior: 'smooth' });
          } else {
            console.warn(
              "No se encontró '.tabla-container', usando scrollIntoView() de emergencia.",
            );
            tareaElemento.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }
          // Resaltado temporal
          tareaElemento.classList.add('resaltado-temporal');
          setTimeout(() => {
            tareaElemento.classList.remove('resaltado-temporal');
          }, 2500);
        } else {
          console.warn(
            `[Tareas] Elemento tarea no encontrado (rAF): ID ${state.tareaSeleccionadald}`,
          );
        }
      });
    } else {
      // Si no hay ID, asegurar que el panel de detalles esté cerrado
      // (a menos que el usuario ya tuviera uno seleccionado)
      if (state.tareaSeleccionadald === null) {
        document
          .querySelector('.app-container')
          ?.classList.remove('detalle-visible');
      }
    }

    // --- Renderizado Inicial ---
    try {
      cargarIconos();
      popularSelectorDeCursos(
        document.getElementById('select-curso-tarea'),
        true,
      );
      popularSelectorDeProyectos();
      // Iconos del header contextual
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
      // Iconos del FAB móvil
      const btnAbrirCreacion = document.getElementById(
        'btn-abrir-creacion-movil',
      );
      if (btnAbrirCreacion) btnAbrirCreacion.innerHTML = ICONS.plus;
      // Iconos del panel de detalles
      const btnCerrarDetalles = document.getElementById('btn-cerrar-detalles');
      if (btnCerrarDetalles) btnCerrarDetalles.innerHTML = ICONS.close;
      const btnEditar = document.getElementById('btn-editar-tarea');
      if (btnEditar) btnEditar.innerHTML = ICONS.edit;
      // --- INICIO ETAPA 1: Cargar ícono ---
      const btnEnviarAGrupo = document.getElementById('btn-enviar-a-grupo');
      if (btnEnviarAGrupo) btnEnviarAGrupo.innerHTML = ICONS.group;
      // --- FIN ETAPA 1 ---
      const btnEliminar = document.getElementById('btn-eliminar-tarea');
      if (btnEliminar) btnEliminar.innerHTML = ICONS.delete;
      // --- INICIO ETAPA 1: Cargar ícono modal ---
      const btnCerrarModalGrupo = document.querySelector(
        '#modal-enviar-a-grupo .btn-cerrar-modal',
      );
      if (btnCerrarModalGrupo) btnCerrarModalGrupo.innerHTML = ICONS.close;
      // --- FIN ETAPA 1 ---

      renderizarTareas();
      renderizarDetalles();
      actualizarUIModoSeleccion(); // Asegura que el header contextual esté oculto
    } catch (error) {
      console.error('[Tareas] Error durante el renderizado inicial:', error);
    }

    // --- LISTENERS DE PÁGINA (Se adjuntan solo a #page-tareas) ---
    // (Usamos el patrón de 'proyectos.js' de un solo listener de clic por página)
    if (pageElement.dataset.clickHandlerAttached !== 'true') {
      pageElement.dataset.clickHandlerAttached = 'true';

      pageElement.addEventListener('click', async (e) => {
        // --- Clic en Header Contextual (Modo Selección) ---
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
              await completarTareasSeleccionadas(); // async
              break;
            case 'eliminar-seleccion':
              eliminarTareasSeleccionadas(); // Llama a confirmación (que es async)
              break;
          }
          return;
        }

        // --- Clic en Fila de Tarea ---
        const fila = e.target.closest('#tabla-tareas-body tr[data-id]');
        if (fila) {
          const taskId = fila.dataset.id; // Es String
          if (state.tareasEnModoSeleccion) {
            toggleSeleccionTarea(taskId);
          } else if (String(state.tareaSeleccionadald) !== taskId) {
            // Typo 'ld'
            state.tareaSeleccionadald = taskId; // Typo 'ld'
            // No guardamos en DB, es estado de UI local
            renderizarTareas(); // Para 'selected-task'
            renderizarDetalles();
            document
              .querySelector('.app-container')
              ?.classList.add('detalle-visible');
          }
          return;
        }

        // --- Clic en Panel de Detalles ---
        const panelDetalles = document.getElementById('panel-detalles');
        if (panelDetalles && panelDetalles.contains(e.target)) {
          const completarBtn = e.target.closest('#btn-completar-tarea');
          const editarBtn = e.target.closest('#btn-editar-tarea');
          const enviarBtn = e.target.closest('#btn-enviar-a-grupo'); // <-- ETAPA 1
          const eliminarBtn = e.target.closest('#btn-eliminar-tarea');
          const addSubtareaBtn = e.target.closest('#btn-agregar-subtarea');
          const deleteSubtaskBtn = e.target.closest('.btn-delete-subtask');
          const subtareaCheckbox = e.target.closest(
            '#lista-subtareas input[type="checkbox"]',
          );

          if (completarBtn && !completarBtn.disabled) {
            const tarea = state.tareas.find(
              (t) => String(t.id) === String(state.tareaSeleccionadald),
            ); // Typo 'ld'
            if (tarea) {
              const completada = !tarea.completada;

              const fechaCompletado = completada
                ? obtenerFechaLocalISO()
                : null;
              try {
                await actualizarDocumento('tareas', String(tarea.id), {
                  completada,
                  fechaCompletado,
                });
                // No renderizar, listener lo hará.
              } catch (error) {
                console.error('[Tareas] Error al completar tarea:', error);
              }
            }
            return;
          }
          if (editarBtn && !editarBtn.disabled) {
            iniciarEdicionTarea();
            return;
          }
          // --- INICIO ETAPA 1: Listener del botón ---
          if (enviarBtn && !enviarBtn.disabled) {
            abrirModalEnviarAGrupo();
            return;
          }
          // --- FIN ETAPA 1 ---
          if (eliminarBtn && !eliminarBtn.disabled) {
            const tarea = state.tareas.find(
              (t) => String(t.id) === String(state.tareaSeleccionadald),
            ); // Typo 'ld'
            if (tarea) {
              mostrarConfirmacion(
                'Eliminar Tarea',
                `¿Eliminar "${tarea.titulo}"?`,
                async () => {
                  await eliminarTarea(state.tareaSeleccionadald); // async
                },
              );
            } // Typo 'ld'
            return;
          }
          if (addSubtareaBtn) {
            await agregarSubtarea(); // async
            return;
          }
          if (deleteSubtaskBtn) {
            const index = parseInt(deleteSubtaskBtn.dataset.index, 10);
            eliminarSubtarea(index); // Llama a confirmación (que es async)
            return;
          }
          if (subtareaCheckbox) {
            const index = parseInt(subtareaCheckbox.dataset.index, 10);
            await toggleSubtarea(index); // async
            return;
          }
        } // Fin clics panel detalles

        // --- Clic en Botón Cerrar Detalles ---
        const cerrarDetallesBtn = e.target.closest('#btn-cerrar-detalles');
        if (cerrarDetallesBtn) {
          state.tareaSeleccionadald = null; // Typo 'ld'
          document
            .querySelector('.app-container')
            ?.classList.remove('detalle-visible');
          renderizarTareas(); // Quitar 'selected-task'
          renderizarDetalles(); // Renderizar panel vacío
          return;
        }

        // --- Clic en Botón Filtro (Dropdown) ---
        // (La lógica del dropdown es compleja y usa 'document.body', la mantenemos separada)
      }); // --- FIN LISTENER DE CLIC DE PÁGINA ---
    } // Fin if(dataset.clickHandlerAttached)

    // --- LISTENERS DE DROPDOWN (Globales, como en el original) ---
    if (!document.body.dataset.tareasDropdownListener) {
      document.body.dataset.tareasDropdownListener = 'true';

      document.addEventListener('click', (e) => {
        if (state.paginaActual !== 'tareas') {
          // Si no estamos en tareas, cerrar dropdowns abiertos
          if (activeDropdown) activeDropdown.remove();
          if (activeFiltroDropdown) activeFiltroDropdown.remove();
          activeDropdown = null;
          activeDropdownButton = null;
          activeFiltroDropdown = null;
          return;
        }

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
            ? activeDropdownButton.closest('tr[data-id]')?.dataset.id
            : null; // ID es String
          if (activeDropdown) activeDropdown.remove();
          activeDropdown = null;
          activeDropdownButton = null;
          if (taskId !== null) {
            switch (action) {
              case 'editar-tarea-menu':
                if (String(state.tareaSeleccionadald) !== taskId)
                  state.tareaSeleccionadald = taskId; // Typo 'ld'
                iniciarEdicionTarea();
                break;
              case 'seleccionar-tarea-menu':
                iniciarModoSeleccion(taskId);
                break;
              case 'eliminar-tarea-menu':
                const tarea = state.tareas.find((t) => String(t.id) === taskId);
                if (tarea)
                  mostrarConfirmacion(
                    `Eliminar Tarea`,
                    `¿Eliminar "${tarea.titulo}"?`,
                    async () => await eliminarTarea(taskId), // async
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
            state.filtroProyecto = value; // Guardamos ID como string
          } else if (action === 'toggle-submenu') {
            const submenuId = `filtro-submenu-${filtroDropdownOption.dataset.submenu}`;
            const submenu = activeFiltroDropdown?.querySelector(
              `#${submenuId}`,
            );
            if (submenu) {
              submenu.classList.toggle('hidden');
              filtroDropdownOption.classList.toggle('abierto');
            }
            return;
          } else {
            return;
          }
          renderizarTareas(); // El filtro/orden SÍ es renderizado manual
          if (activeFiltroDropdown) repopularMenuFiltros(activeFiltroDropdown);
          return;
        } else if (menuButton) {
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
        } else if (filtroMenuButton) {
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
          // Clic fuera de todo dropdown
          if (activeDropdown && !isClickInsideActiveDropdown) {
            activeDropdown.remove();
            activeDropdown = null;
            activeDropdownButton = null;
          }
          if (activeFiltroDropdown && !isClickInsideFiltroDropdown) {
            activeFiltroDropdown.remove();
            document
              .getElementById('btn-filtros-dropdown')
              ?.classList.remove('active');
            activeFiltroDropdown = null;
          }
        }
      }); // Fin listener global de 'click'
    } // Fin if(dataset.tareasDropdownListener)

    // --- LISTENERS DE CHECKBOX (Select All) ---
    const checkSelectAll = document.getElementById('seleccionar-todas-tareas');
    if (checkSelectAll && !checkSelectAll.dataset.listenerAttached) {
      checkSelectAll.dataset.listenerAttached = 'true';
      checkSelectAll.addEventListener('change', (e) => {
        if (!state.tareasEnModoSeleccion) return;
        seleccionarTodasTareasVisibles(e.target.checked);
      });
    }

    // --- LISTENERS DE TABLA (dDblclick, Long Press, Swipe) ---
    const tablaBody = document.getElementById('tabla-tareas-body');
    if (tablaBody) {
      // (Listeners de Touch/Long Press, sin cambios internos)
      if (!tablaBody.dataset.longPressListener) {
        let touchStartX = 0,
          touchStartY = 0,
          touchEndX = 0,
          touchEndY = 0;
        let longPressTimer = null;
        let pressStartX = 0,
          pressStartY = 0;
        const longPressDuration = 500;
        tablaBody.dataset.longPressListener = 'true';
        tablaBody.addEventListener(
          'touchstart',
          (e) => {
            const isSwiping = tablaBody.dataset.isSwiping === 'true';
            if (
              isSwiping ||
              state.tareasEnModoSeleccion ||
              e.touches.length > 1
            ) {
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
            const tareaId = fila.dataset.id; // String ID
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
      // (Listener de Dblclick, MODIFICADO para ser async)
      if (!tablaBody.dataset.dblClickListener) {
        tablaBody.dataset.dblClickListener = 'true';
        tablaBody.addEventListener('dblclick', async (e) => {
          const fila = e.target.closest('tr[data-id]');
          if (
            !fila ||
            window.getSelection().toString() ||
            state.tareasEnModoSeleccion
          )
            return;
          const tareaId = fila.dataset.id; // String ID
          const tarea = state.tareas.find((t) => String(t.id) === tareaId);
          if (tarea) {
            const completada = !tarea.completada;

            const fechaCompletado = completada
              ? obtenerFechaLocalISO()
              : null;
            try {
              await actualizarDocumento('tareas', String(tarea.id), {
                completada,
                fechaCompletado,
              });
              // No renderizar, listener lo hará
            } catch (error) {
              console.error('[Tareas] Error en dblclick:', error);
            }
          }
        });
      }
      // (Listeners de Swipe, MODIFICADO para ser async)
      if (!tablaBody.dataset.touchListenersBar) {
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
            tablaBody.dataset.isSwiping = 'false';
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
              tablaBody.dataset.isSwiping = 'true';
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
                  tablaBody.dataset.isSwiping = 'false';
                  if (swipeBackgroundBar) swipeBackgroundBar.remove();
                  swipeBackgroundBar = null;
                }
              }
            }
            if (isSwiping) {
              const wrappers = swipedRow.querySelectorAll(
                '.cell-content-wrapper',
              );
              wrappers.forEach((wrapper) => {
                wrapper.style.transform = `translateX(${diffX}px)`;
              });
              if (swipeBackgroundBar) {
                if (diffX < -feedbackThreshold) {
                  swipeBackgroundBar.classList.add(
                    'swiping-left',
                    'show-feedback',
                  );
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
            tablaBody.dataset.isSwiping = 'false';
            return;
          }
          const diffX = touchEndX - touchStartX;
          const diffY = touchEndY - touchStartY;
          barToRemove.style.opacity = '0';
          setTimeout(() => {
            barToRemove.remove();
          }, 150);
          const wrappers = rowToAnimate.querySelectorAll(
            '.cell-content-wrapper',
          );
          wrappers.forEach((wrapper) => {
            wrapper.style.transform = '';
          });
          if (
            Math.abs(diffX) > swipeThreshold &&
            Math.abs(diffY) < swipeMaxVertical
          ) {
            const tareaId = rowToAnimate.dataset.id; // String ID
            setTimeout(async () => {
              // <-- async
              const tarea = state.tareas.find((t) => String(t.id) === tareaId);
              if (!tarea) return;
              if (diffX < 0) {
                // Completar
                const completada = !tarea.completada;
                const fechaCompletado = completada
                  ? new Date().toISOString().split('T')[0]
                  : null;
                try {
                  await actualizarDocumento('tareas', String(tarea.id), {
                    completada,
                    fechaCompletado,
                  });
                } catch (error) {
                  console.error('[Tareas] Error en swipe-completar:', error);
                }
              } else {
                // Eliminar
                mostrarConfirmacion(
                  `Eliminar Tarea`,
                  `¿Eliminar "${tarea.titulo}"?`,
                  async () => {
                    await eliminarTarea(tareaId); // async
                  },
                );
              }
            }, 50);
          }
          swipedRow = null;
          swipeBackgroundBar = null;
          isSwiping = false;
          tablaBody.dataset.isSwiping = 'false';
        });
      } // fin if(dataset.touchListenersBar)
    } // fin if(tablaBody)

    // --- LISTENERS DE FORMULARIOS (Una sola vez) ---
    const formNuevaTarea = document.getElementById('form-nueva-tarea');
    if (formNuevaTarea && !formNuevaTarea.dataset.submitListener) {
      formNuevaTarea.dataset.submitListener = 'true';
      formNuevaTarea.addEventListener('submit', agregarTarea); // Es async
    }

    const formEditarTarea = document.getElementById('form-editar-tarea');
    if (formEditarTarea && !formEditarTarea.dataset.submitListener) {
      formEditarTarea.dataset.submitListener = 'true';
      formEditarTarea.addEventListener('submit', async (e) => {
        // <-- async
        e.preventDefault();
        const tarea = state.tareas.find(
          (t) => String(t.id) === String(state.tareaSeleccionadald),
        ); // Typo 'ld'
        if (tarea) {
          const datosActualizar = {
            titulo: document.getElementById('edit-titulo-tarea').value.trim(),
            descripcion: document
              .getElementById('edit-desc-tarea')
              .value.trim(),
            proyectold:
              document.getElementById('edit-select-proyecto-tarea').value ||
              null, // Typo 'ld'
            fecha: document.getElementById('edit-fecha-tarea').value,
            prioridad: document.getElementById('edit-prioridad-tarea').value,
          };
          try {
            await actualizarDocumento(
              'tareas',
              String(tarea.id),
              datosActualizar,
            );
            cerrarModal('modal-editar-tarea');
          } catch (error) {
            console.error('[Tareas] Error al editar tarea:', error);
            mostrarAlerta('Error', 'No se pudo actualizar la tarea.');
          }
        } else {
          cerrarModal('modal-editar-tarea');
        }
      });
    }

    // --- INICIO ETAPA 1: Listeners para el nuevo modal ---
    const btnConfirmarEnviar = document.getElementById(
      'btn-confirmar-enviar-a-grupo',
    );
    if (btnConfirmarEnviar && !btnConfirmarEnviar.dataset.listenerAttached) {
      btnConfirmarEnviar.dataset.listenerAttached = 'true';
      btnConfirmarEnviar.addEventListener('click', handleEnviarAGrupo);
    }
    // (El botón de cancelar ya es manejado por el listener global 'data-action="cerrar-modal"')
    // --- FIN ETAPA 1 ---

    // --- LISTENER DEL FAB (Móvil) ---
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
  }); //================================= FIN 'paginaCargada:tareas'
} //================================= FIN inicializarTareas
