// ==========================================================================
// ==                          src/state.js                              ==
// ==========================================================================
//
// Este es el NUEVO corazón de "Pulso".
//
// 1. Define el estado inicial (la plantilla por defecto).
// 2. Exporta el 'state' global como un Proxy.
// 3. Inicia y detiene los 'listeners' de Firebase que actualizan
//    el 'state' en tiempo real.
// 4. Emite eventos en el EventBus cuando los datos cambian.
//
// ==========================================================================

import { EventBus } from './eventBus.js';
import { escucharConfig, escucharColeccion } from './firebase.js';

// ===================================
// ==        ESTADO INICIAL         ==
// ===================================
// Define la ESTRUCTURA por defecto de la app.
// Los arrays se llenarán desde Firebase.
const estadoInicial = {
  // --- ID de Usuario (NUEVO) ---
  currentUserId: null,

  // --- Datos de Colecciones (se llenarán desde Firebase) ---
  cursos: [],
  tareas: [],
  eventos: [],
  apuntes: [],
  proyectos: [],

  // --- Estados de Selección (Locales, no sincronizados) ---
  cursoSeleccionadoId: null,
  proyectoSeleccionadoId: null,
  apunteSeleccionadoId: null,
  tareaSeleccionadald: null, // Mantenemos tu typo original

  // --- Estados de Modo Selección (Locales, no sincronizados) ---
  tareasEnModoSeleccion: false,
  tareasSeleccionadasIds: [],
  apuntesEnModoSeleccion: false,
  apuntesSeleccionadosIds: [],

  // --- CONFIGURACIÓN POR DEFECTO (Se sincronizará con Firebase) ---
  config: {
    theme: 'light',
    accent_color: '#0078d7',
    userName: null, // Vendrá de Google Auth
    widgetsVisibles: {
      racha: true,
      enfoque: true,
      proximamente: true,
      eventos: true,
      progresoSemanal: true,
      accesos: true,
      cargaSemanal: true,
      pomodoro: true,
      apuntesRecientes: true,
      progresoProyectos: true,
      tareasVencidas: true,
    },
    muescasColores: {
      vencida: '#333333',
      hoy: '#e74c3c',
      manana: '#f39c12',
      cercana: '#2ecc71',
      lejana: 'rgba(128, 128, 128, 0.3)',
      vencidaFondoColor: '#e74c3c',
      vencidaFondoOpacidad: 0.08,
    },
  },

  // --- Estados Temporales de UI (Locales, no sincronizados) ---
  paginaActual: 'dashboard',
  ordenamiento: { col: 'fecha', reverse: false },
  filtroCurso: 'todos',
  filtroCursoApuntes: 'todos',
  filtroProyecto: 'todos',
  fechaPreseleccionada: null, // La que discutimos
};

// ===================================
// ==      ESTADO GLOBAL (Proxy)    ==
// ===================================
// Creamos el estado global como un Proxy del estado inicial
export const state = new Proxy(JSON.parse(JSON.stringify(estadoInicial)), {
  set(target, property, value) {
    target[property] = value;
    // console.log(`[State Change] ${property}:`, value); // Descomenta para debuggear
    return true;
  },
});

// ===================================
// ==    MOTOR DE SINCRONIZACIÓN    ==
// ===================================

// Variables para guardar las funciones de "desuscripción" de Firebase
let unsubscribeConfig = null;
let unsubscribeCursos = null;
let unsubscribeTareas = null;
let unsubscribeApuntes = null;
let unsubscribeProyectos = null;
let unsubscribeEventos = null;

/**
 * Inicia la escucha de datos desde Firestore para TODAS las colecciones.
 * @param {string} userId - El ID del usuario logueado.
 */
export function iniciarSincronizacion(userId) {
  console.log('[State] Iniciando sincronización para User ID:', userId);
  state.currentUserId = userId; // Guardamos el ID del usuario en el estado

  // --- 1. Escuchar Configuración ---
  if (unsubscribeConfig) unsubscribeConfig();
  unsubscribeConfig = escucharConfig((configData) => {
    // Fusionamos la config de la nube (configData) con la local por defecto
    state.config = {
      ...estadoInicial.config,
      ...(configData || {}), // Usar configData si existe, o un objeto vacío
      widgetsVisibles: {
        ...estadoInicial.config.widgetsVisibles,
        ...(configData?.widgetsVisibles || {}),
      },
      muescasColores: {
        ...estadoInicial.config.muescasColores,
        ...(configData?.muescasColores || {}),
      },
    };
    // Emitimos un evento para que main.js aplique el tema
    EventBus.emit('configActualizada');
  });
  console.log('[State] Escuchando cambios en "config"...');

  // --- 2. Escuchar Cursos ---
  if (unsubscribeCursos) unsubscribeCursos();
  unsubscribeCursos = escucharColeccion('cursos', (cursosData) => {
    state.cursos = cursosData;
    EventBus.emit('cursosActualizados');
  });
  console.log('[State] Escuchando cambios en "cursos"...');

  // --- 3. Escuchar Tareas ---
  if (unsubscribeTareas) unsubscribeTareas();
  unsubscribeTareas = escucharColeccion('tareas', (tareasData) => {
    // Corrección para asegurar que 'subtareas' siempre sea un array
    state.tareas = tareasData.map((t) => ({
      ...t,
      subtareas: Array.isArray(t.subtareas) ? t.subtareas : [],
    }));
    EventBus.emit('tareasActualizadas');
  });
  console.log('[State] Escuchando cambios en "tareas"...');

  // --- 4. Escuchar Apuntes ---
  if (unsubscribeApuntes) unsubscribeApuntes();
  unsubscribeApuntes = escucharColeccion('apuntes', (apuntesData) => {
    state.apuntes = apuntesData;
    EventBus.emit('apuntesActualizados');
  });
  console.log('[State] Escuchando cambios en "apuntes"...');

  // --- 5. Escuchar Proyectos ---
  if (unsubscribeProyectos) unsubscribeProyectos();
  unsubscribeProyectos = escucharColeccion('proyectos', (proyectosData) => {
    state.proyectos = proyectosData;
    EventBus.emit('proyectosActualizados');
  });
  console.log('[State] Escuchando cambios en "proyectos"...');

  // --- 6. Escuchar Eventos ---
  if (unsubscribeEventos) unsubscribeEventos();
  unsubscribeEventos = escucharColeccion('eventos', (eventosData) => {
    state.eventos = eventosData;
    EventBus.emit('eventosActualizados');
  });
  console.log('[State] Escuchando cambios en "eventos"...');
}

/**
 * Detiene TODAS las escuchas de Firestore.
 * Se debe llamar al cerrar sesión.
 */
export function detenerSincronizacion() {
  if (unsubscribeConfig) unsubscribeConfig();
  if (unsubscribeCursos) unsubscribeCursos();
  if (unsubscribeTareas) unsubscribeTareas();
  if (unsubscribeApuntes) unsubscribeApuntes();
  if (unsubscribeProyectos) unsubscribeProyectos();
  if (unsubscribeEventos) unsubscribeEventos();

  // Reseteamos el estado al estado inicial
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, JSON.parse(JSON.stringify(estadoInicial)));

  console.log('[State] Sincronización detenida y estado reseteado.');
}

// --- Limpieza inicial ---
// Al cargar el script, reseteamos el estado al inicial
Object.keys(state).forEach((key) => delete state[key]);
Object.assign(state, JSON.parse(JSON.stringify(estadoInicial)));
console.log('[State] Estado inicializado.');
