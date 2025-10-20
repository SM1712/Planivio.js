import { state } from './state.js';
import {
  cargarIconos,
  mostrarConfirmacion,
  mostrarAlerta,
  mostrarPrompt,
  cerrarModal,
  mostrarModal, // Asegúrate de importar 'mostrarModal' si no lo tenías
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
} from './utils.js';
import { ICONS } from './icons.js'; // Importamos los íconos para usarlos aquí

import { inicializarDashboard } from './pages/dashboard.js';
import { inicializarTareas } from './pages/tareas.js';
import { inicializarCursos } from './pages/cursos.js';
import { inicializarCalendario } from './pages/calendario.js';
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
      // Usamos setTimeout(0) para darle al navegador un "respiro"
      // y asegurar que el DOM esté 100% listo antes de inicializar.
      // Esto arreglará el 'long press'.
      setTimeout(() => {
        newPage.classList.add('visible');
        if (pageInitializers[idPagina]) {
          pageInitializers[idPagina](newPage); // Le pasamos newPage
        } else {
          console.warn(
            `No se encontró una función de inicialización para la página: ${idPagina}`,
          );
        }
      }, 0); // <-- ESTE ES EL ARREGLO
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

// Función para preparar el contenido del modal de configuraciones
function inicializarModalConfiguraciones() {
  // Cargar nombre de usuario
  const inputNombre = document.getElementById('input-nombre-usuario');
  if (inputNombre) {
    inputNombre.value = state.config.userName || '';
  }

  // Cargar estado de los checkboxes de widgets
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
}

function agregarEventListenersGlobales() {
  // Listener para la navegación principal
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

  // Listeners para sidebar en móvil
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

  // --- LÓGICA DEL NUEVO MODAL DE CONFIGURACIONES ---
  const configBtn = document.getElementById('btn-config-dropdown');
  configBtn?.addEventListener('click', () => {
    inicializarModalConfiguraciones();
    mostrarModal('modal-configuraciones');
  });

  // Manejar la navegación por pestañas dentro del modal (Versión Robusta)
  document
    .getElementById('settings-nav-list')
    ?.addEventListener('click', (e) => {
      const navItem = e.target.closest('.settings-nav-item');
      if (!navItem) return;
      const tabId = navItem.dataset.tab;

      // Se buscan los elementos DENTRO del listener para asegurar que siempre estén actualizados
      const settingsPanes = document.querySelectorAll('.settings-pane');
      document
        .querySelectorAll('.settings-nav-item')
        .forEach((item) => item.classList.remove('active'));
      settingsPanes.forEach((pane) => pane.classList.remove('active'));

      navItem.classList.add('active');
      document.getElementById(`settings-${tabId}`)?.classList.add('active');
    });

  // Listeners para los controles DENTRO del modal
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

  // Inyectar iconos SVG en el modal
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
  }

  const btnCerrarModalConfig = document.querySelector(
    '#modal-configuraciones .btn-cerrar-modal',
  );
  if (btnCerrarModalConfig) {
    btnCerrarModalConfig.innerHTML = ICONS.close;
  }
  // --- FIN LÓGICA DEL NUEVO MODAL ---

  // Listeners para controles que ahora están en el modal
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

  // Listener global para cerrar modales
  document.body.addEventListener('click', (e) => {
    // Busca si el clic fue en un elemento con data-action="cerrar-modal"
    const closeButton = e.target.closest('[data-action="cerrar-modal"]');
    if (closeButton) {
      // Encuentra el modal padre (el overlay)
      const modalOverlay = closeButton.closest('.modal-overlay');
      if (modalOverlay) {
        cerrarModal(modalOverlay.id); // Llama a la función para cerrar
      }
      document
        .getElementById('btn-prompt-cancelar')
        ?.addEventListener('click', () => cerrarModal('modal-prompt'));
    }
  });
  document
    .getElementById('btn-confirm-cancelar')
    ?.addEventListener('click', () => cerrarModal('modal-confirmacion'));
}

// Punto de entrada de la aplicación
document.addEventListener('DOMContentLoaded', async () => {
  cargarDatos();
  aplicarTema();
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
