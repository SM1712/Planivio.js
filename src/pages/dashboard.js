// ==========================================================================
// ==                             IMPORTACIONES                            ==
// ==========================================================================
import { state } from '../state.js';
import { guardarDatos } from '../utils.js';
import { cambiarPagina } from '../main.js';
import {
  mostrarModal,
  cerrarModal,
  popularSelectorDeCursos,
  popularSelectorDeProyectos,
  mostrarNotificacion,
} from '../ui.js';
// Asegúrate que la ruta a proyectos.js sea correcta y que la función esté exportada
import { calcularEstadisticasProyecto } from './proyectos.js';

// ==========================================================================
// ==                         CONFIGURACIÓN INICIAL                        ==
// ==========================================================================

// Mapeo entre claves de config y selectores CSS. ¡Verifica que coincidan con tu HTML!
const widgetSelectors = {
  racha: '.widget-racha',
  enfoque: '.widget-enfoque',
  proximamente: '.widget-proximamente',
  eventos: '.widget-eventos',
  progresoSemanal: '.widget-progreso',
  accesos: '.widget-accesos',
  cargaSemanal: '.widget-workload',
  pomodoro: '.widget-pomodoro',
  apuntesRecientes: '.widget-apuntes-recientes',
  progresoProyectos: '.widget-proyectos-progreso',
  tareasVencidas: '.widget-tareas-vencidas',
};

// Frases para el saludo dinámico
const frasesDashboard = [
  '¿Listo para organizar tu día?',
  'Un pequeño paso hoy...',
  'La clave es empezar.',
  '¡Que la productividad te acompañe!',
  'Organiza, enfócate, avanza.',
  '¿Qué meta conquistarás hoy?',
  'Divide y vencerás... ¡tus tareas!',
  '¡A darle con todo!',
];

// ==========================================================================
// ==                      FUNCIONES AUXILIARES DEL DASHBOARD            ==
// ==========================================================================

/**
 * Genera saludo ("Buenos días/tardes/noches, [Nombre]") y frase motivacional.
 * @returns {{saludo: string, frase: string}} Objeto con saludo y frase.
 */
function obtenerSaludoYFrase() {
  const hora = new Date().getHours();
  const nombre = state.config.userName || 'Usuario';
  let saludoBase;

  if (hora < 12) saludoBase = `¡Buenos días, ${nombre}!`;
  else if (hora < 19) saludoBase = `Buenas tardes, ${nombre}.`;
  else saludoBase = `Buenas noches, ${nombre}.`;

  const fraseAleatoria =
    frasesDashboard[Math.floor(Math.random() * frasesDashboard.length)];
  return { saludo: saludoBase, frase: fraseAleatoria };
}

// ==========================================================================
// ==                 LÓGICA DEL WIDGET POMODORO (v2)                  ==
// ==========================================================================
let pomodoroInterval;
let pomodoroCiclosCompletados = 0;
let tiempoRestante = 25 * 60;
let enModoFoco = true;
let estaCorriendo = false;
const DURACION_FOCO = 25 * 60;
const DURACION_DESCANSO_CORTO = 5 * 60;
const DURACION_DESCANSO_LARGO = 15 * 60;
const timerEl = () => document.getElementById('pomodoro-timer');
const statusEl = () => document.getElementById('pomodoro-status');
const startBtnEl = () => document.getElementById('btn-pomodoro-start');

function actualizarDisplayPomodoro() {
  const display = timerEl();
  if (!display) return;
  const minutos = Math.floor(tiempoRestante / 60);
  const segundos = tiempoRestante % 60;
  display.textContent = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
}
function iniciarPomodoro() {
  // Solo pide permiso si no ha sido concedido ni denegado antes
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
  estaCorriendo = true;
  if (startBtnEl()) startBtnEl().textContent = 'Pausar';
  clearInterval(pomodoroInterval);
  pomodoroInterval = setInterval(() => {
    tiempoRestante--;
    actualizarDisplayPomodoro();
    if (tiempoRestante < 0) finalizarCicloPomodoro();
  }, 1000);
}
function pausarPomodoro() {
  estaCorriendo = false;
  if (startBtnEl()) startBtnEl().textContent = 'Reanudar';
  clearInterval(pomodoroInterval);
}
function reiniciarPomodoro() {
  pausarPomodoro();
  pomodoroCiclosCompletados = 0;
  enModoFoco = true;
  tiempoRestante = DURACION_FOCO;
  actualizarDisplayPomodoro();
  if (statusEl()) statusEl().textContent = `Ciclo 1 de 4. ¡A enfocarse!`;
  if (startBtnEl()) startBtnEl().textContent = 'Iniciar Foco';
}
function finalizarCicloPomodoro() {
  clearInterval(pomodoroInterval);
  estaCorriendo = false;
  let titulo = '',
    cuerpo = '',
    proximoModo = ''; // Inicializar variables

  if (enModoFoco) {
    pomodoroCiclosCompletados++;
    if (pomodoroCiclosCompletados >= 4) {
      // Toca descanso largo
      titulo = '¡Ciclos completados!';
      cuerpo = `¡Felicidades! Tómate un merecido descanso largo de ${DURACION_DESCANSO_LARGO / 60} minutos.`;
      tiempoRestante = DURACION_DESCANSO_LARGO;
      proximoModo = 'Descanso largo en curso...';
      pomodoroCiclosCompletados = 0;
    } else {
      // Toca descanso corto
      titulo = '¡Tiempo de descansar!';
      cuerpo = `¡Excelente sesión de foco! Tómate ${DURACION_DESCANSO_CORTO / 60} minutos.`;
      tiempoRestante = DURACION_DESCANSO_CORTO;
      proximoModo = `Tomando un descanso corto... (Ciclo ${pomodoroCiclosCompletados}/4)`;
    }
    enModoFoco = false;
  } else {
    // Terminó un descanso
    titulo = '¡Hora de enfocarse!';
    cuerpo = `El descanso terminó. ¡A seguir con la próxima sesión de ${DURACION_FOCO / 60} minutos!`;
    tiempoRestante = DURACION_FOCO;
    proximoModo = `Ciclo ${pomodoroCiclosCompletados + 1} de 4. ¡A enfocarse!`;
    enModoFoco = true;
  }
  mostrarNotificacion(titulo, { body: cuerpo });
  if (statusEl()) statusEl().textContent = proximoModo;
  actualizarDisplayPomodoro();
  if (startBtnEl())
    startBtnEl().textContent = enModoFoco ? 'Iniciar Foco' : 'Iniciar Descanso';
}
function inicializarPomodoroListeners() {
  const startBtn = startBtnEl();
  const resetBtn = document.getElementById('btn-pomodoro-reset');
  if (!startBtn || !resetBtn || startBtn.dataset.initialized === 'true') return;
  startBtn.addEventListener('click', () => {
    if (estaCorriendo) pausarPomodoro();
    else iniciarPomodoro();
  });
  resetBtn.addEventListener('click', reiniciarPomodoro);
  startBtn.dataset.initialized = 'true';
}

// ==========================================================================
// ==          FUNCIONES DE RENDERIZADO PARA CADA WIDGET INDIVIDUAL        ==
// ==========================================================================

/** Renderiza el widget de Racha Diaria */
function renderizarWidgetRacha() {
  const racha = calcularRacha(); // Asume que esta función existe y es correcta
  const contadorEl = document.getElementById('widget-racha-contador');
  const iconoEl = document.getElementById('widget-racha-icono');
  const textoEl = document.getElementById('widget-racha-texto');
  if (!contadorEl || !iconoEl || !textoEl) return;

  contadorEl.textContent = racha;
  if (racha > 0) {
    iconoEl.textContent = '🔥';
    textoEl.textContent =
      racha === 1
        ? 'día completando tareas.'
        : 'días seguidos completando tareas.';
  } else {
    iconoEl.textContent = '❄️';
    textoEl.textContent = '¡Completa una tarea hoy para iniciar tu racha!';
  }
}

/** Calcula la racha actual de días completando tareas */
// En dashboard.js
function calcularRacha() {
  // ✨ CAMBIO: Filtra usando la nueva propiedad
  const tareasRealmenteCompletadas = state.tareas.filter(
    (t) => t.completada && t.fechaCompletado,
  );

  if (tareasRealmenteCompletadas.length === 0) return 0;

  // ✨ CAMBIO: Crea el Set usando fechaCompletado
  const fechasDeCompletado = new Set(
    tareasRealmenteCompletadas.map((t) => t.fechaCompletado),
  );

  let racha = 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  for (let i = 0; ; i++) {
    const fechaAComprobar = new Date(hoy);
    fechaAComprobar.setDate(hoy.getDate() - i);
    // ✨ CAMBIO: Asegúrate de formatear correctamente (sin T00:00:00)
    const fechaFormateada = fechaAComprobar.toISOString().split('T')[0];

    if (fechasDeCompletado.has(fechaFormateada)) {
      racha++;
    } else {
      // Si el día 'i=0' (hoy) no está, la racha es 0, incluso si ayer sí hubo.
      // Si i > 0, la racha se rompe.
      if (i > 0) {
        // Si falló un día anterior, la racha es la que llevamos
        break;
      } else if (!fechasDeCompletado.has(hoy.toISOString().split('T')[0])) {
        // Si hoy no se completó nada, la racha se interrumpe (es 0)
        // Pero si ayer sí, la racha debería ser 1? No, la racha es CONSECUTIVA *hasta hoy*.
        // Si hoy no hiciste, se rompe. Correcto es 0.
        // PERO, si la comprobación es del día ANTERIOR (i=1) y falla, la racha es solo la de hoy (1 si hoy existe)
        // El bucle actual funciona bien: cuenta hacia atrás hasta que falla.
        break; // Rompe el bucle si falta un día.
      }
    }
    if (i > 366) break; // Límite de seguridad
  }
  return racha;
}

/** Renderiza el widget de Enfoque del Día */
function renderizarWidgetEnfoque() {
  const lista = document.getElementById('widget-enfoque-lista');
  if (!lista) return;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const tareasDeHoy = state.tareas.filter((t) => {
    if (!t.fecha || t.completada) return false;
    const fechaTarea = new Date(t.fecha + 'T00:00:00');
    return fechaTarea.getTime() === hoy.getTime();
  });

  if (tareasDeHoy.length === 0) {
    lista.innerHTML = '<li><p>¡Ninguna tarea pendiente para hoy!</p></li>';
  } else {
    lista.innerHTML = tareasDeHoy
      .map(
        (t) => `
      <li class="widget-task-item">
        <span class="prioridad-indicador prioridad-${t.prioridad.toLowerCase()}"></span>
        <div class="widget-task-info">
          <strong class="widget-task-title">${t.titulo}</strong>
          <span class="widget-task-meta">${t.curso || 'General'}</span>
        </div>
      </li>`,
      )
      .join('');
  }
}

/** Renderiza el widget de Próximamente (tareas en 3 días) */
function renderizarWidgetProximamente() {
  const lista = document.getElementById('widget-proximamente-lista');
  if (!lista) return;
  const hoy = new Date();
  const tresDiasDespues = new Date();
  hoy.setHours(0, 0, 0, 0);
  tresDiasDespues.setDate(hoy.getDate() + 3);
  tresDiasDespues.setHours(23, 59, 59, 999);

  const tareasProximas = state.tareas
    .filter((t) => {
      if (!t.fecha || t.completada) return false;
      const fechaTarea = new Date(t.fecha + 'T00:00:00');
      // Tareas que son DESPUÉS de hoy pero ANTES o IGUAL a tres días después
      return fechaTarea > hoy && fechaTarea <= tresDiasDespues;
    })
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  if (tareasProximas.length === 0) {
    lista.innerHTML = '<li><p>Nada en el horizonte cercano.</p></li>';
  } else {
    lista.innerHTML = tareasProximas
      .map((t) => {
        const [, month, day] = t.fecha.split('-');
        const fechaFormateada = `${day}/${month}`;
        return `
        <li class="widget-task-item">
          <span class="prioridad-indicador prioridad-${t.prioridad.toLowerCase()}"></span>
          <div class="widget-task-info">
            <strong class="widget-task-title">${t.titulo}</strong>
            <span class="widget-task-meta">${t.curso || 'General'} - Entrega: ${fechaFormateada}</span>
          </div>
        </li>`;
      })
      .join('');
  }
}

/** Renderiza el widget de Eventos Próximos (eventos en 7 días) */
function renderizarWidgetEventos() {
  const lista = document.getElementById('widget-eventos-lista');
  if (!lista) return;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const unaSemanaDespues = new Date(hoy);
  unaSemanaDespues.setDate(hoy.getDate() + 7);

  const eventosProximos = state.eventos
    .filter((evento) => {
      if (!evento.fechaInicio || !evento.fechaFin) return false;
      const inicio = new Date(evento.fechaInicio + 'T00:00:00');
      const fin = new Date(evento.fechaFin + 'T00:00:00');
      // Eventos que terminan hoy o después Y empiezan antes de la próxima semana
      return fin >= hoy && inicio < unaSemanaDespues;
    })
    .sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio));

  if (eventosProximos.length === 0) {
    lista.innerHTML =
      '<li><p>No tienes eventos programados para esta semana.</p></li>';
  } else {
    const formatFecha = (fechaStr) => {
      const fecha = new Date(fechaStr + 'T00:00:00');
      const options = { weekday: 'short', day: 'numeric', month: 'short' }; // Formato más corto
      const fechaFormateada = fecha.toLocaleDateString('es-ES', options);
      return fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
    };
    lista.innerHTML = eventosProximos
      .map((evento) => {
        const fechaStr =
          evento.fechaInicio === evento.fechaFin
            ? formatFecha(evento.fechaInicio)
            : `${formatFecha(evento.fechaInicio)} - ${formatFecha(evento.fechaFin)}`;
        return `
        <li class="widget-task-item">
          <div class="event-color-dot" style="background-color: ${evento.color};"></div>
          <div class="widget-task-info">
            <strong class="widget-task-title">${evento.titulo}</strong>
            <span class="widget-task-meta">${fechaStr}</span>
          </div>
        </li>`;
      })
      .join('');
  }
}

/** Actualiza el contador del widget de Progreso Semanal */
function actualizarWidgetProgreso() {
  const contador = document.getElementById('widget-progreso-contador');
  if (!contador) return;
  // Lógica simple: cuenta tareas completadas. Podría mejorarse para contar solo las de esta semana.
  const tareasCompletadas = state.tareas.filter((t) => t.completada).length;
  contador.textContent = tareasCompletadas;
}

/** Renderiza el widget de Carga Semanal (Bar Chart v5 FINAL) */
function renderizarWidgetCargaSemanal() {
  const container = document.getElementById('workload-heatmap-container');
  if (!container) return;
  container.innerHTML = '';

  const pad = (num) => num.toString().padStart(2, '0');
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

  const diaDeLaSemana = hoy.getDay();
  const diferenciaLunes = diaDeLaSemana === 0 ? 6 : diaDeLaSemana - 1;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - diferenciaLunes);
  lunes.setHours(0, 0, 0, 0);

  const tareasPorDia = [];
  for (let i = 0; i < 7; i++) {
    const diaActualLoop = new Date(lunes);
    diaActualLoop.setDate(lunes.getDate() + i);
    const diaActualStr = `${diaActualLoop.getFullYear()}-${pad(diaActualLoop.getMonth() + 1)}-${pad(diaActualLoop.getDate())}`;
    const tareasPendientes = state.tareas.filter(
      (t) => !t.completada && t.fecha === diaActualStr,
    ).length;
    tareasPorDia.push(tareasPendientes);
  }

  const maxTareas = Math.max(...tareasPorDia, 1);
  const dias = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  for (let i = 0; i < 7; i++) {
    const diaActualLoop = new Date(lunes);
    diaActualLoop.setDate(lunes.getDate() + i);
    const diaActualStr = `${diaActualLoop.getFullYear()}-${pad(diaActualLoop.getMonth() + 1)}-${pad(diaActualLoop.getDate())}`;

    const cargaRelativa = tareasPorDia[i] / maxTareas;
    const alturaBarra = cargaRelativa * 100;
    const opacidadBarra = 0.15 + cargaRelativa * 0.65;

    const diaEl = document.createElement('div');
    diaEl.className = 'heatmap-day';
    const inicialEl = document.createElement('span');
    inicialEl.className = 'day-initial';
    inicialEl.textContent = dias[i];
    const barraEl = document.createElement('div');
    barraEl.className = 'heatmap-bar';
    barraEl.style.height = `${alturaBarra}%`;
    barraEl.style.opacity = opacidadBarra;

    if (diaActualStr === hoyStr) {
      inicialEl.classList.add('current');
      diaEl.classList.add('current-day-box');
    }

    diaEl.appendChild(inicialEl);
    diaEl.appendChild(barraEl);
    container.appendChild(diaEl);
  }
}

/** Renderiza el widget de Apuntes Recientes */
function renderizarWidgetApuntesRecientes() {
  const lista = document.getElementById('widget-apuntes-lista');
  if (!lista) return;
  const apuntesOrdenados = [...state.apuntes].sort((a, b) => {
    return new Date(b.fechaModificacion) - new Date(a.fechaModificacion);
  });
  const apuntesRecientes = apuntesOrdenados.slice(0, 3);

  if (apuntesRecientes.length === 0) {
    lista.innerHTML = '<li><p>Aún no has creado ningún apunte.</p></li>';
    lista.removeEventListener('click', handleApunteRecienteClick);
  } else {
    lista.innerHTML = apuntesRecientes
      .map((apunte) => {
        const titulo = apunte.titulo || 'Apunte sin título';
        const curso = apunte.curso || 'General';
        return `
        <li data-id="${apunte.id}">
          <div class="apunte-reciente-info">
            <strong class="apunte-reciente-titulo">${titulo}</strong>
            <span class="apunte-reciente-curso">${curso}</span>
          </div>
        </li>`;
      })
      .join('');
    lista.removeEventListener('click', handleApunteRecienteClick);
    lista.addEventListener('click', handleApunteRecienteClick);
  }
}

/** Renderiza el widget de Progreso de Proyectos */
function renderizarWidgetProgresoProyectos() {
  const lista = document.getElementById('widget-proyectos-lista');
  if (!lista) return;
  const proyectosAMostrar = state.proyectos.slice(0, 5);

  if (proyectosAMostrar.length === 0) {
    lista.innerHTML =
      '<li><p>Crea tu primer proyecto para ver su progreso aquí.</p></li>';
    lista.removeEventListener('click', handleProyectoProgresoClick);
  } else {
    lista.innerHTML = proyectosAMostrar
      .map((proyecto) => {
        const stats = calcularEstadisticasProyecto(proyecto.id); // Asegúrate que esta función use proyectoId
        return `
        <li data-id="${proyecto.id}">
          <div class="proyecto-progreso-item">
            <strong class="proyecto-progreso-nombre">${proyecto.nombre}</strong>
            <span class="proyecto-progreso-stats">
              ${stats.completadas} de ${stats.total} tareas (${stats.porcentaje}%)
            </span>
            <div class="progreso-barra-container">
              <div class="progreso-barra-relleno" style="width: ${stats.porcentaje}%;"></div>
            </div>
          </div>
        </li>`;
      })
      .join('');
    lista.removeEventListener('click', handleProyectoProgresoClick);
    lista.addEventListener('click', handleProyectoProgresoClick);
  }
}

/** Renderiza el widget de Tareas Vencidas */
function renderizarWidgetTareasVencidas() {
  const lista = document.getElementById('widget-vencidas-lista');
  if (!lista) return;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const tareasVencidas = state.tareas
    .filter((t) => {
      if (!t.fecha) return false;
      const fechaTarea = new Date(t.fecha + 'T00:00:00');
      return !t.completada && fechaTarea < hoy;
    })
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  if (tareasVencidas.length === 0) {
    lista.innerHTML =
      '<li><p>¡Felicidades! No tienes tareas vencidas.</p></li>';
    lista.removeEventListener('click', handleTareaVencidaClick);
  } else {
    lista.innerHTML = tareasVencidas
      .map((tarea) => {
        const curso = tarea.curso || 'General';
        return `
        <li data-id="${tarea.id}">
          <div class="tarea-vencida-info">
            <strong class="tarea-vencida-titulo">${tarea.titulo}</strong>
            <span class="tarea-vencida-curso">${curso}</span>
          </div>
        </li>`;
      })
      .join('');
    lista.removeEventListener('click', handleTareaVencidaClick);
    lista.addEventListener('click', handleTareaVencidaClick);
  }
}
// ==========================================================================
// ==          FUNCIÓN CENTRAL PARA RENDERIZAR Y GESTIONAR WIDGETS         ==
// ==========================================================================
function renderizarWidgets() {
  console.log('--- [Dashboard] Iniciando renderizarWidgets ---');
  if (!state.config || typeof state.config.widgetsVisibles !== 'object') {
    console.error(
      'Error FATAL: state.config.widgetsVisibles no está definido.',
    );
    return;
  }
  console.log(
    '[Dashboard] Configuración:',
    JSON.parse(JSON.stringify(state.config.widgetsVisibles)),
  );
  console.log(
    `[Dashboard] Datos: Tareas=${state.tareas?.length}, Apuntes=${state.apuntes?.length}, Proyectos=${state.proyectos?.length}, Eventos=${state.eventos?.length}`,
  );

  for (const key in widgetSelectors) {
    if (widgetSelectors.hasOwnProperty(key)) {
      const selector = widgetSelectors[key];
      const widgetElement = document.querySelector(selector);
      if (!widgetElement) {
        // console.warn(`[Dashboard] Widget HTML "${selector}" (key: ${key}) NO encontrado.`); // Descomenta si sospechas del HTML
        continue;
      }
      const esVisible = state.config.widgetsVisibles[key] === true;
      if (esVisible) {
        let displayStyle = 'flex'; // Asume flex, ajusta si es necesario
        // if (key === 'cargaSemanal') displayStyle = 'grid';
        widgetElement.style.display = displayStyle;
        // console.log(`[Dashboard] Mostrando y llamando render para: ${key}`); // Descomenta para depuración detallada
        try {
          llamarFuncionRenderWidget(key);
        } catch (error) {
          console.error(
            `[Dashboard] !!! Error al ejecutar render para '${key}':`,
            error,
          );
        }
      } else {
        widgetElement.style.display = 'none';
      }
    }
  }
  console.log('--- [Dashboard] renderizarWidgets completado ---');
}

/** Función auxiliar para llamar a la función correcta */
function llamarFuncionRenderWidget(widgetKey) {
  switch (widgetKey) {
    case 'racha':
      renderizarWidgetRacha();
      break;
    case 'enfoque':
      renderizarWidgetEnfoque();
      break;
    case 'proximamente':
      renderizarWidgetProximamente();
      break;
    case 'eventos':
      renderizarWidgetEventos();
      break;
    case 'progresoSemanal':
      actualizarWidgetProgreso();
      break;
    case 'cargaSemanal':
      renderizarWidgetCargaSemanal();
      break;
    case 'pomodoro':
      actualizarDisplayPomodoro();
      break;
    case 'apuntesRecientes':
      renderizarWidgetApuntesRecientes();
      break;
    case 'progresoProyectos':
      renderizarWidgetProgresoProyectos();
      break;
    case 'tareasVencidas':
      renderizarWidgetTareasVencidas();
      break;
    case 'accesos':
      break;
    default:
      console.warn(
        `[Dashboard] Llamada a render no implementada para: ${widgetKey}`,
      );
  }
}

// ==========================================================================
// ==                MANEJADORES DE EVENTOS PARA NAVEGACIÓN                ==
// ==========================================================================
function handleApunteRecienteClick(event) {
  const apunteLi = event.target.closest('li[data-id]');
  if (!apunteLi) return;
  const apunteId = parseInt(apunteLi.dataset.id, 10);
  state.apunteActivoId = apunteId; // ✨ CORREGIDO: Usar apunteActivoId
  guardarDatos();
  cambiarPagina('apuntes');
}
function handleProyectoProgresoClick(event) {
  const proyectoLi = event.target.closest('li[data-id]');
  if (!proyectoLi) return;
  const proyectoId = parseInt(proyectoLi.dataset.id, 10);
  state.proyectoSeleccionadoId = proyectoId;
  guardarDatos();
  cambiarPagina('proyectos');
}
function handleTareaVencidaClick(event) {
  const tareaLi = event.target.closest('li[data-id]');
  if (!tareaLi) return;
  const tareaId = parseInt(tareaLi.dataset.id, 10);
  state.tareaSeleccionadald = tareaId;
  guardarDatos();
  cambiarPagina('tareas');
}

// ==========================================================================
// ==       FUNCIONES PARA EL MODAL DE NUEVA TAREA (ACCESO RÁPIDO)         ==
// ==========================================================================

/** Abre el modal para añadir una nueva tarea desde el dashboard */
export function abrirModalNuevaTarea(fechaPorDefecto = null) {
  console.log('[Dashboard] Entrando a abrirModalNuevaTarea...'); // Log

  const form = document.getElementById('form-dashboard-nueva-tarea');
  console.log('[Dashboard] Formulario encontrado:', form);
  if (!form) {
    console.error(
      '[Dashboard] Error Crítico: No se encontró el formulario #form-dashboard-nueva-tarea.',
    );
    return;
  }

  form.reset();
  console.log('[Dashboard] Intentando popular selectores...');
  try {
    popularSelectorDeCursos(
      document.getElementById('dashboard-select-curso-tarea'),
      true,
    );
    popularSelectorDeProyectos('dashboard-select-proyecto-tarea');
    const inputFecha = document.getElementById('dashboard-input-fecha-tarea');
    if (fechaPorDefecto) {
      // Si pasamos una fecha (desde calendario.js)
      inputFecha.value = fechaPorDefecto;
    } else {
      // Si no (desde el propio dashboard), ponemos la de hoy
      inputFecha.valueAsDate = new Date();
    }
    console.log('[Dashboard] Selectores populados y fecha establecida.');
  } catch (error) {
    console.error('[Dashboard] Error al popular selectores o fecha:', error);
    return;
  }

  console.log(
    "[Dashboard] Intentando llamar a mostrarModal('modal-dashboard-nueva-tarea')...",
  );
  const modalElement = document.getElementById('modal-dashboard-nueva-tarea');
  console.log('[Dashboard] Elemento del modal encontrado:', modalElement);
  if (!modalElement) {
    console.error(
      '[Dashboard] Error Crítico: No se encontró el modal #modal-dashboard-nueva-tarea.',
    );
    return;
  }

  mostrarModal('modal-dashboard-nueva-tarea');
  console.log('[Dashboard] Llamada a mostrarModal ejecutada.');
}

/** Procesa el formulario del modal y añade la nueva tarea */
function agregarTareaDesdeDashboard(event) {
  event.preventDefault(); // Evita que la página se recargue
  console.log("[Dashboard] Formulario 'agregarTareaDesdeDashboard' enviado."); // Log

  const cursoSelect = document.getElementById('dashboard-select-curso-tarea');
  const proyectoSelect = document.getElementById(
    'dashboard-select-proyecto-tarea',
  );
  const tituloInput = document.getElementById('dashboard-input-titulo-tarea');
  const descInput = document.getElementById('dashboard-input-desc-tarea');
  const fechaInput = document.getElementById('dashboard-input-fecha-tarea');
  const prioridadSelect = document.getElementById(
    'dashboard-select-prioridad-tarea',
  );

  // Verificación básica de que los elementos existen
  if (
    !cursoSelect ||
    !proyectoSelect ||
    !tituloInput ||
    !fechaInput ||
    !prioridadSelect
  ) {
    console.error(
      '[Dashboard] Faltan elementos en el formulario de nueva tarea.',
    );
    alert('Error interno: Faltan elementos en el formulario.');
    return;
  }

  const nuevaTarea = {
    id: Date.now(),
    curso: cursoSelect.value,
    proyectoId: parseInt(proyectoSelect.value) || null, // Asegura que sea número o null
    titulo: tituloInput.value.trim(),
    descripcion: descInput.value.trim(), // Asegúrate que descInput exista si lo usas
    fecha: fechaInput.value,
    prioridad: prioridadSelect.value,
    completada: false,
    fechaCompletado: null, // Incluye la nueva propiedad
    subtareas: [],
  };

  if (!nuevaTarea.titulo || !nuevaTarea.fecha) {
    alert('El título y la fecha son obligatorios.');
    return;
  }

  try {
    state.tareas.push(nuevaTarea);
    guardarDatos();
    console.log('[Dashboard] Nueva tarea añadida:', nuevaTarea);
    cerrarModal('modal-dashboard-nueva-tarea');
    renderizarWidgets(); // Refresca los widgets por si la nueva tarea afecta alguno
  } catch (error) {
    console.error('[Dashboard] Error al guardar la nueva tarea:', error);
    alert('Hubo un error al guardar la tarea.');
  }
}
// ==========================================================================
// ==                  FUNCIÓN PRINCIPAL DE INICIALIZACIÓN                 ==
// ==========================================================================
export function inicializarDashboard() {
  console.log('--- [Dashboard] Iniciando inicializarDashboard ---');
  const pageDashboard = document.getElementById('page-dashboard');
  if (!pageDashboard) {
    console.error('[Dashboard] Error: #page-dashboard no encontrado.');
    return;
  }

  // --- Saludo Dinámico (CORREGIDO) ---
  try {
    const saludoContainer = pageDashboard.querySelector('.panel-header'); // Este es el .panel-header
    if (saludoContainer) {
      // Limpia saludos/frases anteriores
      saludoContainer
        .querySelectorAll('.header-info-usuario')
        .forEach((el) => el.remove()); // Borra el contenedor si existe

      // ✨ PASO 1: Crea el DIV contenedor
      const infoUsuarioDiv = document.createElement('div');
      infoUsuarioDiv.className = 'header-info-usuario'; // Le asigna la clase que necesita el CSS

      // PASO 2: Obtiene saludo y frase
      const { saludo, frase } = obtenerSaludoYFrase();

      // PASO 3: Crea los párrafos
      const saludoEl = document.createElement('p');
      saludoEl.className = 'saludo-dinamico';
      saludoEl.textContent = saludo;

      const fraseEl = document.createElement('p');
      fraseEl.className = 'frase-dinamica';
      fraseEl.textContent = frase;

      // ✨ PASO 4: Añade los párrafos DENTRO del nuevo DIV
      infoUsuarioDiv.appendChild(saludoEl);
      infoUsuarioDiv.appendChild(fraseEl);

      // ✨ PASO 5: Añade el nuevo DIV (con todo dentro) al header
      saludoContainer.appendChild(infoUsuarioDiv);
    } else {
      console.warn(
        '[Dashboard] Contenedor .panel-header no encontrado para el saludo.',
      );
    }
  } catch (error) {
    console.error('[Dashboard] Error al añadir saludo:', error);
  }

  // --- Renderizado inicial de widgets ---
  try {
    renderizarWidgets();
  } catch (error) {
    console.error(
      '[Dashboard] !!! Error en llamada a renderizarWidgets:',
      error,
    );
  }

  // --- Inicialización Pomodoro (si es visible) ---
  try {
    const pomodoroWidget = document.querySelector(widgetSelectors.pomodoro);
    if (
      pomodoroWidget &&
      window.getComputedStyle(pomodoroWidget).display !== 'none'
    ) {
      console.log('[Dashboard] Inicializando Pomodoro...');
      inicializarPomodoroListeners();
      actualizarDisplayPomodoro();
    } else {
      // console.log("[Dashboard] Pomodoro no encontrado u oculto."); // Descomenta si necesitas
    }
  } catch (error) {
    console.error('[Dashboard] Error inicializando Pomodoro:', error);
  }

  // --- Añadir Listeners globales (solo una vez) ---
  if (!pageDashboard.dataset.initialized) {
    console.log('[Dashboard] Añadiendo listeners globales.');
    pageDashboard.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      console.log(`[Dashboard] Clic acción: ${action}`);
      if (action === 'ir-a-cursos') cambiarPagina('cursos');
      else if (action === 'nueva-tarea-modal') abrirModalNuevaTarea();
    });

    const form = document.getElementById('form-dashboard-nueva-tarea');
    if (form) {
      form.removeEventListener('submit', agregarTareaDesdeDashboard);
      form.addEventListener('submit', agregarTareaDesdeDashboard);
    } else {
      // console.warn("[Dashboard] Form #form-dashboard-nueva-tarea no encontrado."); // Descomenta si necesitas
    }
    pageDashboard.dataset.initialized = 'true';
  } else {
    // console.log("[Dashboard] Listeners globales ya inicializados."); // Descomenta si necesitas
  }
  console.log('--- [Dashboard] inicializarDashboard completado ---');
}
