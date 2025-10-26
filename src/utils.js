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

  const estadoInicialCompleto = JSON.parse(JSON.stringify(defaultState));

  if (datosGuardados) {
    try {
      const estadoGuardado = JSON.parse(datosGuardados);

      // ======================================================
      // ==           INICIO DE MIGRACIÓN DE DATOS           ==
      // ======================================================
      // Revisa si 'cursos' existe, es un array, y si su primer elemento es un string.
      if (
        estadoGuardado.cursos &&
        Array.isArray(estadoGuardado.cursos) &&
        typeof estadoGuardado.cursos[0] === 'string'
      ) {
        console.warn(
          '[cargarDatos] Detectada estructura de Cursos antigua. Migrando...',
        );
        const cursosAntiguos = estadoGuardado.cursos;
        // Convierte el array de strings a un array de objetos
        estadoGuardado.cursos = cursosAntiguos.map((nombreCurso, index) => ({
          id: nombreCurso === 'General' ? 1 : Date.now() + index, // Asigna ID '1' a General, y únicos a los demás
          nombre: nombreCurso,
          emoji: null,
          isArchivado: false,
        }));
        console.log(
          '[cargarDatos] Migración de Cursos completada:',
          estadoGuardado.cursos,
        );
      }
      // ======================================================
      // ==             FIN DE MIGRACIÓN DE DATOS            ==
      // ======================================================

      // 2. Fusiona los datos guardados (ya migrados) sobre el estado inicial completo.
      const estadoFinal = {
        ...estadoInicialCompleto,
        ...estadoGuardado,
        config: {
          ...estadoInicialCompleto.config,
          ...(estadoGuardado.config || {}),
          widgetsVisibles: {
            ...estadoInicialCompleto.config.widgetsVisibles,
            ...(estadoGuardado.config?.widgetsVisibles || {}),
          },
          muescasColores: {
            ...estadoInicialCompleto.config.muescasColores,
            ...(estadoGuardado.config?.muescasColores || {}),
            vencidaFondoColor:
              estadoGuardado.config?.muescasColores?.vencidaFondoColor ??
              estadoInicialCompleto.config.muescasColores.vencidaFondoColor,
            vencidaFondoOpacidad:
              estadoGuardado.config?.muescasColores?.vencidaFondoOpacidad ??
              estadoInicialCompleto.config.muescasColores.vencidaFondoOpacidad,
          },
        },
      };

      // 3. Limpia el estado global actual...
      Object.keys(state).forEach((key) => delete state[key]);

      // 4. Aplica el estado final fusionado...
      Object.assign(state, estadoFinal);

      console.log(
        '[cargarDatos] Datos cargados y fusionados:',
        JSON.parse(JSON.stringify(state)),
      );
    } catch (error) {
      console.error(
        '[cargarDatos] Error al parsear o fusionar datos de localStorage. Se usará el estado inicial.',
        error,
      );
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, estadoInicialCompleto);
    }
  } else {
    // ... (lógica de 'else' sin cambios) ...
    if (
      !state.config ||
      typeof state.config.widgetsVisibles !== 'object' ||
      typeof state.config.muescasColores !== 'object'
    ) {
      if (!state.config) state.config = {};
      if (typeof state.config.widgetsVisibles !== 'object') {
        state.config.widgetsVisibles = JSON.parse(
          JSON.stringify(defaultState.config.widgetsVisibles),
        );
      }
      if (!state.config || typeof state.config.muescasColores !== 'object') {
        if (!state.config) state.config = {};
        state.config.muescasColores = JSON.parse(
          JSON.stringify(defaultState.config.muescasColores),
        );
      } else {
        if (typeof state.config.muescasColores.vencidaFondoColor !== 'string') {
          state.config.muescasColores.vencidaFondoColor =
            defaultState.config.muescasColores.vencidaFondoColor;
        }
        if (
          typeof state.config.muescasColores.vencidaFondoOpacidad !== 'number'
        ) {
          state.config.muescasColores.vencidaFondoOpacidad =
            defaultState.config.muescasColores.vencidaFondoOpacidad;
        }
      }
    }
    console.log(
      '[cargarDatos] No se encontraron datos guardados, usando estado inicial.',
    );
  }

  if (!state.config || typeof state.config.widgetsVisibles !== 'object') {
    console.error(
      '[cargarDatos] Fallo CRÍTICO final: state.config.widgetsVisibles sigue sin estar definido correctamente.',
    );
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

export function aplicarColorFondoVencida() {
  const root = document.documentElement;
  const configColores = state.config?.muescasColores;

  if (configColores) {
    const colorBase = configColores.vencidaFondoColor || '#e74c3c';
    const opacidad = configColores.vencidaFondoOpacidad ?? 0.08; // Usa ?? para manejar 0

    // Convertir color base a RGB
    const rgbArray = hexToRgb(colorBase);
    if (rgbArray) {
      const rgbaColor = `rgba(${rgbArray.join(', ')}, ${opacidad})`;
      root.style.setProperty('--color-fondo-vencida', rgbaColor);
      console.log(
        `[aplicarColorFondoVencida] Variable --color-fondo-vencida actualizada a: ${rgbaColor}`,
      );
    } else {
      // Fallback si hexToRgb falla
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
    // Aplicar fallback directamente
    root.style.setProperty('--color-fondo-vencida', 'rgba(231, 76, 60, 0.08)');
  }
}

export function aplicarColoresMuescas() {
  const root = document.documentElement;
  // Accede de forma segura a los colores en el estado
  const colores = state.config?.muescasColores;

  if (colores) {
    // Establece las variables CSS usando los colores del estado o valores por defecto si alguno falta
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
    // Para 'lejana', usa el color guardado o el RGBA por defecto
    root.style.setProperty(
      '--color-muesca-lejana',
      colores.lejana || 'rgba(128, 128, 128, 0.3)',
    );
    console.log(
      '[aplicarColoresMuescas] Variables CSS de muescas actualizadas.',
    );
  } else {
    // Fallback si el objeto 'muescasColores' no existe en el estado
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
