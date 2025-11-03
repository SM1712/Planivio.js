// ==========================================================================
// ==
// ==                          src/main.js
// ==
// ==    (MODIFICADO - FASE P3.4: CONECTADOS BOTONES DE
// ==     IMPORTAR/EXPORTAR A LAS NUEVAS FUNCIONES DE UTILS.JS)
// ==
// ==========================================================================

import { state } from './state.js';
import { EventBus } from './eventBus.js';
import {
  setFirebaseUserId,
  guardarConfig,
  migrarDatosDesdeLocalStorage,
  agregarEventoCumpleaños,
} from './firebase.js';
import { iniciarSincronizacion, detenerSincronizacion } from './state.js';
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
  hexToRgb,
  getTextColorForBg,
  darkenColor,
  // ¡AHORA SÍ LAS USAMOS!
  exportarDatosJSON,
  importarDatosJSON,
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
 * Carga el HTML de la página y emite un evento
 * cuando la página está lista para ser inicializada.
 * @param {string} idPagina - El ID de la página a cargar (ej: 'tareas').
 * @param {object} [data={}] - Datos opcionales para pasar al evento 'paginaCargada'
 */
export async function cambiarPagina(idPagina, data = {}) {
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
      }, 0);

      // 4. ¡EMITIR EVENTO! Avisar al módulo JS correspondiente que su HTML está listo.
      // Pasamos la 'data' completa (que puede incluir 'pagina', 'id', 'cursoId', etc.)
      EventBus.emit('paginaCargada:' + idPagina, data);
      // También emitimos un evento genérico
      EventBus.emit('paginaCargada', data);
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
 * Llama a guardarConfig (async)
 */
async function cambiarTemaBase() {
  state.config.theme = state.config.theme === 'light' ? 'dark' : 'light';
  aplicarTema(); // Aplica visualmente
  await guardarConfig({ theme: state.config.theme }); // Guarda solo este cambio en Firebase
}

/**
 * Llama a guardarConfig (async)
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
  if (state.config && state.config.accent_color) {
    cambiarColorAcento(state.config.accent_color);
  } else {
    cambiarColorAcento('#0078d7'); // Color por defecto
  }
  updateRgbVariables();
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

const {
  auth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} = window.firebaseServices;

const appHeader = document.querySelector('.app-header');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const btnGoogleLogin = document.getElementById('btn-google-login');

/**
 * Función principal de autenticación.
 */
async function manejarEstadoDeAutenticacion() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // --- 1. USUARIO ESTÁ LOGUEADO ---
      console.log('Usuario detectado:', user.uid);
      setFirebaseUserId(user.uid);

      if (appHeader) appHeader.style.visibility = 'visible';
      loginContainer.style.display = 'none';
      if (appContainer) appContainer.style.visibility = 'visible';

      // ==========================================================
      // ==      LÓGICA ONBOARDING/MIGRACIÓN (P3.1)
      // ==========================================================

      const configRef = window.firebaseServices.doc(
        window.firebaseServices.db,
        'usuarios',
        user.uid,
        'config',
        'userConfig',
      );
      const configSnap = await window.firebaseServices.getDoc(configRef);
      let configData = configSnap.exists() ? configSnap.data() : null;
      const datosLocalesString = localStorage.getItem('planivioData');

      const isMigrationUser = !configData && datosLocalesString;
      const isNewUser = !configData && !datosLocalesString;
      const isExistingUserWithMissingInfo =
        configData && (!configData.userName || !configData.userBirthday);

      let prefillName = configData ? configData.userName : null;
      let prefillBirthday = configData ? configData.userBirthday : null;

      if (isMigrationUser) {
        await handleMigrationFlow(prefillName, prefillBirthday);
      } else if (isNewUser) {
        await handleNewUserOnboarding();
      } else if (isExistingUserWithMissingInfo) {
        await handleExistingUserUpdate(prefillName, prefillBirthday);
      }

      // ==========================================================
      // ==        FIN DE LÓGICA ONBOARDING/MIGRACIÓN (P3.1)
      // ==========================================================

      iniciarSincronizacion(user.uid);

      console.log('[Main] Sincronización iniciada. Inicializando módulos...');
      inicializarDashboard();
      inicializarTareas();
      inicializarCursos();
      inicializarCalendario();
      inicializarApuntes();
      inicializarProyectos();

      if (document.getElementById('user-photo'))
        document.getElementById('user-photo').src = user.photoURL;
      if (document.getElementById('user-name'))
        document.getElementById('user-name').textContent = user.displayName;
      if (document.getElementById('user-email'))
        document.getElementById('user-email').textContent = user.email;

      await cambiarPagina(state.paginaActual || 'dashboard');
    } else {
      // --- 2. USUARIO NO ESTÁ LOGUEADO ---
      console.log('No hay usuario.');

      if (appHeader) appHeader.style.visibility = 'hidden';
      loginContainer.style.display = 'flex';
      if (appContainer) appContainer.style.visibility = 'hidden';

      detenerSincronizacion();
    }
  });
}

// ==========================================================
// ==       FUNCIONES DE FLUJO DE BIENVENIDA (P3.1)        ==
// ==========================================================

/**
 * Flujo para usuarios con datos en localStorage ("Te conozco")
 */
async function handleMigrationFlow(prefillName, prefillBirthday) {
  console.log('[Main] Iniciando Flujo de Migración...');
  const { nombre, fechaCumple } = await mostrarModalOnboarding(
    '¡Bienvenido de nuevo!',
    prefillName,
    prefillBirthday,
  );
  await guardarDatosOnboarding(nombre, fechaCumple, prefillBirthday);

  const quiereMigrar = await mostrarConfirmacion(
    `¡Espera, ${nombre}! ¡Creo que te conozco! 🧐`,
    'Soy Pulsito, el corazón de Planivio. 😊<br><br>Detecté datos locales de una versión anterior. ¿Quieres que los migremos a tu cuenta en la nube para tenerlos en todas partes?',
    '¡Sí, migrar mis datos!',
    'Saltar bienvenida',
  );

  if (quiereMigrar) {
    try {
      const datosLocalesString = localStorage.getItem('planivioData');
      const estadoLocal = JSON.parse(datosLocalesString);
      await migrarDatosDesdeLocalStorage(estadoLocal);
      localStorage.removeItem('planivioData');
      await mostrarAlerta(
        '¡Migración Completa! ✨',
        `¡Listo, ${nombre}! Tus datos locales ahora están en la nube. ¡Qué alegría verte de vuelta!`,
      );
    } catch (error) {
      console.error('[Main] Error durante la migración:', error);
      await mostrarAlerta(
        'Error de Migración 😥',
        'Hubo un problema al importar tus datos. Empezarás con una cuenta limpia.',
      );
    }
  } else {
    localStorage.removeItem('planivioData');
    await mostrarAlerta(
      '¡Entendido! 😉',
      `¡CLARO, ${nombre}! ¡Perdón! 😅 ¡Hace tanto ya! ¡Adelante, esta es tu casa!`,
    );
  }
}

/**
 * Flujo para usuarios 100% nuevos (Tour de Pulsito)
 */
async function handleNewUserOnboarding() {
  console.log('[Main] Iniciando Flujo de Onboarding para Usuario Nuevo...');
  const { nombre, fechaCumple } = await mostrarModalOnboarding(
    '¡HOOOLA! 👋 ¡Soy Pulsito!',
    null,
    null,
  );
  await guardarDatosOnboarding(nombre, fechaCumple, null);

  const quiereTour = await mostrarConfirmacion(
    `¡Un placer, ${nombre}, SOY PULSITO! 🤩`,
    '¡Estoy súper emocionado de que estés aquí! Mi trabajo es ayudarte a organizarlo TO-DO. ¿Te gustaría un tour súper rápido para mostrarte cómo funciona Planivio?',
    '¡Sí, vamos! 🚀',
    'No, gracias. Prefiero explorar.',
  );

  if (quiereTour) {
    await runOnboardingTour(nombre);
  } else {
    await mostrarAlerta(
      '¡Entendido! 👍',
      '¡No hay problema! La mejor forma de empezar es creando tu primer **Curso** (o proyecto). ¡Te llevaré allí! ¡Diviértete!',
    );
    EventBus.emit('navegarA', { pagina: 'cursos' });
  }
}

/**
 * Flujo para usuarios existentes a los que les falta nombre o cumpleaños
 */
async function handleExistingUserUpdate(prefillName, prefillBirthday) {
  console.log('[Main] Actualizando info de usuario existente...');
  const { nombre, fechaCumple } = await mostrarModalOnboarding(
    '¡Hola de nuevo! 👋',
    prefillName,
    prefillBirthday,
  );
  await guardarDatosOnboarding(nombre, fechaCumple, prefillBirthday);
  await mostrarAlerta('¡Genial!', '¡Datos de perfil actualizados!');
}

/**
 * El tour de 5 pasos de Pulsito
 */
async function runOnboardingTour(nombre) {
  EventBus.emit('navegarA', { pagina: 'dashboard' });
  await mostrarAlerta(
    'Paso 1: El Dashboard 🏠',
    '¡Vamos! 🚀 Esta es tu **Torre de Control**. Aquí verás un resumen de tus tareas urgentes, eventos próximos y tu progreso. ¡Ideal para empezar el día!',
  );

  EventBus.emit('navegarA', { pagina: 'cursos' });
  await mostrarAlerta(
    'Paso 2: Los Cursos 🧠',
    '¡El paso más importante! Todo en Planivio se organiza por **Cursos** (o materias, o proyectos... ¡lo que quieras!).<br><br>Aquí es donde los crearás. ¡Te sugiero crear tu primer curso cuando terminemos!',
  );

  EventBus.emit('navegarA', { pagina: 'tareas' });
  await mostrarAlerta(
    'Paso 3: Las Tareas 📝',
    'Una vez que tengas cursos, aquí añadirás tus tareas. Puedes asignarles fechas, prioridades y ¡hasta subtareas! Es el corazón de tu organización.',
  );

  EventBus.emit('navegarA', { pagina: 'proyectos' });
  await mostrarAlerta(
    'Paso 4: Los Proyectos 🗂️',
    '¡Esta página es genial! Un **Proyecto** te deja agrupar tareas de *diferentes* cursos. Perfecto para un "Trabajo Final" o "Metas del Mes".',
  );

  EventBus.emit('navegarA', { pagina: 'apuntes' });
  await mostrarAlerta(
    'Paso 5: Los Apuntes ✍️',
    '¡No más notas perdidas! Aquí puedes escribir apuntes rápidos, vincularlos a tus cursos y proyectos, y tener todo en un solo lugar.',
  );

  EventBus.emit('navegarA', { pagina: 'calendario' });
  await mostrarAlerta(
    'Paso 6: El Calendario 🗓️',
    '¡La vista mágica! ✨ Aquí es donde todo se junta. Verás todas tus tareas y eventos en una vista mensual. ¡Tu cumpleaños ya debería estar aquí! 😉',
  );

  await mostrarAlerta(
    'Paso 7: ¡Hazlo Tuyo! 🎨',
    '¡Casi terminamos! Planivio se adapta a ti. Puedes cambiar el tema (claro/oscuro) y tu color de acento favorito. ¡Te mostraré dónde!',
  );
  mostrarModal('modal-configuraciones');
  document.querySelector('[data-tab="personalizacion"]')?.click();

  await mostrarAlerta(
    '¡Tour completado! 🥳',
    `¡Eso es todo, ${nombre}! Ya tienes todo para empezar a conquistar tu día.<br><br>¡Ah! Y un reto: en el Dashboard verás tu **Racha Diaria**. ¡Intenta llegar a los 100 días seguidos! ¡A PULSAR! ❤️`,
  );
  EventBus.emit('navegarA', { pagina: 'dashboard' });
}

/**
 * Función helper para guardar los datos del onboarding
 */
async function guardarDatosOnboarding(nombre, fechaCumple, prefillBirthday) {
  state.config.userName = nombre;
  const configUpdates = { userName: nombre };

  if (fechaCumple) {
    state.config.userBirthday = fechaCumple;
    configUpdates.userBirthday = fechaCumple;

    if (!prefillBirthday && fechaCumple) {
      try {
        await agregarEventoCumpleaños(fechaCumple);
        console.log('[Main] Evento de cumpleaños creado exitosamente.');
      } catch (error) {
        console.error('[Main] Error al crear evento de cumpleaños:', error);
      }
    }
  }
  await guardarConfig(configUpdates);
}

// ==========================================================
// ==       FIN DE NUEVAS FUNCIONES DE BIENVENIDA          ==
// ==========================================================

/**
 * Inicia el pop-up de login con Google
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
 * Cierra la sesión y llama a detenerSincronizacion
 */
async function handleLogout() {
  try {
    await signOut(auth);
    detenerSincronizacion();
    console.log('Cierre de sesión exitoso.');
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

// ===============================================
// ==     FIN LÓGICA DE AUTENTICACIÓN FIREBASE    ==
// ===============================================

/**
 * Conecta los listeners globales al EventBus o a guardarConfig
 */
function agregarEventListenersGlobales() {
  // --- Navegación (EMITE EVENTOS) ---
  document.getElementById('main-nav').addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (navItem && navItem.dataset.page) {
      const idPagina = navItem.dataset.page;

      if (idPagina === 'proyectos') state.proyectoSeleccionadoId = null;
      if (idPagina === 'tareas') state.tareaSeleccionadald = null;
      if (idPagina === 'apuntes') state.apunteActivoId = null;

      EventBus.emit('navegarA', { pagina: idPagina });

      document
        .getElementById('app-container')
        .classList.remove('sidebar-visible');
    }
  });

  // Cargar iconos de la barra de navegación principal
  const mainNav = document.getElementById('main-nav');
  if (mainNav) {
    try {
      mainNav.querySelector('li[data-page="dashboard"] .nav-icon').innerHTML =
        ICONS.dashboard;
      mainNav.querySelector('li[data-page="tareas"] .nav-icon').innerHTML =
        ICONS.tareas;
      mainNav.querySelector('li[data-page="calendario"] .nav-icon').innerHTML =
        ICONS.calendario;
      mainNav.querySelector('li[data-page="cursos"] .nav-icon').innerHTML =
        ICONS.cursos;
      mainNav.querySelector('li[data-page="apuntes"] .nav-icon').innerHTML =
        ICONS.apuntes;
      mainNav.querySelector('li[data-page="proyectos"] .nav-icon').innerHTML =
        ICONS.proyectos;
    } catch (error) {
      console.error('[Main] Error al cargar iconos de navegación:', error);
    }
  }

  // Cargar iconos del HEADER principal
  try {
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    if (btnToggleSidebar) {
      btnToggleSidebar.innerHTML = ICONS.menu;
    }
    const btnConfig = document.getElementById('btn-config-dropdown');
    if (btnConfig) {
      btnConfig.innerHTML = ICONS.settings;
    }
  } catch (error) {
    console.error('[Main] Error al cargar iconos del header:', error);
  }

  // --- Sidebar (UI local) ---
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
    inicializarModalConfiguraciones();
    mostrarModal('modal-configuraciones');
  });

  // Listener del botón Logout
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

  // Listener de Widgets
  document
    .querySelector('.widget-toggle-list')
    ?.addEventListener('change', async (e) => {
      if (e.target.type === 'checkbox') {
        const key = e.target.dataset.widgetKey;
        if (
          state.config.widgetsVisibles &&
          state.config.widgetsVisibles.hasOwnProperty(key)
        ) {
          state.config.widgetsVisibles[key] = e.target.checked;
          await guardarConfig({
            widgetsVisibles: state.config.widgetsVisibles,
          });

          if (state.paginaActual === 'dashboard') {
            EventBus.emit('navegarA', { pagina: 'dashboard' });
          }
        }
      }
    });

  // Listener de Formulario Quick-Add
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
      agregarTareaDesdeDashboard(event);
    };
    formQuickAddTask.addEventListener('submit', quickAddTaskSubmitHandler);
    formQuickAddTask._submitHandler = quickAddTaskSubmitHandler;
  }

  // Carga de iconos en Config
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

  // Listeners de Personalización
  document
    .getElementById('btn-cambiar-tema')
    ?.addEventListener('click', cambiarTemaBase);
  document.getElementById('color-palette')?.addEventListener('click', (e) => {
    if (e.target.matches('.color-swatch[data-color]')) {
      cambiarColorAcento(e.target.dataset.color);
    }
  });
  document
    .getElementById('input-color-custom')
    ?.addEventListener('input', (e) => cambiarColorAcento(e.target.value));

  // ==========================================================================
  // ==        INICIO CORRECCIÓN FASE P3.4: CONECTAR BOTONES
  // ==========================================================================

  // Conectar el botón de EXPORTAR
  document
    .getElementById('btn-exportar-datos')
    ?.addEventListener('click', () => {
      exportarDatosJSON(); // ¡Llama a la nueva función de utils.js!
    });

  // Conectar el botón de IMPORTAR (para que haga clic en el input oculto)
  document
    .getElementById('btn-importar-datos')
    ?.addEventListener('click', () => {
      document.getElementById('input-importar-datos')?.click();
    });

  // Conectar el INPUT de archivo (el que hace el trabajo real)
  document
    .getElementById('input-importar-datos')
    ?.addEventListener('change', async (event) => {
      await importarDatosJSON(event); // ¡Llama a la nueva función de utils.js!
      // Limpiar el valor para permitir importar el mismo archivo de nuevo
      event.target.value = null;
    });

  // ==========================================================================
  // ==        FIN CORRECCIÓN FASE P3.4
  // ==========================================================================

  // Listener Cierre de Modales
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

  // Listener Modal Chooser
  const modalChooser = document.getElementById('modal-chooser-crear');
  if (modalChooser) {
    document
      .getElementById('btn-chooser-evento')
      ?.addEventListener('click', () => {
        const fecha = modalChooser.dataset.fechaSeleccionada;
        const curso = modalChooser.dataset.cursoPreseleccionado;
        if (fecha) {
          cerrarModal('modal-chooser-crear');
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
          abrirModalNuevaTarea(fecha, curso);
        }
        delete modalChooser.dataset.fechaSeleccionada;
        delete modalChooser.dataset.cursoPreseleccionado;
      });
  }

  // Listeners Colores Muescas
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
      if (e.target.matches('.color-choices .color-swatch[data-color]')) {
        const button = e.target;
        const container = button.closest('.color-choices');
        const key = container?.dataset.muescaKey || container?.dataset.fondoKey;
        const nuevoColor = button.dataset.color;
        const isFondo = container?.dataset.hasOwnProperty('fondoKey');
        if (key && nuevoColor && state.config.muescasColores) {
          if (state.config.muescasColores.hasOwnProperty(key)) {
            state.config.muescasColores[key] = nuevoColor;
            await guardarConfig({
              muescasColores: state.config.muescasColores,
            });
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
          await guardarConfig({ muescasColores: state.config.muescasColores });

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
  aplicarTema();
});

EventBus.on('navegarA', (data) => {
  console.log('[Main] Evento: navegarA recibido:', data);
  if (data.pagina) {
    if (data.id !== undefined && data.pagina === 'tareas')
      state.tareaSeleccionadald = data.id;
    if (data.id !== undefined && data.pagina === 'apuntes')
      state.apunteActivoId = data.id; // Corregido para que coincida con tu state
    if (data.id !== undefined && data.pagina === 'proyectos')
      state.proyectoSeleccionadoId = data.id;

    // Pasar la data completa a cambiarPagina
    cambiarPagina(data.pagina, data);
  }
});

// 2. Iniciar la aplicación en DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Main] DOMContentLoaded. Inicializando módulos...');

  agregarEventListenersGlobales();

  btnGoogleLogin.addEventListener('click', handleGoogleLogin);

  aplicarTema();

  manejarEstadoDeAutenticacion();
});
