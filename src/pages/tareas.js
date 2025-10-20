// ===================================
// ==          IMPORTACIONES        ==
// ===================================
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
  cargarIconos, // Importa cargarIconos
} from '../ui.js';
import { ICONS } from '../icons.js'; // Importa ICONS
let activeDropdown = null; // <<< MOVIDO AQUÍ
let activeDropdownButton = null; // <<< MOVIDO AQUÍ
// ======================================================
// ==        HELPER FUNCTIONS FOR THIS MODULE         ==
// ======================================================

// --- Render Main Table (Visible Only) ---
function renderizarTareas() {
  const tbody = document.getElementById('tabla-tareas-body');
  if (!tbody) {
    console.error('Error: Elemento #tabla-tareas-body no encontrado.');
    return;
  }

  // Detecta si la vista es móvil según el ancho de la ventana
  const isMobileView = window.innerWidth <= 900;
  // console.log("isMobileView:", isMobileView); // Descomenta para depurar tamaño

  // --- Filtrado ---
  let tareasAMostrar = state.tareas;
  if (state.filtroCurso && state.filtroCurso !== 'todos') {
    tareasAMostrar = state.tareas.filter((t) => t.curso === state.filtroCurso);
  }

  // --- Ordenamiento ---
  const col = state.ordenamiento?.col || 'fecha';
  const reverse = state.ordenamiento?.reverse || false;
  const tareasOrdenadas = [...tareasAMostrar].sort((a, b) => {
    if (a.completada !== b.completada) return a.completada ? 1 : -1; // Pendientes primero
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
  tbody.innerHTML = ''; // Limpia tabla visible

  tareasFinales.forEach((tarea) => {
    const tr = document.createElement('tr');
    tr.dataset.id = tarea.id;

    // Aplica clases de estado (vencimiento, completada, seleccionada)
    let claseVencimiento = '';
    if (tarea.completada) {
      tr.classList.add('tarea-completada');
    } else {
      claseVencimiento = obtenerClaseVencimiento(tarea.fecha);
      tr.classList.add(claseVencimiento);
    }
    if (tarea.id === state.tareaSeleccionadald) {
      tr.classList.add('selected-task');
    }

    // Formato de fecha
    const [year, month, day] =
      tarea.fecha && !isNaN(new Date(tarea.fecha + 'T00:00:00'))
        ? tarea.fecha.split('-')
        : ['--', '--', '--'];
    const fechaFormateada = `${day}/${month}/${year}`;

    // --- Genera HTML Condicional (Móvil vs Escritorio) ---
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
      // --- VISTA MÓVIL ---
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
      // --- VISTA ESCRITORIO (con wrappers para swipe) ---
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

    // Aplica HTML a la fila
    tr.innerHTML = rowHTML;
    tbody.appendChild(tr);
  });

  // --- Actualizar Contador Título ---
  const tituloPendientes = document.getElementById('titulo-tareas-pendientes');
  if (tituloPendientes) {
    const countPendientes = tareasAMostrar.filter((t) => !t.completada).length;
    tituloPendientes.textContent = `Tareas Pendientes (${countPendientes})`;
  }

  // --- Actualizar Estado Botones de Filtro/Ordenamiento ---
  document.querySelectorAll('.btn-filtro[data-sort]').forEach((btn) => {
    const isActive = btn.dataset.sort === col;
    btn.classList.toggle('active', isActive);
    // Aquí puedes añadir lógica para mostrar flechas ▲/▼ si isActive
  });

  // --- Actualizar Select Filtro Curso ---
  const filtroCursoSelect = document.getElementById('filtro-curso');
  if (filtroCursoSelect) {
    filtroCursoSelect.value = state.filtroCurso || 'todos';
  }
} // === END of renderizarTareas ===

// ======================================================
// ==    NUEVAS FUNCIONES PARA ACCIONES EN LOTE         ==
// ======================================================

/**
 * Obtiene la lista de tareas que están actualmente visibles
 * según el filtro de curso aplicado.
 */
function getTareasVisiblesFiltradas() {
  let tareasAMostrar = state.tareas;
  if (state.filtroCurso && state.filtroCurso !== 'todos') {
    tareasAMostrar = state.tareas.filter((t) => t.curso === state.filtroCurso);
  }
  return tareasAMostrar;
}

/**
 * Marca como completadas todas las tareas en state.tareasSeleccionadasIds
 */
function completarTareasSeleccionadas() {
  if (state.tareasSeleccionadasIds.length === 0) return;

  console.log(`Completando ${state.tareasSeleccionadasIds.length} tareas...`);
  state.tareas.forEach((tarea) => {
    if (state.tareasSeleccionadasIds.includes(tarea.id)) {
      if (!tarea.completada) {
        tarea.completada = true;
        tarea.fechaCompletado = new Date().toISOString().split('T')[0];
      }
    }
  });

  guardarDatos();
  renderizarTareas(); // Actualiza la tabla
  salirModoSeleccion(); // Salimos del modo selección
}

/**
 * Muestra confirmación y luego elimina todas las tareas
 * en state.tareasSeleccionadasIds
 */
function eliminarTareasSeleccionadas() {
  const count = state.tareasSeleccionadasIds.length;
  if (count === 0) return;

  mostrarConfirmacion(
    'Eliminar Tareas',
    `¿Estás seguro de que quieres eliminar ${count} tarea(s)? Esta acción no se puede deshacer.`,
    () => {
      console.log(`Eliminando ${count} tareas...`);
      // Filtramos el array principal, manteniendo solo las tareas
      // que NO están en la lista de seleccionadas.
      state.tareas = state.tareas.filter(
        (tarea) => !state.tareasSeleccionadasIds.includes(tarea.id),
      );

      guardarDatos();
      renderizarTareas();
      salirModoSeleccion();
    },
  );
}

/**
 * Selecciona o deselecciona todas las tareas visibles
 * según el checkbox "Seleccionar Todas"
 */
function seleccionarTodasTareasVisibles(isChecked) {
  if (isChecked) {
    // Seleccionar todas las visibles
    const tareasVisibles = getTareasVisiblesFiltradas();
    state.tareasSeleccionadasIds = tareasVisibles.map((t) => t.id);
  } else {
    // Deseleccionar todas
    state.tareasSeleccionadasIds = [];
  }

  // Si deseleccionamos todas, salimos del modo.
  // Si no, actualizamos la UI.
  if (state.tareasSeleccionadasIds.length === 0) {
    salirModoSeleccion();
  } else {
    actualizarUIModoSeleccion();
  }
}

// --- Render Details Panel ---
function renderizarDetalles() {
  // console.log('--- Iniciando renderizarDetalles ---'); // Descomenta si necesitas depurar
  // console.log('ID Tarea seleccionada (state):', state.tareaSeleccionadald);

  const panel = document.getElementById('panel-detalles');
  if (!panel) {
    console.error('PANEL DE DETALLES NO ENCONTRADO');
    return;
  }

  const titulo = document.getElementById('det-titulo');
  const descripcion = document.getElementById('det-descripcion');
  const btnCompletar = document.getElementById('btn-completar-tarea');
  const btnEditar = document.getElementById('btn-editar-tarea');
  const btnEliminar = document.getElementById('btn-eliminar-tarea');
  const subtareasContainer = document.querySelector('.subtareas-container');
  const listaSubtareas = document.getElementById('lista-subtareas');
  const proyectoContainer = document.getElementById('det-proyecto-container');
  const proyectoNombre = document.getElementById('det-proyecto-nombre');

  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  // console.log('Tarea encontrada en state:', tarea); // Descomenta si necesitas depurar

  if (tarea) {
    // console.log('Tarea válida encontrada, actualizando DOM...'); // Descomenta si necesitas depurar
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

    // Project
    if (proyectoContainer && proyectoNombre) {
      if (tarea.proyectold) {
        const proyecto = state.proyectos.find((p) => p.id === tarea.proyectold);
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

    // Subtasks
    if (subtareasContainer) {
      subtareasContainer.style.display = 'flex'; // Asegura visibilidad del contenedor
      renderizarSubtareas(tarea); // Llama a renderizar la lista UL
    }
  } else {
    // Clean panel
    // console.log('No hay tarea seleccionada o no encontrada, limpiando panel...'); // Descomenta si necesitas depurar
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
  // console.log('--- Finalizando renderizarDetalles ---'); // Descomenta si necesitas depurar
}

// --- Render Subtasks ---
function renderizarSubtareas(tarea) {
  const listaSubtareas = document.getElementById('lista-subtareas');
  if (!listaSubtareas) {
    console.error('Elemento #lista-subtareas no encontrado');
    return;
  }
  listaSubtareas.innerHTML = ''; // Limpia siempre antes de renderizar
  if (!tarea.subtareas || tarea.subtareas.length === 0) {
    // Opcional: listaSubtareas.innerHTML = '<li class="no-subtareas-msg"><p>No hay sub-tareas.</p></li>';
    return;
  }

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

// --- Sort Tasks ---
function ordenarPor(columna) {
  if (!columna) return;
  if (state.ordenamiento.col === columna) {
    state.ordenamiento.reverse = !state.ordenamiento.reverse;
  } else {
    state.ordenamiento.col = columna;
    state.ordenamiento.reverse = false;
  }
  renderizarTareas(); // Vuelve a dibujar la tabla con el nuevo orden
}

// --- Add Task ---
function agregarTarea(event) {
  event.preventDefault();
  const cursoSelect = document.getElementById('select-curso-tarea');
  const proyectoSelect = document.getElementById('select-proyecto-tarea');
  const tituloInput = document.getElementById('input-titulo-tarea');
  const descInput = document.getElementById('input-desc-tarea');
  const fechaInput = document.getElementById('input-fecha-tarea');
  const prioridadSelect = document.getElementById('select-prioridad-tarea');

  // Validación básica de existencia de elementos (importante)
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
    proyectold: parseInt(proyectoSelect.value) || null, // Asegura que sea número o null
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
  renderizarTareas(); // Actualiza la tabla
  popularFiltroDeCursos(); // Actualiza el filtro de cursos por si afecta

  // Resetea el formulario
  event.target.reset(); // Resetea campos
  if (fechaInput) fechaInput.valueAsDate = new Date(); // Pone fecha de hoy
  popularSelectorDeProyectos(); // Repopula proyectos por si cambió
  if (cursoSelect && state.cursos.length > 0) {
    // Resetea curso al primero no general o general
    cursoSelect.value =
      state.cursos.find((c) => c !== 'General') || state.cursos[0] || 'General';
  }
}

// --- Subtask Actions ---
function agregarSubtarea() {
  const input = document.getElementById('input-nueva-subtarea');
  const texto = input?.value.trim(); // Safely access value
  if (!texto || state.tareaSeleccionadald === null) return;
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  if (tarea) {
    if (!Array.isArray(tarea.subtareas)) tarea.subtareas = []; // Asegura que sea array
    tarea.subtareas.push({ texto, completada: false });
    if (input) input.value = ''; // Limpia input
    guardarDatos();
    renderizarSubtareas(tarea); // Actualiza solo la lista de subtareas
  }
}
function eliminarSubtarea(index) {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  // Verifica que el índice sea válido y exista la subtarea
  if (
    !tarea ||
    !Array.isArray(tarea.subtareas) ||
    tarea.subtareas[index] === undefined
  ) {
    console.warn(`Intento de eliminar subtarea inválida en índice ${index}`);
    return;
  }
  const subTexto = tarea.subtareas[index].texto;
  mostrarConfirmacion(
    'Eliminar Sub-tarea',
    `¿Eliminar "${subTexto || '(vacía)'}"?`,
    () => {
      tarea.subtareas.splice(index, 1); // Elimina del array
      guardarDatos();
      renderizarSubtareas(tarea); // Actualiza la lista
    },
  );
}
function toggleSubtarea(index) {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  // Verifica que el índice sea válido y exista la subtarea
  if (
    tarea &&
    Array.isArray(tarea.subtareas) &&
    tarea.subtareas[index] !== undefined
  ) {
    tarea.subtareas[index].completada = !tarea.subtareas[index].completada;
    guardarDatos();
    // Actualiza visualmente sin re-renderizar toda la lista (más eficiente)
    const checkbox = document.querySelector(
      `#lista-subtareas input[data-index="${index}"]`,
    );
    // Busca el span usando el ID único que generamos
    const textoSpan = document.getElementById(
      `subtarea-texto-${tarea.id}-${index}`,
    );
    if (checkbox && textoSpan) {
      // Aplica/quita estilos directamente
      textoSpan.style.textDecoration = checkbox.checked
        ? 'line-through'
        : 'none';
      textoSpan.style.color = checkbox.checked
        ? 'var(--text-muted)'
        : 'var(--text-base)';
      // Asegura que el checkbox refleje el estado (aunque el navegador suele hacerlo)
      checkbox.checked = tarea.subtareas[index].completada;
    } else {
      // Fallback si no se encuentran los elementos: re-renderizar
      console.warn(
        'Elementos de subtarea no encontrados para actualización visual, re-renderizando...',
      );
      renderizarSubtareas(tarea);
    }
  } else {
    console.warn(`Intento de alternar subtarea inválida en índice ${index}`);
  }
}

// --- Open Edit Modal ---
function iniciarEdicionTarea() {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  if (!tarea) {
    console.warn('No hay tarea seleccionada para editar.');
    return;
  }
  console.log('Abriendo modal edición para:', tarea);
  try {
    // Poblar campos del modal
    document.getElementById('edit-titulo-tarea').value = tarea.titulo || '';
    document.getElementById('edit-desc-tarea').value = tarea.descripcion || '';
    document.getElementById('edit-fecha-tarea').value = tarea.fecha || '';
    document.getElementById('edit-prioridad-tarea').value =
      tarea.prioridad || 'Media';
    // Poblar selector de proyectos para edición
    popularSelectorDeProyectosEdicion(tarea.proyectold);
    // Mostrar modal
    mostrarModal('modal-editar-tarea');
  } catch (error) {
    console.error('Error al poblar o mostrar el modal de edición:', error);
    alert('Error al abrir el editor de tareas.');
  }
}

// --- Generic Delete Task by ID ---
function eliminarTarea(idAEliminar) {
  if (idAEliminar === null || idAEliminar === undefined) return;
  const tareaIndex = state.tareas.findIndex((t) => t.id === idAEliminar);
  if (tareaIndex === -1) {
    console.warn(`Tarea con ID ${idAEliminar} no encontrada para eliminar.`);
    return;
  }
  console.log(`Eliminando tarea ID: ${idAEliminar}`);
  state.tareas.splice(tareaIndex, 1); // Elimina del array

  // Si la tarea eliminada era la seleccionada, limpia la selección
  if (state.tareaSeleccionadald === idAEliminar) {
    state.tareaSeleccionadald = null;
    document
      .querySelector('.app-container')
      ?.classList.remove('detalle-visible');
    renderizarDetalles(); // Limpia panel detalles
  }
  guardarDatos();
  renderizarTareas(); // Actualiza tabla
  popularFiltroDeCursos(); // Actualiza filtro por si era la última de un curso
}

// --- Delete Selected Task (Called by button) ---
function eliminarTareaSeleccionada() {
  // La confirmación se maneja en el listener del botón ahora
  console.warn(
    'eliminarTareaSeleccionada llamada directamente - la confirmación debe estar en el listener.',
  );
  // Si necesitas usarla desde otro lugar, añade la confirmación aquí
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  if (tarea) {
    mostrarConfirmacion(
      'Eliminar Tarea',
      `¿Eliminar "${tarea.titulo}"?`,
      () => {
        eliminarTarea(state.tareaSeleccionadald);
      },
    );
  }
}

function actualizarUIModoSeleccion() {
  const panelCentral = document.querySelector('#page-tareas .panel-central');
  const headerNormal = panelCentral?.querySelector('.panel-header'); // El header con filtros
  const headerContextual = document.getElementById('tareas-header-contextual'); // El nuevo header contextual
  const tablaBody = document.getElementById('tabla-tareas-body');

  // --- Lógica del Checkbox "Seleccionar Todas" ---
  const selectAllCheckbox = document.getElementById('seleccionar-todas-tareas');
  const totalSeleccionadas = state.tareasSeleccionadasIds.length;
  const tareasVisibles = getTareasVisiblesFiltradas(); // Usamos la nueva función
  const totalVisibles = tareasVisibles.length;
  // --- Fin lógica Checkbox ---

  if (!panelCentral || !headerNormal || !headerContextual || !tablaBody) {
    console.error('Faltan elementos para actualizar UI modo selección');
    return;
  }

  const enModoSeleccion = state.tareasEnModoSeleccion;

  headerNormal.style.display = enModoSeleccion ? 'none' : 'flex';
  headerContextual.style.display = enModoSeleccion ? 'flex' : 'none';
  tablaBody.classList.toggle('modo-seleccion-activo', enModoSeleccion);

  if (enModoSeleccion) {
    const contador = headerContextual.querySelector('#seleccion-contador');
    if (contador)
      contador.textContent = `${totalSeleccionadas} seleccionada(s)`;

    // Actualiza estado checkbox "Seleccionar Todas"
    if (selectAllCheckbox) {
      if (totalSeleccionadas === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else if (totalSeleccionadas === totalVisibles) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else {
        // Estado intermedio
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
      }
    }

    // Actualiza estilos de las filas
    const filas = tablaBody.querySelectorAll('tr[data-id]');
    filas.forEach((fila) => {
      const tareaId = parseInt(fila.dataset.id, 10);
      const isSelected = state.tareasSeleccionadasIds.includes(tareaId);
      fila.classList.toggle('seleccionada-en-modo', isSelected);
    });
  } else {
    // Limpia estilos de fila al salir del modo
    tablaBody
      .querySelectorAll('tr.seleccionada-en-modo')
      .forEach((fila) => fila.classList.remove('seleccionada-en-modo'));

    // Resetea el checkbox
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  }
}

// --- Función para ENTRAR en modo selección ---
function iniciarModoSeleccion(tareaIdInicial) {
  if (!state.tareasEnModoSeleccion) {
    // Solo si no estábamos ya en modo selección
    console.log('Iniciando modo selección...');
    state.tareasEnModoSeleccion = true;
    state.tareasSeleccionadasIds = []; // Limpia selecciones previas
    if (tareaIdInicial !== null && tareaIdInicial !== undefined) {
      state.tareasSeleccionadasIds.push(tareaIdInicial); // Añade la tarea que activó el modo
    }
    // Opcional: Oculta el panel de detalles si estaba abierto
    const appContainer = document.querySelector('.app-container');
    if (appContainer?.classList.contains('detalle-visible')) {
      state.tareaSeleccionadald = null; // Deselecciona la tarea activa
      appContainer.classList.remove('detalle-visible');
      renderizarDetalles(); // Limpia el panel
    }

    actualizarUIModoSeleccion(); // Actualiza la UI
  } else {
    // Si ya estábamos en modo selección y se hizo clic/long press,
    // simplemente alterna la selección de esa tarea
    toggleSeleccionTarea(tareaIdInicial);
  }
}

// --- Función para SALIR del modo selección ---
function salirModoSeleccion() {
  if (state.tareasEnModoSeleccion) {
    console.log('Saliendo de modo selección...');
    state.tareasEnModoSeleccion = false;
    state.tareasSeleccionadasIds = []; // Limpia la selección
    actualizarUIModoSeleccion(); // Restaura la UI normal
  }
}

// --- Función para ALTERNAR la selección de una tarea ---
function toggleSeleccionTarea(tareaId) {
  // Solo funciona si estamos en modo selección y recibimos un ID válido
  if (!state.tareasEnModoSeleccion || tareaId === null || tareaId === undefined)
    return;

  const index = state.tareasSeleccionadasIds.indexOf(tareaId);
  if (index > -1) {
    // Ya estaba seleccionada -> deseleccionar
    state.tareasSeleccionadasIds.splice(index, 1);
    console.log(`Tarea ${tareaId} deseleccionada.`);
  } else {
    // No estaba seleccionada -> seleccionar
    state.tareasSeleccionadasIds.push(tareaId);
    console.log(`Tarea ${tareaId} seleccionada.`);
  }

  // Si deseleccionamos la última tarea, salimos del modo selección
  if (state.tareasSeleccionadasIds.length === 0) {
    salirModoSeleccion();
  } else {
    actualizarUIModoSeleccion(); // Solo actualiza la UI si seguimos en modo selección
  }
}
// ===================================
// ==   MAIN INITIALIZATION FUNCTION  ==
// ===================================

export function inicializarTareas(pageElement) {
  console.log('--- inicializarTareas ---');

  // --- VARIABLES PARA SWIPE (Barra de Fondo) ---
  let touchStartX = 0,
    touchStartY = 0,
    touchEndX = 0, // <--- ARREGLO #1 (Se inicializan aquí)
    touchEndY = 0; // <--- ARREGLO #1 (Se inicializan aquí)
  let swipedRow = null,
    swipeBackgroundBar = null;
  const swipeThreshold = 50,
    feedbackThreshold = 30,
    swipeMaxVertical = 30;
  let isSwiping = false,
    positioningParent = null;
  let longPressTimer = null;
  let pressStartX = 0;
  let pressStartY = 0;
  const longPressDuration = 500;

  // --- Load Icons, Populate Selectors, Initial Render ---
  try {
    cargarIconos(); // Carga iconos generales
    popularSelectorDeCursos(
      document.getElementById('select-curso-tarea'),
      true,
    );
    popularFiltroDeCursos();
    popularSelectorDeProyectos();

    // --- ARREGLO #3: Cargar iconos del header contextual ---
    const btnCompletarSel = document.getElementById(
      'btn-completar-seleccionadas',
    );
    const btnEliminarSel = document.getElementById(
      'btn-eliminar-seleccionadas',
    );
    const btnCancelarSel = document.getElementById('btn-cancelar-seleccion');

    // Usamos un ícono SVG de "check" como fallback si ICONS.check_all no existe
    const checkAllIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.77 4.93l-1.41-1.41-8.36 8.36-3.54-3.54-1.41 1.41 4.95 4.95zM4.23 12.05l-1.41-1.41-1.41 1.41 1.41 1.41 1.41-1.41zM11.23 12.05l-1.41-1.41-1.41 1.41 1.41 1.41 1.41-1.41z"/></svg>';

    if (btnCompletarSel)
      btnCompletarSel.innerHTML = ICONS.check_all || checkAllIcon;
    if (btnEliminarSel) btnEliminarSel.innerHTML = ICONS.delete;
    if (btnCancelarSel) btnCancelarSel.innerHTML = ICONS.close;
    // --- FIN ARREGLO #3 ---
  } catch (error) {
    console.error('Error durante initial setup (iconos/selectores):', error);
  }

  try {
    renderizarTareas(); // Dibuja la tabla
    renderizarDetalles(); // Dibuja el panel de detalles
  } catch (error) {
    console.error('Error durante el renderizado inicial:', error);
  }

  // --- Show/Hide Details Panel ---
  const appContainer = document.querySelector('.app-container');
  if (appContainer) {
    appContainer.classList.toggle(
      'detalle-visible',
      state.tareaSeleccionadald !== null,
    );
  } else {
    console.error("Contenedor principal '.app-container' no encontrado.");
  }

  // --- SETUP EVENT LISTENERS ---
  const pageTareas = pageElement;
  if (!pageTareas) {
    console.error(
      'Error: inicializarTareas fue llamado sin un elemento de página.',
    );
    return;
  }

  // =================================================================
  // ==                LISTENER GLOBAL (Corregido)                ==
  // =================================================================

  // (Esto ya estaba bien de la vez anterior, evita listeners duplicados)
  if (document.body.dataset.tareasListenerAttached === 'true') {
    console.log('Listener de TAREAS global ya adjunto a document.body.');
  } else {
    document.body.dataset.tareasListenerAttached = 'true';
    console.log('Adjuntando listener de TAREAS global a document.body...');

    document.addEventListener('click', (e) => {
      // Gatekeeper
      if (!activeDropdown && state.paginaActual !== 'tareas') {
        return;
      }
      const currentPageTareas = document.getElementById('page-tareas');
      const isClickInsidePage = currentPageTareas
        ? currentPageTareas.contains(e.target)
        : false;

      // Targets
      const menuButton = e.target.closest('.btn-tarea-menu');
      const dropdownOptionButton = e.target.closest(
        '.tarea-actions-dropdown-active button[data-action]',
      );
      const isClickInsideActiveDropdown = activeDropdown
        ? activeDropdown.contains(e.target)
        : false;

      // 1. Clic en OPCIÓN DEL MENÚ (Funcional)
      if (dropdownOptionButton) {
        e.stopPropagation();
        const action = dropdownOptionButton.dataset.action;
        const associatedTaskId = activeDropdownButton
          ? parseInt(
              activeDropdownButton.closest('tr[data-id]')?.dataset.id,
              10,
            )
          : null;

        if (activeDropdown) activeDropdown.remove();
        activeDropdown = null;
        activeDropdownButton = null;

        if (associatedTaskId !== null) {
          switch (action) {
            case 'editar-tarea-menu':
              if (state.tareaSeleccionadald !== associatedTaskId) {
                state.tareaSeleccionadald = associatedTaskId;
              }
              iniciarEdicionTarea();
              break;
            case 'seleccionar-tarea-menu':
              iniciarModoSeleccion(associatedTaskId);
              break;
            case 'eliminar-tarea-menu':
              const tarea = state.tareas.find((t) => t.id === associatedTaskId);
              if (tarea) {
                mostrarConfirmacion(
                  `Eliminar Tarea`,
                  `¿Eliminar "${tarea.titulo}"?`,
                  () => {
                    eliminarTarea(associatedTaskId);
                  },
                );
              }
              break;
          }
        }
        return;
      }

      // 2. Clic en BOTÓN MENÚ (3 puntos) (Funcional)
      if (menuButton && isClickInsidePage) {
        e.stopPropagation();
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
        // (Lógica de crear y posicionar menú... esto estaba bien)
        const row = menuButton.closest('tr[data-id]');
        const dropdownTemplate = row?.querySelector('.tarea-actions-dropdown');
        if (!dropdownTemplate) return;
        activeDropdown = dropdownTemplate.cloneNode(true);
        activeDropdown.classList.add('tarea-actions-dropdown-active');
        activeDropdown.style.visibility = 'hidden';
        document.body.appendChild(activeDropdown);
        activeDropdownButton = menuButton;
        const btnRect = menuButton.getBoundingClientRect();
        const dropdownRect = activeDropdown.getBoundingClientRect();
        const margin = 10;
        let left = btnRect.left - dropdownRect.width - 5;
        if (left < margin) left = btnRect.right + 5;
        let top = btnRect.top + btnRect.height / 2 - dropdownRect.height / 2;
        if (top + dropdownRect.height > window.innerHeight - margin) {
          top = btnRect.bottom - dropdownRect.height;
        }
        if (top < margin) top = margin;
        activeDropdown.style.top = `${top}px`;
        activeDropdown.style.left = `${left}px`;
        requestAnimationFrame(() => {
          if (activeDropdown) activeDropdown.style.visibility = 'visible';
        });
        return;
      }

      // 3. Clic FUERA del menú activo (Funcional)
      if (activeDropdown && !isClickInsideActiveDropdown) {
        activeDropdown.remove();
        activeDropdown = null;
        activeDropdownButton = null;
      }

      // 4. Lógica de Clics DENTRO de la página
      if (!isClickInsidePage) {
        return;
      }

      const fila = e.target.closest('#tabla-tareas-body tr[data-id]');
      const header = e.target.closest('th[data-sort]');
      const filtroBtn = e.target.closest('.btn-filtro[data-sort]');
      const cerrarDetallesBtn = e.target.closest('#btn-cerrar-detalles');
      const contextualHeaderButton = e.target.closest(
        '#tareas-header-contextual button[data-action]',
      );

      // Clic en Header Contextual
      if (contextualHeaderButton) {
        const action = contextualHeaderButton.dataset.action;
        console.log('Clic en header contextual:', action);
        switch (action) {
          case 'cancelar-seleccion':
            salirModoSeleccion();
            break;
          case 'completar-seleccion':
            // ANTES: console.log('Acción Completar Selección (A implementar)');
            completarTareasSeleccionadas(); // <-- REEMPLAZA AQUÍ
            break;
          case 'eliminar-seleccion':
            // ANTES: console.log('Acción Eliminar Selección (A implementar)');
            eliminarTareasSeleccionadas(); // <-- REEMPLAZA AQUÍ
            break;
        }
        return;
      }

      // --- ARREGLO #2: Lógica de clic en Fila ---
      if (fila && !isClickInsideActiveDropdown && !menuButton) {
        const tareaId = parseInt(fila.dataset.id, 10);

        // Si estamos en modo selección, un clic alterna la selección
        if (state.tareasEnModoSeleccion) {
          console.log(`Modo Selección: Alternando tarea ${tareaId}`);
          toggleSeleccionTarea(tareaId); // <-- ¡ESTO FALTABA!
          return; // Y no abras el panel de detalles
        }

        // Si NO estamos en modo selección, abre los detalles
        if (state.tareaSeleccionadald !== tareaId) {
          console.log('Seleccionando fila ID:', tareaId);
          state.tareaSeleccionadald = tareaId;
          guardarDatos();
          renderizarTareas();
          renderizarDetalles();
          appContainer?.classList.add('detalle-visible');
        }
        return;
      }
      // --- FIN ARREGLO #2 ---

      // Clics en Header, Filtro, Cerrar Detalles (Esto estaba bien)
      if (header) {
        ordenarPor(header.dataset.sort);
        return;
      }
      if (filtroBtn) {
        ordenarPor(filtroBtn.dataset.sort);
        return;
      }
      if (cerrarDetallesBtn) {
        state.tareaSeleccionadald = null;
        guardarDatos();
        appContainer?.classList.remove('detalle-visible');
        renderizarTareas();
        renderizarDetalles();
        return;
      }
    });
  } // --- Fin del IF para listener global ---

  // =================================================================
  // ==        LISTENERS LOCALES (Long Press, Forms, etc.)          ==
  // =================================================================

  const checkSelectAll = document.getElementById('seleccionar-todas-tareas');
  if (checkSelectAll && !checkSelectAll.dataset.listenerAttached) {
    checkSelectAll.dataset.listenerAttached = 'true';
    checkSelectAll.addEventListener('change', (e) => {
      if (!state.tareasEnModoSeleccion) return;
      seleccionarTodasTareasVisibles(e.target.checked);
    });
    console.log('Listener Change añadido a checkSelectAll');
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

        // --- ARREGLO #1: Inicializa touchEnd aquí ---
        touchEndX = touch.clientX;
        touchEndY = touch.clientY;
        // --- FIN ARREGLO #1 ---

        const fila = e.target.closest('tr[data-id]');
        if (!fila) return;
        const tareaId = parseInt(fila.dataset.id, 10);

        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          // Ahora 'touchEndX/Y' tienen el valor inicial si no hubo 'touchmove'
          const currentDiffX = Math.abs(touchEndX - pressStartX);
          const currentDiffY = Math.abs(touchEndY - pressStartY);

          if (currentDiffX < 10 && currentDiffY < 10) {
            // El chequeo ahora funciona
            console.log('Long press confirmado en ID:', tareaId);
            iniciarModoSeleccion(tareaId);
          } else {
            console.log('Long press cancelado por movimiento excesivo.');
          }
          longPressTimer = null;
        }, longPressDuration);
      },
      { passive: true },
    );

    tablaBody.addEventListener(
      'touchmove',
      (e) => {
        // Esto estaba bien, actualiza 'touchEnd' si hay movimiento
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
    console.log('Listeners Long Press añadidos a tablaBody');
  }

  // (El resto de listeners: dblclick, panelDetalles, swipe, forms, etc.
  // ... estaban bien y pueden quedarse como están)

  if (tablaBody && !tablaBody.dataset.dblClickListener) {
    tablaBody.dataset.dblClickListener = 'true';
    tablaBody.addEventListener('dblclick', (e) => {
      const fila = e.target.closest('tr[data-id]');
      if (
        !fila ||
        window.getSelection().toString() ||
        state.tareasEnModoSeleccion
      )
        return; // <-- Añadido chequeo de modo selección
      const tareaId = parseInt(fila.dataset.id, 10);
      const tarea = state.tareas.find((t) => t.id === tareaId);
      if (tarea) {
        tarea.completada = !tarea.completada;
        tarea.fechaCompletado = tarea.completada
          ? new Date().toISOString().split('T')[0]
          : null;
        guardarDatos();
        renderizarTareas();
        if (tareaId === state.tareaSeleccionadald) renderizarDetalles();
      }
    });
    console.log('Listener DblClick añadido a tablaBody');
  }

  const panelDetalles = document.getElementById('panel-detalles');
  if (panelDetalles && !panelDetalles.dataset.clickListener) {
    panelDetalles.dataset.clickListener = 'true';
    panelDetalles.addEventListener('click', (e) => {
      // (Tu lógica de click en panel detalles estaba bien)
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
        );
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
        );
        if (tarea) {
          mostrarConfirmacion(
            'Eliminar Tarea',
            `¿Eliminar "${tarea.titulo}"?`,
            () => {
              eliminarTarea(state.tareaSeleccionadald);
            },
          );
        }
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
    console.log('Listener Delegado añadido a panelDetalles');
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
        // (Tu lógica de touchstart para swipe estaba bien)
        if (state.tareasEnModoSeleccion) return; // <-- Añadido chequeo
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
        // (Tu lógica de touchmove para swipe estaba bien)
        if (state.tareasEnModoSeleccion || !swipedRow) return; // <-- Añadido chequeo
        if (!swipedRow || !positioningParent) return;
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
      // (Tu lógica de touchend para swipe estaba bien)
      if (state.tareasEnModoSeleccion || !swipedRow) return; // <-- Añadido chequeo
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
            if (tareaId === state.tareaSeleccionadald) renderizarDetalles();
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
    console.log('Listeners Swipe (Barra Fondo) añadidos a tablaBody');
  }

  const formNuevaTarea = document.getElementById('form-nueva-tarea');
  if (formNuevaTarea && !formNuevaTarea.dataset.submitListener) {
    formNuevaTarea.dataset.submitListener = 'true';
    formNuevaTarea.addEventListener('submit', agregarTarea);
    console.log('Listener Submit añadido a formNuevaTarea');
  }

  const formEditarTarea = document.getElementById('form-editar-tarea');
  if (formEditarTarea && !formEditarTarea.dataset.submitListener) {
    formEditarTarea.dataset.submitListener = 'true';
    formEditarTarea.addEventListener('submit', (e) => {
      e.preventDefault();
      const tarea = state.tareas.find(
        (t) => t.id === state.tareaSeleccionadald,
      );
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
          ) || null;
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
    console.log('Listener Submit añadido a formEditarTarea');
  }

  const filtroCursoSelect = document.getElementById('filtro-curso');
  if (filtroCursoSelect && !filtroCursoSelect.dataset.changeListener) {
    filtroCursoSelect.dataset.changeListener = 'true';
    filtroCursoSelect.addEventListener('change', (e) => {
      state.filtroCurso = e.target.value;
      renderizarTareas();
    });
    console.log('Listener Change añadido a filtroCursoSelect');
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
      // (Tu lógica de modal móvil estaba bien)
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
      } else {
        console.error('Faltan elementos para mostrar form en modal móvil');
      }
    });
    console.log('Listener Click añadido a btnAbrirCreacionMovil');
  }

  console.log('--- inicializarTareas Complete ---');
} //=================================
