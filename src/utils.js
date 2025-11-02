import { state, state as defaultState } from './state.js';

// NOTA: 'cargarDatos' y 'guardarDatos' han sido eliminados.
// La lógica de carga está en main.js (manejarEstadoDeAutenticacion)
// La lógica de sincronización está en state.js (iniciarSincronizacion)
// La lógica de guardado está en firebase.js (guardarConfig, agregarDocumento, etc.)

export function updateRgbVariables() {
  const computedStyle = getComputedStyle(document.body);
  const textColorHex = computedStyle.getPropertyValue('--text-base').trim();
  const rgbArray = hexToRgb(textColorHex);
  if (rgbArray) {
    document.body.style.setProperty('--text-base-rgb', rgbArray.join(', '));
  }
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

// ==========================================================================
// ==    IMPORTAR/EXPORTAR (Funcionalidad limitada temporalmente)        ==
// ==========================================================================

// REEMPLAZA LA FUNCIÓN ANTERIOR CON ESTA VERSIÓN ASÍNCRONA
export async function exportarDatosJSON(mostrarPrompt) {
  // ADVERTENCIA: Esto ahora solo exporta el ESTADO LOCAL,
  // que puede no estar 100% sincronizado si la nube está actualizando.
  // Lo refactorizaremos en Fase P3 para leer de Firebase.
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
    // Limpiamos datos temporales que no deben exportarse
    delete estadoParaExportar.apuntesEnModoSeleccion;
    delete estadoParaExportar.apuntesSeleccionadosIds;
    delete estadoParaExportar.tareasEnModoSeleccion;
    delete estadoParaExportar.tareasSeleccionadasIds;
    delete estadoParaExportar.currentUserId;

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
  // ADVERTENCIA: Esta función está temporalmente deshabilitada
  // en main.js. Requerirá refactorización en Fase P3.
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const nuevoEstado = JSON.parse(e.target.result);

      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, nuevoEstado);

      // guardarDatos(); // <-- ELIMINADO. Esta función ya no existe.
      console.warn(
        'Importación completada, pero el guardado en Firebase debe hacerse manualmente.',
      );

      // Llama al callback indicando éxito
      callback(
        null,
        '¡Datos importados localmente! La aplicación se recargará. (El guardado en la nube está deshabilitado temporalmente).',
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

// ==========================================================================
// ==    FUNCIONES DE ESTILO (Sin cambios)                                 ==
// ==========================================================================

export function aplicarColorFondoVencida() {
  const root = document.documentElement;
  const configColores = state.config?.muescasColores;

  if (configColores) {
    const colorBase = configColores.vencidaFondoColor || '#e74c3c';
    const opacidad = configColores.vencidaFondoOpacidad ?? 0.08;

    const rgbArray = hexToRgb(colorBase);
    if (rgbArray) {
      const rgbaColor = `rgba(${rgbArray.join(', ')}, ${opacidad})`;
      root.style.setProperty('--color-fondo-vencida', rgbaColor);
    } else {
      root.style.setProperty(
        '--color-fondo-vencida',
        `rgba(231, 76, 60, ${opacidad})`,
      );
      console.warn(
        `[aplicarColorFondoVencida] No se pudo convertir ${colorBase} a RGB. Usando fallback.`,
      );
    }
  } else {
    console.warn(
      '[aplicarColorFondoVencida] No se encontraron colores en state.config.',
    );
    root.style.setProperty('--color-fondo-vencida', 'rgba(231, 76, 60, 0.08)');
  }
}

export function aplicarColoresMuescas() {
  const root = document.documentElement;
  const colores = state.config?.muescasColores;

  if (colores) {
    root.style.setProperty(
      '--color-muesca-vencida',
      colores.vencida || '#333333',
    );
    root.style.setProperty('--color-muesca-hoy', colores.hoy || '#e74c3c');
    root.style.setProperty(
      '--color-muesca-manana',
      colores.manana || '#f39c12',
    );
    root.style.setProperty(
      '--color-muesca-cercana',
      colores.cercana || '#2ecc71',
    );
    root.style.setProperty(
      '--color-muesca-lejana',
      colores.lejana || 'rgba(128, 128, 128, 0.3)',
    );
  } else {
    console.warn(
      '[aplicarColoresMuescas] No se encontraron colores de muescas en state.config. Aplicando defaults.',
    );
    root.style.setProperty('--color-muesca-vencida', '#333333');
    root.style.setProperty('--color-muesca-hoy', '#e74c3c');
    root.style.setProperty('--color-muesca-manana', '#f39c12');
    root.style.setProperty('--color-muesca-cercana', '#2ecc71');
    root.style.setProperty('--color-muesca-lejana', 'rgba(128, 128, 128, 0.3)');
  }
}
