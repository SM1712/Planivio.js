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
  cargarIconos, // Corregido el nombre
} from '../ui.js';
import { ICONS } from '../icons.js';

// ======================================================
// ==        HELPER FUNCTIONS FOR THIS MODULE         ==
// ======================================================

// --- Render Main Table (Visible Only) ---
function renderizarTareas() {
  const tbody = document.getElementById('tabla-tareas-body'); // Solo tbody visible
  if (!tbody) {
    console.error('Error: Elemento #tabla-tareas-body no encontrado.');
    return;
  }

  // --- Filtering ---
  let tareasAMostrar = state.tareas;
  if (state.filtroCurso && state.filtroCurso !== 'todos') {
    tareasAMostrar = state.tareas.filter((t) => t.curso === state.filtroCurso);
  }

  // --- Sorting ---
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

  // --- Date Check Helper ---
  const obtenerClaseVencimiento = (fechaTareaStr) => {
    if (!fechaTareaStr) return 'tarea-sin-fecha';
    let fechaTarea;
    try {
      fechaTarea = new Date(fechaTareaStr + 'T00:00:00');
      if (isNaN(fechaTarea.getTime())) throw new Error('Fecha inválida');
    } catch (e) {
      console.warn(`Fecha inválida encontrada: ${fechaTareaStr}`);
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

  // --- Render Rows ---
  tbody.innerHTML = ''; // Limpiar tabla
  tareasFinales.forEach((tarea) => {
    const tr = document.createElement('tr');
    tr.dataset.id = tarea.id;

    // Apply status classes (due, completed, selected)
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

    // Format date
    const [year, month, day] =
      tarea.fecha && !isNaN(new Date(tarea.fecha + 'T00:00:00'))
        ? tarea.fecha.split('-')
        : ['--', '--', '--'];
    const fechaFormateada = `${day}/${month}/${year}`;

    // Generate HTML with wrappers
    tr.innerHTML = `
      <td class="celda-muesca"><span class="muesca-vencimiento"></span></td>
      <td><div class="cell-content-wrapper">${tarea.curso || 'General'}</div></td>
      <td class="col-prioridad">
        <div class="cell-content-wrapper">
          <span class="prioridad-indicador prioridad-${tarea.prioridad?.toLowerCase() || 'baja'}"></span>
        </div>
      </td>
      <td><div class="cell-content-wrapper">${tarea.titulo || '(Sin título)'}</div></td>
      <td><div class="cell-content-wrapper">${fechaFormateada}</div></td>
    `;
    tbody.appendChild(tr);
  });

  // --- Update UI Counters/Filters ---
  const tituloPendientes = document.getElementById('titulo-tareas-pendientes');
  if (tituloPendientes) {
    const countPendientes = tareasAMostrar.filter((t) => !t.completada).length;
    tituloPendientes.textContent = `Tareas Pendientes (${countPendientes})`;
  }
  document.querySelectorAll('.btn-filtro[data-sort]').forEach((btn) => {
    const isActive = btn.dataset.sort === col;
    btn.classList.toggle('active', isActive);
    // Add arrow indicator logic here if desired
  });
  const filtroCursoSelect = document.getElementById('filtro-curso');
  if (filtroCursoSelect) {
    filtroCursoSelect.value = state.filtroCurso || 'todos';
  }
} // === END of renderizarTareas ===

// --- Render Details Panel ---
function renderizarDetalles() {
  console.log('--- Iniciando renderizarDetalles ---');
  console.log('ID Tarea seleccionada (state):', state.tareaSeleccionadald);

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

  console.log('Elementos encontrados:', {
    titulo,
    descripcion,
    btnCompletar,
    btnEditar,
    btnEliminar,
    subtareasContainer,
    listaSubtareas,
    proyectoContainer,
    proyectoNombre,
  });

  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  console.log('Tarea encontrada en state:', tarea);

  if (tarea) {
    console.log('Tarea válida encontrada, actualizando DOM...');
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
      subtareasContainer.style.display = 'flex';
      renderizarSubtareas(tarea);
    }
  } else {
    // Clean panel
    console.log(
      'No hay tarea seleccionada o no encontrada, limpiando panel...',
    );
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
  console.log('--- Finalizando renderizarDetalles ---');
}

// --- Render Subtasks ---
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
          <span class="subtarea-texto" id="subtarea-texto-${tarea.id}-${index}">${sub.texto}</span>
          <button class="btn-icon btn-delete-subtask" data-index="${index}" title="Eliminar sub-tarea" aria-label="Eliminar sub-tarea ${sub.texto}">
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
  renderizarTareas();
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

  if (
    !tituloInput ||
    !fechaInput ||
    !cursoSelect ||
    !proyectoSelect ||
    !descInput ||
    !prioridadSelect
  ) {
    alert('Error: Formulario incompleto.');
    return;
  }
  const nuevaTarea = {
    id: Date.now(),
    curso: cursoSelect.value || 'General',
    proyectold: parseInt(proyectoSelect.value) || null,
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
  if (cursoSelect && state.cursos.length > 0)
    cursoSelect.value =
      state.cursos.find((c) => c !== 'General') || state.cursos[0];
}

// --- Subtask Actions ---
function agregarSubtarea() {
  const input = document.getElementById('input-nueva-subtarea');
  const texto = input?.value.trim();
  if (!texto || state.tareaSeleccionadald === null) return;
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  if (tarea) {
    if (!tarea.subtareas) tarea.subtareas = [];
    tarea.subtareas.push({ texto, completada: false });
    if (input) input.value = '';
    guardarDatos();
    renderizarSubtareas(tarea);
  }
}
function eliminarSubtarea(index) {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  if (!tarea || !tarea.subtareas || tarea.subtareas[index] === undefined)
    return;
  const subTexto = tarea.subtareas[index].texto;
  mostrarConfirmacion('Eliminar Sub-tarea', `¿Eliminar "${subTexto}"?`, () => {
    tarea.subtareas.splice(index, 1);
    guardarDatos();
    renderizarSubtareas(tarea);
  });
}
function toggleSubtarea(index) {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  if (tarea && tarea.subtareas && tarea.subtareas[index] !== undefined) {
    tarea.subtareas[index].completada = !tarea.subtareas[index].completada;
    guardarDatos();
    // Update visually (more efficient than full re-render)
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
    }
    // Fallback: renderizarSubtareas(tarea);
  }
}

// --- Open Edit Modal ---
function iniciarEdicionTarea() {
  const tarea = state.tareas.find((t) => t.id === state.tareaSeleccionadald);
  if (!tarea) return;
  try {
    document.getElementById('edit-titulo-tarea').value = tarea.titulo || '';
    document.getElementById('edit-desc-tarea').value = tarea.descripcion || '';
    document.getElementById('edit-fecha-tarea').value = tarea.fecha || '';
    document.getElementById('edit-prioridad-tarea').value =
      tarea.prioridad || 'Media';
    popularSelectorDeProyectosEdicion(tarea.proyectold); // Ensure this populates correctly
    mostrarModal('modal-editar-tarea');
  } catch (error) {
    console.error('Error populating edit modal:', error);
  }
}

// --- Generic Delete Task by ID ---
function eliminarTarea(idAEliminar) {
  if (idAEliminar === null || idAEliminar === undefined) return;
  const tareaIndex = state.tareas.findIndex((t) => t.id === idAEliminar);
  if (tareaIndex === -1) return;
  state.tareas.splice(tareaIndex, 1);
  if (state.tareaSeleccionadald === idAEliminar) {
    state.tareaSeleccionadald = null;
    document
      .querySelector('.app-container')
      ?.classList.remove('detalle-visible');
    renderizarDetalles();
  }
  guardarDatos();
  renderizarTareas();
  popularFiltroDeCursos();
}

// --- Delete Selected Task (uses generic delete) ---
function eliminarTareaSeleccionada() {
  eliminarTarea(state.tareaSeleccionadald);
}

// ===================================
// ==   MAIN INITIALIZATION FUNCTION  ==
// ===================================

export function inicializarTareas() {
  console.log('--- inicializarTareas ---');

  // --- VARIABLES FOR SWIPE (Wrapper Transform) ---
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let swipedRow = null; // Fila TR original
  let swipeBackgroundBar = null; // Barra DIV de fondo
  let swipeThreshold = 50;
  let feedbackThreshold = 30;
  let swipeMaxVertical = 30;
  let isSwiping = false;
  let positioningParent = null;

  // --- Load Icons, Populate Selectors, Initial Render ---
  try {
    cargarIconos();
    popularSelectorDeCursos(
      document.getElementById('select-curso-tarea'),
      true,
    );
    popularFiltroDeCursos();
    popularSelectorDeProyectos();
  } catch (error) {
    console.error('Error during initial setup:', error);
  }

  renderizarTareas();
  renderizarDetalles();

  // --- Show/Hide Details Panel ---
  const appContainer = document.querySelector('.app-container');
  if (appContainer) {
    appContainer.classList.toggle(
      'detalle-visible',
      state.tareaSeleccionadald !== null,
    );
  } else {
    console.error("'.app-container' not found.");
  }

  // --- SETUP EVENT LISTENERS ---
  const pageTareas = document.getElementById('page-tareas');
  if (!pageTareas) {
    console.error('#page-tareas element not found.');
    return;
  }
  if (pageTareas.dataset.listenersAttached === 'true') {
    console.log('Listeners already attached.');
    return;
  }
  pageTareas.dataset.listenersAttached = 'true';

  // === Listener for PAGE CLICKS (Row Selection, Headers, Filters, Close Button) ===
  pageTareas.addEventListener('click', (e) => {
    const fila = e.target.closest('#tabla-tareas-body tr[data-id]');
    const header = e.target.closest('th[data-sort]');
    const filtroBtn = e.target.closest('.btn-filtro[data-sort]');
    const cerrarDetallesBtn = e.target.closest('#btn-cerrar-detalles');

    if (fila) {
      /* Select row logic */
      const tareaId = parseInt(fila.dataset.id, 10);
      if (state.tareaSeleccionadald !== tareaId) {
        state.tareaSeleccionadald = tareaId;
        guardarDatos();
        renderizarTareas();
        renderizarDetalles();
        appContainer?.classList.add('detalle-visible');
      }
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
    if (cerrarDetallesBtn) {
      /* Close details logic */
      state.tareaSeleccionadald = null;
      guardarDatos();
      appContainer?.classList.remove('detalle-visible');
      renderizarTareas();
      renderizarDetalles();
      return;
    }
  });

  // === Listener for DOUBLE CLICK (Complete/Uncomplete) ===
  const tablaBody = document.getElementById('tabla-tareas-body'); // Renamed for consistency
  if (tablaBody && !tablaBody.dataset.dblClickListener) {
    tablaBody.dataset.dblClickListener = 'true';
    tablaBody.addEventListener('dblclick', (e) => {
      const fila = e.target.closest('tr[data-id]');
      if (!fila || window.getSelection().toString()) return;
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
  }

  // === DELEGATED Listener for DETAILS PANEL actions ===
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
        console.log('>>> Botón ELIMINAR detectado. Mostrando confirmación...'); // Log ajustado
        const tarea = state.tareas.find(
          (t) => t.id === state.tareaSeleccionadald,
        );
        if (tarea) {
          mostrarConfirmacion(
            'Eliminar Tarea',
            `¿Estás seguro de que quieres eliminar la tarea "${tarea.titulo}"? Esta acción no se puede deshacer.`,
            () => {
              console.log(
                `Confirmado ELIMINAR Tarea ID: ${tarea.id} desde botón`,
              ); // Log confirmación
              eliminarTarea(state.tareaSeleccionadald); // Llama a la función genérica DESPUÉS de confirmar
            },
          );
        } else {
          console.error(
            'No se encontró la tarea seleccionada para eliminar desde el botón.',
          );
        }
        return; // Importante
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

  // === Listeners for SWIPE (Transforming Wrappers) ===
  if (tablaBody && !tablaBody.dataset.touchListenersBar) {
    // Nuevo dataset
    tablaBody.dataset.touchListenersBar = 'true';
    positioningParent = document.querySelector('.tabla-container'); // Padre para posicionar barra
    if (
      positioningParent &&
      window.getComputedStyle(positioningParent).position === 'static'
    ) {
      positioningParent.style.position = 'relative';
    }

    tablaBody.addEventListener(
      'touchstart',
      (e) => {
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        swipedRow = e.target.closest('tr[data-id]');
        isSwiping = false;
        touchEndX = touchStartX;
        touchEndY = touchStartY;
        swipeBackgroundBar = null; // Resetea barra
        // Limpia barras huérfanas
        document
          .querySelectorAll('.swipe-background-bar')
          .forEach((b) => b.remove());
      },
      { passive: true },
    );

    tablaBody.addEventListener(
      'touchmove',
      (e) => {
        if (!swipedRow || !positioningParent) return;

        const touch = e.touches[0];
        touchEndX = touch.clientX;
        touchEndY = touch.clientY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // --- Inicio real del Swipe ---
        if (
          !isSwiping &&
          Math.abs(diffX) > 10 &&
          Math.abs(diffX) > Math.abs(diffY)
        ) {
          isSwiping = true;

          // --- CREAR/MOSTRAR BARRA DE FONDO ---
          if (!swipeBackgroundBar) {
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
            // Retraso mínimo para asegurar que esté en DOM antes de añadir 'visible'
            requestAnimationFrame(() => {
              if (swipeBackgroundBar)
                swipeBackgroundBar.classList.add('visible');
            });
          }
        }

        // --- Mover Wrappers y Actualizar Barra ---
        if (isSwiping) {
          // Mueve los wrappers de contenido
          const wrappers = swipedRow.querySelectorAll('.cell-content-wrapper');
          wrappers.forEach((wrapper) => {
            wrapper.style.transform = `translateX(${diffX}px)`;
          });

          // Actualiza clases de la BARRA para color/icono
          if (swipeBackgroundBar) {
            if (diffX < -feedbackThreshold) {
              // Izquierda
              swipeBackgroundBar.classList.add('swiping-left', 'show-feedback');
              swipeBackgroundBar.classList.remove('swiping-right');
            } else if (diffX > feedbackThreshold) {
              // Derecha
              swipeBackgroundBar.classList.add(
                'swiping-right',
                'show-feedback',
              );
              swipeBackgroundBar.classList.remove('swiping-left');
            } else {
              // Centro
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
      const rowToAnimate = swipedRow;
      const barToRemove = swipeBackgroundBar; // Guarda referencia

      if (!rowToAnimate || !isSwiping || !barToRemove) {
        if (barToRemove) barToRemove.remove(); // Limpia si algo falló
        swipedRow = null;
        swipeBackgroundBar = null;
        isSwiping = false;
        return;
      }

      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      // --- ELIMINAR BARRA (con fade-out) ---
      barToRemove.style.opacity = '0';
      setTimeout(() => {
        barToRemove.remove();
      }, 150); // Tiempo de transition

      // --- RESETEAR WRAPPERS ---
      const wrappers = rowToAnimate.querySelectorAll('.cell-content-wrapper');
      wrappers.forEach((wrapper) => {
        wrapper.style.transform = '';
      });

      // --- LÓGICA DE ACCIÓN (CON LOGS Y SIN SETTIMEOUT TEMPORALMENTE) ---
      if (
        Math.abs(diffX) > swipeThreshold &&
        Math.abs(diffY) < swipeMaxVertical
      ) {
        const tareaId = parseInt(rowToAnimate.dataset.id, 10);
        console.log('Swipe válido detectado. DiffX:', diffX); // Log

        // Quitamos setTimeout temporalmente para probar
        // setTimeout(() => {
        const tarea = state.tareas.find((t) => t.id === tareaId);
        if (!tarea) {
          console.error('Tarea no encontrada para acción swipe, ID:', tareaId); // Log Error
          return; // Salir si no hay tarea
        }

        if (diffX < 0) {
          // Izquierda -> Completar (SIN CAMBIOS)
          console.log(`Ejecutando acción COMPLETAR para Tarea ID: ${tareaId}`); // Log
          tarea.completada = !tarea.completada;
          tarea.fechaCompletado = tarea.completada
            ? new Date().toISOString().split('T')[0]
            : null;
          guardarDatos();
          renderizarTareas();
          if (tareaId === state.tareaSeleccionadald) renderizarDetalles();
        } else {
          // Derecha -> Eliminar
          console.log(
            `INTENTANDO mostrar confirmación para ELIMINAR Tarea ID: ${tareaId}`,
          ); // Log Clave
          mostrarConfirmacion(
            // <<< LLAMADA DIRECTA
            `Eliminar Tarea`,
            `¿Eliminar "${tarea.titulo}"?`,
            () => {
              console.log(`Confirmado ELIMINAR Tarea ID: ${tareaId}`); // Log Confirmación
              eliminarTarea(tareaId);
            },
          );
          console.log('Llamada a mostrarConfirmacion realizada.'); // Log Clave
        }
        // }, 50); // Fin setTimeout (comentado)
      }

      // Reseteo final (SIN CAMBIOS)
      swipedRow = null;
      isSwiping = false;
    }); // Fin touchend
  }

  // === Listener for NEW TASK Form Submit ===
  const formNuevaTarea = document.getElementById('form-nueva-tarea');
  if (formNuevaTarea && !formNuevaTarea.dataset.submitListener) {
    formNuevaTarea.dataset.submitListener = 'true';
    formNuevaTarea.addEventListener('submit', agregarTarea);
  }

  // === Listener for EDIT TASK Form Submit ===
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
  }

  // === Listener for COURSE FILTER Change ===
  const filtroCursoSelect = document.getElementById('filtro-curso');
  if (filtroCursoSelect && !filtroCursoSelect.dataset.changeListener) {
    filtroCursoSelect.dataset.changeListener = 'true';
    filtroCursoSelect.addEventListener('change', (e) => {
      state.filtroCurso = e.target.value;
      renderizarTareas();
    });
  }

  console.log('--- inicializarTareas Complete ---');
} // === END of inicializarTareas Function ===
