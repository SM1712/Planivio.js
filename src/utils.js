// ==========================================================================
// ==
// ==                          src/utils.js
// ==
// ==    (MODIFICADO - FASE P3.4: IMPORTAR/EXPORTAR REFACTORIZADO
// ==     PARA LEER Y ESCRIBIR DIRECTAMENTE DESDE FIREBASE)
// ==
// ==========================================================================

import { state } from './state.js';
// --- INICIO FASE P3.4: NUEVAS IMPORTACIONES ---
import {
  crearConsulta,
  ejecutarConsulta,
  getDocumento,
  migrarDatosDesdeLocalStorage,
} from './firebase.js';
import { mostrarAlerta, mostrarConfirmacion, mostrarPrompt } from './ui.js';
// --- FIN FASE P3.4: NUEVAS IMPORTACIONES ---

// ==========================================================================
// ==    FUNCIONES DE COLOR (Sin cambios)
// ==========================================================================

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
// ==    IMPORTAR/EXPORTAR (REFACTORIZADO FASE P3.4)
// ==========================================================================

/**
 * REFACTORIZADO (P3.4): Exporta TODOS los datos del usuario
 * leyendo directamente desde Firestore para asegurar un backup completo.
 */
export async function exportarDatosJSON() {
  const fecha = new Date().toISOString().split('T')[0];
  const nombrePorDefecto = `planivio-backup-${fecha}`;

  try {
    const nombreArchivo = await mostrarPrompt(
      'Exportar Datos',
      'Ingresa un nombre para el archivo de respaldo:',
      nombrePorDefecto,
    );

    if (!nombreArchivo) {
      console.log('Exportación cancelada.');
      return;
    }

    // 1. Crear el objeto de respaldo
    const datosParaExportar = {
      config: {},
      cursos: [],
      tareas: [],
      proyectos: [],
      apuntes: [],
      eventos: [],
    };

    // 2. Obtener todos los datos de Firebase
    console.log('[Exportar] Obteniendo datos de Firebase...');

    // Obtenemos todos los documentos y la config en paralelo
    const [config, cursos, tareas, proyectos, apuntes, eventos] =
      await Promise.all([
        getDocumento('config', 'userConfig'),
        ejecutarConsulta(crearConsulta('cursos')),
        ejecutarConsulta(crearConsulta('tareas')),
        ejecutarConsulta(crearConsulta('proyectos')),
        ejecutarConsulta(crearConsulta('apuntes')),
        ejecutarConsulta(crearConsulta('eventos')),
      ]);

    datosParaExportar.config = config || {};
    datosParaExportar.cursos = cursos;
    datosParaExportar.tareas = tareas;
    datosParaExportar.proyectos = proyectos;
    datosParaExportar.apuntes = apuntes;
    datosParaExportar.eventos = eventos;

    console.log('[Exportar] Datos listos para descargar.');

    // 3. Crear y descargar el archivo (lógica existente)
    const jsonString = JSON.stringify(datosParaExportar, null, 2);
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

    await mostrarAlerta(
      'Exportación Exitosa',
      'Tu archivo de respaldo se ha descargado.',
    );
  } catch (error) {
    if (error.message.includes('cancelado')) {
      console.log('Exportación cancelada por el usuario.');
    } else {
      console.error('[Exportar] Error al exportar datos:', error);
      await mostrarAlerta(
        'Error de Exportación',
        'No se pudieron exportar los datos. Revisa la consola.',
      );
    }
  }
}

/**
 * REFACTORIZADO (P3.4): Importa datos desde un archivo JSON y
 * los sube a Firestore usando un WriteBatch, sobrescribiendo
 * todos los datos en la nube.
 */
export async function importarDatosJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async (e) => {
    let nuevoEstado;
    try {
      nuevoEstado = JSON.parse(e.target.result);
      // Validación simple para asegurar que es un archivo de Planivio
      if (
        nuevoEstado.config === undefined ||
        nuevoEstado.cursos === undefined ||
        nuevoEstado.tareas === undefined
      ) {
        throw new Error(
          'El archivo no parece ser un respaldo de Planivio válido.',
        );
      }
    } catch (error) {
      console.error('Error al parsear el archivo JSON:', error);
      await mostrarAlerta(
        'Error de Importación',
        'El archivo seleccionado no es un archivo de respaldo de Planivio válido.',
      );
      return;
    }

    try {
      // 1. Advertir al usuario
      const confirmado = await mostrarConfirmacion(
        '¡Acción Destructiva!',
        'Estás a punto de SOBRESCRIBIR todos tus datos en la nube con el contenido de este archivo. Esta acción no se puede deshacer. ¿Continuar?',
        'Sobrescribir',
        'Cancelar',
      );

      if (!confirmado) {
        console.log('Importación cancelada por el usuario.');
        return;
      }

      // 2. Llamar a la función de migración (que usa un batch)
      console.log('[Importar] Iniciando migración batch...');
      await migrarDatosDesdeLocalStorage(nuevoEstado);

      // 3. Avisar y recargar
      await mostrarAlerta(
        '¡Importación Completa!',
        'Tus datos han sido restaurados en la nube. La aplicación se recargará ahora para sincronizar los cambios.',
      );
      location.reload();
    } catch (error) {
      console.error('Error al importar datos a Firebase:', error);
      await mostrarAlerta(
        'Error de Importación',
        'Ocurrió un error al guardar los datos en la nube. Revisa la consola.',
      );
    }
  }; // fin reader.onload

  reader.onerror = async () => {
    await mostrarAlerta(
      'Error de Lectura',
      'No se pudo leer el archivo seleccionado.',
    );
  };

  reader.readAsText(file);
}

// ==========================================================================
// ==    FUNCIONES DE ESTILO (Sin cambios)
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
  }
}
