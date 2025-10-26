export let state = {
  cursos: [
    {
      id: 1, // ID estable para el curso por defecto
      nombre: 'General',
      emoji: null,
      isArchivado: false,
    },
  ],
  tareas: [],
  eventos: [],
  apuntes: [],
  proyectos: [],
  cursoSeleccionadoId: null,
  proyectoSeleccionadoId: null,
  apunteSeleccionadoId: null, // <-- AÑADIDO: Para navegación a apuntes
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
      vencida: '#333333',
      hoy: '#e74c3c',
      manana: '#f39c12',
      cercana: '#2ecc71',
      lejana: 'rgba(128, 128, 128, 0.3)',
      vencidaFondoColor: '#e74c3c',
      vencidaFondoOpacidad: 0.08,
    },
  },
  paginaActual: 'dashboard',
  tareaSeleccionadald: null, // Nota: tienes un typo aquí ('ld' al final)
  ordenamiento: { col: 'fecha', reverse: false },
  filtroCurso: 'todos',
  filtroCursoApuntes: 'todos',
  filtroProyecto: 'todos',
  tareasEnModoSeleccion: false,
  tareasSeleccionadasIds: [],
  apuntesEnModoSeleccion: false,
  apuntesSeleccionadosIds: [],
};
