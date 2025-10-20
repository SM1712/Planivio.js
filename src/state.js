export let state = {
  cursos: ['General'],
  tareas: [],
  eventos: [],
  apuntes: [],
  proyectos: [],
  proyectoSeleccionadoId: null,
  config: {
    theme: 'light',
    accent_color: '#0078d7',
    userName: null,
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
      vencida: '#333333', // Era el color de fondo para .tarea-vencida .muesca-vencimiento
      hoy: '#e74c3c', // Rojo
      manana: '#f39c12', // Naranja
      cercana: '#2ecc71', // Verde
      lejana: 'rgba(128, 128, 128, 0.3)', // Gris translúcido (lo mantendremos así por defecto)
      vencidaFondoColor: '#e74c3c', // Color base (rojo por defecto)
      vencidaFondoOpacidad: 0.08, // Opacidad (8% por defecto)
    },
  },
  paginaActual: 'dashboard',
  tareaSeleccionadald: null,
  ordenamiento: { col: 'fecha', reverse: false },
  filtroCurso: 'todos',
  filtroCursoApuntes: 'todos',
  filtroProyecto: 'todos',
  tareasEnModoSeleccion: false, // Rastrea si el modo selección está activo
  tareasSeleccionadasIds: [], // Array de IDs de tareas seleccionadas
  apuntesEnModoSeleccion: false,
  apuntesSeleccionadosIds: [],
};
