import { state } from './state.js';
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
  cargarDatos,
  guardarDatos,
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
} from './pages/dashboard.js'; // Necesitamos abrirModalNuevaTarea aquí
import { inicializarTareas } from './pages/tareas.js';
import { inicializarCursos } from './pages/cursos.js';
import {
  inicializarCalendario,
  iniciarEdicionEvento,
} from './pages/calendario.js'; // Necesitamos iniciarEdicionEvento aquí
import { inicializarApuntes } from './pages/apuntes.js';
import { inicializarProyectos } from './pages/proyectos.js';

const pageInitializers = {
  dashboard: inicializarDashboard,
  tareas: inicializarTareas,
  cursos: inicializarCursos,
  calendario: inicializarCalendario,
  apuntes: inicializarApuntes,
  proyectos: inicializarProyectos,
};

// ... (cambiarPagina, cambiarTemaBase, cambiarColorAcento, aplicarTema, inicializarModalConfiguraciones SIN CAMBIOS) ...
export async function cambiarPagina(idPagina) {
  state.paginaActual = idPagina;
  const appContent = document.getElementById('app-content');
  if (!appContent) return;
  try {
    const response = await fetch(`./src/views/${idPagina}.html`);
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status}, No se pudo encontrar ${idPagina}.html`,
      );
    }
    appContent.innerHTML = await response.text();
    const newPage = appContent.querySelector('.page');
    if (newPage) {
      setTimeout(() => {
        newPage.classList.add('visible');
        if (pageInitializers[idPagina]) {
          pageInitializers[idPagina](newPage);
        } else {
          console.warn(
            `No se encontró una función de inicialización para la página: ${idPagina}`,
          );
        }
      }, 0);
    } else {
      console.error(
        `La página ${idPagina} se cargó pero no se encontró el elemento .page`,
      );
    }
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.page === idPagina);
    });
  } catch (error) {
    console.error('Error al cargar la página:', error);
    appContent.innerHTML = `<div class="panel"><h2>Error al cargar la página</h2><p>${error.message}. Revisa la consola para más detalles.</p></div>`;
  }
}
function cambiarTemaBase() {
  state.config.theme = state.config.theme === 'light' ? 'dark' : 'light';
  aplicarTema();
  guardarDatos();
}
function cambiarColorAcento(color) {
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
  guardarDatos();
}
function aplicarTema() {
  document.body.classList.toggle('dark-theme', state.config.theme === 'dark');
  cambiarColorAcento(state.config.accent_color);
  updateRgbVariables();
}
function inicializarModalConfiguraciones() {
  const inputNombre = document.getElementById('input-nombre-usuario');
  if (inputNombre) {
    inputNombre.value = state.config.userName || '';
  }
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
    const inputColorFondo = document.getElementById('color-fondo-vencida');
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

function agregarEventListenersGlobales() {
  // ... (Listeners de navegación, sidebar, modal configuraciones SIN CAMBIOS) ...
  document.getElementById('main-nav').addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (navItem && navItem.dataset.page) {
      const idPagina = navItem.dataset.page;
      if (idPagina === 'proyectos') state.proyectoSeleccionadoId = null;
      if (idPagina === 'tareas') state.tareaSeleccionadaId = null;
      if (idPagina === 'apuntes') state.apunteActivold = null;
      guardarDatos();
      cambiarPagina(idPagina);
      document
        .getElementById('app-container')
        .classList.remove('sidebar-visible');
    }
  });
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
  const configBtn = document.getElementById('btn-config-dropdown');
  configBtn?.addEventListener('click', () => {
    inicializarModalConfiguraciones();
    mostrarModal('modal-configuraciones');
  });
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
  document
    .getElementById('input-nombre-usuario')
    ?.addEventListener('change', (e) => {
      state.config.userName = e.target.value.trim();
      guardarDatos();
    });
  document
    .querySelector('.widget-toggle-list')
    ?.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        const key = e.target.dataset.widgetKey;
        if (
          state.config.widgetsVisibles &&
          state.config.widgetsVisibles.hasOwnProperty(key)
        ) {
          state.config.widgetsVisibles[key] = e.target.checked;
          guardarDatos();
          if (state.paginaActual === 'dashboard') {
            cambiarPagina('dashboard');
          }
        }
      }
    });
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
  document
    .getElementById('btn-exportar-datos')
    ?.addEventListener('click', () => {
      exportarDatosJSON(mostrarPrompt);
    });
  document
    .getElementById('btn-importar-datos')
    ?.addEventListener('click', () => {
      mostrarConfirmacion(
        'Importar Datos',
        '¿Estás seguro? Esta acción sobreescribirá todos tus datos actuales. Se recomienda exportar primero.',
        () => {
          document.getElementById('input-importar-datos').click();
        },
      );
    });
  document
    .getElementById('input-importar-datos')
    ?.addEventListener('change', (event) => {
      importarDatosJSON(event, (error, message) => {
        if (error) {
          mostrarAlerta('Error de Importación', message);
        } else {
          mostrarAlerta('Éxito', message, () => location.reload());
        }
      });
    });
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
    ?.addEventListener('click', () => cerrarModal('modal-prompt')); // Añadido por si acaso

  // ======================================================
  // ==        INICIO MODIFICACIÓN MODAL CHOOSER         ==
  // ======================================================
  const modalChooser = document.getElementById('modal-chooser-crear');
  if (modalChooser) {
    // Botón para Nuevo Evento
    document
      .getElementById('btn-chooser-evento')
      ?.addEventListener('click', () => {
        const fecha = modalChooser.dataset.fechaSeleccionada;
        const curso = modalChooser.dataset.cursoPreseleccionado; // Leemos el curso
        if (fecha) {
          cerrarModal('modal-chooser-crear');
          // Pasamos la fecha Y el curso a iniciarEdicionEvento
          // (Necesitamos modificar iniciarEdicionEvento en calendario.js)
          iniciarEdicionEvento({ fechaInicio: fecha, fechaFin: fecha }, curso);
        }
        // Limpiamos los datasets después de usarlos
        delete modalChooser.dataset.fechaSeleccionada;
        delete modalChooser.dataset.cursoPreseleccionado;
      });

    // Botón para Nueva Tarea
    document
      .getElementById('btn-chooser-tarea')
      ?.addEventListener('click', () => {
        const fecha = modalChooser.dataset.fechaSeleccionada;
        const curso = modalChooser.dataset.cursoPreseleccionado; // Leemos el curso
        if (fecha) {
          cerrarModal('modal-chooser-crear');
          // Pasamos la fecha Y el curso a abrirModalNuevaTarea
          // (Ya modificamos abrirModalNuevaTarea en dashboard.js)
          abrirModalNuevaTarea(fecha, curso);
        }
        // Limpiamos los datasets después de usarlos
        delete modalChooser.dataset.fechaSeleccionada;
        delete modalChooser.dataset.cursoPreseleccionado;
      });
  }
  // ======================================================
  // ==          FIN MODIFICACIÓN MODAL CHOOSER          ==
  // ======================================================

  // --- Listener colores muescas (SIN CAMBIOS) ---
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
    panelTareasSettings.addEventListener('click', (e) => {
      if (e.target.matches('.color-choices .color-swatch[data-color]')) {
        const button = e.target;
        const container = button.closest('.color-choices');
        const key = container?.dataset.muescaKey || container?.dataset.fondoKey;
        const nuevoColor = button.dataset.color;
        const isFondo = container?.dataset.hasOwnProperty('fondoKey');
        if (key && nuevoColor && state.config.muescasColores) {
          if (state.config.muescasColores.hasOwnProperty(key)) {
            state.config.muescasColores[key] = nuevoColor;
            guardarDatos();
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
    panelTareasSettings.addEventListener('input', (e) => {
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
          guardarDatos();
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

// ... (Punto de entrada DOMContentLoaded SIN CAMBIOS) ...
document.addEventListener('DOMContentLoaded', async () => {
  cargarDatos();
  aplicarTema();
  aplicarColoresMuescas();
  aplicarColorFondoVencida();
  cargarIconos();
  updateRgbVariables();
  agregarEventListenersGlobales();

  if (!state.config.userName) {
    const nombre = await mostrarModalOnboarding();
    state.config.userName = nombre;
    guardarDatos();
    mostrarAlerta(
      `¡Hola, ${nombre}!`,
      'Para empezar a organizarte, el primer paso es crear un curso. Luego, podrás añadir tareas a ese curso.',
      () => {
        cambiarPagina('cursos');
      },
    );
  } else {
    await cambiarPagina(state.paginaActual || 'dashboard');
  }
});
