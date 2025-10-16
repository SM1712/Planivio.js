import { state } from './state.js';
import {
  cargarIconos,
  mostrarConfirmacion,
  mostrarAlerta,
  mostrarPrompt,
  cerrarModal,
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

async function cambiarPagina(idPagina) {
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
      newPage.classList.add('visible');
    }
    // ===== LA CORRECCIÓN CLAVE ESTÁ AQUÍ =====
    // Esperamos un instante para que el DOM se actualice antes de ejecutar los scripts de la página
    setTimeout(() => {
      if (pageInitializers[idPagina]) {
        pageInitializers[idPagina]();
      } else {
        console.warn(
          `No se encontró una función de inicialización para la página: ${idPagina}`,
        );
      }
    }, 0);
    // ==========================================

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

function agregarEventListenersGlobales() {
  document.getElementById('main-nav').addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (navItem && navItem.dataset.page) {
      cambiarPagina(navItem.dataset.page);
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
  const configDropdown = document.getElementById('config-dropdown');
  configBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    configDropdown.classList.toggle('visible');
  });
  window.addEventListener('click', (e) => {
    if (
      configDropdown &&
      configBtn &&
      !configBtn.contains(e.target) &&
      !configDropdown.contains(e.target)
    ) {
      configDropdown.classList.remove('visible');
    }
  });

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
      configDropdown.classList.remove('visible');
    });
  document
    .getElementById('btn-importar-datos')
    ?.addEventListener('click', () => {
      mostrarConfirmacion(
        'Importar Datos',
        '¿Estás seguro? Esta acción sobreescribirá todos tus datos actuales. Se recomienda exportar primero.',
        () => {
          document.getElementById('input-importar-datos').click();
          configDropdown.classList.remove('visible');
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
    if (e.target.matches('[data-action="cerrar-modal"]')) {
      cerrarModal(e.target.closest('.modal-overlay').id);
    }
  });

  document
    .getElementById('btn-confirm-cancelar')
    ?.addEventListener('click', () => cerrarModal('modal-confirmacion'));
}

document.addEventListener('DOMContentLoaded', async () => {
  cargarDatos();
  aplicarTema();
  cargarIconos();
  updateRgbVariables();
  agregarEventListenersGlobales();
  await cambiarPagina(state.paginaActual || 'dashboard');
});
