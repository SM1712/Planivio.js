// ==========================================================================
// ==                             IMPORTACIONES                            ==
// ==========================================================================
import { state } from '../state.js';
import { guardarDatos } from '../utils.js';
import { cambiarPagina } from '../main.js';
import {
  mostrarModal,
  cerrarModal,
  popularSelectorDeCursos, // Usaremos la función arreglada
  popularSelectorDeProyectos,
  mostrarNotificacion,
} from '../ui.js';
import { calcularEstadisticasProyecto } from './proyectos.js';

// ... (El resto de las funciones: widgetSelectors, frasesDashboard, obtenerSaludoYFrase, Lógica Pomodoro, calcularRacha, renderizarWidgets, etc. NO CAMBIAN) ...
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
function actualizarDisplayPomodoro() {
  const display = timerEl();
  if (!display) return;
  const minutos = Math.floor(tiempoRestante / 60);
  const segundos = tiempoRestante % 60;
  display.textContent = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
}
function iniciarPomodoro() {
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
    proximoModo = '';
  if (enModoFoco) {
    pomodoroCiclosCompletados++;
    if (pomodoroCiclosCompletados >= 4) {
      titulo = '¡Ciclos completados!';
      cuerpo = `¡Felicidades! Tómate un merecido descanso largo de ${DURACION_DESCANSO_LARGO / 60} minutos.`;
      tiempoRestante = DURACION_DESCANSO_LARGO;
      proximoModo = 'Descanso largo en curso...';
      pomodoroCiclosCompletados = 0;
    } else {
      titulo = '¡Tiempo de descansar!';
      cuerpo = `¡Excelente sesión de foco! Tómate ${DURACION_DESCANSO_CORTO / 60} minutos.`;
      tiempoRestante = DURACION_DESCANSO_CORTO;
      proximoModo = `Tomando un descanso corto... (Ciclo ${pomodoroCiclosCompletados}/4)`;
    }
    enModoFoco = false;
  } else {
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
function renderizarWidgetRacha() {
  const racha = calcularRacha(); // calcularRacha ahora excluye archivados
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
function calcularRacha() {
  const tareasRealmenteCompletadas = state.tareas.filter((t) => {
    // Condición original: completada y con fecha
    if (!t.completada || !t.fechaCompletado) return false;
    // NUEVA condición: el curso NO debe estar archivado
    const cursoAsociado = state.cursos.find((c) => c.nombre === t.curso);
    return !cursoAsociado?.isArchivado; // `?.` es opcional chaining (seguro si cursoAsociado es null/undefined)
  });

  if (tareasRealmenteCompletadas.length === 0) return 0;
  const fechasDeCompletado = new Set(
    tareasRealmenteCompletadas.map((t) => t.fechaCompletado),
  );
  let racha = 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  for (let i = 0; ; i++) {
    const fechaAComprobar = new Date(hoy);
    fechaAComprobar.setDate(hoy.getDate() - i);
    const fechaFormateada = fechaAComprobar.toISOString().split('T')[0];
    if (fechasDeCompletado.has(fechaFormateada)) {
      racha++;
    } else {
      // Corrección lógica racha: si el día actual no cuenta, la racha es 0.
      if (i === 0 && !fechasDeCompletado.has(hoy.toISOString().split('T')[0])) {
        racha = 0; // Si hoy no se completó, la racha se rompe.
      }
      // Si un día anterior falta, se rompe la secuencia.
      if (i > 0) {
        break;
      }
    }
    if (i > 366) break; // Límite de seguridad
  }
  return racha;
}
function renderizarWidgetEnfoque() {
  const lista = document.getElementById('widget-enfoque-lista');
  if (!lista) return;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const tareasDeHoy = state.tareas.filter((t) => {
    // Condiciones originales
    if (!t.fecha || t.completada) return false;
    const fechaTarea = new Date(t.fecha + 'T00:00:00');
    if (fechaTarea.getTime() !== hoy.getTime()) return false;
    // NUEVA condición: curso no archivado
    const cursoAsociado = state.cursos.find((c) => c.nombre === t.curso);
    return !cursoAsociado?.isArchivado;
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
      // Condiciones originales
      if (!t.fecha || t.completada) return false;
      const fechaTarea = new Date(t.fecha + 'T00:00:00');
      if (!(fechaTarea > hoy && fechaTarea <= tresDiasDespues)) return false;
      // NUEVA condición: curso no archivado
      const cursoAsociado = state.cursos.find((c) => c.nombre === t.curso);
      return !cursoAsociado?.isArchivado;
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
      return fin >= hoy && inicio < unaSemanaDespues;
    })
    .sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio));
  if (eventosProximos.length === 0) {
    lista.innerHTML =
      '<li><p>No tienes eventos programados para esta semana.</p></li>';
  } else {
    const formatFecha = (fechaStr) => {
      const fecha = new Date(fechaStr + 'T00:00:00');
      const options = { weekday: 'short', day: 'numeric', month: 'short' };
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
function actualizarWidgetProgreso() {
  const contador = document.getElementById('widget-progreso-contador');
  if (!contador) return;
  const tareasCompletadas = state.tareas.filter((t) => t.completada).length;
  contador.textContent = tareasCompletadas;
}
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

    // Contar solo tareas pendientes de cursos no archivados
    const tareasPendientes = state.tareas.filter((t) => {
      if (t.completada || t.fecha !== diaActualStr) return false;
      const cursoAsociado = state.cursos.find((c) => c.nombre === t.curso);
      return !cursoAsociado?.isArchivado;
    }).length;

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
function renderizarWidgetProgresoProyectos() {
  const lista = document.getElementById('widget-proyectos-lista');
  if (!lista) return;
  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );
  // Filtra los proyectos: solo muestra los que NO tienen curso O cuyo curso NO está archivado.
  const proyectosFiltrados = state.proyectos.filter(
    (proyecto) =>
      !(proyecto.curso && cursosArchivadosNombres.has(proyecto.curso)),
  );
  const proyectosAMostrar = proyectosFiltrados.slice(0, 5);
  if (proyectosAMostrar.length === 0) {
    lista.innerHTML =
      '<li><p>Crea tu primer proyecto para ver su progreso aquí.</p></li>';
    lista.removeEventListener('click', handleProyectoProgresoClick);
  } else {
    lista.innerHTML = proyectosAMostrar
      .map((proyecto) => {
        const stats = calcularEstadisticasProyecto(proyecto.id);
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
function renderizarWidgetTareasVencidas() {
  const lista = document.getElementById('widget-vencidas-lista');
  if (!lista) return;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const tareasVencidas = state.tareas
    .filter((t) => {
      // Condiciones originales
      if (!t.fecha || t.completada) return false;
      const fechaTarea = new Date(t.fecha + 'T00:00:00');
      if (!(fechaTarea < hoy)) return false;
      // NUEVA condición: curso no archivado
      const cursoAsociado = state.cursos.find((c) => c.nombre === t.curso);
      return !cursoAsociado?.isArchivado;
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
function renderizarWidgets() {
  if (!state.config || typeof state.config.widgetsVisibles !== 'object') {
    console.error(
      'Error FATAL: state.config.widgetsVisibles no está definido.',
    );
    return;
  }
  for (const key in widgetSelectors) {
    if (widgetSelectors.hasOwnProperty(key)) {
      const selector = widgetSelectors[key];
      const widgetElement = document.querySelector(selector);
      if (!widgetElement) {
        continue;
      }
      const esVisible = state.config.widgetsVisibles[key] === true;
      if (esVisible) {
        let displayStyle = 'flex';
        widgetElement.style.display = displayStyle;
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
}
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
function handleApunteRecienteClick(event) {
  const apunteLi = event.target.closest('li[data-id]');
  if (!apunteLi) return;
  const apunteId = parseInt(apunteLi.dataset.id, 10);
  state.apunteActivoId = apunteId;
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

/**
 * ACTUALIZADO: Abre el modal para añadir una nueva tarea desde el dashboard.
 * @param {string | null} fechaPorDefecto - Fecha 'YYYY-MM-DD' a pre-rellenar.
 * @param {string | null} cursoPreseleccionado - Nombre del curso a pre-seleccionar.
 */
export function abrirModalNuevaTarea(
  fechaPorDefecto = null,
  cursoPreseleccionado = null,
) {
  const form = document.getElementById('form-dashboard-nueva-tarea');
  if (!form) {
    console.error(
      '[Dashboard] Error Crítico: No se encontró el formulario #form-dashboard-nueva-tarea.',
    );
    return;
  }
  form.reset();

  try {
    // 1. Popular selector de cursos usando la función arreglada
    const selectorCurso = document.getElementById(
      'dashboard-select-curso-tarea',
    );
    if (selectorCurso) {
      popularSelectorDeCursos(selectorCurso, true); // true para omitir 'General'
      // 2. Pre-seleccionar curso si viene del modal chooser
      if (
        cursoPreseleccionado &&
        selectorCurso.querySelector(`option[value="${cursoPreseleccionado}"]`)
      ) {
        selectorCurso.value = cursoPreseleccionado;
      }
    } else {
      console.warn(
        '[Dashboard] Selector de curso #dashboard-select-curso-tarea no encontrado.',
      );
    }

    // 3. Popular selector de proyectos (sin cambios)
    popularSelectorDeProyectos('dashboard-select-proyecto-tarea');

    // 4. Establecer fecha (sin cambios)
    const inputFecha = document.getElementById('dashboard-input-fecha-tarea');
    if (inputFecha) {
      if (fechaPorDefecto) {
        inputFecha.value = fechaPorDefecto;
      } else {
        inputFecha.valueAsDate = new Date();
      }
    } else {
      console.warn(
        '[Dashboard] Input de fecha #dashboard-input-fecha-tarea no encontrado.',
      );
    }
  } catch (error) {
    console.error('[Dashboard] Error al popular selectores o fecha:', error);
    return;
  }

  const modalElement = document.getElementById('modal-dashboard-nueva-tarea');
  if (!modalElement) {
    console.error(
      '[Dashboard] Error Crítico: No se encontró el modal #modal-dashboard-nueva-tarea.',
    );
    return;
  }
  mostrarModal('modal-dashboard-nueva-tarea');
}

/** Procesa el formulario del modal y añade la nueva tarea */
function agregarTareaDesdeDashboard(event) {
  // ... (función sin cambios internos, solo verifica elementos)
  event.preventDefault();
  const cursoSelect = document.getElementById('dashboard-select-curso-tarea');
  const proyectoSelect = document.getElementById(
    'dashboard-select-proyecto-tarea',
  );
  const tituloInput = document.getElementById('dashboard-input-titulo-tarea');
  const descInput = document.getElementById('dashboard-input-desc-tarea'); // Asegúrate que exista si lo usas
  const fechaInput = document.getElementById('dashboard-input-fecha-tarea');
  const prioridadSelect = document.getElementById(
    'dashboard-select-prioridad-tarea',
  );

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
    curso: cursoSelect.value, // Ya se obtiene el nombre del curso seleccionado
    proyectoId: parseInt(proyectoSelect.value) || null,
    titulo: tituloInput.value.trim(),
    descripcion: descInput?.value.trim() || '', // Manejo seguro de descInput
    fecha: fechaInput.value,
    prioridad: prioridadSelect.value,
    completada: false,
    fechaCompletado: null,
    subtareas: [],
  };

  if (!nuevaTarea.titulo || !nuevaTarea.fecha) {
    alert('El título y la fecha son obligatorios.');
    return;
  }

  try {
    state.tareas.push(nuevaTarea);
    guardarDatos();
    cerrarModal('modal-dashboard-nueva-tarea');
    renderizarWidgets();
  } catch (error) {
    console.error('[Dashboard] Error al guardar la nueva tarea:', error);
    alert('Hubo un error al guardar la tarea.');
  }
}

// ==========================================================================
// ==                  FUNCIÓN PRINCIPAL DE INICIALIZACIÓN                 ==
// ==========================================================================
export function inicializarDashboard() {
  // ... (función sin cambios internos, solo asegura que los listeners se añadan correctamente)
  console.log('--- [Dashboard] Iniciando inicializarDashboard ---');
  const pageDashboard = document.getElementById('page-dashboard');
  if (!pageDashboard) {
    console.error('[Dashboard] Error: #page-dashboard no encontrado.');
    return;
  }

  try {
    const saludoContainer = pageDashboard.querySelector('.panel-header');
    if (saludoContainer) {
      saludoContainer
        .querySelectorAll('.header-info-usuario')
        .forEach((el) => el.remove());
      const infoUsuarioDiv = document.createElement('div');
      infoUsuarioDiv.className = 'header-info-usuario';
      const { saludo, frase } = obtenerSaludoYFrase();
      const saludoEl = document.createElement('p');
      saludoEl.className = 'saludo-dinamico';
      saludoEl.textContent = saludo;
      const fraseEl = document.createElement('p');
      fraseEl.className = 'frase-dinamica';
      fraseEl.textContent = frase;
      infoUsuarioDiv.appendChild(saludoEl);
      infoUsuarioDiv.appendChild(fraseEl);
      saludoContainer.appendChild(infoUsuarioDiv);
    } else {
      console.warn(
        '[Dashboard] Contenedor .panel-header no encontrado para el saludo.',
      );
    }
  } catch (error) {
    console.error('[Dashboard] Error al añadir saludo:', error);
  }

  try {
    renderizarWidgets();
  } catch (error) {
    console.error(
      '[Dashboard] !!! Error en llamada a renderizarWidgets:',
      error,
    );
  }

  try {
    const pomodoroWidget = document.querySelector(widgetSelectors.pomodoro);
    if (
      pomodoroWidget &&
      window.getComputedStyle(pomodoroWidget).display !== 'none'
    ) {
      inicializarPomodoroListeners();
      actualizarDisplayPomodoro();
    }
  } catch (error) {
    console.error('[Dashboard] Error inicializando Pomodoro:', error);
  }

  if (!pageDashboard.dataset.initialized) {
    pageDashboard.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'ir-a-cursos') cambiarPagina('cursos');
      else if (action === 'nueva-tarea-modal') abrirModalNuevaTarea(); // Llama sin argumentos aquí
    });

    const form = document.getElementById('form-dashboard-nueva-tarea');
    if (form) {
      form.removeEventListener('submit', agregarTareaDesdeDashboard);
      form.addEventListener('submit', agregarTareaDesdeDashboard);
    }
    pageDashboard.dataset.initialized = 'true';
  }
  console.log('--- [Dashboard] inicializarDashboard completado ---');
}
