import { state } from '../state.js';
// import { guardarDatos } from '../utils.js'; // <-- ELIMINADO
import { EventBus } from '../eventBus.js'; // <-- AÑADIDO
// --- INICIO NUEVAS IMPORTACIONES FIREBASE ---
import {
  agregarDocumento,
  actualizarDocumento,
  eliminarDocumento,
} from '../firebase.js';
// --- FIN NUEVAS IMPORTACIONES FIREBASE ---
import {
  mostrarConfirmacion,
  mostrarModal,
  cerrarModal,
  popularSelectorDeCursos, // Ya estaba aquí
  popularSelectorDeProyectos,
  cargarIconos,
  mostrarAlerta, // <-- AÑADIDO PARA MANEJO DE ERRORES
} from '../ui.js';
import { ICONS } from '../icons.js';
import { abrirModalNuevaTarea } from './dashboard.js';
import { obtenerFechaLocalISO } from '../utils.js'; // <-- AÑADIDO
// import { cambiarPagina } from '../main.js'; // <-- ELIMINADO

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

/**
 * MODIFICADO: Usa agregarDocumento y es async.
 */
async function agregarEvento(datosEvento) {
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
  // const nuevoEvento = { id: Date.now(), ...datosEvento }; // <-- ELIMINADO
  // state.eventos.push(nuevoEvento); // <-- ELIMINADO
  try {
    await agregarDocumento('eventos', datosEvento);
    console.log('[Calendario] Evento nuevo guardado en Firestore.');
  } catch (error) {
    console.error('[Calendario] Error al agregar evento:', error);
    mostrarAlerta('Error', 'No se pudo guardar el evento.');
  }
  // guardarDatos(); // <-- ELIMINADO
  // renderizarCalendario(); // <-- ELIMINADO (El listener lo hará)
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

  // ==========================================================
  // ==                ¡INICIO DE LA CORRECCIÓN!               ==
  // ==========================================================
  // Faltaba la comilla de cierre (`) aquí.
  resumenTitulo.innerHTML = `
    <span>Detalles del ${diaFormateado}</span>
      <div class="resumen-dia-acciones">
        <button id="btn-agregar-rapido-dia" class="btn-accent-ghost">+</button>
      </div>
  `;
  // ==========================================================
  // ==                  ¡FIN DE LA CORRECCIÓN!                ==
  // ==========================================================

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
    popularSelectorDeCursos(selectCurso, false); // Popula omitiendo 'General'
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

/**
 * MODIFICADO: Usa eliminarDocumento y es async.
 * ¡AQUÍ ESTÁ LA CORRECCIÓN PARA EL BORRADO!
 */
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
      const eventoOriginal = state.eventos.find(
        (e) => String(e.id) === String(idParaAccion),
      );
      if (eventoOriginal) {
        iniciarEdicionEvento(eventoOriginal);
      }
    };
  if (btnEliminar)
    btnEliminar.onclick = () => {
      cerrarModal('modal-evento-detalles');
      const eventoOriginal = state.eventos.find(
        (e) => String(e.id) === String(idParaAccion),
      );
      const titulo = eventoOriginal ? eventoOriginal.titulo : evento.titulo;

      // ==========================================================
      // ==                ¡INICIO DE LA CORRECCIÓN!               ==
      // ==========================================================
      // El setTimeout ahora es async para poder usar await dentro.
      setTimeout(async () => {
        // Usamos await en mostrarConfirmacion. Pasa los textos de los botones.
        const quiereEliminar = await mostrarConfirmacion(
          'Eliminar Evento',
          `¿Seguro que quieres eliminar "${titulo}" y todas sus repeticiones? Esta acción eliminará la cadena completa.`,
          'Eliminar', // Texto del botón Aceptar
          'Cancelar', // Texto del botón Cancelar
        );

        // Si el usuario hizo clic en "Eliminar" (la promesa resolvió true)
        if (quiereEliminar) {
          try {
            await eliminarDocumento('eventos', String(idParaAccion));
            console.log(
              `[Calendario] Evento ${idParaAccion} eliminado de Firestore.`,
            );
          } catch (error) {
            console.error('[Calendario] Error al eliminar evento:', error);
            mostrarAlerta('Error', 'No se pudo eliminar el evento.');
          }
          // No se llama a renderizar, ¡"Pulso" lo hará!
        }
        // Si quiereEliminar es false (hizo clic en Cancelar), no se hace nada.
      }, 200);
      // ==========================================================
      // ==                  ¡FIN DE LA CORRECCIÓN!                ==
      // ==========================================================
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

/**
 * MODIFICADO: Conecta los listeners del DOM cuando la página se carga.
 */
function conectarUICalendario() {
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
      if (form) form.reset(); // Resetear antes de rellenar
      const today = new Date().toISOString().split('T')[0];
      // Asegurar que cursoPreseleccionado sea null al crear desde aquí
      iniciarEdicionEvento({ fechaInicio: today, fechaFin: today }, null);
    });
    btnNuevoEvento.dataset.initialized = 'true';
  }

  const gridFechas = document.getElementById('calendario-grid');
  if (gridFechas) {
    // Limpiar listeners antiguos si existen (más robusto)
    if (gridFechas._clickHandler)
      gridFechas.removeEventListener('click', gridFechas._clickHandler);
    if (gridFechas._mouseDownHandler)
      gridFechas.removeEventListener('mousedown', gridFechas._mouseDownHandler);
    if (gridFechas._mouseOverHandler)
      gridFechas.removeEventListener('mouseover', gridFechas._mouseOverHandler);
    if (gridFechas._contextMenuHandler)
      gridFechas.removeEventListener(
        'contextmenu',
        gridFechas._contextMenuHandler,
      );

    // Definir handlers
    const clickHandler = (e) => {
      const esMovil = window.innerWidth <= 900;
      if (wasDragging) {
        // Si venimos de un arrastre, no hacer nada en el click
        wasDragging = false; // Resetear para el próximo click
        return;
      }
      const celda = e.target.closest('.dia-mes'); // Celda de día del mes actual

      // Determinar si se hizo clic sobre una barra de evento largo
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

      // Si se hizo clic en una barra de evento
      if (eventoClicado) {
        mostrarDetallesEvento(eventoClicado);
      }
      // Si se hizo clic en una celda (y no en una barra)
      else if (celda) {
        e.stopPropagation(); // Evitar que otros listeners (ej. body) se activen
        const fechaCelda = celda.dataset.fecha;
        const celdaInfo = celdasCache.find(
          (c) => c.fecha.toISOString().split('T')[0] === fechaCelda,
        );

        if (celdaInfo) {
          // Quitar selección previa
          document
            .querySelectorAll('#calendario-grid .dia-mes.dia-seleccionado')
            .forEach((c) => c.classList.remove('dia-seleccionado'));
          // Marcar celda actual como seleccionada
          celda.classList.add('dia-seleccionado');
          // Mostrar resumen del día
          mostrarResumenDia(celdaInfo.fecha);
          // En móvil, mostrar el panel de resumen como overlay
          if (esMovil) {
            document.body.classList.add('resumen-movil-visible');
          }
        }
      }
    };
    const mouseDownHandler = (e) => {
      if (e.button !== 0) return; // Solo botón izquierdo
      const celda = e.target.closest('.dia-mes');
      if (!celda) return;
      isDragging = true;
      wasDragging = false; // Resetear al iniciar
      dragStartDate = celda.dataset.fecha;
      dragEndDate = celda.dataset.fecha;
      actualizarSeleccionArrastre();
      e.preventDefault(); // Prevenir selección de texto
    };
    const mouseOverHandler = (e) => {
      if (!isDragging) return;
      const celda = e.target.closest('.dia-mes');
      if (!celda) return;
      if (celda.dataset.fecha !== dragEndDate) {
        wasDragging = true; // Marcar que sí hubo arrastre
        dragEndDate = celda.dataset.fecha;
        actualizarSeleccionArrastre();
      }
    };
    const contextMenuHandler = (e) => {
      e.preventDefault(); // Prevenir menú contextual del navegador
      const celda = e.target.closest('.dia-mes');
      if (celda) {
        const fechaStr = celda.dataset.fecha;
        const modalChooser = document.getElementById('modal-chooser-crear');
        if (modalChooser && fechaStr) {
          modalChooser.dataset.fechaSeleccionada = fechaStr;
          // Limpiar curso preseleccionado por si acaso
          delete modalChooser.dataset.cursoPreseleccionado;
          mostrarModal('modal-chooser-crear');
        }
      }
    };

    // Añadir listeners
    gridFechas.addEventListener('click', clickHandler);
    gridFechas.addEventListener('mousedown', mouseDownHandler);
    gridFechas.addEventListener('mouseover', mouseOverHandler);
    gridFechas.addEventListener('contextmenu', contextMenuHandler);

    // Guardar referencias
    gridFechas._clickHandler = clickHandler;
    gridFechas._mouseDownHandler = mouseDownHandler;
    gridFechas._mouseOverHandler = mouseOverHandler;
    gridFechas._contextMenuHandler = contextMenuHandler;
  }

  // Listener global mouseup (para finalizar arrastre)
  if (window._calendarioMouseUpHandler) {
    window.removeEventListener('mouseup', window._calendarioMouseUpHandler);
  }
  const mouseUpHandler = () => {
    if (!isDragging) return;
    if (wasDragging) {
      // Solo abrir modal si hubo arrastre real
      const start = new Date(dragStartDate + 'T00:00:00'); // Añadir T00:00:00
      const end = new Date(dragEndDate + 'T00:00:00'); // Añadir T00:00:00
      const fechaInicio = start < end ? dragStartDate : dragEndDate;
      const fechaFin = start < end ? dragEndDate : dragStartDate;
      // Limpiar curso preseleccionado
      iniciarEdicionEvento(
        { fechaInicio: fechaInicio, fechaFin: fechaFin },
        null,
      );
    }
    isDragging = false;
    // wasDragging se resetea en el próximo mousedown o click
    limpiarSeleccionArrastre();
  };
  window.addEventListener('mouseup', mouseUpHandler);
  window._calendarioMouseUpHandler = mouseUpHandler; // Guardar referencia

  const panelResumen = document.getElementById('calendario-resumen');
  if (panelResumen) {
    // Limpiar listeners antiguos
    if (panelResumen._clickHandler)
      panelResumen.removeEventListener('click', panelResumen._clickHandler);
    if (panelResumen._dblClickHandler)
      panelResumen.removeEventListener(
        'dblclick',
        panelResumen._dblClickHandler,
      );

    const clickHandler = (e) => {
      const esMovil = window.innerWidth <= 900;
      const btnCerrar = e.target.closest('#btn-cerrar-resumen-dia');
      const btnAgregarRapido = e.target.closest('#btn-agregar-rapido-dia');
      const tareaItem = e.target.closest('.tarea-item-resumen');
      const btnEditarEvento = e.target.closest('.btn-editar-resumen');

      if (btnCerrar) {
        if (esMovil) {
          document.body.classList.remove('resumen-movil-visible');
        }
        // Volver a mostrar resumen del mes (puede optimizarse guardando estado)
        mostrarResumenMes(fechaActual.getMonth(), fechaActual.getFullYear());
        // Quitar selección de día
        document
          .querySelectorAll('#calendario-grid .dia-mes.dia-seleccionado')
          .forEach((c) => c.classList.remove('dia-seleccionado'));
      } else if (btnAgregarRapido) {
        const fechaStr = document.querySelector(
          '#calendario-grid .dia-mes.dia-seleccionado',
        )?.dataset.fecha;
        const modalChooser = document.getElementById('modal-chooser-crear');
        if (modalChooser && fechaStr) {
          modalChooser.dataset.fechaSeleccionada = fechaStr;
          delete modalChooser.dataset.cursoPreseleccionado; // Limpiar curso
          mostrarModal('modal-chooser-crear');
        }
      } else if (tareaItem) {
        const tareaId = tareaItem.dataset.taskId;
        if (tareaId) {
          // state.tareaSeleccionadald = parseInt(tareaId); // <-- ELIMINADO
          // guardarDatos(); // <-- ELIMINADO
          EventBus.emit('navegarA', { pagina: 'tareas', id: tareaId }); // <-- AÑADIDO
        }
      } else if (btnEditarEvento) {
        const eventId = btnEditarEvento.dataset.eventId;
        // Buscar el evento original (no la instancia)
        const eventoOriginal = state.eventos.find(
          (ev) => String(ev.id) === String(eventId),
        );
        if (eventoOriginal) {
          iniciarEdicionEvento(eventoOriginal, null); // Sin curso preseleccionado
        } else {
          console.warn(
            'No se encontró el evento original para editar:',
            eventId,
          );
        }
      }
    };
    const dblClickHandler = (e) => {
      const tareaItem = e.target.closest('.tarea-item-resumen');
      if (!tareaItem) return;
      const tareaId = tareaItem.dataset.taskId;
      const tarea = state.tareas.find((t) => String(t.id) === String(tareaId)); // Comparar como string por si acaso
      if (tarea && !tarea.completada) {
        // Solo si no está completada
        mostrarConfirmacion(
          'Completar Tarea',
          `¿Marcar "${tarea.titulo}" como completada?`,
          async () => {
            // <-- AÑADIDO async
            // tarea.completada = true; // <-- ELIMINADO
            // tarea.fechaCompletado = new Date().toISOString().split('T')[0]; // <-- ELIMINADO
            try {
              await actualizarDocumento('tareas', String(tareaId), {
                completada: true,
                fechaCompletado: obtenerFechaLocalISO(),
              });
              console.log(`[Calendario] Tarea ${tareaId} completada.`);
            } catch (error) {
              console.error('[Calendario] Error al completar tarea:', error);
              mostrarAlerta('Error', 'No se pudo completar la tarea.');
            }
            // guardarDatos(); // <-- ELIMINADO
            // renderizarCalendario(); // <-- ELIMINADO (El listener lo hará)
          },
          'Completar', // Texto del botón Aceptar
          'Cancelar', // Texto del botón Cancelar
        );
      } else if (tarea && tarea.completada) {
        // Opcional: Permitir desmarcar con doble clic también?
        // mostrarConfirmacion('Marcar como Pendiente', `¿Marcar "${tarea.titulo}" como pendiente?`, () => { ... });
      }
    };

    panelResumen.addEventListener('click', clickHandler);
    panelResumen.addEventListener('dblclick', dblClickHandler);
    panelResumen._clickHandler = clickHandler;
    panelResumen._dblClickHandler = dblClickHandler;
  }

  // --- Listener Formulario Nuevo Evento (CON GUARDA) ---
  const formNuevoEvento = document.getElementById('form-nuevo-evento');
  // Aseguramos que el listener se añada UNA SOLA VEZ
  if (formNuevoEvento && !formNuevoEvento.dataset.listenerAttached) {
    const submitHandler = async (e) => {
      // <-- AÑADIDO async
      // Definimos el handler aquí dentro
      e.preventDefault();
      // --- Leer datos del formulario ---
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
      const eventoId = document.getElementById('input-evento-id').value; // ID es String

      // --- Validaciones ---
      if (
        !datosEvento.titulo ||
        !datosEvento.fechaInicio ||
        !datosEvento.fechaFin
      ) {
        alert('El evento debe tener un título y fechas de inicio y fin.');
        return;
      }
      if (
        new Date(datosEvento.fechaFin + 'T00:00:00') <
        new Date(datosEvento.fechaInicio + 'T00:00:00')
      ) {
        // Comparar con hora
        alert('La fecha de fin no puede ser anterior a la fecha de inicio.');
        return;
      }

      // --- Lógica Guardar/Actualizar ---
      try {
        if (eventoId) {
          // Si hay ID, es una actualización
          await actualizarDocumento('eventos', String(eventoId), datosEvento); // <-- AÑADIDO
          console.log('Evento actualizado:', eventoId);
          // guardarDatos(); // <-- ELIMINADO
          // renderizarCalendario(); // <-- ELIMINADO
        } else {
          // Si no hay ID, es un evento nuevo
          // Llamar a agregarEvento que hace push, guarda y renderiza
          await agregarEvento(datosEvento); // <-- AÑADIDO await
        }
      } catch (error) {
        console.error(
          '[Calendario] Error al guardar/actualizar evento:',
          error,
        );
        mostrarAlerta('Error', 'No se pudo guardar el evento.');
      }

      cerrarModal('modal-nuevo-evento');
    }; // Fin de submitHandler

    formNuevoEvento.addEventListener('submit', submitHandler);
    formNuevoEvento.dataset.listenerAttached = 'true'; // Marcar que ya tiene listener
  }
  // --- FIN CORRECCIÓN LISTENER SUBMIT ---

  // --- Listener Paleta Color (Con guarda) ---
  const paleta = document.getElementById('evento-color-palette');
  const inputColorOculto = document.getElementById('input-evento-color');
  const inputColorCustom = document.getElementById('input-evento-color-custom');
  if (paleta && inputColorOculto && inputColorCustom) {
    if (!paleta.dataset.listenerAttached) {
      paleta.addEventListener('click', (e) => {
        if (e.target.matches('.color-swatch[data-color]')) {
          const color = e.target.dataset.color;
          inputColorOculto.value = color;
          inputColorCustom.value = color;
          paleta
            .querySelectorAll('.color-swatch')
            .forEach((s) => s.classList.remove('active'));
          e.target.classList.add('active');
          // Desmarcar custom si se selecciona un preset
          const customSwatchDiv = inputColorCustom.closest(
            '.custom-color-swatch',
          );
          if (customSwatchDiv) customSwatchDiv.classList.remove('active');
        }
      });
      paleta.dataset.listenerAttached = 'true';
    }
    if (!inputColorCustom.dataset.listenerAttached) {
      inputColorCustom.addEventListener('input', (e) => {
        inputColorOculto.value = e.target.value;
        paleta
          .querySelectorAll('.color-swatch')
          .forEach((s) => s.classList.remove('active'));
        // Marcar el div del custom picker como activo
        const customSwatchDiv = inputColorCustom.closest(
          '.custom-color-swatch',
        );
        if (customSwatchDiv) customSwatchDiv.classList.add('active');
      });
      inputColorCustom.dataset.listenerAttached = 'true';
    }
  }

  // --- Listener Botones Acción Rápida (Con guarda) ---
  const btnAccionTarea = document.getElementById('btn-accion-nueva-tarea');
  if (btnAccionTarea && !btnAccionTarea.dataset.listenerAttached) {
    btnAccionTarea.addEventListener('click', () => {
      const fecha = document.getElementById('accion-rapida-fecha').value;
      cerrarModal('modal-accion-rapida');
      // state.fechaPreseleccionada = fecha; // <-- ELIMINADO
      // guardarDatos(); // <-- ELIMINADO
      EventBus.emit('navegarA', { pagina: 'tareas', id: null, fecha: fecha }); // <-- AÑADIDO
    });
    btnAccionTarea.dataset.listenerAttached = 'true';
  }
  const btnAccionEvento = document.getElementById('btn-accion-nuevo-evento');
  if (btnAccionEvento && !btnAccionEvento.dataset.listenerAttached) {
    btnAccionEvento.addEventListener('click', () => {
      const fecha = document.getElementById('accion-rapida-fecha').value;
      cerrarModal('modal-accion-rapida');
      iniciarEdicionEvento({ fechaInicio: fecha, fechaFin: fecha }, null); // Sin curso
    });
    btnAccionEvento.dataset.listenerAttached = 'true';
  }

  // --- Listener Modal Chooser (Con guarda) ---
  const modalChooser = document.getElementById('modal-chooser-crear');
  if (modalChooser) {
    const btnChooserEvento = document.getElementById('btn-chooser-evento');
    if (btnChooserEvento && !btnChooserEvento.dataset.listenerAttached) {
      btnChooserEvento.addEventListener('click', () => {
        const fecha = modalChooser.dataset.fechaSeleccionada;
        const curso = modalChooser.dataset.cursoPreseleccionado;
        cerrarModal('modal-chooser-crear');
        if (fecha) {
          iniciarEdicionEvento({ fechaInicio: fecha, fechaFin: fecha }, curso);
        }
        delete modalChooser.dataset.fechaSeleccionada;
        delete modalChooser.dataset.cursoPreseleccionado;
      });
      btnChooserEvento.dataset.listenerAttached = 'true';
    }
    const btnChooserTarea = document.getElementById('btn-chooser-tarea');
    if (btnChooserTarea && !btnChooserTarea.dataset.listenerAttached) {
      btnChooserTarea.addEventListener('click', () => {
        const fecha = modalChooser.dataset.fechaSeleccionada;
        const curso = modalChooser.dataset.cursoPreseleccionado;
        cerrarModal('modal-chooser-crear');
        if (fecha) {
          // Esto fallará hasta que dashboard.js esté migrado, lo cual es correcto.
          abrirModalNuevaTarea(fecha, curso);
        }
        delete modalChooser.dataset.fechaSeleccionada;
        delete modalChooser.dataset.cursoPreseleccionado;
      });
      btnChooserTarea.dataset.listenerAttached = 'true';
    }
  }

  // --- Listener Select Recurrencia (Con guarda) ---
  const selectRecurrenciaEvento = document.getElementById(
    'evento-select-recurrencia',
  );
  const containerFinEvento = document.getElementById(
    'evento-fin-recurrencia-container',
  );
  if (selectRecurrenciaEvento && containerFinEvento) {
    if (!selectRecurrenciaEvento.dataset.listenerAttached) {
      selectRecurrenciaEvento.addEventListener('change', (e) => {
        containerFinEvento.classList.toggle(
          'hidden',
          e.target.value === 'nunca',
        );
      });
      selectRecurrenciaEvento.dataset.listenerAttached = 'true';
    }
  }
}

/**
 * MODIFICADO: Esta es la nueva función principal.
 * Solo se suscribe a los eventos del EventBus.
 */
export function inicializarCalendario() {
  console.log('[Calendario] Inicializando y suscribiendo a eventos...');

  // 1. Escuchar cuándo el HTML de esta página se carga en el DOM
  EventBus.on('paginaCargada:calendario', (data) => {
    console.log(
      '[Calendario] Evento: paginaCargada:calendario recibido. Conectando listeners de UI...',
    );
    conectarUICalendario(); // Llama a la función que hace el trabajo
  });

  // 2. Escuchar cuándo cambian los datos de eventos
  const refrescarCalendarioCompleto = () => {
    if (state.paginaActual === 'calendario') {
      console.log(
        '[Calendario] Evento: eventos, tareas o cursos actualizados. Renderizando...',
      );
      renderizarCalendario();
    }
  };

  EventBus.on('eventosActualizados', refrescarCalendarioCompleto);
  EventBus.on('tareasActualizadas', refrescarCalendarioCompleto);
  EventBus.on('cursosActualizados', refrescarCalendarioCompleto); // Para filtro de archivados
  EventBus.on('proyectosActualizados', refrescarCalendarioCompleto); // Para detalles en resumen
}
