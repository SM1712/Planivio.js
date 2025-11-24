// ==========================================================================
// ==
// ==                          src/main.js
// ==
// ==    (MODIFICADO - ETAPA 0 (CORREGIDO): Corregido el nombre de
// ==     'enablePersistence' a 'enableIndexedDbPersistence')
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
  inicializarSonido,
  mostrarPasoTour, // ✨ IMPORTAR
} from './ui.js';
import {
  updateRgbVariables,
  hexToRgb,
  getTextColorForBg,
  darkenColor,
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
import { inicializarGrupos } from './pages/grupos.js'; // <-- AÑADIDO (ETAPA 2)
// (Importado en Etapa 4)
import {
  inicializarPulsos,
  generarPulsosDelDia,
  abrirPanelPulsos,
  // ✨ INICIO CAMBIO ETAPA 17: Importar Triggers
  triggerPulsoResumenHoy,
  triggerPulsoEventosSemana,
  triggerPulsoRecordatorioRacha,
  // ✨ FIN CAMBIO ETAPA 17
} from './pages/pulsos.js';

// Esto se usará para la carga inicial de páginas
const pageInitializers = {
  dashboard: inicializarDashboard,
  tareas: inicializarTareas,
  cursos: inicializarCursos,
  calendario: inicializarCalendario,
  apuntes: inicializarApuntes,
  proyectos: inicializarProyectos,
  grupos: inicializarGrupos, // <-- AÑADIDO (ETAPA 2)
  pulsos: inicializarPulsos,
};

// ✨ INICIO CAMBIO ETAPA 17: Variable global para el temporizador
let pulsoTimer = null;
// ✨ FIN CAMBIO ETAPA 17

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
/**
 * Aplica visualmente el color de acento al DOM (SIN GUARDAR).
 */
function _aplicarColorAcentoVisualmente(color) {
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
}

/**
 * Llama a guardarConfig (async) y aplica visualmente.
 * Usar esta función cuando el USUARIO cambia el color manualmente.
 */
async function cambiarColorAcento(color) {
  state.config.accent_color = color;
  _aplicarColorAcentoVisualmente(color);
  await guardarConfig({ accent_color: state.config.accent_color }); // Guarda solo este cambio
}

/**
 * (Aplica estilos basados en el state.config actual)
 * NO DEBE LLAMAR A GUARDAR CONFIG.
 */
function aplicarTema() {
  document.body.classList.toggle('dark-theme', state.config.theme === 'dark');
  if (state.config && state.config.accent_color) {
    _aplicarColorAcentoVisualmente(state.config.accent_color);
  } else {
    _aplicarColorAcentoVisualmente('#2f5580'); // Color por defecto
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
      if (key && state.config.widgetsVisibles.hasOwnProperty(key)) {
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

  // Rellenar controles de Pulsos (Añadido en Etapa 10)
  const configPulsos = state.config?.pulsos;
  if (configPulsos) {
    const panelPulsos = document.getElementById('settings-pulsos');
    if (!panelPulsos) return;

    // 1. Rellenar todos los inputs (checkbox, time, select)
    const inputs = panelPulsos.querySelectorAll(
      'input[data-pulso-key], select[data-pulso-key]',
    );
    inputs.forEach((input) => {
      const key = input.dataset.pulsoKey;
      const subKey = input.dataset.pulsoSubKey;
      if (configPulsos[key] && configPulsos[key][subKey] !== undefined) {
        const valor = configPulsos[key][subKey];
        if (input.type === 'checkbox') {
          input.checked = valor;
        } else {
          input.value = valor;
        }
      }
    });

    // 2. Habilitar/Deshabilitar sub-opciones
    const subOpciones = panelPulsos.querySelectorAll('.config-sub-option');
    subOpciones.forEach((sub) => {
      const parentKey = sub.dataset.pulsoParent;
      const parentToggle = panelPulsos.querySelector(
        `#toggle-pulso-${parentKey}`,
      );
      if (parentToggle) {
        const estaActivo = parentToggle.checked;
        sub.querySelectorAll('input, select').forEach((control) => {
          control.disabled = !estaActivo;
        });
        sub.style.opacity = estaActivo ? 1 : 0.5;
        sub.style.pointerEvents = estaActivo ? 'auto' : 'none';
      }
    });
  }
}

// ===============================================
// == R1.4: LÓGICA DE AUTENTICACIÓN (MODIFICADA)  ==
// ===============================================

import { inicializarNotificacionesGlobales } from './notifications.js'; // ✨ IMPORTAR

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
        configData && 
        !configData.onboardingCompletado && // ✨ FIX: Solo pedir si NO ha completado onboarding
        (!configData.userName); // El cumpleaños es opcional, no debe bloquear

      let prefillName = configData ? configData.userName : null;
      let prefillBirthday = configData ? configData.userBirthday : null;

      if (isMigrationUser) {
        await handleMigrationFlow(prefillName, prefillBirthday);
      } else if (isNewUser) {
        // ✨ FIX: Pasar el nombre de Google como default
        await handleNewUserOnboarding(user.displayName);
      } else if (isExistingUserWithMissingInfo) {
        // ✨ FIX: Pasar el nombre de Google si no hay uno guardado
        const nameToUse = prefillName || user.displayName;
        await handleExistingUserUpdate(nameToUse, prefillBirthday);
      }


      // ==========================================================
      // ==        FIN DE LÓGICA ONBOARDING/MIGRACIÓN (P3.1)
      // ==========================================================

      iniciarSincronizacion(user.uid);

      // (Conectado en Etapa 4)
      inicializarPulsos(); // Prepara los listeners del panel
      generarPulsosDelDia(); // Genera las notificaciones del día ("catch-up")

      // ✨ INICIO CAMBIO ETAPA 17: Iniciar el temporizador de tiempo real
      if (pulsoTimer) clearInterval(pulsoTimer); // Limpiar timer anterior si existe
      pulsoTimer = setInterval(() => {
        // console.log('[Pulsos] Verificando hora para triggers...');
        triggerPulsoResumenHoy();
        triggerPulsoEventosSemana();
        triggerPulsoRecordatorioRacha();
      }, 60000); // Cada 60 segundos
      // ✨ FIN CAMBIO ETAPA 17

// --- INICIO ETAPA 17: Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('[Service Worker] Registrado con éxito:', registration.scope);
      })
      .catch(error => {
        console.log('[Service Worker] Falló el registro:', error);
      });
  });
}
// --- FIN ETAPA 17 ---

      console.log('[Main] Sincronización iniciada. Inicializando módulos...');
      inicializarDashboard();
      inicializarTareas();
      inicializarCursos();
      inicializarCalendario();
      inicializarApuntes();
      inicializarProyectos();
      inicializarGrupos(); // <-- AÑADIDO (ETAPA 2)

      if (document.getElementById('user-photo'))
        document.getElementById('user-photo').src = user.photoURL;
      if (document.getElementById('user-name'))
        document.getElementById('user-name').textContent = user.displayName;
      if (document.getElementById('user-email'))
        document.getElementById('user-email').textContent = user.email;

      // --- INICIO CAMBIO ETAPA 11.4: Asegurar que el email esté en config ---
      // Esto es vital para que otros usuarios puedan encontrarnos
      if (user.email) {
         guardarConfig({ email: user.email });
      }
      // --- FIN CAMBIO ETAPA 11.4 ---

      await cambiarPagina(state.paginaActual || 'dashboard');
    } else {
      // --- 2. USUARIO NO ESTÁ LOGUEADO ---
      console.log('No hay usuario.');

      if (appHeader) appHeader.style.visibility = 'hidden';
      loginContainer.style.display = 'flex';
      if (appContainer) appContainer.style.visibility = 'hidden';

      detenerSincronizacion();

      // ✨ INICIO CAMBIO ETAPA 17: Detener el temporizador al cerrar sesión
      if (pulsoTimer) {
        clearInterval(pulsoTimer);
        pulsoTimer = null;
        console.log('[Pulsos] Temporizador detenido.');
      }
      // ✨ FIN CAMBIO ETAPA 17
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
async function handleNewUserOnboarding(googleDisplayName = '') {
  console.log('[Main] Iniciando Flujo de Onboarding para Usuario Nuevo...');
  const { nombre, fechaCumple } = await mostrarModalOnboarding(
    '¡HOOOLA! 👋 ¡Soy Pulsito!',
    googleDisplayName, // ✨ Usar nombre de Google
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
  // Paso 1: Dashboard
  EventBus.emit('navegarA', { pagina: 'dashboard' });
  await new Promise((r) => setTimeout(r, 800)); // Esperar renderizado
  await mostrarPasoTour(
    '.widget-racha', // O algún widget visible
    '¡BUM-BUM! 💓 ¡Este es el corazón!',
    `¡Hola ${nombre}! Aquí en el **Dashboard** verás tu Racha Diaria. ¡Es el pulso de tu productividad! Mantenla viva entrando todos los días. ¡Tú puedes! 🔥`,
  );

  // Paso 2: Cursos
  EventBus.emit('navegarA', { pagina: 'cursos' });
  await new Promise((r) => setTimeout(r, 800));
  await mostrarPasoTour(
    '#btn-nuevo-curso', // Botón flotante o header
    '¡Aquí nace todo! 🌱',
    'Todo empieza con un **Curso**. Matemáticas, Proyecto X, Vida... ¡Lo que quieras! Dale al botón + y crea tu primer universo. ¡Es súper fácil! ✨',
  );

  // Paso 3: Tareas
  EventBus.emit('navegarA', { pagina: 'tareas' });
  await new Promise((r) => setTimeout(r, 800));
  await mostrarPasoTour(
    '#panel-creacion',
    '¡Acción! 🎬',
    'Aquí es donde las cosas suceden. Crea **Tareas**, ponles fecha y ¡destrúyelas! 💥 Nada se siente mejor que marcar una tarea como completada.',
  );

  // Paso 4: Proyectos
  EventBus.emit('navegarA', { pagina: 'proyectos' });
  await new Promise((r) => setTimeout(r, 800));
  await mostrarPasoTour(
    '#btn-nuevo-proyecto',
    '¡Tus Grandes Metas! 🚀',
    '¿Tienes algo grande en mente? Un **Proyecto** agrupa tareas de varios cursos. ¡Perfecto para organizar ese viaje o tu tesis! 🌍',
  );

  // Paso 5: Apuntes
  EventBus.emit('navegarA', { pagina: 'apuntes' });
  await new Promise((r) => setTimeout(r, 800));
  await mostrarPasoTour(
    '#btn-nuevo-apunte',
    '¡No lo olvides! 🧠',
    'Tus ideas vuelan... ¡atrápalas aquí! Escribe notas rápidas, resúmenes o lo que se te ocurra. ¡Tu segundo cerebro está listo! 📝',
  );

  // Paso 6: Calendario
  EventBus.emit('navegarA', { pagina: 'calendario' });
  await new Promise((r) => setTimeout(r, 800));
  await mostrarPasoTour(
    '.calendar-grid',
    '¡El Futuro! 🔮',
    '¡Mira todo tu mes de un vistazo! Aquí verás tus tareas, eventos y... ¡sí! ¡Tu cumpleaños! 🎂 ¡Organízate como un pro!',
  );

  // Paso 7: Configuración
  mostrarModal('modal-configuraciones');
  document.querySelector('[data-tab="personalizacion"]')?.click();
  await new Promise((r) => setTimeout(r, 800));
  await mostrarPasoTour(
    '#theme-toggle-btn', // O el panel de personalización
    '¡Hazlo Tuyo! 🎨',
    '¿Modo Oscuro? ¿Azul Eléctrico? ¡Tú mandas! Personaliza Planivio para que se vea tan genial como tú. 😎',
  );
  cerrarModal('modal-configuraciones');

  // Final
  EventBus.emit('navegarA', { pagina: 'dashboard' });
  await mostrarAlerta(
    '¡A PULSAR! ❤️',
    `¡Ya eres un experto, ${nombre}! 🎓<br><br>Ahora te toca a ti. Empieza creando tu primer curso y... ¡a conquistar el mundo! 🌍💪`,
  );
}

/**
 * Función helper para guardar los datos del onboarding
 */
async function guardarDatosOnboarding(nombre, fechaCumple, prefillBirthday) {
  state.config.userName = nombre;
  const configUpdates = { userName: nombre };
  
  // --- INICIO CAMBIO ETAPA 11.4: Guardar Email ---
  if (auth.currentUser && auth.currentUser.email) {
    configUpdates.email = auth.currentUser.email;
  }
  // --- FIN CAMBIO ETAPA 11.4 ---

  // ✨ FIX: Marcar onboarding como completado para evitar bucle
  state.config.onboardingCompletado = true;
  configUpdates.onboardingCompletado = true;

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
/**
 * Inicia el pop-up de login con Google
 */
async function handleGoogleLogin() {
  const provider = new GoogleAuthProvider();
  // ✨ NUEVO: Pedir acceso al cumpleaños
  provider.addScope('https://www.googleapis.com/auth/user.birthday.read');

  try {
    const result = await signInWithPopup(auth, provider);
    console.log('Inicio de sesión exitoso:', result.user.displayName);

    // ✨ NUEVO: Obtener Access Token y pedir cumpleaños
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;

    if (token) {
      try {
        const response = await fetch(
          'https://people.googleapis.com/v1/people/me?personFields=birthdays',
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          }
        );
        const data = await response.json();
        
        if (data.birthdays && data.birthdays.length > 0) {
          // Buscar el cumpleaños con fecha completa (año, mes, día)
          const birthday = data.birthdays.find(b => b.date && b.date.year && b.date.month && b.date.day);
          
          if (birthday) {
            const { year, month, day } = birthday.date;
            // Formato YYYY-MM-DD (Mes y día con ceros a la izquierda)
            const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            console.log('[Google] Cumpleaños obtenido:', formattedDate);
            
            // Guardar en estado temporal para el onboarding
            state.tempGoogleBirthday = formattedDate;

            // Si el modal de onboarding ya está abierto, intentar rellenarlo
            const inputCumple = document.getElementById('input-onboarding-cumple');
            if (inputCumple) {
              inputCumple.value = formattedDate;
              console.log('[Google] Input de cumpleaños actualizado dinámicamente.');
            }
          } else {
             console.log('[Google] No se encontró una fecha de nacimiento completa.');
          }
        }
      } catch (fetchError) {
        console.warn('[Google] Error al obtener cumpleaños:', fetchError);
      }
    }

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
      // --- INICIO ETAPA 2: Cargar ícono ---
      mainNav.querySelector('li[data-page="grupos"] .nav-icon').innerHTML =
        ICONS.group;
      // --- FIN ETAPA 2 ---
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
    // (Añadido en Etapa 4)
    const btnPulsos = document.getElementById('btn-pulsos-header');
    if (btnPulsos) {
      // Asumiendo que tienes un ICONS.pulsos (ícono de campana)
      btnPulsos.innerHTML = ICONS.pulsos;
      // Re-añadir el contador que el innerHTML borró
      const contador = document.createElement('span');
      contador.id = 'pulsos-contador';
      contador.className = 'pulsos-contador hidden';
      contador.textContent = '0';
      btnPulsos.appendChild(contador);
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
    inicializarModalConfiguraciones(); // <- AHORA RELLENA LOS CONTROLES DE PULSOS
    mostrarModal('modal-configuraciones');
  });

  // (Añadido en Etapa 4)
  document
    .getElementById('btn-pulsos-header')
    ?.addEventListener('click', (e) => {
      e.stopPropagation(); // Evita que el listener global de 'document' lo cierre
      abrirPanelPulsos();
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
          key && // Asegurarnos que no sea un toggle de pulsos
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
      ICONS.user;
    settingsNavList.querySelector(
      '[data-tab="personalizacion"] .nav-icon',
    ).innerHTML = ICONS.palette;
    settingsNavList.querySelector(
      '[data-tab="dashboard"] .nav-icon',
    ).innerHTML = ICONS.dashboard;
    settingsNavList.querySelector('[data-tab="tareas"] .nav-icon').innerHTML =
      ICONS.tareas;
    // (Añadido en Etapa 4)
    settingsNavList.querySelector('[data-tab="pulsos"] .nav-icon').innerHTML =
      ICONS.pulsos;
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
          '.custom-mmuesca-swatch input[type="color"][data-muesca-key]',
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

  // (Añadido en Etapa 10)
  const panelPulsosSettings = document.getElementById('settings-pulsos');
  if (panelPulsosSettings) {
    panelPulsosSettings.addEventListener('change', async (e) => {
      const target = e.target.closest(
        'input[data-pulso-key], select[data-pulso-key]',
      );
      if (!target) return;

      const key = target.dataset.pulsoKey;
      const subKey = target.dataset.pulsoSubKey;
      const value = target.type === 'checkbox' ? target.checked : target.value;

      if (
        state.config.pulsos[key] &&
        state.config.pulsos[key][subKey] !== undefined
      ) {
        // 1. Actualizar el estado local
        state.config.pulsos[key][subKey] = value;

        // 2. Guardar en Firebase (solo el objeto 'pulsos' completo)
        await guardarConfig({ pulsos: state.config.pulsos });
        console.log(
          `[Main] Configuración de Pulsos guardada: ${key}.${subKey} = ${value}`,
        );

        // 3. Lógica de habilitar/deshabilitar sub-opciones
        if (target.type === 'checkbox' && subKey === 'activo') {
          const subOpciones = panelPulsosSettings.querySelector(
            `.config-sub-option[data-pulso-parent="${key}"]`,
          );
          if (subOpciones) {
            const estaActivo = target.checked;
            subOpciones.querySelectorAll('input, select').forEach((control) => {
              control.disabled = !estaActivo;
            });
            subOpciones.style.opacity = estaActivo ? 1 : 0.5;
            subOpciones.style.pointerEvents = estaActivo ? 'auto' : 'none';
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

  // (Añadido en Etapa 4)
  inicializarSonido();

  // (Añadido en Etapa 4)
  if (
    'Notification' in window &&
    Notification.permission !== 'granted' &&
    Notification.permission !== 'denied'
  ) {
    console.log('[Main] Solicitando permiso de notificaciones...');
    Notification.requestPermission();
  }

  agregarEventListenersGlobales();

  btnGoogleLogin.addEventListener('click', handleGoogleLogin);

  aplicarTema();

  // ======================================================================
  // ==     INICIO ETAPA 0 (CORREGIDO): HABILITAR PERSISTENCIA OFFLINE
  // ======================================================================
  try {
    // CORRECCIÓN: Usar 'enableIndexedDbPersistence' en lugar de 'enablePersistence'
    await window.firebaseServices.enableIndexedDbPersistence(
      window.firebaseServices.db,
    );
    console.log(
      '[Main - ETAPA 0] Persistencia offline de Firebase habilitada.',
    );
  } catch (error) {
    if (error.code == 'failed-precondition') {
      console.warn(
        '[Main - ETAPA 0] Error al habilitar persistencia: Múltiples pestañas abiertas. La persistencia ya está activa en otra pestaña.',
      );
    } else if (error.code == 'unimplemented') {
      console.warn(
        '[Main - ETAPA 0] Error al habilitar persistencia: Navegador no compatible.',
      );
    } else {
      console.error('[Main - ETAPA 0] Error al habilitar persistencia:', error);
    }
  }
  // ======================================================================
  // ==     FIN ETAPA 0 (CORREGIDO)
  // ======================================================================

  manejarEstadoDeAutenticacion();
});
