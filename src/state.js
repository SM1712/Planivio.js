export let state = {
  cursos: ['General'],
  tareas: [],
  eventos: [],
  apuntes: [],
  config: { theme: 'light', accent_color: '#0078d7' },
  paginaActual: 'tareas',
  tareaSeleccionadald: null,
  ordenamiento: { col: 'fecha', reverse: false },
  filtroCurso: 'todos',
  filtroCursoApuntes: 'todos',
  apuntesEnModoSeleccion: false,
  apuntesSeleccionadosIds: [],
};
