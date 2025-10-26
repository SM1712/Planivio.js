import { state } from './state.js';
import { ICONS } from './icons.js';

// ===============================================
// == FUNCIONES DE UI GLOBALES Y REUTILIZABLES ===
// ===============================================

export function cargarIconos() {
  // ... (función sin cambios)
  document.getElementById('btn-toggle-sidebar').innerHTML = ICONS.menu;
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
  const btnFlotante = document.getElementById('btn-abrir-creacion-movil');
  if (btnFlotante) btnFlotante.innerHTML = ICONS.add;
  const btnCerrarDetalles = document.getElementById('btn-cerrar-detalles');
  if (btnCerrarDetalles) btnCerrarDetalles.innerHTML = ICONS.close;
  const btnEditarTareaDetalles = document.getElementById('btn-editar-tarea');
  if (btnEditarTareaDetalles) btnEditarTareaDetalles.innerHTML = ICONS.edit;
  const btnEliminarTareaDetalles =
    document.getElementById('btn-eliminar-tarea');
  if (btnEliminarTareaDetalles)
    btnEliminarTareaDetalles.innerHTML = ICONS.delete;
  const btnCerrarDetallesProyecto = document.getElementById(
    'btn-cerrar-detalles-proyecto',
  );
  if (btnCerrarDetallesProyecto)
    btnCerrarDetallesProyecto.innerHTML = ICONS.close;
}

// --- Funciones para Modales (sin cambios) ---

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

  if (confirmTitle) confirmTitle.textContent = titulo;
  if (confirmMsg) confirmMsg.textContent = msg;

  const nuevoAceptarBtn = aceptarBtn.cloneNode(true);
  aceptarBtn.parentNode.replaceChild(nuevoAceptarBtn, aceptarBtn);

  nuevoAceptarBtn.addEventListener(
    'click',
    () => {
      callback();
      cerrarModal('modal-confirmacion');
    },
    { once: true },
  );

  mostrarModal('modal-confirmacion');
}

export function mostrarAlerta(titulo, msg, callback) {
  const confirmTitle = document.getElementById('confirm-title');
  const confirmMsg = document.getElementById('confirm-msg');
  const aceptarBtn = document.getElementById('btn-confirm-aceptar');
  const cancelarBtn = document.getElementById('btn-confirm-cancelar');

  if (confirmTitle) confirmTitle.textContent = titulo;
  if (confirmMsg) confirmMsg.textContent = msg;
  if (cancelarBtn) cancelarBtn.style.display = 'none';

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
    const cancelarBtn = document.getElementById('btn-prompt-cancelar');

    titleEl.textContent = titulo;
    msgEl.textContent = msg;
    inputEl.value = defaultValue;

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

    form.addEventListener('submit', handleSubmit, { once: true });
    cancelarBtn.addEventListener('click', handleCancel, { once: true });

    mostrarModal('modal-prompt');
    setTimeout(() => inputEl.focus(), 100);
  });
}

// --- Funciones de Ayuda para Selectores (ACTUALIZADAS) ---

/**
 * REFACTORIZADO: Popula un <select> con los cursos desde state.cursos (array de objetos).
 * @param {HTMLElement} selectorElement - El elemento <select> a popular.
 * @param {boolean} omitirGeneral - Si es true, no incluye "General" (si hay más cursos).
 */
export function popularSelectorDeCursos(
  selectorElement,
  omitirGeneral = false,
) {
  const selector = selectorElement; // Asume que el elemento es pasado directamente
  if (!selector) return;

  const valorSeleccionado = selector.value;
  selector.innerHTML = '';

  // Filtramos los cursos que se pueden mostrar
  const cursosMostrables = state.cursos.filter((curso) => {
    if (curso.isArchivado) return false; // Oculta archivados
    if (
      omitirGeneral &&
      curso.nombre === 'General' &&
      state.cursos.filter((c) => !c.isArchivado).length > 1
    ) {
      return false; // Oculta "General" si se pide
    }
    return true;
  });

  // Iteramos sobre los objetos 'curso'
  cursosMostrables.forEach((curso) => {
    const opcion = document.createElement('option');
    opcion.value = curso.nombre; // El valor sigue siendo el nombre
    opcion.textContent = `${curso.emoji ? curso.emoji + ' ' : ''}${
      curso.nombre
    }`; // El texto incluye emoji
    selector.appendChild(opcion);
  });

  // Re-seleccionar el valor si todavía existe en la nueva lista
  if (cursosMostrables.find((c) => c.nombre === valorSeleccionado)) {
    selector.value = valorSeleccionado;
  }
}

/**
 * REFACTORIZADO: Popula el <select> de filtro de cursos.
 * (Esta función parece ser del sistema de filtros antiguo de Tareas)
 */
export function popularFiltroDeCursos() {
  const selector = document.getElementById('filtro-curso');
  if (!selector) return;

  selector.innerHTML = '<option value="todos">Todos los Cursos</option>';

  // Filtramos cursos de state.cursos, no de state.tareas
  const cursosFiltrables = state.cursos.filter((curso) => !curso.isArchivado);

  cursosFiltrables.forEach((curso) => {
    const opcion = document.createElement('option');
    opcion.value = curso.nombre;
    opcion.textContent = `${curso.emoji ? curso.emoji + ' ' : ''}${
      curso.nombre
    }`;
    selector.appendChild(opcion);
  });

  selector.value = state.filtroCurso;
}

// --- (Funciones de Proyectos y Onboarding sin cambios) ---

export function popularSelectorDeProyectos(
  selectorId = 'select-proyecto-tarea',
) {
  const selector = document.getElementById(selectorId);
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
  popularSelectorDeProyectos('edit-select-proyecto-tarea');
  if (selector && proyectoIdSeleccionado) {
    selector.value = proyectoIdSeleccionado;
  }
}

export function mostrarModalOnboarding() {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-onboarding');
    const form = document.getElementById('form-onboarding');
    const inputEl = document.getElementById('input-onboarding-nombre');

    mostrarModal('modal-onboarding');
    setTimeout(() => inputEl.focus(), 100);

    form.addEventListener(
      'submit',
      (e) => {
        e.preventDefault();
        const nombre = inputEl.value.trim();
        if (nombre) {
          cerrarModal('modal-onboarding');
          resolve(nombre);
        }
      },
      { once: true },
    );
  });
}
// Añade esta función en ui.js
export function mostrarNotificacion(titulo, opciones) {
  // Primero, verificamos que el navegador soporte la API
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones de escritorio.');
    return;
  }

  // Si tenemos permiso, creamos la notificación
  if (Notification.permission === 'granted') {
    new Notification(titulo, opciones);
  }
  // Si el permiso no ha sido denegado (es 'default'), lo pedimos.
  else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      // Si el usuario lo concede, creamos la notificación
      if (permission === 'granted') {
        new Notification(titulo, opciones);
      }
    });
  }
  // Si el permiso fue denegado, no podemos hacer nada.
}
