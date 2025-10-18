import { state, state as defaultState } from './state.js';

export function updateRgbVariables() {
  const computedStyle = getComputedStyle(document.body);
  const textColorHex = computedStyle.getPropertyValue('--text-base').trim();
  const rgbArray = hexToRgb(textColorHex);
  if (rgbArray) {
    document.body.style.setProperty('--text-base-rgb', rgbArray.join(', '));
  }
}

// En utils.js o main.js (dentro de cargarDatos)
export function cargarDatos() {
  const datosGuardados = localStorage.getItem('planivioData');

  // 1. Define el estado inicial completo CLONADO (incluyendo widgetsVisibles por defecto)
  //    Usamos JSON.parse(JSON.stringify(...)) para crear una copia profunda y evitar modificar el original importado.
  const estadoInicialCompleto = JSON.parse(JSON.stringify(defaultState));

  if (datosGuardados) {
    try {
      const estadoGuardado = JSON.parse(datosGuardados);

      // 2. Fusiona los datos guardados sobre el estado inicial completo.
      //    Esto asegura que mantenemos la estructura base y añadimos/sobrescribimos con lo guardado.
      const estadoFinal = {
        ...estadoInicialCompleto, // Empieza con la estructura por defecto completa
        ...estadoGuardado, // Sobrescribe claves existentes con lo guardado
        config: {
          // Fusiona 'config' explícitamente para asegurar sub-propiedades
          ...estadoInicialCompleto.config, // Defaults de config
          ...(estadoGuardado.config || {}), // Lo guardado en config (si existe)
          // ✨ Asegura que widgetsVisibles exista y tenga defaults si falta en lo guardado
          widgetsVisibles: {
            ...estadoInicialCompleto.config.widgetsVisibles, // Defaults de widgetsVisibles
            ...(estadoGuardado.config?.widgetsVisibles || {}), // Lo guardado en widgetsVisibles (si existe)
          },
        },
        // Si tienes otros objetos anidados en 'state' que necesiten fusión, añádelos aquí de forma similar a 'config'.
      };

      // 3. Limpia el estado global actual antes de aplicar el estado final.
      //    Esto es importante si la estructura guardada es muy antigua y tiene claves obsoletas.
      Object.keys(state).forEach((key) => delete state[key]);

      // 4. Aplica el estado final fusionado al 'state' global.
      Object.assign(state, estadoFinal);

      console.log(
        '[cargarDatos] Datos cargados y fusionados:',
        JSON.parse(JSON.stringify(state)),
      ); // Loguea una copia para ver el resultado
    } catch (error) {
      console.error(
        '[cargarDatos] Error al parsear o fusionar datos de localStorage. Se usará el estado inicial.',
        error,
      );
      // Si falla, asegura que 'state' tenga al menos la estructura inicial limpia.
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, estadoInicialCompleto); // Aplica estado inicial limpio
    }
  } else {
    // Si no hay datos guardados, el 'state' ya debería tener los valores iniciales importados.
    // Verificamos por si acaso, especialmente widgetsVisibles.
    if (!state.config || typeof state.config.widgetsVisibles !== 'object') {
      console.warn(
        '[cargarDatos] No se encontraron datos guardados y el estado inicial parece incompleto. Re-inicializando config.widgetsVisibles.',
      );
      // Asegura que al menos la configuración exista
      if (!state.config) state.config = {};
      state.config.widgetsVisibles =
        estadoInicialCompleto.config.widgetsVisibles;
    }
    console.log(
      '[cargarDatos] No se encontraron datos guardados, usando estado inicial.',
    );
  }

  // --- Verificación Final ---
  // Aseguramos que widgetsVisibles exista después de todo el proceso
  if (!state.config || typeof state.config.widgetsVisibles !== 'object') {
    console.error(
      '[cargarDatos] Fallo CRÍTICO final: state.config.widgetsVisibles sigue sin estar definido correctamente.',
    );
    // Como último recurso, lo forzamos aquí
    if (!state.config) state.config = {};
    state.config.widgetsVisibles = JSON.parse(
      JSON.stringify(defaultState.config.widgetsVisibles),
    );
  }
}

// Asegúrate de que guardarDatos también esté exportado y funcione correctamente
export function guardarDatos() {
  localStorage.setItem('planivioData', JSON.stringify(state));
}

export function hexToRgb(hex) {
  let r = 0,
    g = 0,
    b = 0;
  if (!hex || hex.length < 4) return null;

  if (hex.length === 4) {
    r = '0x' + hex[1] + hex[1];
    g = '0x' + hex[2] + hex[2];
    b = '0x' + hex[3] + hex[3];
  } else if (hex.length === 7) {
    r = '0x' + hex[1] + hex[2];
    g = '0x' + hex[3] + hex[4];
    b = '0x' + hex[5] + hex[6];
  } else {
    return null;
  }
  return [parseInt(r), parseInt(g), parseInt(b)];
}

export function getTextColorForBg(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  const [r, g, b] = rgb;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
}

export function darkenColor(hex, percent) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const amount = Math.floor(255 * (percent / 100));
  const newRgb = rgb.map((col) => Math.max(0, col - amount));
  return `#${newRgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
// ... al final de utils.js

// REEMPLAZA LA FUNCIÓN ANTERIOR CON ESTA VERSIÓN ASÍNCRONA
export async function exportarDatosJSON(mostrarPrompt) {
  const fecha = new Date().toISOString().split('T')[0];
  const nombrePorDefecto = `planivio-backup-${fecha}`;

  try {
    const nombreArchivo = await mostrarPrompt(
      'Exportar Datos',
      'Ingresa un nombre para el archivo de respaldo:',
      nombrePorDefecto,
    );

    if (!nombreArchivo) return; // Si el usuario no escribe nada, no exportar

    const estadoParaExportar = { ...state };
    delete estadoParaExportar.apuntesEnModoSeleccion;
    delete estadoParaExportar.apuntesSeleccionadosIds;

    const jsonString = JSON.stringify(estadoParaExportar, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo.endsWith('.json')
      ? nombreArchivo
      : `${nombreArchivo}.json`;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    // El usuario presionó "Cancelar", no hacemos nada.
    console.log('Exportación cancelada por el usuario.');
  }
}

// REEMPLAZA LA FUNCIÓN ANTERIOR
export function importarDatosJSON(event, callback) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const nuevoEstado = JSON.parse(e.target.result);

      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, nuevoEstado);

      guardarDatos();

      // Llama al callback indicando éxito
      callback(
        null,
        '¡Datos importados con éxito! La aplicación se recargará.',
      );
    } catch (error) {
      console.error('Error al importar el archivo JSON:', error);
      // Llama al callback indicando error
      callback(
        error,
        'Error: El archivo seleccionado no es un archivo de respaldo de Planivio válido.',
      );
    }
  };
  reader.readAsText(file);
}
