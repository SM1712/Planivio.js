import { state, state as defaultState } from './state.js';

// --- INICIO NUEVAS IMPORTACIONES FIREBASE ---
// Traemos los servicios que publicamos en index.html
const {
  auth, // Necesitamos auth para saber QUIÉN es el usuario
  db, // La base de datos
  doc, // Función para referenciar un documento
  getDoc, // Función para LEER un documento
  setDoc, // Función para ESCRIBIR un documento
} = window.firebaseServices;
// --- FIN NUEVAS IMPORTACIONES FIREBASE ---

export function updateRgbVariables() {
  const computedStyle = getComputedStyle(document.body);
  const textColorHex = computedStyle.getPropertyValue('--text-base').trim();
  const rgbArray = hexToRgb(textColorHex);
  if (rgbArray) {
    document.body.style.setProperty('--text-base-rgb', rgbArray.join(', '));
  }
}

// ======================================================
// ==        INICIO FUNCIÓN cargarDatos (NUEVA LÓGICA) ==
// ======================================================
export async function cargarDatos() {
  // <-- Sigue siendo async
  console.log('[Sync] Iniciando carga de datos (Nube primero)...');
  const estadoInicialCompleto = JSON.parse(JSON.stringify(defaultState));
  let estadoFinal = null;

  const userId = auth.currentUser ? auth.currentUser.uid : null;

  if (userId) {
    // --- USUARIO LOGUEADO: NUBE MANDA ---
    try {
      const docRef = doc(db, 'usuarios', userId, 'backup', 'full_state');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // 1. HAY DATOS EN LA NUBE
        console.log(
          '[Sync] Backup de la nube encontrado. Descargando y aplicando...',
        );
        estadoFinal = docSnap.data();
        // Sincronizamos localStorage para que coincida con la nube
        localStorage.setItem('planivioData', JSON.stringify(estadoFinal));
      } else {
        // 2. NO HAY DATOS EN LA NUBE (Primer login o nube borrada)
        console.log(
          '[Sync] No hay backup en la nube. Verificando localStorage...',
        );
        const datosGuardados = localStorage.getItem('planivioData');

        if (datosGuardados) {
          // 2a. Hay datos locales antiguos (pre-login)
          console.log(
            '[Sync] Datos locales pre-existentes encontrados. Subiendo como primer backup...',
          );
          estadoFinal = JSON.parse(datosGuardados);
          // Forzamos la subida de estos datos locales a la nube
          await guardarDatos();
        } else {
          // 2b. No hay NADA (Usuario 100% nuevo)
          console.log(
            '[Sync] Sin datos locales ni en la nube. Creando primer backup desde estado inicial...',
          );
          estadoFinal = JSON.parse(JSON.stringify(estadoInicialCompleto));
          // Subimos el estado inicial a la nube
          await guardarDatos();
        }
      }
    } catch (error) {
      // 3. FALLO DE RED (No se pudo conectar a Firebase)
      console.error(
        '[Sync] Error al leer de Firebase. Cargando desde localStorage (modo offline)...',
        error,
      );
      const datosGuardados = localStorage.getItem('planivioData');
      if (datosGuardados) {
        console.log('[Sync] Cargando backup local.');
        estadoFinal = JSON.parse(datosGuardados);
      } else {
        console.log(
          '[Sync] Sin conexión y sin backup local. Usando estado inicial.',
        );
        estadoFinal = JSON.parse(JSON.stringify(estadoInicialCompleto));
      }
    }
  } else {
    // --- USUARIO NO LOGUEADO (No debería pasar si la lógica de main.js es correcta) ---
    console.warn(
      '[Sync] No hay usuario. Cargando desde localStorage (modo invitado).',
    );
    const datosGuardados = localStorage.getItem('planivioData');
    if (datosGuardados) {
      estadoFinal = JSON.parse(datosGuardados);
    } else {
      estadoFinal = JSON.parse(JSON.stringify(estadoInicialCompleto));
    }
  }

  // --- LÓGICA DE FUSIÓN Y MIGRACIÓN (Se aplica al estado 'estadoFinal' cargado) ---

  // Tu lógica de migración de Cursos (importante mantenerla)
  if (
    estadoFinal.cursos &&
    Array.isArray(estadoFinal.cursos) &&
    typeof estadoFinal.cursos[0] === 'string'
  ) {
    console.warn('[Sync] Detectada estructura de Cursos antigua. Migrando...');
    const cursosAntiguos = estadoFinal.cursos;
    estadoFinal.cursos = cursosAntiguos.map((nombreCurso, index) => ({
      id: nombreCurso === 'General' ? 1 : Date.now() + index,
      nombre: nombreCurso,
      emoji: null,
      isArchivado: false,
    }));
  }

  // Tu lógica de fusión de Config (importante mantenerla)
  const estadoDefinitivo = {
    ...estadoInicialCompleto,
    ...estadoFinal,
    config: {
      ...estadoInicialCompleto.config,
      ...(estadoFinal.config || {}),
      widgetsVisibles: {
        ...estadoInicialCompleto.config.widgetsVisibles,
        ...(estadoFinal.config?.widgetsVisibles || {}),
      },
      muescasColores: {
        ...estadoInicialCompleto.config.muescasColores,
        ...(estadoFinal.config?.muescasColores || {}),
        vencidaFondoColor:
          estadoFinal.config?.muescasColores?.vencidaFondoColor ??
          estadoInicialCompleto.config.muescasColores.vencidaFondoColor,
        vencidaFondoOpacidad:
          estadoFinal.config?.muescasColores?.vencidaFondoOpacidad ??
          estadoInicialCompleto.config.muescasColores.vencidaFondoOpacidad,
      },
    },
  };

  // 5. Aplicar estado final al 'state' global
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, estadoDefinitivo);
  console.log('[Sync] Carga de datos finalizada.');
}
// ======================================================
// ==         FIN FUNCIÓN cargarDatos (NUEVA LÓGICA)   ==
// ======================================================

// ======================================================
// ==        INICIO FUNCIÓN guardarDatos (MODIFICADA)  ==
// ======================================================
export async function guardarDatos() {
  // <-- Convertida a async

  // 1. Añadir Timestamp
  state.lastUpdated = Date.now();
  console.log(`[Sync] Guardando datos... Timestamp: ${state.lastUpdated}`);

  // 2. Guardar en localStorage (como antes, para offline)
  localStorage.setItem('planivioData', JSON.stringify(state));

  // 3. Guardar en Firebase (NUEVO)
  const userId = auth.currentUser ? auth.currentUser.uid : null;
  if (userId) {
    try {
      const docRef = doc(db, 'usuarios', userId, 'backup', 'full_state');
      // setDoc sobrescribe el documento completo con el state actual
      await setDoc(docRef, state);
      console.log('[Sync] Backup en Firebase completado.');
    } catch (error) {
      console.error('[Sync] Error al guardar backup en Firebase:', error);
      // No bloqueamos al usuario, la app sigue funcionando con localStorage
    }
  } else {
    // Esto no debería pasar si la app requiere login, pero es un buen seguro
    console.warn(
      '[Sync] No hay usuario logueado, guardando solo en localStorage.',
    );
  }
}
// ======================================================
// ==         FIN FUNCIÓN guardarDatos (MODIFICADA)    ==
// ======================================================

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

export async function exportarDatosJSON(mostrarPrompt) {
  const fecha = new Date().toISOString().split('T')[0];
  const nombrePorDefecto = `planivio-backup-${fecha}`;

  try {
    const nombreArchivo = await mostrarPrompt(
      'Exportar Datos',
      'Ingresa un nombre para el archivo de respaldo:',
      nombrePorDefecto,
    );

    if (!nombreArchivo) return;

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
    console.log('Exportación cancelada por el usuario.');
  }
}

export function importarDatosJSON(event, callback) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const nuevoEstado = JSON.parse(e.target.result);

      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, nuevoEstado);

      // ¡Importante! Ahora que guardarDatos es async, debemos manejarlo
      // Lo llamamos sin 'await' (fire-and-forget) para que la UI no se bloquee
      guardarDatos();

      callback(
        null,
        '¡Datos importados con éxito! La aplicación se recargará.',
      );
    } catch (error) {
      console.error('Error al importar el archivo JSON:', error);
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
    const opacidad = configColores.vencidaFondoOpacidad ?? 0.08;

    const rgbArray = hexToRgb(colorBase);
    if (rgbArray) {
      const rgbaColor = `rgba(${rgbArray.join(', ')}, ${opacidad})`;
      root.style.setProperty('--color-fondo-vencida', rgbaColor);
      // console.log(`[aplicarColorFondoVencida] Variable --color-fondo-vencida actualizada a: ${rgbaColor}`);
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
    // console.log('[aplicarColoresMuescas] Variables CSS de muescas actualizadas.');
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
