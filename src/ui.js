import { state } from './state.js';
import { ICONS } from './icons.js';
import { calcularRacha } from './utils.js'; // <-- AÑADIDO

// ===============================================
// == ✨ INICIO CAMBIO ETAPA 14: Lógica de Audio (Simplificada)
// ===============================================

let sonidoNotificacion = null;
// La bandera de 'sonidoPendiente' ya no es necesaria.

/**
 * Inicializa el sonido de notificación usando Howler.
 * Se debe llamar una vez al cargar la app.
 */
export function inicializarSonido() {
  //
  sonidoNotificacion = new Howl({
    src: ['assets/notification.mp3'],
    preload: true,
    // html5: true, // <-- ELIMINADO: Web Audio API es mejor para efectos cortos y autoplay
    onloaderror: (id, err) => {
      console.error(
        '[Audio] Error CRÍTICO al cargar el sonido de notificación:',
        err,
      );
    },
    onplayerror: (id, err) => {
      console.warn(
        '[Audio] Bloqueo de autoplay detectado. El sonido se habilitará tras la primera interacción.',
        err,
      );
      sonidoNotificacion.once('unlock', () => {
        console.log('[Audio] Audio desbloqueado. Reproduciendo...');
        sonidoNotificacion.play();
      });
    },
    onload: () => {
      console.log('[Audio] Sonido de notificación cargado exitosamente.');
    },
  });

  // ✨ INICIO CORRECCIÓN ETAPA 14:
  // Se elimina el listener 'Howler.on("unlock", ...)' que causaba el error.
  // Howler.js maneja el desbloqueo automáticamente en la primera
  // interacción del usuario (clic).
  // ✨ FIN CORRECCIÓN ETAPA 14
}

/**
 * Reproduce el sonido de notificación si está cargado.
 *
 */
export function reproducirSonidoNotificacion() {
  // Intento 1: Usar Howler si está listo
  if (sonidoNotificacion && sonidoNotificacion.state() === 'loaded') {
    sonidoNotificacion.play();
    return;
  }

  // Intento 2: Fallback nativo HTML5 Audio (más confiable a veces)
  try {
    const audio = new Audio('assets/notification.mp3');
    audio.play().catch(e => console.warn('[Audio] Fallback nativo bloqueado:', e));
  } catch (e) {
    console.error('[Audio] Error fatal reproduciendo sonido:', e);
  }
}

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

/**
 * MODIFICADO: Ahora devuelve una Promesa<boolean> y acepta texto de botones.
 * Resuelve 'true' si se acepta, 'false' si se cancela.
 */
export function mostrarConfirmacion(
  titulo,
  msg,
  btnAceptarTexto = 'Aceptar',
  btnCancelarTexto = 'Cancelar',
) {
  return new Promise((resolve) => {
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMsg = document.getElementById('confirm-msg');
    const aceptarBtn = document.getElementById('btn-confirm-aceptar');
    const cancelarBtn = document.getElementById('btn-confirm-cancelar');

    if (confirmTitle) confirmTitle.textContent = titulo;
    if (confirmMsg) confirmMsg.innerHTML = msg; // Cambiado a innerHTML por si quieres usar <br>
    if (aceptarBtn) aceptarBtn.textContent = btnAceptarTexto;
    if (cancelarBtn) {
      cancelarBtn.textContent = btnCancelarTexto;
      cancelarBtn.style.display = 'inline-block'; // Asegurarse de que sea visible
    }

    // Clonar botones para limpiar listeners antiguos
    const nuevoAceptarBtn = aceptarBtn.cloneNode(true);
    aceptarBtn.parentNode.replaceChild(nuevoAceptarBtn, aceptarBtn);

    const nuevoCancelarBtn = cancelarBtn.cloneNode(true);
    cancelarBtn.parentNode.replaceChild(nuevoCancelarBtn, cancelarBtn);

    const cleanupAndResolve = (valor) => {
      cerrarModal('modal-confirmacion');
      resolve(valor);
    };

    nuevoAceptarBtn.addEventListener('click', () => cleanupAndResolve(true), {
      once: true,
    });

    nuevoCancelarBtn.addEventListener('click', () => cleanupAndResolve(false), {
      once: true,
    });

    mostrarModal('modal-confirmacion');
  });
}

/**
 * MODIFICADO: ¡Ahora devuelve una promesa!
 * Esto es VITAL para que el tour de Pulsito funcione.
 */
export function mostrarAlerta(titulo, msg, callback) {
  return new Promise((resolve) => {
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMsg = document.getElementById('confirm-msg');
    const aceptarBtn = document.getElementById('btn-confirm-aceptar');
    const cancelarBtn = document.getElementById('btn-confirm-cancelar');

    if (confirmTitle) confirmTitle.textContent = titulo;
    if (confirmMsg) confirmMsg.innerHTML = msg; // Cambiado a innerHTML
    if (cancelarBtn) cancelarBtn.style.display = 'none'; // Ocultar cancelar en alerta
    if (aceptarBtn) aceptarBtn.textContent = 'Aceptar'; // Resetear texto

    const nuevoAceptarBtn = aceptarBtn.cloneNode(true);
    aceptarBtn.parentNode.replaceChild(nuevoAceptarBtn, aceptarBtn);

    nuevoAceptarBtn.addEventListener(
      'click',
      () => {
        cerrarModal('modal-confirmacion');
        if (callback) callback();
        resolve(true); // Resuelve la promesa cuando se hace clic
      },
      { once: true },
    );

    mostrarModal('modal-confirmacion');
  });
}

/**
 * Muestra un paso del tour, resaltando un elemento y mostrando una alerta.
 * @param {string} selector - Selector CSS del elemento a resaltar.
 * @param {string} titulo - Título de la alerta.
 * @param {string} mensaje - Mensaje de la alerta.
 * @returns {Promise<void>}
 */
export async function mostrarPasoTour(selector, titulo, mensaje) {
  const elemento = document.querySelector(selector);
  if (elemento) {
    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
    elemento.classList.add('tour-highlight');
  } else {
    console.warn(`[Tour] No se encontró el elemento: ${selector}`);
  }

  // Esperar un poco para que el scroll termine y el usuario se ubique
  await new Promise((r) => setTimeout(r, 600));

  await mostrarAlerta(titulo, mensaje);

  if (elemento) {
    elemento.classList.remove('tour-highlight');
  }
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
      reject(new Error('Prompt cancelado por el usuario'));
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

/**
 * ACTUALIZADO: Popula un <select> con los proyectos, opcionalmente excluyendo
 * aquellos cuyo curso asociado está archivado.
 * @param {string} selectorId - El ID del elemento <select> a popular.
 * @param {boolean} excluirProyectosDeCursosArchivados - Si es true, omite proyectos de cursos archivados. (Default: true)
 */
export function popularSelectorDeProyectos(
  selectorId = 'select-proyecto-tarea',
  excluirProyectosDeCursosArchivados = true, // Default a true para la nueva lógica
) {
  const selector = document.getElementById(selectorId);
  if (!selector) return;

  const valorSeleccionado = selector.value;
  selector.innerHTML = '<option value="">Ninguno</option>'; // Opción "Ninguno" siempre presente

  // Construir un Set con los nombres de cursos archivados para búsqueda rápida
  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );

  state.proyectos.forEach((proyecto) => {
    // --- NUEVA LÓGICA DE FILTRADO ---
    let incluirProyecto = true;
    if (excluirProyectosDeCursosArchivados && proyecto.curso) {
      // Si se deben excluir Y el proyecto tiene un curso asociado Y ese curso está en la lista de archivados
      if (cursosArchivadosNombres.has(proyecto.curso)) {
        incluirProyecto = false; // No incluir este proyecto
      }
    }
    // -------------------------------

    if (incluirProyecto) {
      const opcion = document.createElement('option');
      opcion.value = proyecto.id;
      opcion.textContent = proyecto.nombre;
      selector.appendChild(opcion);
    }
  });

  // Re-seleccionar valor si aún existe en la lista filtrada
  if (
    valorSeleccionado &&
    selector.querySelector(`option[value="${valorSeleccionado}"]`)
  ) {
    selector.value = valorSeleccionado;
  } else if (selector.options.length > 0) {
    // Si el valor seleccionado ya no existe (porque se filtró),
    // seleccionar "Ninguno" por defecto si es posible
    selector.value = '';
  }
}

/**
 * ACTUALIZADO: Llama a popularSelectorDeProyectos asegurando excluir archivados.
 * (Usado específicamente en el modal de editar tarea)
 * @param {number | string | null} proyectoIdSeleccionado - El ID del proyecto a seleccionar.
 */
export function popularSelectorDeProyectosEdicion(proyectoIdSeleccionado) {
  // Llama a la función principal, asegurando excluir archivados
  popularSelectorDeProyectos('edit-select-proyecto-tarea', true);

  // Re-seleccionar el valor (Sin cambios aquí)
  const selector = document.getElementById('edit-select-proyecto-tarea');
  if (selector && proyectoIdSeleccionado) {
    // Asegurarse de que la opción todavía exista después del filtrado
    if (selector.querySelector(`option[value="${proyectoIdSeleccionado}"]`)) {
      selector.value = proyectoIdSeleccionado;
    } else {
      selector.value = ''; // Si no existe, seleccionar "Ninguno"
    }
  }
}

/**
 * MODIFICADO: Ahora maneja el nuevo modal de onboarding con cumpleaños.
 * Acepta valores predeterminados y un título personalizado.
 * @param {string} [titulo='¡Bienvenido!'] - El título a mostrar en el modal.
 * @param {string} [defaultNombre=''] - Valor para pre-rellenar el nombre.
 * @param {string | null} [defaultCumple=null] - Valor para pre-rellenar la fecha (YYYY-MM-DD).
 * @returns {Promise<{nombre: string, fechaCumple: string | null}>}
 */
export function mostrarModalOnboarding(
  titulo = '¡Bienvenido!',
  defaultNombre = '',
  defaultCumple = null,
) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-onboarding');
    const form = document.getElementById('form-onboarding');
    const modalTitulo = document.getElementById('onboarding-title'); // Asumiendo que tienes un <h2> o <h3> con este ID
    const inputNombre = document.getElementById('input-onboarding-nombre');
    const inputCumple = document.getElementById('input-onboarding-cumple');

    // --- NUEVO ---
    // Actualizar el título del modal
    if (modalTitulo) {
      modalTitulo.textContent = titulo;
    }
    // --- FIN NUEVO ---

    // Pre-rellenar valores (CON COMPROBACIÓN)
    if (inputNombre) {
      inputNombre.value = defaultNombre || '';
    } else {
      console.error('[UI] No se encontró el elemento #input-onboarding-nombre');
    }

    if (inputCumple) {
      inputCumple.value = defaultCumple || '';
    }

    if (!form) {
      console.error('[UI] No se encontró el elemento #form-onboarding');
      return resolve({ nombre: 'Error', fechaCumple: null }); // Salir de forma segura
    }
    if (!modal) {
      console.error('[UI] No se encontró el elemento #modal-onboarding');
      return resolve({ nombre: 'Error', fechaCumple: null }); // Salir de forma segura
    }

    mostrarModal('modal-onboarding');
    if (inputNombre) {
      setTimeout(() => inputNombre.focus(), 100);
    }

    form.addEventListener(
      'submit',
      (e) => {
        e.preventDefault();
        const nombre = inputNombre ? inputNombre.value.trim() : 'Usuario';
        const fechaCumple =
          inputCumple && inputCumple.value ? inputCumple.value : null;

        if (nombre) {
          cerrarModal('modal-onboarding');
          // Resolvemos con un objeto
          resolve({ nombre, fechaCumple });
        }
      },
      { once: true },
    );
  });
}

// ===============================================
// == Función de Notificación (REEMPLAZADA)
// ===============================================

/**
 * Muestra una notificación de navegador y reproduce un sonido.
 * @param {string} titulo - El título de la notificación.
 * @param {object} [opciones={}] - Opciones.
 * @param {string} [opciones.body] - El texto del cuerpo de la notificación.
 * @param {boolean} [opciones.silent=false] - Si es true, no reproduce sonido.
 */
/**
 * Muestra una notificación de navegador y reproduce un sonido.
 * @param {string} titulo - El título de la notificación.
 * @param {object} [opciones={}] - Opciones.
 * @param {string} [opciones.body] - El texto del cuerpo de la notificación.
 * @param {boolean} [opciones.silent=false] - Si es true, no reproduce sonido.
 */
export function mostrarNotificacion(titulo, opciones = {}) {
  const { body = '', silent = false } = opciones;

  // 1. Reproducir sonido (si no está silenciado)
  if (!silent) {
    reproducirSonidoNotificacion();
  }

  // 2. Lógica de Notificación del Navegador
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones de escritorio.');
    return;
  }

  const notificationOptions = {
    body: body,
    icon: 'assets/pulsito-icon.png',
    badge: 'assets/pulsito-icon.png',
    tag: `planivio-notif-${Date.now()}`,
    renotify: true,
  };

  const triggerNotification = () => {
    // Intentar usar Service Worker primero (para Push/Android)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(titulo, notificationOptions);
      });
    } else {
      // Fallback a notificación estándar
      try {
        new Notification(titulo, notificationOptions);
      } catch (err) {
        console.error('Error al crear notificación estándar:', err);
      }
    }
  };

  if (Notification.permission === 'granted') {
    triggerNotification();
  } else if (Notification.permission === 'default') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        triggerNotification();
      }
    });
  }
}
// ===============================================
// == ✨ LÓGICA DE WOW EFFECTS (Racha, Perfil, Cumple)
// ===============================================

/**
 * Actualiza los iconos de racha en el header.
 */
export function actualizarIconosRachaHeader() {
  const container = document.getElementById('header-streak-container');
  if (!container) return;

  const racha = calcularRacha();
  container.innerHTML = '';
  container.className = 'streak-container hidden'; // Reset

  if (racha > 0) {
    container.classList.remove('hidden');
    
    // Icono de Corona (Racha >= 100)
    if (racha >= 100) {
      const crownSpan = document.createElement('span');
      crownSpan.className = 'streak-icon crown';
      crownSpan.textContent = '👑';
      crownSpan.title = '¡Racha Legendaria! (+100 días)';
      container.appendChild(crownSpan);
    }

    // Icono de Llama
    const flameSpan = document.createElement('span');
    flameSpan.className = 'streak-icon flame';
    flameSpan.textContent = '🔥';
    flameSpan.title = `Racha actual: ${racha} días`;
    container.appendChild(flameSpan);

    // Contador
    const countSpan = document.createElement('span');
    countSpan.className = 'streak-count';
    countSpan.textContent = racha;
    container.appendChild(countSpan);
  } else {
    // Mostrar llama gris si racha es 0 para que el usuario sepa que existe
    container.classList.remove('hidden');
    
    const flameSpan = document.createElement('span');
    flameSpan.className = 'streak-icon flame inactive'; // Nueva clase 'inactive'
    flameSpan.textContent = '🔥';
    flameSpan.style.filter = 'grayscale(100%) opacity(0.5)'; // Estilo inline por si acaso
    flameSpan.title = '¡Completa una tarea hoy para encender la racha!';
    container.appendChild(flameSpan);

    const countSpan = document.createElement('span');
    countSpan.className = 'streak-count';
    countSpan.textContent = '0';
    countSpan.style.opacity = '0.6';
    container.appendChild(countSpan);
  }
}

/**
 * Maneja la subida de foto de perfil.
 */
export function inicializarFotoPerfil() {
  const input = document.getElementById('input-foto-perfil');
  const img = document.getElementById('user-photo');
  
  // Cargar foto guardada
  const savedPhoto = localStorage.getItem('userProfilePhoto');
  const updatePhotoUI = (url) => {
    // 1. Imagen en el modal de configuración
    if (img) img.src = url;
    
    // 2. Botón del header (dropdown)
    const headerBtn = document.getElementById('btn-config-dropdown');
    if (headerBtn) {
      headerBtn.style.backgroundImage = `url('${url}')`;
      headerBtn.style.backgroundSize = 'cover';
      headerBtn.style.backgroundPosition = 'center';
      headerBtn.style.border = '2px solid var(--accent-color)';
      // Ocultar el icono SVG interno
      const svg = headerBtn.querySelector('svg');
      if (svg) svg.style.display = 'none';
    }
  };

  if (savedPhoto) {
    updatePhotoUI(savedPhoto);
  }

  if (input) {
    // Remover listeners anteriores para evitar duplicados si se llama varias veces
    const newClone = input.cloneNode(true);
    input.parentNode.replaceChild(newClone, input);

    newClone.addEventListener('change', (e) => {
      console.log('[Perfil] Archivo seleccionado...');
      const file = e.target.files[0];
      if (!file) {
        console.warn('[Perfil] No se seleccionó ningún archivo.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        console.log('[Perfil] Archivo leído. Procesando imagen...');
        // Redimensionar antes de guardar (Canvas)
        const tempImg = new Image();
        tempImg.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 150;
            let width = tempImg.width;
            let height = tempImg.height;

            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(tempImg, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // Comprimir
            console.log('[Perfil] Imagen procesada. Guardando en localStorage...');
            localStorage.setItem('userProfilePhoto', dataUrl);
            
            updatePhotoUI(dataUrl); // <-- Usamos la función helper
            mostrarNotificacion('¡Foto actualizada!', { body: 'Tu perfil se ve genial. 😎' });
          } catch (err) {
            console.error('[Perfil] Error al procesar/guardar la imagen:', err);
            alert('Error al guardar la imagen. Puede que sea demasiado grande o haya un problema de almacenamiento.');
          }
        };
        tempImg.onerror = (err) => {
          console.error('[Perfil] Error al cargar la imagen temporal:', err);
        };
        tempImg.src = event.target.result;
      };
      reader.onerror = (err) => {
        console.error('[Perfil] Error al leer el archivo:', err);
      };
      reader.readAsDataURL(file);
    });
  } else {
    console.warn('[Perfil] No se encontró el input #input-foto-perfil');
  }
}

/**
 * Verifica si es el cumpleaños del usuario y lanza confeti.
 */
export function verificarCumpleanos() {
  if (!state.config.userBirthday) return;

  const hoy = new Date();
  const cumpleParts = state.config.userBirthday.split('-'); // YYYY-MM-DD
  const mesCumple = parseInt(cumpleParts[1], 10);
  const diaCumple = parseInt(cumpleParts[2], 10);

  if (hoy.getMonth() + 1 === mesCumple && hoy.getDate() === diaCumple) {
    console.log('¡Es el cumpleaños del usuario! 🎉');
    
    // 1. Lanzar Confeti (siempre que entre hoy)
    if (window.confetti) {
      const duration = 3000;
      const end = Date.now() + duration;

      (function frame() {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    }

    // 2. Saludo de Pulsito (Solo una vez al año)
    const currentYear = hoy.getFullYear();
    const lastGreetingYear = state.config.lastBirthdayGreetingYear;

    if (lastGreetingYear !== currentYear) {
      mostrarAlerta(
        '¡FELIZ CUMPLEAÑOS! 🎂🎉',
        `¡${state.config.userName || 'Amigo'}! <br><br>¡Pulsito y todo el equipo de Planivio te deseamos un día increíble! 🥳<br>¡Que cumplas todas tus metas (y tareas)!`
      );
      // Guardar flag (esto debería ir a Firebase idealmente, pero state.config se sincroniza)
      state.config.lastBirthdayGreetingYear = currentYear;
      // Trigger save config (necesitamos importar guardarConfig o emitir evento)
      // Por simplicidad y evitar dependencias circulares, asumimos que el usuario
      // hará algún cambio o que esto se perderá si recarga sin hacer nada más,
      // pero es aceptable para un efecto visual.
      // MEJORA: Emitir evento para guardar
      import('./firebase.js').then(({ guardarConfig }) => {
         guardarConfig({ lastBirthdayGreetingYear: currentYear });
      });
    }
  }
}
