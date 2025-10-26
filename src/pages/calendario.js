import { state } from '../state.js';
import { guardarDatos } from '../utils.js';
import {
  mostrarConfirmacion,
  mostrarModal,
  cerrarModal,
  popularSelectorDeCursos, // Ya estaba aquí
  popularSelectorDeProyectos,
  cargarIconos,
} from '../ui.js';
import { ICONS } from '../icons.js';
import { abrirModalNuevaTarea } from './dashboard.js';
import { cambiarPagina } from '../main.js';

// ... (generarEventosRecurrentes y otras funciones SIN CAMBIOS) ...
export function generarEventosRecurrentes(
  eventosBase,
  fechaInicioVisible,
  fechaFinVisible,
) {
  const eventosExpandidos = [];
  const LIMITE_RECURRENCIA = 365;
  const inicioVisible = new Date(fechaInicioVisible.getTime());
  const finVisible = new Date(fechaFinVisible.getTime());

  eventosBase.forEach((eventoOriginal) => {
    eventosExpandidos.push(eventoOriginal);
    const regla = eventoOriginal.recurrencia;
    if (!regla || !regla.tipo || regla.tipo === 'nunca') {
      return;
    }
    const fechaFinRegla = regla.fin ? new Date(regla.fin + 'T00:00:00') : null;
    const fechaInicioEvento = new Date(
      eventoOriginal.fechaInicio + 'T00:00:00',
    );
    const fechaFinEvento = new Date(eventoOriginal.fechaFin + 'T00:00:00');
    const duracionEventoMs =
      fechaFinEvento.getTime() - fechaInicioEvento.getTime();
    let proximaFechaInicio = new Date(fechaInicioEvento);

    if (proximaFechaInicio < inicioVisible) {
      if (regla.tipo === 'anual') {
        const anosDiferencia =
          inicioVisible.getFullYear() - proximaFechaInicio.getFullYear();
        if (anosDiferencia > 0) {
          proximaFechaInicio.setFullYear(
            proximaFechaInicio.getFullYear() + anosDiferencia - 1,
          );
        }
      } else if (regla.tipo === 'mensual') {
        const mesesDiferencia =
          (inicioVisible.getFullYear() - proximaFechaInicio.getFullYear()) *
            12 +
          (inicioVisible.getMonth() - proximaFechaInicio.getMonth());
        if (mesesDiferencia > 0) {
          proximaFechaInicio.setMonth(
            proximaFechaInicio.getMonth() + mesesDiferencia - 1,
          );
        }
      }
    }

    let contador = 0;
    while (contador < LIMITE_RECURRENCIA) {
      contador++;
      switch (regla.tipo) {
        case 'diario':
          proximaFechaInicio.setDate(proximaFechaInicio.getDate() + 1);
          break;
        case 'semanal':
          proximaFechaInicio.setDate(proximaFechaInicio.getDate() + 7);
          break;
        case 'quincenal':
          proximaFechaInicio.setDate(proximaFechaInicio.getDate() + 14);
          break;
        case 'mensual':
          proximaFechaInicio.setMonth(proximaFechaInicio.getMonth() + 1);
          if (proximaFechaInicio.getDate() < fechaInicioEvento.getDate()) {
            proximaFechaInicio.setDate(0);
          }
          break;
        case 'anual':
          proximaFechaInicio.setFullYear(proximaFechaInicio.getFullYear() + 1);
          break;
        default:
          return;
      }
      if (fechaFinRegla && proximaFechaInicio > fechaFinRegla) {
        break;
      }
      if (proximaFechaInicio > finVisible) {
        break;
      }
      const proximaFechaFin = new Date(
        proximaFechaInicio.getTime() + duracionEventoMs,
      );
      if (proximaFechaFin >= inicioVisible) {
        eventosExpandidos.push({
          ...eventoOriginal,
          id: `${eventoOriginal.id}-r-${contador}`,
          originalId: eventoOriginal.id,
          fechaInicio: proximaFechaInicio.toISOString().split('T')[0],
          fechaFin: proximaFechaFin.toISOString().split('T')[0],
          esInstanciaRecurrente: true,
          proyectoId: eventoOriginal.proyectoId, // Mantener proyectoId
        });
      }
    }
  });
  return eventosExpandidos;
}
let fechaActual = new Date();
let celdasCache = [];
let renderedEventsCache = [];
let isDragging = false;
let dragStartDate = null;
let dragEndDate = null;
let wasDragging = false;

function agregarEvento(datosEvento) {
  if (
    !datosEvento.titulo ||
    !datosEvento.fechaInicio ||
    !datosEvento.fechaFin
  ) {
    alert('El evento debe tener un título y fechas de inicio y fin.');
    return;
  }
  if (new Date(datosEvento.fechaFin) < new Date(datosEvento.fechaInicio)) {
    alert('La fecha de fin no puede ser anterior a la fecha de inicio.');
    return;
  }
  const nuevoEvento = { id: Date.now(), ...datosEvento };
  state.eventos.push(nuevoEvento);
  guardarDatos();
  renderizarCalendario();
}
function formatFechaDDMMYYYY(fechaStr) {
  try {
    const fecha = new Date(fechaStr + 'T00:00:00');
    if (isNaN(fecha.getTime())) return 'Fecha inválida';
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const ano = fecha.getFullYear();
    return `${dia}/${mes}/${ano}`;
  } catch (e) {
    return 'Fecha inválida';
  }
}
function renderizarEventos() {
  const gridEventos = document.getElementById('calendario-eventos-grid');
  if (!gridEventos || celdasCache.length === 0) return;
  gridEventos.innerHTML = '';
  renderedEventsCache = [];
  for (let i = 0; i < 42; i++) {
    gridEventos.appendChild(document.createElement('div'));
  }
  const Y_OFFSET = 34;
  const LANE_HEIGHT = 8;
  const eventLaneMap = new Map();
  const laneOccupancy = Array(3)
    .fill(null)
    .map(() => Array(42).fill(false));
  const eventosExpandidos = generarEventosRecurrentes(
    state.eventos,
    celdasCache[0].fecha,
    celdasCache[41].fecha,
  );
  const eventosDelMes = eventosExpandidos
    .filter((e) => {
      if (!e.fechaInicio || !e.fechaFin) return false;
      const fin = new Date(e.fechaFin + 'T00:00:00');
      const inicio = new Date(e.fechaInicio + 'T00:00:00');
      return fin >= celdasCache[0].fecha && inicio <= celdasCache[41].fecha;
    })
    .sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio));
  eventosDelMes.forEach((evento) => {
    const inicioEvento = new Date(evento.fechaInicio + 'T00:00:00');
    const finEvento = new Date(evento.fechaFin + 'T00:00:00');
    const startIndexRaw = celdasCache.findIndex(
      (c) => c.fecha.getTime() === inicioEvento.getTime(),
    );
    const endIndexRaw = celdasCache.findIndex(
      (c) => c.fecha.getTime() === finEvento.getTime(),
    );
    const startIndex =
      startIndexRaw === -1 && inicioEvento < celdasCache[0].fecha
        ? 0
        : startIndexRaw;
    const endIndex =
      endIndexRaw === -1 && finEvento > celdasCache[41].fecha
        ? 41
        : endIndexRaw;
    if (startIndex !== -1 && endIndex !== -1) {
      for (let carril = 0; carril < 3; carril++) {
        let isLaneFree = true;
        for (let i = startIndex; i <= endIndex; i++) {
          if (laneOccupancy[carril][i]) {
            isLaneFree = false;
            break;
          }
        }
        if (isLaneFree) {
          for (let i = startIndex; i <= endIndex; i++) {
            laneOccupancy[carril][i] = true;
          }
          eventLaneMap.set(evento.id, carril);
          break;
        }
      }
    }
  });
  for (let i = 0; i < 42; i++) {
    const celdaInfo = celdasCache[i];
    const diaDeLaSemana = i % 7;
    eventosDelMes.forEach((evento) => {
      const carril = eventLaneMap.get(evento.id);
      if (carril === undefined) return;
      const inicioReal = new Date(evento.fechaInicio + 'T00:00:00');
      const inicioSemana = celdasCache[i - diaDeLaSemana].fecha;
      const debeDibujar =
        inicioReal.getTime() === celdaInfo.fecha.getTime() ||
        (diaDeLaSemana === 0 && inicioReal < inicioSemana);
      if (debeDibujar) {
        const finReal = new Date(evento.fechaFin + 'T00:00:00');
        const finSemana = celdasCache[i - diaDeLaSemana + 6].fecha;
        const inicioBarra = new Date(
          Math.max(inicioReal.getTime(), inicioSemana.getTime()),
        );
        const finBarra = new Date(
          Math.min(finReal.getTime(), finSemana.getTime()),
        );
        const startIndexInGrid = celdasCache.findIndex(
          (c) => c.fecha.getTime() === inicioBarra.getTime(),
        );
        const endIndexInGrid = celdasCache.findIndex(
          (c) => c.fecha.getTime() === finBarra.getTime(),
        );
        let duracionEnDias = 1;
        if (startIndexInGrid > -1 && endIndexInGrid > -1) {
          duracionEnDias = endIndexInGrid - startIndexInGrid + 1;
        }
        const eventoDiv = document.createElement('div');
        eventoDiv.className = 'cal-evento-largo';
        eventoDiv.style.backgroundColor = evento.color;
        eventoDiv.style.width = `calc(${duracionEnDias * 100}% - 4px)`;
        eventoDiv.style.top = `${Y_OFFSET + carril * LANE_HEIGHT}px`;
        if (inicioReal.getTime() === inicioBarra.getTime()) {
          eventoDiv.classList.add('evento-inicio');
        }
        if (finReal.getTime() === finBarra.getTime()) {
          eventoDiv.classList.add('evento-fin');
        }
        if (gridEventos.children[startIndexInGrid]) {
          gridEventos.children[startIndexInGrid].appendChild(eventoDiv);
          renderedEventsCache.push({ evento: evento, element: eventoDiv });
        }
      }
    });
  }
}
function renderizarCalendario() {
  const gridFechas = document.getElementById('calendario-grid');
  const mesAnoTitulo = document.getElementById('cal-mes-ano');
  if (!gridFechas || !mesAnoTitulo) return;
  const mes = fechaActual.getMonth();
  const ano = fechaActual.getFullYear();
  const nombreMes = new Date(ano, mes).toLocaleString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
  mesAnoTitulo.textContent =
    nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
  gridFechas.innerHTML = '';
  celdasCache = [];
  const primerDiaDelMes = new Date(ano, mes, 1).getDay();
  const diasEnMes = new Date(ano, mes + 1, 0).getDate();
  const offset = primerDiaDelMes === 0 ? 6 : primerDiaDelMes - 1;
  for (let i = 0; i < 42; i++) {
    const dia = i - offset + 1;
    celdasCache.push({
      fecha: new Date(ano, mes, dia),
      dia,
      esMesActual: dia > 0 && dia <= diasEnMes,
      index: i,
    });
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // === INICIO MODIFICACIÓN ===
  // Carga los cursos archivados UNA VEZ para optimizar
  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );
  // ==========================

  celdasCache.forEach((celdaInfo) => {
    const celda = document.createElement('div');
    const fechaStr = celdaInfo.fecha.toISOString().split('T')[0];
    celda.dataset.fecha = fechaStr;
    if (!celdaInfo.esMesActual) {
      // ... (lógica día fantasma sin cambios) ...
      const diasEnMesAnterior = new Date(ano, mes, 0).getDate();
      celda.classList.add('dia-fantasma');
      const diaFantasma =
        celdaInfo.index < offset
          ? diasEnMesAnterior - offset + 1 + celdaInfo.index
          : celdaInfo.dia - diasEnMes;
      celda.innerHTML = `<span class="dia-numero">${diaFantasma}</span>`;
    } else {
      celda.classList.add('dia-mes');
      celda.innerHTML = `<span class="dia-numero">${celdaInfo.dia}</span>`;
      if (celdaInfo.fecha.getTime() === hoy.getTime()) {
        celda.classList.add('dia-hoy');
      }

      // === INICIO MODIFICACIÓN ===
      // Filtrar tareas del día EXCLUYENDO las de cursos archivados
      const tareasDelDia = state.tareas.filter(
        (t) =>
          t.fecha === fechaStr &&
          !t.completada &&
          !cursosArchivadosNombres.has(t.curso), // <-- AÑADIDO ESTO
      );
      // ==========================

      if (tareasDelDia.length > 0) {
        // ... (lógica para dibujar puntos sin cambios) ...
        const puntosContainer = document.createElement('div');
        puntosContainer.className = 'cal-puntos-container';
        const prioridades = { Alta: [], Media: [], Baja: [] };
        tareasDelDia.forEach((t) => prioridades[t.prioridad]?.push(t));
        ['Alta', 'Media', 'Baja'].forEach((prioridad) => {
          if (prioridades[prioridad].length > 0) {
            const filaPrioridadDiv = document.createElement('div');
            filaPrioridadDiv.className = 'cal-prioridad-fila';
            prioridades[prioridad].slice(0, 3).forEach((tarea) => {
              const puntoDiv = document.createElement('div');
              const priorityClass = `prioridad-${prioridad.toLowerCase()}`;
              puntoDiv.className = `cal-evento-tarea ${priorityClass}`;
              puntoDiv.title = `${prioridad}: ${tarea.titulo}`;
              filaPrioridadDiv.appendChild(puntoDiv);
            });
            puntosContainer.appendChild(filaPrioridadDiv);
          }
        });
        celda.appendChild(puntosContainer);
      }
    }
    gridFechas.appendChild(celda);
  });
  renderizarEventos(); // Llama a renderizar eventos largos
  mostrarResumenMes(mes, ano); // Llama a actualizar el panel lateral
}
function mostrarResumenMes(mes, ano) {
  const resumenTitulo = document.getElementById('resumen-titulo');
  const resumenContenido = document.getElementById('resumen-contenido');
  if (!resumenTitulo || !resumenContenido) return;
  const nombreMes = new Date(ano, mes).toLocaleString('es-ES', {
    month: 'long',
  });
  resumenTitulo.innerHTML = `Resumen de ${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}`;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );
  const tareasDelMes = state.tareas.filter(
    (t) =>
      new Date(t.fecha).getMonth() === mes &&
      new Date(t.fecha).getFullYear() === ano &&
      !t.completada &&
      !cursosArchivadosNombres.has(t.curso), // <-- AÑADIDO ESTO
  );
  const inicioDelMes = new Date(ano, mes, 1);
  const finDelMes = new Date(ano, mes + 1, 0);
  const eventosExpandidos = generarEventosRecurrentes(
    state.eventos,
    inicioDelMes,
    finDelMes,
  );
  const eventosDelMes = eventosExpandidos.filter((e) => {
    const inicio = new Date(e.fechaInicio + 'T00:00:00');
    const fin = new Date(e.fechaFin + 'T00:00:00');
    return fin >= inicioDelMes && inicio <= finDelMes;
  });
  if (tareasDelMes.length === 0 && eventosDelMes.length === 0) {
    resumenContenido.innerHTML =
      '<p>Felicidades, no tienes nada programado para este mes. :D</p>';
    return;
  }
  let html = '';
  if (eventosDelMes.length > 0) {
    html += '<h4 class="resumen-curso-titulo">Eventos del Mes</h4>';
    html += '<ul class="resumen-curso-lista">';
    eventosDelMes
      .sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio))
      .forEach((evento) => {
        const inicioStr = formatFechaDDMMYYYY(evento.fechaInicio);
        const finStr = formatFechaDDMMYYYY(evento.fechaFin);
        const fechaStr =
          inicioStr === finStr ? inicioStr : `${inicioStr} - ${finStr}`;
        const proyecto = evento.proyectoId
          ? state.proyectos.find(
              (p) => String(p.id) === String(evento.proyectoId),
            )
          : null;
        const proyectoNombre = proyecto ? proyecto.nombre : null;
        const inicio = new Date(evento.fechaInicio + 'T00:00:00');
        const fin = new Date(evento.fechaFin + 'T00:00:00');
        const esHoy = hoy >= inicio && hoy <= fin;
        const claseHoyString = esHoy ? 'item-hoy' : '';
        html += `<li class="${claseHoyString}">
                 <span class="prioridad-indicador" style="background-color: ${evento.color};"></span>
                 <div class="resumen-item-texto">
                 <span>${evento.titulo}</span>
                 <span class="resumen-fecha-evento">${fechaStr}</span>
                 ${evento.curso ? `<span class="resumen-item-curso">Curso: ${evento.curso}</span>` : ''}
                 ${proyectoNombre ? `<span class="resumen-item-proyecto">Proyecto: ${proyectoNombre}</span>` : ''}
                  </div>
                 <button class="btn-editar-resumen" data-event-id="${evento.originalId || evento.id}" title="Editar Evento">
                   ${ICONS.edit || 'Editar'}
                 </button>
               </li>`;
      });
    html += '</ul>';
  }
  if (tareasDelMes.length > 0) {
    const tareasAgrupadas = tareasDelMes
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .reduce((acc, tarea) => {
        if (!acc[tarea.curso]) acc[tarea.curso] = [];
        acc[tarea.curso].push(tarea);
        return acc;
      }, {});
    html += '<h4 class="resumen-curso-titulo">Tareas del Mes</h4>';
    for (const curso in tareasAgrupadas) {
      html += `<h5 class="resumen-subtitulo">${curso}</h5>`;
      html += '<ul class="resumen-curso-lista">';
      tareasAgrupadas[curso].forEach((tarea) => {
        const fecha = new Date(tarea.fecha + 'T00:00:00');
        const opts = { weekday: 'long', day: 'numeric' };
        let fechaStr = 'Fecha inválida';
        if (!isNaN(fecha.getTime())) {
          fechaStr = fecha.toLocaleDateString('es-ES', opts);
        }
        const esHoy =
          !isNaN(fecha.getTime()) && fecha.getTime() === hoy.getTime();
        const claseHoyString = esHoy ? 'item-hoy' : '';
        html += `<li class="${claseHoyString} tarea-item-resumen" data-task-id="${tarea.id}">
                    <span class="prioridad-indicador prioridad-${tarea.prioridad.toLowerCase()}"></span>
                    <div class="resumen-tarea-info-wrapper">
                       <span class="resumen-tarea-titulo">${tarea.titulo}</span>
                       <span class="resumen-tarea-meta">${fechaStr}</span>
                    </div>
                 </li>`;
      });
      html += '</ul>';
    }
  }
  resumenContenido.innerHTML = html;
}
function mostrarResumenDia(fecha) {
  const resumenTitulo = document.getElementById('resumen-titulo');
  const resumenContenido = document.getElementById('resumen-contenido');
  if (!resumenTitulo || !resumenContenido) {
    console.error('Error: Faltan elementos del DOM en mostrarResumenDia');
    return;
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaStr = fecha.toISOString().split('T')[0];
  const diaFormateado = fecha.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
  });
  const cursosArchivadosNombres = new Set(
    state.cursos.filter((c) => c.isArchivado).map((c) => c.nombre),
  );
  const tareasDelDia = state.tareas.filter(
    (t) =>
      t.fecha === fechaStr &&
      !t.completada &&
      !cursosArchivadosNombres.has(t.curso), // <-- AÑADIDO ESTO
  );
  const eventosExpandidos = generarEventosRecurrentes(
    state.eventos,
    fecha,
    fecha,
  );
  const eventosDelDia = eventosExpandidos.filter(
    (e) => fechaStr >= e.fechaInicio && fechaStr <= e.fechaFin,
  );
  resumenTitulo.innerHTML = `
    <span>Detalles del ${diaFormateado}</span>
      <div class="resumen-dia-acciones">
        <button id="btn-agregar-rapido-dia" class="btn-accent-ghost">+</button>
      </div>
  `;
  let btnCerrar = resumenTitulo.querySelector('#btn-cerrar-resumen-dia');
  if (!btnCerrar) {
    btnCerrar = document.createElement('button');
    btnCerrar.id = 'btn-cerrar-resumen-dia';
    btnCerrar.className = 'btn-cerrar-panel btn-icon';
    resumenTitulo.appendChild(btnCerrar);
  }
  btnCerrar.innerHTML = ICONS.close || 'X';
  if (!resumenTitulo.contains(btnCerrar)) {
    resumenTitulo.appendChild(btnCerrar);
  }

  if (tareasDelDia.length === 0 && eventosDelDia.length === 0) {
    resumenContenido.innerHTML =
      '<p>Felicidades, no tienes eventos ni tareas pendientes para este día. :D</p>';
    return;
  }
  let html = '';
  if (eventosDelDia.length > 0) {
    html +=
      '<h4 class="resumen-curso-titulo">Eventos</h4><ul class="resumen-curso-lista">';
    eventosDelDia.forEach((evento) => {
      const proyecto = evento.proyectoId
        ? state.proyectos.find((p) => String(p.id) == String(evento.proyectoId))
        : null;
      const proyectoNombre = proyecto ? proyecto.nombre : null;
      const idParaAccion = evento.originalId || evento.id;
      html += `<li>
               <span class="prioridad-indicador" style="background-color: ${evento.color};"></span>
               <div class="resumen-item-texto">
                 <span>${evento.titulo}</span>
                 ${evento.descripcion ? `<span class="resumen-item-descripcion">${evento.descripcion}</span>` : ''}
                 ${evento.curso ? `<span class="resumen-item-curso">Curso: ${evento.curso}</span>` : ''}
                 ${proyectoNombre ? `<span class="resumen-item-proyecto">Proyecto: ${proyectoNombre}</span>` : ''}
               </div>
               <button class="btn-editar-resumen" data-event-id="${idParaAccion}" title="Editar Evento">
                 ${ICONS.edit || 'Editar'}
               </button>
             </li>`;
    });
    html += '</ul>';
  }
  if (tareasDelDia.length > 0) {
    html += '<h4 class="resumen-curso-titulo">Tareas</h4>';
    const tareasAgrupadas = tareasDelDia
      .sort((a, b) => {
        const orden = { Alta: 0, Media: 1, Baja: 2 };
        return (orden[a.prioridad] ?? 3) - (orden[b.prioridad] ?? 3);
      })
      .reduce((acc, tarea) => {
        const cursoKey = tarea.curso || 'General';
        if (!acc[cursoKey]) acc[cursoKey] = [];
        acc[cursoKey].push(tarea);
        return acc;
      }, {});
    for (const curso in tareasAgrupadas) {
      if (Object.keys(tareasAgrupadas).length > 1 || curso !== 'General') {
        html += `<h5 class="resumen-subtitulo">${curso}</h5>`;
      }
      html += '<ul class="resumen-curso-lista">';
      tareasAgrupadas[curso].forEach((tarea) => {
        html += `<li class=" tarea-item-resumen" data-task-id="${tarea.id}">
                      <span class="prioridad-indicador prioridad-${tarea.prioridad.toLowerCase()}"></span>
                      <div class="resumen-tarea-info-wrapper">
                         <span class="resumen-tarea-titulo">${tarea.titulo}</span>
                      </div>
                   </li>`;
      });
      html += '</ul>';
    }
  }
  resumenContenido.innerHTML = html;
}

/**
 * ACTUALIZADO: Inicia la edición o creación de un evento.
 * @param {object} evento - El objeto del evento a editar, o un objeto con { fechaInicio, fechaFin } para uno nuevo.
 * @param {string | null} cursoPreseleccionado - El nombre del curso a pre-seleccionar (opcional).
 */
export function iniciarEdicionEvento(evento, cursoPreseleccionado = null) {
  const modalTitulo = document.getElementById('modal-evento-titulo');
  const btnGuardar = document.getElementById('btn-guardar-evento');
  const inputId = document.getElementById('input-evento-id');
  const inputTitulo = document.getElementById('input-evento-titulo');
  const inputInicio = document.getElementById('input-evento-inicio');
  const inputFin = document.getElementById('input-evento-fin');
  const inputColor = document.getElementById('input-evento-color');
  const inputColorCustom = document.getElementById('input-evento-color-custom');
  const inputDescripcion = document.getElementById('input-evento-descripcion');
  const selectProyecto = document.getElementById('select-evento-proyecto');
  const selectCurso = document.getElementById('select-evento-curso');
  const selectRecurrencia = document.getElementById(
    'evento-select-recurrencia',
  );
  const inputFinRecurrencia = document.getElementById(
    'evento-input-fin-recurrencia',
  );
  const containerFinRecurrencia = document.getElementById(
    'evento-fin-recurrencia-container',
  );
  const paleta = document.getElementById('evento-color-palette');

  // Rellenar campos básicos
  if (modalTitulo)
    modalTitulo.textContent = evento.id
      ? 'Editar Evento'
      : 'Agregar Nuevo Evento';
  if (btnGuardar)
    btnGuardar.textContent = evento.id ? 'Actualizar Evento' : 'Guardar Evento';
  if (inputId) inputId.value = evento.id || '';
  if (inputTitulo) inputTitulo.value = evento.titulo || '';
  if (inputInicio) inputInicio.value = evento.fechaInicio;
  if (inputFin) inputFin.value = evento.fechaFin;
  if (inputColor) inputColor.value = evento.color || '#3498db';
  if (inputColorCustom) inputColorCustom.value = evento.color || '#3498db';
  if (inputDescripcion) inputDescripcion.value = evento.descripcion || '';

  // Popular y seleccionar Proyecto
  if (selectProyecto) {
    popularSelectorDeProyectos('select-evento-proyecto');
    selectProyecto.value = evento.proyectoId || '';
  }

  // Popular y seleccionar Curso (usando el preseleccionado si existe)
  if (selectCurso) {
    popularSelectorDeCursos(selectCurso, true); // Popula omitiendo 'General'
    // Prioridad: 1. Curso del evento existente, 2. Curso preseleccionado, 3. Vacío
    selectCurso.value = evento.curso || cursoPreseleccionado || '';
  }

  // Rellenar campos de Recurrencia
  if (selectRecurrencia && inputFinRecurrencia && containerFinRecurrencia) {
    if (evento.recurrencia) {
      selectRecurrencia.value = evento.recurrencia.tipo || 'nunca';
      inputFinRecurrencia.value = evento.recurrencia.fin || '';
    } else {
      selectRecurrencia.value = 'nunca';
      inputFinRecurrencia.value = '';
    }
    containerFinRecurrencia.classList.toggle(
      'hidden',
      selectRecurrencia.value === 'nunca',
    );
  }

  // Marcar color activo en la paleta
  if (paleta) {
    paleta
      .querySelectorAll('.color-swatch')
      .forEach((s) => s.classList.remove('active'));
    const swatchExistente = paleta.querySelector(
      `.color-swatch[data-color="${evento.color || '#3498db'}"]`,
    );
    if (swatchExistente) {
      swatchExistente.classList.add('active');
    }
  }

  mostrarModal('modal-nuevo-evento');
}

// ... (mostrarDetallesEvento, abrirMenuAccionRapida, actualizarSeleccionArrastre, limpiarSeleccionArrastre, inicializarCalendario SIN CAMBIOS) ...
function mostrarDetallesEvento(evento) {
  const titulo = document.getElementById('evento-detalles-titulo');
  const colorIndicator = document.getElementById('evento-detalles-color');
  const fechas = document.getElementById('evento-detalles-fechas');
  const btnEditar = document.getElementById('btn-editar-evento');
  const btnEliminar = document.getElementById('btn-eliminar-evento');
  if (titulo) titulo.textContent = evento.titulo;
  if (colorIndicator) colorIndicator.style.backgroundColor = evento.color;
  const inicio = new Date(evento.fechaInicio + 'T00:00:00');
  const fin = new Date(evento.fechaFin + 'T00:00:00');
  const opts = { day: 'numeric', month: 'long', year: 'numeric' };
  if (fechas)
    fechas.textContent = `${inicio.toLocaleDateString('es-ES', opts)} - ${fin.toLocaleDateString('es-ES', opts)}`;
  const idParaAccion = evento.originalId || evento.id;
  if (btnEditar)
    btnEditar.onclick = () => {
      cerrarModal('modal-evento-detalles');
      const eventoOriginal = state.eventos.find((e) => e.id === idParaAccion);
      if (eventoOriginal) {
        iniciarEdicionEvento(eventoOriginal);
      }
    };
  if (btnEliminar)
    btnEliminar.onclick = () => {
      cerrarModal('modal-evento-detalles');
      const eventoOriginal = state.eventos.find((e) => e.id === idParaAccion);
      const titulo = eventoOriginal ? eventoOriginal.titulo : evento.titulo;
      setTimeout(() => {
        mostrarConfirmacion(
          'Eliminar Evento',
          `¿Seguro que quieres eliminar "${titulo}" y todas sus repeticiones? Esta acción eliminará la cadena completa.`,
          () => {
            state.eventos = state.eventos.filter((e) => e.id !== idParaAccion);
            guardarDatos();
            renderizarCalendario();
          },
        );
      }, 200);
    };
  mostrarModal('modal-evento-detalles');
}
function abrirMenuAccionRapida(celda) {
  const fecha = celda.dataset.fecha;
  const fechaObj = new Date(fecha + 'T00:00:00');
  const titulo = document.getElementById('accion-rapida-titulo');
  const inputFecha = document.getElementById('accion-rapida-fecha');
  if (titulo)
    titulo.textContent = fechaObj.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
    });
  if (inputFecha) inputFecha.value = fecha;
  mostrarModal('modal-accion-rapida');
}
function actualizarSeleccionArrastre() {
  limpiarSeleccionArrastre();
  if (!dragStartDate || !dragEndDate) return;
  const start = new Date(dragStartDate + 'T00:00:00');
  const end = new Date(dragEndDate + 'T00:00:00');
  const rangeStart = new Date(Math.min(start.getTime(), end.getTime()));
  const rangeEnd = new Date(Math.max(start.getTime(), end.getTime()));
  for (
    let d = new Date(rangeStart);
    d <= rangeEnd;
    d.setDate(d.getDate() + 1)
  ) {
    const fechaStr = d.toISOString().split('T')[0];
    const celda = document.querySelector(
      `#calendario-grid .dia-mes[data-fecha="${fechaStr}"]`,
    );
    if (celda) celda.classList.add('selection-range');
  }
}
function limpiarSeleccionArrastre() {
  document
    .querySelectorAll('#calendario-grid .selection-range')
    .forEach((c) => c.classList.remove('selection-range'));
}
export function inicializarCalendario() {
  cargarIconos();
  renderizarCalendario();
  const btnPrev = document.getElementById('cal-btn-prev');
  if (btnPrev && !btnPrev.dataset.initialized) {
    btnPrev.addEventListener('click', () => {
      fechaActual.setMonth(fechaActual.getMonth() - 1);
      renderizarCalendario();
    });
    btnPrev.dataset.initialized = 'true';
  }
  const btnNext = document.getElementById('cal-btn-next');
  if (btnNext && !btnNext.dataset.initialized) {
    btnNext.addEventListener('click', () => {
      fechaActual.setMonth(fechaActual.getMonth() + 1);
      renderizarCalendario();
    });
    btnNext.dataset.initialized = 'true';
  }
  const btnNuevoEvento = document.getElementById('btn-nuevo-evento');
  if (btnNuevoEvento && !btnNuevoEvento.dataset.initialized) {
    btnNuevoEvento.addEventListener('click', () => {
      const form = document.getElementById('form-nuevo-evento');
      if (form) form.reset();
      const today = new Date().toISOString().split('T')[0];
      iniciarEdicionEvento({ fechaInicio: today, fechaFin: today });
    });
    btnNuevoEvento.dataset.initialized = 'true';
  }
  const gridFechas = document.getElementById('calendario-grid');
  if (gridFechas) {
    gridFechas.addEventListener('click', (e) => {
      const esMovil = window.innerWidth <= 900;
      if (wasDragging) {
        return;
      }
      const celda = e.target.closest('.dia-mes');
      if (!celda) {
        wasDragging = false;
        return;
      }
      e.stopPropagation();
      const clickX = e.clientX;
      const clickY = e.clientY;
      let eventoClicado = null;
      for (const cachedItem of renderedEventsCache) {
        const rect = cachedItem.element.getBoundingClientRect();
        if (
          clickX >= rect.left &&
          clickX <= rect.right &&
          clickY >= rect.top &&
          clickY <= rect.bottom
        ) {
          eventoClicado = cachedItem.evento;
          break;
        }
      }
      if (eventoClicado) {
        mostrarDetallesEvento(eventoClicado);
      } else {
        e.stopPropagation();
        if (esMovil) {
          document.body.classList.add('resumen-movil-visible');
          const celdaInfo = celdasCache.find(
            (c) => c.fecha.toISOString().split('T')[0] === celda.dataset.fecha,
          );
          if (celdaInfo) mostrarResumenDia(celdaInfo.fecha);
          document
            .querySelectorAll('#calendario-grid .dia-mes.dia-seleccionado')
            .forEach((c) => c.classList.remove('dia-seleccionado'));
          celda.classList.add('dia-seleccionado');
        } else {
          document
            .querySelectorAll('#calendario-grid .dia-mes.dia-seleccionado')
            .forEach((c) => c.classList.remove('dia-seleccionado'));
          celda.classList.add('dia-seleccionado');
          const celdaInfo = celdasCache.find(
            (c) => c.fecha.toISOString().split('T')[0] === celda.dataset.fecha,
          );
          if (celdaInfo) {
            mostrarResumenDia(celdaInfo.fecha);
          }
        }
      }
      wasDragging = false;
    });
    gridFechas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const celda = e.target.closest('.dia-mes');
      if (!celda) return;
      isDragging = true;
      wasDragging = false;
      dragStartDate = celda.dataset.fecha;
      dragEndDate = celda.dataset.fecha;
      actualizarSeleccionArrastre();
      e.preventDefault();
    });
    gridFechas.addEventListener('mouseover', (e) => {
      if (!isDragging) return;
      const celda = e.target.closest('.dia-mes');
      if (!celda) return;
      if (celda.dataset.fecha !== dragEndDate) {
        wasDragging = true;
        dragEndDate = celda.dataset.fecha;
        actualizarSeleccionArrastre();
      }
    });
    gridFechas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const celda = e.target.closest('.dia-mes');
      if (celda) {
        const fechaStr = celda.dataset.fecha;
        const modalChooser = document.getElementById('modal-chooser-crear');
        if (modalChooser && fechaStr) {
          modalChooser.dataset.fechaSeleccionada = fechaStr;
          mostrarModal('modal-chooser-crear');
        }
      }
    });
  }
  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    if (wasDragging) {
      const start = new Date(dragStartDate);
      const end = new Date(dragEndDate);
      iniciarEdicionEvento({
        fechaInicio: start < end ? dragStartDate : dragEndDate,
        fechaFin: start < end ? dragEndDate : dragStartDate,
      });
    }
    isDragging = false;
    wasDragging = false;
    limpiarSeleccionArrastre();
  });
  const panelResumen = document.getElementById('calendario-resumen');
  if (panelResumen) {
    panelResumen.addEventListener('click', (e) => {
      const esMovil = window.innerWidth <= 900;
      if (e.target.closest('#btn-cerrar-resumen-dia')) {
        if (esMovil) {
          document.body.classList.remove('resumen-movil-visible');
        } else {
          mostrarResumenMes(fechaActual.getMonth(), fechaActual.getFullYear());
        }
      }
      if (e.target.closest('#btn-agregar-rapido-dia')) {
        const fechaStr = document.querySelector(
          '#calendario-grid .dia-mes.dia-seleccionado',
        )?.dataset.fecha;
        const modalChooser = document.getElementById('modal-chooser-crear');
        if (modalChooser && fechaStr) {
          modalChooser.dataset.fechaSeleccionada = fechaStr;
          mostrarModal('modal-chooser-crear');
        }
      } else if (e.target.closest('.tarea-item-resumen')) {
        const tareaItem = e.target.closest('.tarea-item-resumen');
        const tareaId = tareaItem.dataset.taskId;
        if (tareaId) {
          state.tareaSeleccionadald = parseInt(tareaId);
          guardarDatos();
          cambiarPagina('tareas');
        }
      } else if (e.target.closest('.btn-editar-resumen')) {
        const btn = e.target.closest('.btn-editar-resumen');
        const eventId = btn.dataset.eventId;
        const eventoOriginal = state.eventos.find(
          (ev) => ev.id === parseInt(eventId),
        );
        if (eventoOriginal) {
          iniciarEdicionEvento(eventoOriginal);
        }
      }
    });
  }
  panelResumen.addEventListener('dblclick', (e) => {
    const tareaItem = e.target.closest('.tarea-item-resumen');
    if (!tareaItem) return;
    const tareaId = tareaItem.dataset.taskId;
    const tarea = state.tareas.find((t) => t.id == tareaId);
    if (tarea) {
      mostrarConfirmacion(
        'Completar Tarea',
        `¿Marcar "${tarea.titulo}" como completada?`,
        () => {
          tarea.completada = true;
          guardarDatos();
          renderizarCalendario();
        },
      );
    }
  });
  const formNuevoEvento = document.getElementById('form-nuevo-evento');
  if (formNuevoEvento) {
    formNuevoEvento.addEventListener('submit', (e) => {
      e.preventDefault();
      const datosEvento = {
        titulo: document.getElementById('input-evento-titulo').value.trim(),
        fechaInicio: document.getElementById('input-evento-inicio').value,
        fechaFin: document.getElementById('input-evento-fin').value,
        color: document.getElementById('input-evento-color').value,
        recurrencia: {
          tipo: document.getElementById('evento-select-recurrencia').value,
          fin:
            document.getElementById('evento-input-fin-recurrencia').value ||
            null,
        },
        curso: document.getElementById('select-evento-curso').value || null,
        descripcion: document
          .getElementById('input-evento-descripcion')
          .value.trim(),
        proyectoId:
          document.getElementById('select-evento-proyecto').value || null,
      };
      const eventoId = parseInt(
        document.getElementById('input-evento-id').value,
      );
      if (eventoId) {
        const index = state.eventos.findIndex((ev) => ev.id === eventoId);
        if (index !== -1) {
          state.eventos[index] = { ...state.eventos[index], ...datosEvento };
          guardarDatos();
          renderizarCalendario();
        }
      } else {
        agregarEvento(datosEvento);
      }
      cerrarModal('modal-nuevo-evento');
    });
  }
  const paleta = document.getElementById('evento-color-palette');
  const inputColorOculto = document.getElementById('input-evento-color');
  const inputColorCustom = document.getElementById('input-evento-color-custom');
  if (paleta && inputColorOculto && inputColorCustom) {
    paleta.addEventListener('click', (e) => {
      if (e.target.matches('.color-swatch[data-color]')) {
        const color = e.target.dataset.color;
        inputColorOculto.value = color;
        inputColorCustom.value = color;
        paleta
          .querySelectorAll('.color-swatch')
          .forEach((s) => s.classList.remove('active'));
        e.target.classList.add('active');
      }
    });
    inputColorCustom.addEventListener('input', (e) => {
      inputColorOculto.value = e.target.value;
      paleta
        .querySelectorAll('.color-swatch')
        .forEach((s) => s.classList.remove('active'));
    });
  }
  document
    .getElementById('btn-accion-nueva-tarea')
    ?.addEventListener('click', () => {
      const fecha = document.getElementById('accion-rapida-fecha').value;
      cerrarModal('modal-accion-rapida');
      document.querySelector('.nav-item[data-page="tareas"]')?.click();
      setTimeout(() => {
        const inputFecha = document.getElementById('input-fecha-tarea');
        if (inputFecha) inputFecha.value = fecha;
      }, 50);
    });
  document
    .getElementById('btn-accion-nuevo-evento')
    ?.addEventListener('click', () => {
      const fecha = document.getElementById('accion-rapida-fecha').value;
      cerrarModal('modal-accion-rapida');
      iniciarEdicionEvento({ fechaInicio: fecha, fechaFin: fecha });
    });
  const modalChooser = document.getElementById('modal-chooser-crear');
  if (modalChooser) {
    document
      .getElementById('btn-chooser-evento')
      ?.addEventListener('click', () => {
        const fecha = modalChooser.dataset.fechaSeleccionada;
        if (fecha) {
          cerrarModal('modal-chooser-crear');
          iniciarEdicionEvento({ fechaInicio: fecha, fechaFin: fecha });
        }
      });
    document
      .getElementById('btn-chooser-tarea')
      ?.addEventListener('click', () => {
        const fecha = modalChooser.dataset.fechaSeleccionada;
        if (fecha) {
          cerrarModal('modal-chooser-crear');
          abrirModalNuevaTarea(fecha);
        }
      });
  }
  const selectRecurrenciaEvento = document.getElementById(
    'evento-select-recurrencia',
  );
  const containerFinEvento = document.getElementById(
    'evento-fin-recurrencia-container',
  );
  if (selectRecurrenciaEvento && containerFinEvento) {
    selectRecurrenciaEvento.addEventListener('change', (e) => {
      if (e.target.value === 'nunca') {
        containerFinEvento.classList.add('hidden');
      } else {
        containerFinEvento.classList.remove('hidden');
      }
    });
  }
}
