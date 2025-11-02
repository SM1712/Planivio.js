// ==========================================================================
// ==                          src/main.js                               ==
// ==========================================================================
//
// Este es el "Controlador" principal, modificado para "Pulso".
//
// 1. Escucha a Firebase Auth para el login.
// 2. Inicia la sincronización en state.js.
// 3. Escucha eventos del EventBus (como 'navegarA' o 'configActualizada')
//    y reacciona a ellos.
//
// ==========================================================================

import { state } from './state.js';
import { EventBus } from './eventBus.js'; // <-- P1.1
import {
  setFirebaseUserId,
  guardarConfig,
  migrarDatosDesdeLocalStorage,
} from './firebase.js'; // <-- P1.2
import { iniciarSincronizacion, detenerSincronizacion } from './state.js'; // <-- P1.3
import {
  cargarIconos,
  mostrarConfirmacion,
  mostrarAlerta,
  mostrarPrompt,
  cerrarModal,
  mostrarModal,
  mostrarModalOnboarding,
} from './ui.js';
import {
  updateRgbVariables,
  // cargarDatos, // <-- P1.5 ELIMINADO
  // guardarDatos, // <-- P1.5 ELIMINADO
  hexToRgb,
  getTextColorForBg,
  darkenColor,
  exportarDatosJSON, // Roto temporalmente
  importarDatosJSON, // Roto temporalmente
  aplicarColorFondoVencida,
  aplicarColoresMuescas,
} from './utils.js';
import { ICONS } from './icons.js';

// Importaciones de páginas (sin cambios)
import {
  inicializarDashboard,
  abrirModalNuevaTarea,
  agregarTareaDesdeDashboard,
} from './pages/dashboard.js';
import { inicializarTareas } from './pages/tareas.js';
import { inicializarCursos } from './pages/cursos.js';
import {
  inicializarCalendario,
  iniciarEdicionEvento,
} from './pages/calendario.js';
import { inicializarApuntes } from './pages/apuntes.js';
import { inicializarProyectos } from './pages/proyectos.js';

// Esto se usará para la carga inicial de páginas
const pageInitializers = {
  dashboard: inicializarDashboard,
  tareas: inicializarTareas,
  cursos: inicializarCursos,
  calendario: inicializarCalendario,
  apuntes: inicializarApuntes,
  proyectos: inicializarProyectos,
};

/**
 * MODIFICADO: Carga el HTML de la página y emite un evento
 * cuando la página está lista para ser inicializada.
 * @param {string} idPagina - El ID de la página a cargar (ej: 'tareas').
 */
export async function cambiarPagina(idPagina) {
  // 1. Actualizar estado local (para highlight de nav)
  state.paginaActual = idPagina;
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.page === idPagina);
  });

  const appContent = document.getElementById('app-content');
  if (!appContent) return;

  try {
    // 2. Cargar el HTML de la vista
    const response = await fetch(`./src/views/${idPagina}.html`);
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status}, No se pudo encontrar ${idPagina}.html`,
      );
    }
    appContent.innerHTML = await response.text();
    const newPage = appContent.querySelector('.page');

    if (newPage) {
      // 3. (Animación) Añadir clase 'visible'
      setTimeout(() => {
        newPage.classList.add('visible');
      }, 0); // 0ms para que ocurra en el siguiente 'tick'

      // 4. ¡EMITIR EVENTO! Avisar al módulo JS correspondiente que su HTML está listo.
      EventBus.emit('paginaCargada:' + idPagina);
      // También emitimos un evento genérico por si algún módulo (como dashboard)
      // necesita refrescarse cada vez que se carga.
      EventBus.emit('paginaCargada');
    } else {
      console.error(
        `La página ${idPagina} se cargó pero no se encontró el elemento .page`,
      );
    }
  } catch (error) {
    console.error('Error al cargar la página:', error);
    appContent.innerHTML = `<div class="panel"><h2>Error al cargar la página</h2><p>${error.message}. Revisa la consola para más detalles.</p></div>`;
  }
}

/**
 * MODIFICADO: Ahora llama a guardarConfig (async) en lugar de guardarDatos.
 */
async function cambiarTemaBase() {
  state.config.theme = state.config.theme === 'light' ? 'dark' : 'light';
  aplicarTema(); // Aplica visualmente
  await guardarConfig({ theme: state.config.theme }); // Guarda solo este cambio en Firebase
}

/**
 * MODIFICADO: Ahora llama a guardarConfig (async) en lugar de guardarDatos.
 */
async function cambiarColorAcento(color) {
  state.config.accent_color = color;
  const root = document.documentElement;
  root.style.setProperty('--accent-color', color);
  const activeColor = darkenColor(color, 15);
  root.style.setProperty('--accent-color-active', activeColor);
  const textColor = getTextColorForBg(activeColor);
  root.style.setProperty('--accent-text-color', textColor);
  const rgb = hexToRgb(color);
  if (rgb) {
    root.style.setProperty(
      '--accent-color-hover',
      `rgba(${rgb.join(', ')}, 0.15)`,
    );
    root.style.setProperty('--accent-color-rgb', rgb.join(', '));
  }
  await guardarConfig({ accent_color: state.config.accent_color }); // Guarda solo este cambio
}

/**
 * (Aplica estilos basados en el state.config actual)
 */
function aplicarTema() {
  document.body.classList.toggle('dark-theme', state.config.theme === 'dark');
  cambiarColorAcento(state.config.accent_color);
  updateRgbVariables();
  // Aplicamos colores de muescas y fondo que dependen del tema (oscuro/claro)
  aplicarColoresMuescas();
  aplicarColorFondoVencida();
}

/**
 * (Lee el state local y rellena el modal de config)
 */
function inicializarModalConfiguraciones() {
  // Rellenar widgets
  const widgetToggles = document.querySelectorAll(
    '.widget-toggle-item input[type="checkbox"]',
  );
  if (state.config.widgetsVisibles) {
    widgetToggles.forEach((checkbox) => {
      const key = checkbox.dataset.widgetKey;
      if (state.config.widgetsVisibles.hasOwnProperty(key)) {
        checkbox.checked = state.config.widgetsVisibles[key];
      }
    });
  }
  // Rellenar colores de muescas
  const coloresMuescas = state.config?.muescasColores;
  if (coloresMuescas) {
    Object.keys(coloresMuescas).forEach((key) => {
      if (key === 'vencidaFondoColor' || key === 'vencidaFondoOpacidad') return;
      const savedColor = coloresMuescas[key];
      const customInput = document.getElementById(`color-muesca-${key}-custom`);
      if (customInput) customInput.value = savedColor;
      const choicesContainer = document.querySelector(
        `.color-choices[data-muesca-key="${key}"]`,
      );
      if (choicesContainer) {
        const presetButtons =
          choicesContainer.querySelectorAll('.color-swatch');
        const customSwatchDiv = choicesContainer.querySelector(
          '.custom-muesca-swatch',
        );
        let presetMatch = false;
        presetButtons.forEach((btn) => btn.classList.remove('active'));
        if (customSwatchDiv) customSwatchDiv.classList.remove('active');
        presetButtons.forEach((btn) => {
          if (btn.dataset.color === savedColor) {
            btn.classList.add('active');
            presetMatch = true;
          }
        });
        if (!presetMatch && customSwatchDiv) {
          customSwatchDiv.classList.add('active');
        }
      }
    });
    // const inputColorFondo = document.getElementById('color-fondo-vencida'); // Esta variable no se usa
    const inputOpacidad = document.getElementById('opacidad-fondo-vencida');
    const opacidadLabel = inputOpacidad?.nextElementSibling;
    const savedFondoColor = coloresMuescas.vencidaFondoColor || '#e74c3c';
    const fondoChoicesContainer = document.querySelector(
      '.color-choices[data-fondo-key="vencidaFondoColor"]',
    );
    if (fondoChoicesContainer) {
      const presetButtons =
        fondoChoicesContainer.querySelectorAll('.color-swatch');
      const customSwatchDiv = fondoChoicesContainer.querySelector(
        '.custom-muesca-swatch',
      );
      let presetMatch = false;
      presetButtons.forEach((btn) => btn.classList.remove('active'));
      if (customSwatchDiv) customSwatchDiv.classList.remove('active');
      presetButtons.forEach((btn) => {
        if (btn.dataset.color === savedFondoColor) {
          btn.classList.add('active');
          presetMatch = true;
        }
      });
      if (!presetMatch && customSwatchDiv) {
        customSwatchDiv.classList.add('active');
        const customInput = customSwatchDiv.querySelector(
          'input[type="color"]',
        );
        if (customInput) customInput.value = savedFondoColor;
      } else if (presetMatch && customSwatchDiv) {
        const customInput = customSwatchDiv.querySelector(
          'input[type="color"]',
        );
        if (customInput) customInput.value = savedFondoColor;
      }
    }
    if (inputOpacidad) {
      const opacidadValue = coloresMuescas.vencidaFondoOpacidad ?? 0.08;
      inputOpacidad.value = opacidadValue;
      if (opacidadLabel)
        opacidadLabel.textContent = `${Math.round(opacidadValue * 100)}%`;
      inputOpacidad.style.setProperty(
        '--range-percent',
        `${opacidadValue * 100}%`,
      );
    }
  }
}

// ===============================================
// == R1.4: LÓGICA DE AUTENTICACIÓN (MODIFICADA)  ==
// ===============================================

// Traemos los servicios que publicamos en index.html
const {
  auth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} = window.firebaseServices;

// Referencias a la UI de Login y App
const appHeader = document.querySelector('.app-header');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const btnGoogleLogin = document.getElementById('btn-google-login');
// btnLogout se obtiene en agregarEventListenersGlobales porque está en un modal

/**
 * Función principal de autenticación.
 */
async function manejarEstadoDeAutenticacion() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // --- 1. USUARIO ESTÁ LOGUEADO ---
      console.log('Usuario detectado:', user.uid);

      // Mostrar app y header, ocultar login
      if (appHeader) appHeader.style.visibility = 'visible';
      loginContainer.style.display = 'none';
      if (appContainer) appContainer.style.visibility = 'visible';

      // Poblar el panel de usuario en Configuración
      if (document.getElementById('user-photo'))
        document.getElementById('user-photo').src = user.photoURL;
      if (document.getElementById('user-name'))
        document.getElementById('user-name').textContent = user.displayName;
      if (document.getElementById('user-email'))
        document.getElementById('user-email').textContent = user.email;

      // ¡IMPORTANTE! Guardar User ID e iniciar sincronización
      setFirebaseUserId(user.uid);

      // --- P3.1: Lógica de Migración/Onboarding ---
      const configRef = doc(
        window.firebaseServices.db,
        'usuarios',
        user.uid,
        'config',
        'userConfig',
      );
      const configSnap = await window.firebaseServices.getDoc(configRef);
      // Usamos 'planivioData' (la key de tu utils.js original)
      const datosLocalesString = localStorage.getItem('planivioData');

      if (!configSnap.exists() && datosLocalesString) {
        // Usuario nuevo (sin config en la nube) PERO con datos locales
        console.log(
          '[Main] Usuario nuevo con datos locales. Preguntando para migrar...',
        );
        // Asumimos que mostrarConfirmacion fue adaptado para devolver Promise<boolean>
        const quiereMigrar = await mostrarConfirmacion(
          'Importar Datos Locales',
          '¡Bienvenido! Hemos encontrado datos locales en este navegador. ¿Quieres importarlos a tu nueva cuenta en la nube?',
          null,
          'Sí, Importar',
          'No, Empezar de Cero',
        );

        if (quiereMigrar) {
          try {
            const estadoLocal = JSON.parse(datosLocalesString);
            await migrarDatosDesdeLocalStorage(estadoLocal); // Sube todo a Firebase
            localStorage.removeItem('planivioData'); // Limpia local
            mostrarAlerta(
              'Migración Exitosa',
              'Tus datos locales se han importado a la nube.',
            );
          } catch (error) {
            console.error('[Main] Error durante la migración:', error);
            mostrarAlerta(
              'Error de Migración',
              'Hubo un problema al importar tus datos.',
            );
          }
        } else {
          // No quiso migrar, borrar local
          localStorage.removeItem('planivioData');
        }
      } else if (!configSnap.exists() && !datosLocalesString) {
        // Usuario 100% nuevo, ejecutar onboarding
        const nombre = await mostrarModalOnboarding();
        // Guardamos el nombre en el state local temporalmente
        state.config.userName = nombre;
        // Y lo subimos a Firebase
        await guardarConfig({ userName: nombre });

        mostrarAlerta(
          `¡Hola, ${nombre}!`,
          'Para empezar a organizarte, el primer paso es crear un curso. Luego, podrás añadir tareas a ese curso.',
          () => {
            EventBus.emit('navegarA', { pagina: 'cursos' }); // Usar EventBus para navegar
          },
        );
      }

      // ¡INICIAR SINCRONIZACIÓN! (Cargará config, cursos, tareas, etc.)
      iniciarSincronizacion(user.uid);

      // Cargamos la página guardada o el dashboard
      // El listener 'configActualizada' aplicará el tema
      // El state.paginaActual se cargará desde la config si existe
      await cambiarPagina(state.paginaActual || 'dashboard');
    } else {
      // --- 2. USUARIO NO ESTÁ LOGUEADO ---
      console.log('No hay usuario.');

      // Ocultar app y header, mostrar login
      if (appHeader) appHeader.style.visibility = 'hidden';
      loginContainer.style.display = 'flex';
      if (appContainer) appContainer.style.visibility = 'hidden';

      // Detener todos los listeners de Firebase
      detenerSincronizacion();
    }
  });
}

/**
 * Inicia el pop-up de login con Google (Sin cambios)
 */
async function handleGoogleLogin() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    console.log('Inicio de sesión exitoso:', result.user.displayName);
  } catch (error) {
    console.error('Error al iniciar sesión con Google:', error);
    alert('Hubo un error al iniciar sesión. Intenta de nuevo.');
  }
}

/**
 * MODIFICADO: Cierra la sesión y llama a detenerSincronizacion
 */
async function handleLogout() {
  try {
    await signOut(auth);
    detenerSincronizacion(); // <-- Detiene listeners y resetea el state
    console.log('Cierre de sesión exitoso.');
    // onAuthStateChanged se encargará de mostrar la pantalla de login
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

// ===============================================
// ==     FIN LÓGICA DE AUTENTICACIÓN FIREBASE    ==
// ===============================================

/**
 * MODIFICADO: Conecta los listeners globales al EventBus o a guardarConfig
 */
function agregarEventListenersGlobales() {
  // --- Navegación (AHORA EMITE EVENTOS) ---
  document.getElementById('main-nav').addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (navItem && navItem.dataset.page) {
      const idPagina = navItem.dataset.page;

      // Limpiamos IDs de selección (estado local, no se guarda)
      if (idPagina === 'proyectos') state.proyectoSeleccionadoId = null;
      if (idPagina === 'tareas') state.tareaSeleccionadald = null; // Mantenemos tu typo
      if (idPagina === 'apuntes') state.apunteActivoId = null; // Nombre de tu state

      // guardarDatos(); // <-- ELIMINADO

      // ¡NUEVA FORMA DE NAVEGAR!
      EventBus.emit('navegarA', { pagina: idPagina });

      document
        .getElementById('app-container')
        .classList.remove('sidebar-visible');
    }
  });

  // --- Sidebar (Sin cambios, es solo UI local) ---
  document
    .getElementById('btn-toggle-sidebar')
    ?.addEventListener('click', () => {
      document
        .getElementById('app-container')
        .classList.toggle('sidebar-visible');
    });
  document.querySelector('.sidebar-overlay')?.addEventListener('click', () => {
    document
      .getElementById('app-container')
      .classList.remove('sidebar-visible');
  });

  // --- Modal Configuraciones (MODIFICADO para guardarConfig) ---
  const configBtn = document.getElementById('btn-config-dropdown');
  configBtn?.addEventListener('click', () => {
    // Poblar el modal con los datos del state ACTUAL
    // (incluyendo perfil de Firebase si ya se cargó)
    if (auth.currentUser) {
      if (document.getElementById('user-photo'))
        document.getElementById('user-photo').src = auth.currentUser.photoURL;
      if (document.getElementById('user-name'))
        document.getElementById('user-name').textContent =
          auth.currentUser.displayName;
      if (document.getElementById('user-email'))
        document.getElementById('user-email').textContent =
          auth.currentUser.email;
    }
    inicializarModalConfiguraciones(); // Rellena widgets, muescas, etc.
    mostrarModal('modal-configuraciones');
  });

  // Listener del botón Logout (que está dentro del modal)
  document
    .getElementById('btn-logout')
    ?.addEventListener('click', handleLogout);

  document
    .getElementById('settings-nav-list')
    ?.addEventListener('click', (e) => {
      const navItem = e.target.closest('.settings-nav-item');
      if (!navItem) return;
      const tabId = navItem.dataset.tab;
      const settingsPanes = document.querySelectorAll('.settings-pane');
      document
        .querySelectorAll('.settings-nav-item')
        .forEach((item) => item.classList.remove('active'));
      settingsPanes.forEach((pane) => pane.classList.remove('active'));
      navItem.classList.add('active');
      document.getElementById(`settings-${tabId}`)?.classList.add('active');
    });

  // Listener de Widgets (MODIFICADO)
  document
    .querySelector('.widget-toggle-list')
    ?.addEventListener('change', async (e) => {
      // <-- async
      if (e.target.type === 'checkbox') {
        const key = e.target.dataset.widgetKey;
        if (
          state.config.widgetsVisibles &&
          state.config.widgetsVisibles.hasOwnProperty(key)
        ) {
          state.config.widgetsVisibles[key] = e.target.checked;
          // guardarDatos(); // <-- ELIMINADO
          await guardarConfig({
            widgetsVisibles: state.config.widgetsVisibles,
          }); // <-- AÑADIDO

          if (state.paginaActual === 'dashboard') {
            // Forzar recarga del dashboard para mostrar/ocultar widget
            EventBus.emit('navegarA', { pagina: 'dashboard' });
          }
        }
      }
    });

  // Listener de Formulario Quick-Add (Sin cambios, dashboard.js lo maneja)
  const formQuickAddTask = document.getElementById(
    'form-dashboard-nueva-tarea',
  );
  if (formQuickAddTask) {
    if (formQuickAddTask._submitHandler) {
      formQuickAddTask.removeEventListener(
        'submit',
        formQuickAddTask._submitHandler,
      );
    }
    const quickAddTaskSubmitHandler = (event) => {
      // Esta función (importada de dashboard.js) DEBE ser modificada
      // en la Fase P2 para usar Firebase (addDoc) en lugar de guardarDatos
      agregarTareaDesdeDashboard(event);
    };
    formQuickAddTask.addEventListener('submit', quickAddTaskSubmitHandler);
    formQuickAddTask._submitHandler = quickAddTaskSubmitHandler;
  }

  // Carga de iconos en Config (Sin cambios)
  const settingsNavList = document.getElementById('settings-nav-list');
  if (settingsNavList) {
    settingsNavList.querySelector('[data-tab="usuario"] .nav-icon').innerHTML =
      ICONS.settings;
    settingsNavList.querySelector(
      '[data-tab="personalizacion"] .nav-icon',
    ).innerHTML = ICONS.edit;
    settingsNavList.querySelector(
      '[data-tab="dashboard"] .nav-icon',
    ).innerHTML = ICONS.dashboard;
    settingsNavList.querySelector('[data-tab="tareas"] .nav-icon').innerHTML =
      ICONS.tareas;
  }
  const btnCerrarModalConfig = document.querySelector(
    '#modal-configuraciones .btn-cerrar-modal',
  );
  if (btnCerrarModalConfig) {
    btnCerrarModalConfig.innerHTML = ICONS.close;
  }

  // Listeners de Personalización (MODIFICADO)
  document
    .getElementById('btn-cambiar-tema')
    ?.addEventListener('click', cambiarTemaBase); // cambiarTemaBase ya es async
  document.getElementById('color-palette')?.addEventListener('click', (e) => {
    if (e.target.matches('.color-swatch[data-color]')) {
      cambiarColorAcento(e.target.dataset.color); // cambiarColorAcento ya es async
    }
  });
  document
    .getElementById('input-color-custom')
    ?.addEventListener('input', (e) => cambiarColorAcento(e.target.value)); // cambiarColorAcento ya es async

  // Listeners de Importar/Exportar (Deshabilitados temporalmente)
  document
    .getElementById('btn-exportar-datos')
    ?.addEventListener('click', () => {
      // exportarDatosJSON(mostrarPrompt); // TODO: Refactorizar en Fase P3.4
      mostrarAlerta(
        'Función Deshabilitada',
        'La exportación se está actualizando para la nube. Tus datos están seguros en tu cuenta.',
      );
    });
  document
    .getElementById('btn-importar-datos')
    ?.addEventListener('click', () => {
      // mostrarConfirmacion( ... ) // TODO: Refactorizar en Fase P3.4
      mostrarAlerta(
        'Función Deshabilitada',
        'La importación se está actualizando para la nube.',
      );
    });
  document
    .getElementById('input-importar-datos')
    ?.addEventListener('change', (event) => {
      // importarDatosJSON(event, ...); // TODO: Refactorizar en Fase P3.4
    });

  // Listener Cierre de Modales (Sin cambios)
  document.body.addEventListener('click', (e) => {
    const closeButton = e.target.closest('[data-action="cerrar-modal"]');
    if (closeButton) {
      const modalOverlay = closeButton.closest('.modal-overlay');
      if (modalOverlay) {
        cerrarModal(modalOverlay.id);
      }
    }
  });
  document
    .getElementById('btn-confirm-cancelar')
    ?.addEventListener('click', () => cerrarModal('modal-confirmacion'));
  document
    .getElementById('btn-prompt-cancelar')
    ?.addEventListener('click', () => cerrarModal('modal-prompt'));

  // Listener Modal Chooser (Sin cambios)
  const modalChooser = document.getElementById('modal-chooser-crear');
  if (modalChooser) {
    document
      .getElementById('btn-chooser-evento')
      ?.addEventListener('click', () => {
        const fecha = modalChooser.dataset.fechaSeleccionada;
        const curso = modalChooser.dataset.cursoPreseleccionado;
        if (fecha) {
          cerrarModal('modal-chooser-crear');
          // Esta función (de calendario.js) DEBE ser modificada en Fase P2
          iniciarEdicionEvento({ fechaInicio: fecha, fechaFin: fecha }, curso);
        }
        delete modalChooser.dataset.fechaSeleccionada;
        delete modalChooser.dataset.cursoPreseleccionado;
      });

    document
      .getElementById('btn-chooser-tarea')
      ?.addEventListener('click', () => {
        const fecha = modalChooser.dataset.fechaSeleccionada;
        const curso = modalChooser.dataset.cursoPreseleccionado;
        if (fecha) {
          cerrarModal('modal-chooser-crear');
          // Esta función (de dashboard.js) DEBE ser modificada en Fase P2
          abrirModalNuevaTarea(fecha, curso);
        }
        delete modalChooser.dataset.fechaSeleccionada;
        delete modalChooser.dataset.cursoPreseleccionado;
      });
  }

  // Listeners Colores Muescas (MODIFICADO)
  const panelTareasSettings = document.getElementById('settings-tareas');
  if (panelTareasSettings) {
    const actualizarVisualizacionColor = (key, nuevoColor, isFondo = false) => {
      const dataAttribute = isFondo ? 'data-fondo-key' : 'data-muesca-key';
      const choicesContainer = panelTareasSettings.querySelector(
        `.color-choices[${dataAttribute}="${key}"]`,
      );
      if (choicesContainer) {
        const presetButtons =
          choicesContainer.querySelectorAll('.color-swatch');
        const customSwatchDiv = choicesContainer.querySelector(
          '.custom-muesca-swatch',
        );
        let presetMatch = false;
        presetButtons.forEach((btn) => {
          const isActive = btn.dataset.color === nuevoColor;
          btn.classList.toggle('active', isActive);
          if (isActive) presetMatch = true;
        });
        if (customSwatchDiv) {
          customSwatchDiv.classList.toggle('active', !presetMatch);
          const customInput = customSwatchDiv.querySelector(
            'input[type="color"]',
          );
          if (customInput) customInput.value = nuevoColor;
        }
      }
    };

    panelTareasSettings.addEventListener('click', async (e) => {
      // <-- async
      if (e.target.matches('.color-choices .color-swatch[data-color]')) {
        const button = e.target;
        const container = button.closest('.color-choices');
        const key = container?.dataset.muescaKey || container?.dataset.fondoKey;
        const nuevoColor = button.dataset.color;
        const isFondo = container?.dataset.hasOwnProperty('fondoKey');
        if (key && nuevoColor && state.config.muescasColores) {
          if (state.config.muescasColores.hasOwnProperty(key)) {
            state.config.muescasColores[key] = nuevoColor;
            // guardarDatos(); // <-- ELIMINADO
            await guardarConfig({
              muescasColores: state.config.muescasColores,
            }); // <-- AÑADIDO
            if (isFondo) {
              aplicarColorFondoVencida();
            } else {
              aplicarColoresMuescas();
            }
            actualizarVisualizacionColor(key, nuevoColor, isFondo);
          }
        }
      }
    });
    panelTareasSettings.addEventListener('input', async (e) => {
      // <-- async
      const target = e.target;
      let key = null;
      let nuevoValor = null;
      let isFondoColor = false;
      let isFondoOpacidad = false;
      let isMuescaColor = false;
      if (
        target.matches(
          '.custom-muesca-swatch input[type="color"][data-muesca-key]',
        )
      ) {
        key = target.dataset.muescaKey;
        nuevoValor = target.value;
        isMuescaColor = true;
      } else if (
        target.matches(
          '.custom-muesca-swatch input[type="color"][data-fondo-key="vencidaFondoColor"]',
        )
      ) {
        key = target.dataset.fondoKey;
        nuevoValor = target.value;
        isFondoColor = true;
      } else if (
        target.matches(
          'input[type="range"][data-fondo-key="vencidaFondoOpacidad"]',
        )
      ) {
        key = target.dataset.fondoKey;
        nuevoValor = parseFloat(target.value);
        isFondoOpacidad = true;
      }
      if (key && nuevoValor !== null && state.config.muescasColores) {
        if (state.config.muescasColores.hasOwnProperty(key)) {
          state.config.muescasColores[key] = nuevoValor;
          // guardarDatos(); // <-- ELIMINADO
          await guardarConfig({ muescasColores: state.config.muescasColores }); // <-- AÑADIDO

          if (isMuescaColor) {
            aplicarColoresMuescas();
            actualizarVisualizacionColor(key, nuevoValor, false);
          } else if (isFondoColor) {
            aplicarColorFondoVencida();
            actualizarVisualizacionColor(key, nuevoValor, true);
          } else if (isFondoOpacidad) {
            aplicarColorFondoVencida();
            const opacidadLabel = target.nextElementSibling;
            if (opacidadLabel)
              opacidadLabel.textContent = `${Math.round(nuevoValor * 100)}%`;
            target.style.setProperty('--range-percent', `${nuevoValor * 100}%`);
          }
        }
      }
    });
  }
}

// ===============================================
// ==        INICIO DE LA APLICACIÓN (NUEVO)    ==
// ===============================================

// 1. Suscribirse a eventos globales del EventBus
EventBus.on('configActualizada', () => {
  console.log('[Main] Evento: configActualizada recibido.');
  aplicarTema(); // Aplica el tema/colores cuando la config llegue de Firebase
});

EventBus.on('navegarA', (data) => {
  console.log('[Main] Evento: navegarA recibido:', data);
  if (data.pagina) {
    // Guardar el ID de selección en el estado local (temporal)
    if (data.id !== undefined && data.pagina === 'tareas')
      state.tareaSeleccionadald = data.id; // Mantenemos typo
    if (data.id !== undefined && data.pagina === 'apuntes')
      state.apunteActivoId = data.id;
    if (data.id !== undefined && data.pagina === 'proyectos')
      state.proyectoSeleccionadoId = data.id;

    cambiarPagina(data.pagina); // Carga el HTML y emite 'paginaCargada:...'
  }
});

// 2. Iniciar la aplicación en DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Main] DOMContentLoaded. Inicializando módulos...');

  // Conecta todos los listeners (botones de modales, inputs, etc.)
  agregarEventListenersGlobales();

  // Conecta los botones de login/logout
  btnGoogleLogin.addEventListener('click', handleGoogleLogin);
  // (El listener de btn-logout se añade en agregarEventListenersGlobales)

  // Cargar el tema desde localStorage INMEDIATAMENTE para evitar flash blanco
  // (utils.js aún tiene cargarDatos() por ahora)
  try {
    cargarDatos(); // Carga síncrona inicial de localStorage
    aplicarTema(); // Aplica tema local
  } catch (e) {
    console.error('Error en carga inicial de localStorage:', e);
    aplicarTema(); // Aplica tema por defecto
  }

  // ¡Inicia el cerebro de autenticación!
  // Esto revisará si el usuario está logueado y disparará
  // la carga de datos o mostrará la pantalla de login.
  manejarEstadoDeAutenticacion();

  // Les decimos a los módulos que se preparen para escuchar los eventos 'paginaCargada'
  // Ahora es seguro llamarlos, porque el DOM está cargado.
  inicializarDashboard();
  inicializarTareas();
  inicializarCursos();
  inicializarCalendario();
  inicializarApuntes();
  inicializarProyectos();
});
