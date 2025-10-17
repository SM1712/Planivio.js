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
import { calcularEstadisticasProyecto } from './proyectos.js';

function obtenerSaludo() {
  const hora = new Date().getHours();
  // Clave: Usamos el nombre guardado en el estado.
  const nombre = state.config.userName || 'Usuario';

  if (hora < 12) {
    return `¡Buenos días, ${nombre}!`;
  } else if (hora < 19) {
    return `Buenas tardes, ${nombre}.`;
  } else {
    return `Buenas noches, ${nombre}.`;
  }
}
// --- FUNCIONES DE RENDERIZADO DE WIDGETS ---
function renderizarWidgets() {
  actualizarWidgetProgreso();
  renderizarWidgetEnfoque();
  renderizarWidgetProximamente();
  renderizarWidgetRacha();
  renderizarWidgetEventos();
  renderizarWidgetCargaSemanal();
  renderizarWidgetApuntesRecientes();
  renderizarWidgetProgresoProyectos();
  renderizarWidgetTareasVencidas();
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
    return;
  }

  // --- ✨ CAMBIO PRINCIPAL AQUÍ ---
  // Esta función ahora formatea la fecha como "Jueves 16 de octubre"
  const formatFecha = (fechaStr) => {
    const fecha = new Date(fechaStr + 'T00:00:00');
    const options = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    };
    // Capitalizamos la primera letra del resultado
    const fechaFormateada = fecha.toLocaleDateString('es-ES', options);
    return fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
  };

  lista.innerHTML = eventosProximos
    .map((evento) => {
      // La lógica para mostrar el rango de fechas sigue siendo la misma
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

function renderizarWidgetEnfoque() {
  const lista = document.getElementById('widget-enfoque-lista');
  if (!lista) return;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const tareasDeHoy = state.tareas.filter((t) => {
    if (t.completada) return false;
    const fechaTarea = new Date(t.fecha + 'T00:00:00');
    return fechaTarea.getTime() === hoy.getTime();
  });

  if (tareasDeHoy.length === 0) {
    lista.innerHTML = '<li><p>¡Ninguna tarea pendiente para hoy!</p></li>';
    return;
  }
  lista.innerHTML = tareasDeHoy
    .map(
      (t) => `
              <li class="widget-task-item">
                  <span class="prioridad-indicador prioridad-${t.prioridad.toLowerCase()}"></span>
                  <div class="widget-task-info">
                      <strong class="widget-task-title">${t.titulo}</strong>
                      <span class="widget-task-meta">${t.curso}</span>
                  </div>
              </li>`,
    )
    .join('');
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
      if (t.completada) return false;
      const fechaTarea = new Date(t.fecha + 'T00:00:00');
      return fechaTarea > hoy && fechaTarea <= tresDiasDespues;
    })
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  if (tareasProximas.length === 0) {
    lista.innerHTML = '<li><p>Nada en el horizonte cercano.</p></li>';
    return;
  }
  lista.innerHTML = tareasProximas
    .map((t) => {
      const [, month, day] = t.fecha.split('-');
      const fechaFormateada = `${day}/${month}`;
      return `
                <li class="widget-task-item">
                    <span class="prioridad-indicador prioridad-${t.prioridad.toLowerCase()}"></span>
                    <div class="widget-task-info">
                        <strong class="widget-task-title">${t.titulo}</strong>
                        <span class="widget-task-meta">${t.curso} - Entrega: ${fechaFormateada}</span>
                    </div>
                </li>`;
    })
    .join('');
}

function actualizarWidgetProgreso() {
  const contador = document.getElementById('widget-progreso-contador');
  if (!contador) return;
  const tareasCompletadas = state.tareas.filter((t) => t.completada).length;
  contador.textContent = tareasCompletadas;
}

function abrirModalNuevaTarea() {
  const form = document.getElementById('form-dashboard-nueva-tarea');
  if (!form) return;

  form.reset(); // Limpiamos el formulario

  // Populamos los selectores
  popularSelectorDeCursos(
    document.getElementById('dashboard-select-curso-tarea'),
    true,
  );
  popularSelectorDeProyectos('dashboard-select-proyecto-tarea');

  // Ponemos la fecha de hoy por defecto
  document.getElementById('dashboard-input-fecha-tarea').valueAsDate =
    new Date();

  mostrarModal('modal-dashboard-nueva-tarea');
}

function agregarTareaDesdeDashboard(event) {
  event.preventDefault();

  const nuevaTarea = {
    id: Date.now(),
    curso: document.getElementById('dashboard-select-curso-tarea').value,
    proyectold:
      parseInt(
        document.getElementById('dashboard-select-proyecto-tarea').value,
      ) || null,
    titulo: document
      .getElementById('dashboard-input-titulo-tarea')
      .value.trim(),
    descripcion: document
      .getElementById('dashboard-input-desc-tarea')
      .value.trim(),
    fecha: document.getElementById('dashboard-input-fecha-tarea').value,
    prioridad: document.getElementById('dashboard-select-prioridad-tarea')
      .value,
    completada: false,
    subtareas: [],
  };

  if (!nuevaTarea.titulo || !nuevaTarea.fecha) {
    alert('El título y la fecha son obligatorios.');
    return;
  }

  state.tareas.push(nuevaTarea);
  guardarDatos();
  cerrarModal('modal-dashboard-nueva-tarea');
  renderizarWidgets(); // Refrescamos los widgets para mostrar la nueva tarea
}

function calcularRacha() {
  // 1. Obtenemos solo las tareas completadas que tengan una fecha válida.
  const tareasCompletadas = state.tareas.filter((t) => t.completada && t.fecha);

  if (tareasCompletadas.length === 0) {
    return 0; // Si no hay tareas completadas, la racha es 0.
  }

  // 2. Creamos un Set con fechas únicas para evitar contar el mismo día varias veces.
  // Usamos toISOString().split('T')[0] para asegurarnos de que solo tenemos la fecha (YYYY-MM-DD).
  const fechasDeCompletado = new Set(
    tareasCompletadas.map((t) => new Date(t.fecha).toISOString().split('T')[0]),
  );

  let racha = 0;

  // 3. Obtenemos la fecha de hoy, ajustada al inicio del día para una comparación precisa.
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // 4. Empezamos a contar hacia atrás desde hoy.
  for (let i = 0; i < fechasDeCompletado.size + 1; i++) {
    const fechaAComprobar = new Date(hoy);
    fechaAComprobar.setDate(hoy.getDate() - i);
    const fechaFormateada = fechaAComprobar.toISOString().split('T')[0];

    if (fechasDeCompletado.has(fechaFormateada)) {
      // Si el día que estamos revisando está en nuestro set de fechas, incrementamos la racha.
      racha++;
    } else {
      // En el momento en que encontramos un día "vacío", la racha se rompe y terminamos.
      break;
    }
  }

  return racha;
}

function renderizarWidgetRacha() {
  // Asumimos que ya tienes una función calcularRacha() que devuelve un número
  const racha = calcularRacha();

  const contadorEl = document.getElementById('widget-racha-contador');
  const iconoEl = document.getElementById('widget-racha-icono');
  const textoEl = document.getElementById('widget-racha-texto');

  if (!contadorEl || !iconoEl || !textoEl) return; // Verificación de seguridad

  contadorEl.textContent = racha;

  if (racha > 0) {
    // ESTADO ACTIVO: Hay una racha
    iconoEl.textContent = '🔥';
    textoEl.textContent =
      racha === 1
        ? 'día completando tareas.'
        : 'días seguidos completando tareas.';
  } else {
    // ESTADO CERO: No hay racha
    iconoEl.textContent = '❄️';
    textoEl.textContent = '¡Completa una tarea hoy para iniciar tu racha!';
  }
}

export function inicializarDashboard() {
  const pageDashboard = document.getElementById('page-dashboard');

  if (pageDashboard && !pageDashboard.querySelector('.saludo-dinamico')) {
    const saludoEl = document.createElement('p');
    saludoEl.className = 'saludo-dinamico';
    saludoEl.textContent = obtenerSaludo();
    const header = pageDashboard.querySelector('.panel-header');
    if (header) {
      header.appendChild(saludoEl);
    }
  }

  renderizarWidgets();
  inicializarPomodoro();

  if (pageDashboard && !pageDashboard.dataset.initialized) {
    pageDashboard.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;

      const action = button.dataset.action;

      if (action === 'ir-a-cursos') {
        document.querySelector('.nav-item[data-page="cursos"]')?.click();
      } else if (action === 'nueva-tarea-modal') {
        // **AQUÍ ESTÁ EL CAMBIO PRINCIPAL**
        abrirModalNuevaTarea();
      }
    });

    // Añadimos el listener para el submit del nuevo formulario
    const form = document.getElementById('form-dashboard-nueva-tarea');
    if (form) {
      form.addEventListener('submit', agregarTareaDesdeDashboard);
    }

    pageDashboard.dataset.initialized = 'true';
  }
}

/**
 * Renderiza el widget de carga de trabajo semanal como un GRÁFICO DE BARRAS.
 */
/**
 * Renderiza el widget de carga de trabajo semanal como un GRÁFICO DE BARRAS DINÁMICO.
 */
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

    // --- ✨ CAMBIO CLAVE: Calculamos la opacidad dinámicamente ---
    // Mapeamos la carga a un rango de opacidad entre 0.15 (mínimo) y 0.8 (máximo)
    const opacidadBarra = 0.15 + cargaRelativa * 0.65;

    const diaEl = document.createElement('div');
    diaEl.className = 'heatmap-day';

    const inicialEl = document.createElement('span');
    inicialEl.className = 'day-initial';
    inicialEl.textContent = dias[i];

    const barraEl = document.createElement('div');
    barraEl.className = 'heatmap-bar';
    barraEl.style.height = `${alturaBarra}%`;
    barraEl.style.opacity = opacidadBarra; // Aplicamos la opacidad dinámica

    if (diaActualStr === hoyStr) {
      inicialEl.classList.add('current');
      diaEl.classList.add('current-day-box');
    }

    diaEl.appendChild(inicialEl);
    diaEl.appendChild(barraEl);
    container.appendChild(diaEl);
  }
}

// ===========================================
// == LÓGICA DEL WIDGET POMODORO (v2)
// ===========================================
let pomodoroInterval;
let pomodoroCiclosCompletados = 0; // ✨ NUEVO: Contador de ciclos
let tiempoRestante = 25 * 60;
let enModoFoco = true;
let estaCorriendo = false;

// ✨ CAMBIO: Constantes más descriptivas
const DURACION_FOCO = 25 * 60;
const DURACION_DESCANSO_CORTO = 5 * 60;
const DURACION_DESCANSO_LARGO = 15 * 60;

const timerEl = () => document.getElementById('pomodoro-timer');
const statusEl = () => document.getElementById('pomodoro-status');
const startBtnEl = () => document.getElementById('btn-pomodoro-start');

function actualizarDisplay() {
  const minutos = Math.floor(tiempoRestante / 60);
  const segundos = tiempoRestante % 60;
  if (timerEl()) {
    timerEl().textContent = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  }
}

function iniciarPomodoro() {
  Notification.requestPermission();
  estaCorriendo = true;
  startBtnEl().textContent = 'Pausar';

  pomodoroInterval = setInterval(() => {
    tiempoRestante--;
    actualizarDisplay();
    if (tiempoRestante < 0) {
      finalizarCiclo();
    }
  }, 1000);
}

function pausarPomodoro() {
  estaCorriendo = false;
  startBtnEl().textContent = 'Reanudar';
  clearInterval(pomodoroInterval);
}

function reiniciarPomodoro() {
  pausarPomodoro();
  pomodoroCiclosCompletados = 0; // ✨ CAMBIO: Reiniciamos el contador
  enModoFoco = true;
  tiempoRestante = DURACION_FOCO;
  actualizarDisplay();
  statusEl().textContent = `Ciclo ${pomodoroCiclosCompletados + 1} de 4. ¡A enfocarse!`;
  startBtnEl().textContent = 'Iniciar Foco';
}

function finalizarCiclo() {
  clearInterval(pomodoroInterval);
  estaCorriendo = false;

  let titulo, cuerpo, proximoModo;

  if (enModoFoco) {
    // Si terminamos un ciclo de foco
    pomodoroCiclosCompletados++;
    if (pomodoroCiclosCompletados === 4) {
      // ✨ CAMBIO: Si completamos 4 ciclos
      titulo = '¡Ciclos completados!';
      cuerpo = `¡Felicidades! Tómate un merecido descanso largo de ${DURACION_DESCANSO_LARGO / 60} minutos.`;
      tiempoRestante = DURACION_DESCANSO_LARGO;
      proximoModo = 'Descanso largo en curso...';
      pomodoroCiclosCompletados = 0; // Reiniciamos para la siguiente ronda
    } else {
      // Si no, es un descanso corto
      titulo = '¡Tiempo de descansar!';
      cuerpo = `¡Excelente sesión de foco! Tómate ${DURACION_DESCANSO_CORTO / 60} minutos.`;
      tiempoRestante = DURACION_DESCANSO_CORTO;
      proximoModo = `Tomando un descanso corto... (Ciclo ${pomodoroCiclosCompletados}/4)`;
    }
    enModoFoco = false;
  } else {
    // Si terminamos un descanso
    titulo = '¡Hora de enfocarse!';
    cuerpo = `El descanso terminó. ¡A seguir con la próxima sesión de ${DURACION_FOCO / 60} minutos!`;
    tiempoRestante = DURACION_FOCO;
    proximoModo = `Ciclo ${pomodoroCiclosCompletados + 1} de 4. ¡A enfocarse!`;
    enModoFoco = true;
  }

  mostrarNotificacion(titulo, { body: cuerpo });
  statusEl().textContent = proximoModo;
  actualizarDisplay();
  startBtnEl().textContent = enModoFoco ? 'Iniciar Foco' : 'Iniciar Descanso';
}

function inicializarPomodoro() {
  const startBtn = document.getElementById('btn-pomodoro-start');
  const resetBtn = document.getElementById('btn-pomodoro-reset');
  if (!startBtn || !resetBtn) return;
  if (startBtn.dataset.initialized) return;

  startBtn.addEventListener('click', () => {
    if (estaCorriendo) pausarPomodoro();
    else iniciarPomodoro();
  });
  resetBtn.addEventListener('click', reiniciarPomodoro);

  // ✨ CAMBIO: Mensaje inicial más claro
  statusEl().textContent = `Ciclo ${pomodoroCiclosCompletados + 1} de 4. ¡A enfocarse!`;
  actualizarDisplay();
  startBtn.dataset.initialized = 'true';
}

/**
 * Renderiza el widget con los apuntes modificados más recientemente.
 */
function renderizarWidgetApuntesRecientes() {
  const lista = document.getElementById('widget-apuntes-lista');
  if (!lista) return;

  // 1. Clonamos y ordenamos los apuntes por fecha de modificación (más reciente primero)
  const apuntesOrdenados = [...state.apuntes].sort((a, b) => {
    // Aseguramos que las fechas sean objetos Date para comparar
    const fechaA = new Date(a.fechaModificacion);
    const fechaB = new Date(b.fechaModificacion);
    return fechaB - fechaA; // Orden descendente
  });

  // 2. Tomamos los primeros 3 apuntes (o menos si no hay suficientes)
  const apuntesRecientes = apuntesOrdenados.slice(0, 3);

  // 3. Generamos el HTML o mostramos mensaje si no hay apuntes
  if (apuntesRecientes.length === 0) {
    lista.innerHTML = '<li><p>Aún no has creado ningún apunte.</p></li>';
    // Removemos el listener si ya existía para evitar duplicados
    lista.removeEventListener('click', handleApunteRecienteClick);
    return;
  }

  lista.innerHTML = apuntesRecientes
    .map((apunte) => {
      // Usamos 'Apunte sin título' como fallback si el título está vacío
      const titulo = apunte.titulo || 'Apunte sin título';
      const curso = apunte.curso || 'General'; // Usamos 'General' si no tiene curso asignado

      // Añadimos data-id al <li> para saber a qué apunte corresponde
      return `
        <li data-id="${apunte.id}">
          <div class="apunte-reciente-info">
            <strong class="apunte-reciente-titulo">${titulo}</strong>
            <span class="apunte-reciente-curso">${curso}</span>
          </div>
        </li>`;
    })
    .join('');

  // 4. Añadimos el event listener para manejar los clics (una sola vez)
  // Removemos primero para evitar duplicados si la función se llama varias veces
  lista.removeEventListener('click', handleApunteRecienteClick);
  lista.addEventListener('click', handleApunteRecienteClick);
}

/**
 * Maneja el clic en un elemento de la lista de apuntes recientes.
 * Navega a la página de apuntes y selecciona el apunte correspondiente.
 * @param {Event} event - El evento de clic.
 */
function handleApunteRecienteClick(event) {
  const apunteLi = event.target.closest('li[data-id]');
  if (!apunteLi) return; // Si el clic no fue en un <li> con data-id, salimos

  const apunteId = parseInt(apunteLi.dataset.id, 10);

  // Guardamos el ID del apunte seleccionado en el estado global
  // Necesitarás asegurarte de que la página de apuntes use este ID al inicializar
  state.apunteActivold = apunteId;
  guardarDatos(); // Guardamos el estado para que se recuerde al cambiar de página

  // Navegamos a la página de apuntes
  cambiarPagina('apuntes');
}

/**
 * Renderiza el widget con el progreso de los proyectos.
 */
function renderizarWidgetProgresoProyectos() {
  const lista = document.getElementById('widget-proyectos-lista');
  if (!lista) return;

  // 1. Decidimos qué proyectos mostrar (ej: los primeros 3 o todos)
  //    Podríamos ordenarlos por fecha de creación, modificación, etc. si quisiéramos.
  //    Por ahora, mostramos hasta 5 proyectos tal como están en el state.
  const proyectosAMostrar = state.proyectos.slice(0, 5);

  // 2. Generamos el HTML o mostramos mensaje si no hay proyectos
  if (proyectosAMostrar.length === 0) {
    lista.innerHTML =
      '<li><p>Crea tu primer proyecto para ver su progreso aquí.</p></li>';
    lista.removeEventListener('click', handleProyectoProgresoClick); // Limpiamos listener
    return;
  }

  lista.innerHTML = proyectosAMostrar
    .map((proyecto) => {
      // Calculamos las estadísticas para este proyecto
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

  // 3. Añadimos el event listener para manejar los clics
  lista.removeEventListener('click', handleProyectoProgresoClick); // Evitar duplicados
  lista.addEventListener('click', handleProyectoProgresoClick);
}

/**
 * Maneja el clic en un elemento de la lista de progreso de proyectos.
 * Navega a la página de proyectos y selecciona el proyecto correspondiente.
 * @param {Event} event - El evento de clic.
 */
function handleProyectoProgresoClick(event) {
  const proyectoLi = event.target.closest('li[data-id]');
  if (!proyectoLi) return;

  const proyectoId = parseInt(proyectoLi.dataset.id, 10);

  // Guardamos el ID del proyecto seleccionado en el estado global
  // La página de proyectos deberá usar este ID al inicializarse
  state.proyectoSeleccionadoId = proyectoId;
  guardarDatos();

  // Navegamos a la página de proyectos
  cambiarPagina('proyectos');
}

/**
 * Renderiza el widget con las tareas pendientes cuya fecha ya pasó.
 */
function renderizarWidgetTareasVencidas() {
  const lista = document.getElementById('widget-vencidas-lista');
  if (!lista) return;

  // 1. Obtenemos la fecha de hoy (ignorando la hora)
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // 2. Filtramos las tareas vencidas y no completadas
  const tareasVencidas = state.tareas.filter((t) => {
    // Verificamos que tenga fecha
    if (!t.fecha) return false;

    const fechaTarea = new Date(t.fecha + 'T00:00:00'); // Aseguramos comparar solo fechas
    return !t.completada && fechaTarea < hoy;
  });

  // 3. Ordenamos las tareas vencidas (opcional: de más antigua a más reciente)
  tareasVencidas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  // 4. Generamos el HTML o mostramos mensaje si no hay tareas vencidas
  if (tareasVencidas.length === 0) {
    lista.innerHTML =
      '<li><p>¡Felicidades! No tienes tareas vencidas.</p></li>';
    lista.removeEventListener('click', handleTareaVencidaClick); // Limpiamos listener
    return;
  }

  lista.innerHTML = tareasVencidas
    .map((tarea) => {
      const curso = tarea.curso || 'General';

      // Añadimos data-id al <li>
      return `
        <li data-id="${tarea.id}">
          <div class="tarea-vencida-info">
            <strong class="tarea-vencida-titulo">${tarea.titulo}</strong>
            <span class="tarea-vencida-curso">${curso}</span>
          </div>
        </li>`;
    })
    .join('');

  // 5. Añadimos el event listener para manejar los clics
  lista.removeEventListener('click', handleTareaVencidaClick);
  lista.addEventListener('click', handleTareaVencidaClick);
}

/**
 * Maneja el clic en un elemento de la lista de tareas vencidas.
 * Navega a la página de tareas y selecciona la tarea correspondiente.
 * @param {Event} event - El evento de clic.
 */
function handleTareaVencidaClick(event) {
  const tareaLi = event.target.closest('li[data-id]');
  if (!tareaLi) return;

  const tareaId = parseInt(tareaLi.dataset.id, 10);

  // Guardamos el ID de la tarea seleccionada en el estado global
  // La página de tareas deberá usar este ID al inicializar
  state.tareaSeleccionadaId = tareaId;
  guardarDatos();

  // Navegamos a la página de tareas
  cambiarPagina('tareas');
}
