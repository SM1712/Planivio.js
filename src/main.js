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
  aplicarColorFondoVencida,
  aplicarColoresMuescas,
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

  const coloresMuescas = state.config?.muescasColores;
  if (coloresMuescas) {
    // Itera sobre cada tipo de muesca (vencida, hoy, etc.)
    Object.keys(coloresMuescas).forEach((key) => {
      // Ignora las claves de fondo por ahora
      if (key === 'vencidaFondoColor' || key === 'vencidaFondoOpacidad') return;

      const savedColor = coloresMuescas[key];
      // Encuentra el input custom correspondiente y ponle el valor guardado
      const customInput = document.getElementById(`color-muesca-${key}-custom`);
      if (customInput) customInput.value = savedColor;

      // Encuentra todos los botones preset y el div custom para esta clave
      const choicesContainer = document.querySelector(
        `.color-choices[data-muesca-key="${key}"]`,
      );
      if (choicesContainer) {
        const presetButtons =
          choicesContainer.querySelectorAll('.color-swatch');
        const customSwatchDiv = choicesContainer.querySelector(
          '.custom-muesca-swatch',
        );
        let presetMatch = false; // Flag para saber si un preset coincidió

        // Quita 'active' de todos primero
        presetButtons.forEach((btn) => btn.classList.remove('active'));
        if (customSwatchDiv) customSwatchDiv.classList.remove('active');

        // Busca si el color guardado coincide con algún preset
        presetButtons.forEach((btn) => {
          if (btn.dataset.color === savedColor) {
            btn.classList.add('active');
            presetMatch = true;
          }
        });

        // Si ningún preset coincidió, marca el custom swatch como activo
        if (!presetMatch && customSwatchDiv) {
          customSwatchDiv.classList.add('active');
        }
      }
    });

    // --- CARGAR COLOR Y OPACIDAD DE FONDO VENCIDA (Esto estaba bien) ---
    const inputColorFondo = document.getElementById('color-fondo-vencida');
    const inputOpacidad = document.getElementById('opacidad-fondo-vencida');
    const opacidadLabel = inputOpacidad?.nextElementSibling;

    // Lógica para marcar el color base activo
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
        if (customInput) customInput.value = savedFondoColor; // Asegura valor del input
      } else if (presetMatch && customSwatchDiv) {
        // Si un preset está activo, pon ese color en el input custom también
        const customInput = customSwatchDiv.querySelector(
          'input[type="color"]',
        );
        if (customInput) customInput.value = savedFondoColor;
      }
    }

    // Lógica para opacidad (se mantiene igual)
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
    settingsNavList.querySelector('[data-tab="tareas"] .nav-icon').innerHTML =
      ICONS.tareas;
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

  const panelTareasSettings = document.getElementById('settings-tareas');
  if (panelTareasSettings) {
    // Función helper REVISADA para actualizar UI (marca botón/swatch activo)
    const actualizarVisualizacionColor = (key, nuevoColor, isFondo = false) => {
      const dataAttribute = isFondo ? 'data-fondo-key' : 'data-muesca-key';
      // Log para verificar qué se busca
      console.log(
        `[actualizarVisualizacionColor] Buscando container: .color-choices[${dataAttribute}="${key}"]`,
      );
      const choicesContainer = panelTareasSettings.querySelector(
        `.color-choices[${dataAttribute}="${key}"]`,
      );

      if (choicesContainer) {
        const presetButtons =
          choicesContainer.querySelectorAll('.color-swatch');
        const customSwatchDiv = choicesContainer.querySelector(
          '.custom-muesca-swatch',
        ); // Mantenemos clase genérica
        let presetMatch = false;

        // Log antes de actualizar
        console.log(
          `[actualizarVisualizacionColor] Actualizando para key=${key}, color=${nuevoColor}, esFondo=${isFondo}`,
        );

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
          // Siempre actualiza el valor del input custom para reflejar el color actual
          if (customInput) customInput.value = nuevoColor;
        }
        console.log(
          `[actualizarVisualizacionColor] UI actualizada. Preset activo: ${presetMatch}`,
        );
      } else {
        console.error(
          `[actualizarVisualizacionColor] No se encontró el container para key=${key}, esFondo=${isFondo}`,
        );
      }
    };

    // Listener para CLICS en botones preset (Muescas Y Fondo)
    panelTareasSettings.addEventListener('click', (e) => {
      if (e.target.matches('.color-choices .color-swatch[data-color]')) {
        const button = e.target;
        const container = button.closest('.color-choices');
        // Extrae CUALQUIER key presente (muesca o fondo)
        const key = container?.dataset.muescaKey || container?.dataset.fondoKey;
        const nuevoColor = button.dataset.color;
        const isFondo = container?.dataset.hasOwnProperty('fondoKey'); // Verifica si tiene el atributo fondoKey

        // Log detallado al hacer clic
        console.log(`--- Clic Preset Detectado ---`);
        console.log(` Target:`, button);
        console.log(` Container:`, container);
        console.log(` Key extraída: ${key}`);
        console.log(` Color: ${nuevoColor}`);
        console.log(` Es Fondo?: ${isFondo}`);

        if (key && nuevoColor && state.config.muescasColores) {
          // Verifica si la key existe en el objeto state antes de asignar
          if (state.config.muescasColores.hasOwnProperty(key)) {
            state.config.muescasColores[key] = nuevoColor;
            guardarDatos();

            // Llama a la función de aplicación correcta
            if (isFondo) {
              console.log(' Llamando a aplicarColorFondoVencida()');
              aplicarColorFondoVencida();
            } else {
              console.log(' Llamando a aplicarColoresMuescas()');
              aplicarColoresMuescas();
            }

            // Actualiza UI del modal
            actualizarVisualizacionColor(key, nuevoColor, isFondo);

            console.log(` State actualizado: ${key} = ${nuevoColor}`);
          } else {
            console.error(
              ` Error: La key '${key}' no existe en state.config.muescasColores.`,
            );
          }
        } else {
          console.error(
            ' Error: Faltan datos (key, nuevoColor o state.config.muescasColores) para procesar clic preset.',
          );
        }
      }
    });

    // Listener para CAMBIOS en input (Custom Muescas, Custom Fondo, Opacidad)
    panelTareasSettings.addEventListener('input', (e) => {
      const target = e.target;
      let key = null;
      let nuevoValor = null;
      let isFondoColor = false;
      let isFondoOpacidad = false;
      let isMuescaColor = false;

      // Identifica qué input cambió
      if (
        target.matches(
          '.custom-muesca-swatch input[type="color"][data-muesca-key]',
        )
      ) {
        key = target.dataset.muescaKey;
        nuevoValor = target.value;
        isMuescaColor = true;
        console.log(
          `--- Input Custom Muesca Detectado --- Key=${key}, Valor=${nuevoValor}`,
        );
      } else if (
        target.matches(
          '.custom-muesca-swatch input[type="color"][data-fondo-key="vencidaFondoColor"]',
        )
      ) {
        key = target.dataset.fondoKey;
        nuevoValor = target.value;
        isFondoColor = true;
        console.log(
          `--- Input Custom Fondo Detectado --- Key=${key}, Valor=${nuevoValor}`,
        );
      } else if (
        target.matches(
          'input[type="range"][data-fondo-key="vencidaFondoOpacidad"]',
        )
      ) {
        key = target.dataset.fondoKey;
        nuevoValor = parseFloat(target.value);
        isFondoOpacidad = true;
        console.log(
          `--- Input Opacidad Detectado --- Key=${key}, Valor=${nuevoValor}`,
        );
      }

      // Procesa el cambio si se identificó un input válido
      if (key && nuevoValor !== null && state.config.muescasColores) {
        if (state.config.muescasColores.hasOwnProperty(key)) {
          state.config.muescasColores[key] = nuevoValor;
          guardarDatos();

          if (isMuescaColor) {
            console.log(' Llamando a aplicarColoresMuescas()');
            aplicarColoresMuescas();
            actualizarVisualizacionColor(key, nuevoValor, false);
          } else if (isFondoColor) {
            console.log(' Llamando a aplicarColorFondoVencida()');
            aplicarColorFondoVencida();
            actualizarVisualizacionColor(key, nuevoValor, true);
          } else if (isFondoOpacidad) {
            console.log(' Llamando a aplicarColorFondoVencida()');
            aplicarColorFondoVencida();
            // Actualiza UI del slider
            const opacidadLabel = target.nextElementSibling;
            if (opacidadLabel)
              opacidadLabel.textContent = `${Math.round(nuevoValor * 100)}%`;
            target.style.setProperty('--range-percent', `${nuevoValor * 100}%`);
          }
          console.log(` State actualizado: ${key} = ${nuevoValor}`);
        } else {
          console.error(
            ` Error: La key '${key}' no existe en state.config.muescasColores.`,
          );
        }
      } else if (key || nuevoValor) {
        // Log si algo falló en la identificación o estado
        console.error(
          ' Error: Faltan datos (key, nuevoValor o state.config.muescasColores) para procesar input change.',
        );
      }
    });
  }
  // --- FIN LISTENER COLORES MUESCAS (CORREGIDO) ---
} // Cierre de agregarEventListenersGlobales

// Punto de entrada de la aplicación
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
