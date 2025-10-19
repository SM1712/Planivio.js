import { state } from './state.js';
import { ICONS } from './icons.js';

// ===============================================
// == FUNCIONES DE UI GLOBALES Y REUTILIZABLES ===
// ===============================================

export function cargarIconos() {
  // Configura iconos globales en el cascarón principal (index.html)
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

  // Los botones de cierre ahora se cargan con cada página, por lo que los buscamos de forma segura aquí.
  // Esto se ejecutará cada vez que se cargue una página que los contenga.
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

// --- Funciones para Modales (son globales) ---

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

// --- Funciones de Ayuda para Selectores (reutilizables) ---

export function popularSelectorDeCursos(
  selectorElement,
  omitirGeneral = false,
) {
  const selector =
    selectorElement || document.getElementById('select-curso-tarea');
  if (!selector) return;

  const valorSeleccionado = selector.value;
  selector.innerHTML = '';
  state.cursos.forEach((nombreCurso) => {
    if (omitirGeneral && nombreCurso === 'General' && state.cursos.length > 1) {
      return;
    }
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
