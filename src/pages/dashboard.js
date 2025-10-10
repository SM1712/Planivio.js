import { state } from '../state.js';

/**
 * Función principal que actualiza todos los widgets del dashboard.
 */
export function actualizarDashboard() {
  renderizarWidgetEnfoque();
  renderizarWidgetProximamente();
  actualizarWidgetProgreso();
}

/**
 * Renderiza el widget "Enfoque del Día".
 */
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
    </li>
  `,
    )
    .join('');
}

/**
 * Renderiza el widget "Próximamente".
 */
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
      const [_, month, day] = t.fecha.split('-');
      const fechaFormateada = `${day}/${month}`;
      return `
      <li class="widget-task-item">
        <span class="prioridad-indicador prioridad-${t.prioridad.toLowerCase()}"></span>
        <div class="widget-task-info">
          <strong class="widget-task-title">${t.titulo}</strong>
          <span class="widget-task-meta">${t.curso} - Entrega: ${fechaFormateada}</span>
        </div>
      </li>
    `;
    })
    .join('');
}

/**
 * Actualiza el contador del widget "Progreso Semanal".
 */
function actualizarWidgetProgreso() {
  const contador = document.getElementById('widget-progreso-contador');
  if (!contador) return;

  const tareasCompletadas = state.tareas.filter((t) => t.completada).length;
  contador.textContent = tareasCompletadas;
}
