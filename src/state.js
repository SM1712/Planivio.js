export let state = {
  cursos: ['General'],
  tareas: [],
  eventos: [], // <-- AÑADE ESTA LÍNEA
  config: { theme: 'light', accent_color: '#0078d7' },
  paginaActual: 'tareas',
  tareaSeleccionadaId: null,
  ordenamiento: { col: 'fecha', reverse: false },
  filtroCurso: 'todos',
};
