import { state } from '../state.js';
import { guardarDatos, getTextColorForBg } from '../utils.js';
import {
  mostrarConfirmacion,
  mostrarModal,
  cerrarModal,
  renderizarTareas,
} from '../ui.js';
import { ICONS } from '../icons.js';

let fechaActual = new Date();
let celdasCache = [];
let renderedEventsCache = [];

let isDragging = false;
let dragStartDate = null;
let dragEndDate = null;
let wasDragging = false;

const gridFechas = document.getElementById('calendario-grid');
const gridEventos = document.getElementById('calendario-eventos-grid');
const mesAnoTitulo = document.getElementById('cal-mes-ano');
const btnPrev = document.getElementById('cal-btn-prev');
const btnNext = document.getElementById('cal-btn-next');
const panelResumen = document.getElementById('calendario-resumen');
const resumenTitulo = document.getElementById('resumen-titulo');
const resumenContenido = document.getElementById('resumen-contenido');

export function inicializarCalendario() {
  if (!btnPrev) return;
  // Estos listeners solo se añaden una vez y nunca se borran
  btnPrev.addEventListener('click', () => {
    fechaActual.setMonth(fechaActual.getMonth() - 1);
    renderizarCalendario();
  });
  btnNext.addEventListener('click', () => {
    fechaActual.setMonth(fechaActual.getMonth() + 1);
    renderizarCalendario();
  });

  panelResumen.addEventListener('click', (e) => {
    const btnCerrar = e.target.closest('#btn-cerrar-resumen-dia');
    if (btnCerrar) {
      mostrarResumenMes(fechaActual.getMonth(), fechaActual.getFullYear());
    }
    const btnEditar = e.target.closest('.btn-editar-resumen');
    if (btnEditar) {
      const eventoId = parseInt(btnEditar.dataset.eventId);
      const evento = state.eventos.find((ev) => ev.id === eventoId);
      if (evento) {
        iniciarEdicionEvento(evento);
      }
    }
  });

  document
    .getElementById('btn-accion-nueva-tarea')
    .addEventListener('click', () => {
      const fecha = document.getElementById('accion-rapida-fecha').value;
      cerrarModal('modal-accion-rapida');
      document.querySelector('.nav-item[data-page="tareas"]').click();
      setTimeout(() => {
        const inputFecha = document.getElementById('input-fecha-tarea');
        if (inputFecha) inputFecha.value = fecha;
      }, 50);
    });

  document
    .getElementById('btn-accion-nuevo-evento')
    .addEventListener('click', () => {
      const fecha = document.getElementById('accion-rapida-fecha').value;
      cerrarModal('modal-accion-rapida');
      iniciarEdicionEvento({ fechaInicio: fecha, fechaFin: fecha });
    });

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
    limpiarSeleccionArrastre();
  });

  gridFechas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Solo clic izquierdo
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

  gridFechas.addEventListener('click', (e) => {
    if (wasDragging) {
      wasDragging = false;
      return;
    }

    const celda = e.target.closest('.dia-mes');
    if (!celda) return;

    const clickX = e.clientX;
    const clickY = e.clientY;
    let eventoClicado = null;

    for (const renderedEvent of renderedEventsCache) {
      const rect = renderedEvent.element.getBoundingClientRect();
      if (
        clickX >= rect.left &&
        clickX <= rect.right &&
        clickY >= rect.top &&
        clickY <= rect.bottom
      ) {
        eventoClicado = state.eventos.find((ev) => ev.id === renderedEvent.id);
        break;
      }
    }

    if (eventoClicado) {
      mostrarDetallesEvento(eventoClicado);
    } else {
      mostrarResumenDia(
        celdasCache.find(
          (c) => c.fecha.toISOString().split('T')[0] === celda.dataset.fecha,
        ).fecha,
      );
    }
  });

  gridFechas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const celda = e.target.closest('.dia-mes');
    if (!celda) return;
    abrirMenuAccionRapida(celda);
  });

  renderizarCalendario();
}

function renderizarEventos() {
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

  const eventosDelMes = state.eventos
    .filter((e) => {
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

        if (inicioReal.getTime() >= inicioSemana.getTime()) {
          eventoDiv.classList.add('evento-inicio');
        }
        if (finReal.getTime() <= finSemana.getTime()) {
          eventoDiv.classList.add('evento-fin');
        }

        if (gridEventos.children[startIndexInGrid]) {
          gridEventos.children[startIndexInGrid].appendChild(eventoDiv);
          renderedEventsCache.push({
            id: evento.id,
            element: eventoDiv,
          });
        }
      }
    });
  }
}

export function renderizarCalendario() {
  if (!gridFechas) return;

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
  const diasEnMesAnterior = new Date(ano, mes, 0).getDate();
  const offset = primerDiaDelMes === 0 ? 6 : primerDiaDelMes - 1;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  for (let i = 0; i < 42; i++) {
    const dia = i - offset + 1;
    celdasCache.push({
      fecha: new Date(ano, mes, dia),
      dia,
      esMesActual: dia > 0 && dia <= diasEnMes,
      index: i,
    });
  }

  celdasCache.forEach((celdaInfo) => {
    const celda = document.createElement('div');
    const fechaStr = celdaInfo.fecha.toISOString().split('T')[0];
    celda.dataset.fecha = fechaStr;

    if (!celdaInfo.esMesActual) {
      celda.classList.add('dia-fantasma');
      const diaFantasma =
        celdaInfo.index < offset
          ? diasEnMesAnterior - offset + 1 + celdaInfo.index
          : celdaInfo.dia - diasEnMes;
      celda.innerHTML = `<span class="dia-numero">${diaFantasma}</span>`;
    } else {
      celda.classList.add('dia-mes');
      celda.innerHTML = `<span class="dia-numero">${celdaInfo.dia}</span>`;
      if (celdaInfo.fecha.getTime() === hoy.getTime())
        celda.classList.add('dia-hoy');

      const tareasDelDia = state.tareas.filter(
        (t) => t.fecha === fechaStr && !t.completada,
      );
      if (tareasDelDia.length > 0) {
        const puntosContainer = document.createElement('div');
        puntosContainer.className = 'cal-puntos-container';
        const prioridades = { Baja: [], Media: [], Alta: [] };
        tareasDelDia.forEach((t) => prioridades[t.prioridad]?.push(t));
        ['Alta', 'Media', 'Baja'].forEach((prioridad) => {
          if (prioridades[prioridad].length > 0) {
            const filaDiv = document.createElement('div');
            filaDiv.className = 'cal-prioridad-fila';
            prioridades[prioridad].slice(0, 3).forEach((tarea) => {
              const puntoDiv = document.createElement('div');
              puntoDiv.className = `cal-evento-tarea prioridad-${tarea.prioridad.toLowerCase()}`;
              puntoDiv.title = `${prioridad}: ${tarea.titulo}`;
              filaDiv.appendChild(puntoDiv);
            });
            puntosContainer.appendChild(filaDiv);
          }
        });
        celda.appendChild(puntosContainer);
      }
    }
    gridFechas.appendChild(celda);
  });

  renderizarEventos();
  mostrarResumenMes(mes, ano);
}

function actualizarSeleccionArrastre() {
  limpiarSeleccionArrastre();
  if (!dragStartDate || !dragEndDate) return;

  const start = new Date(dragStartDate + 'T00:00:00');
  const end = new Date(dragEndDate + 'T00:00:00');

  const rangeStart = new Date(Math.min(start.getTime(), end.getTime()));
  const rangeEnd = new Date(Math.max(start.getTime(), end.getTime()));

  for (let d = rangeStart; d <= rangeEnd; d.setDate(d.getDate() + 1)) {
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

function abrirMenuAccionRapida(celda) {
  const fecha = celda.dataset.fecha;
  const fechaObj = new Date(fecha + 'T00:00:00');
  const titulo = fechaObj.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
  });

  document.getElementById('accion-rapida-titulo').textContent = titulo;
  document.getElementById('accion-rapida-fecha').value = fecha;
  mostrarModal('modal-accion-rapida');
}

function iniciarEdicionEvento(evento) {
  document.getElementById('modal-evento-titulo').textContent = evento.id
    ? 'Editar Evento'
    : 'Agregar Nuevo Evento';
  document.getElementById('btn-guardar-evento').textContent = evento.id
    ? 'Actualizar Evento'
    : 'Guardar Evento';
  document.getElementById('input-evento-id').value = evento.id || '';
  document.getElementById('input-evento-titulo').value = evento.titulo || '';
  document.getElementById('input-evento-inicio').value = evento.fechaInicio;
  document.getElementById('input-evento-fin').value = evento.fechaFin;
  document.getElementById('input-evento-color').value =
    evento.color || '#3498db';

  const paleta = document.getElementById('evento-color-palette');
  paleta
    .querySelectorAll('.color-swatch')
    .forEach((s) => s.classList.remove('active'));
  const swatchExistente = paleta.querySelector(
    `.color-swatch[data-color="${evento.color}"]`,
  );
  if (swatchExistente) {
    swatchExistente.classList.add('active');
  }

  mostrarModal('modal-nuevo-evento');
}
function mostrarDetallesEvento(evento) {
  document.getElementById('evento-detalles-titulo').textContent = evento.titulo;
  document.getElementById('evento-detalles-color').style.backgroundColor =
    evento.color;
  const inicio = new Date(evento.fechaInicio + 'T00:00:00');
  const fin = new Date(evento.fechaFin + 'T00:00:00');
  const opts = { day: 'numeric', month: 'long', year: 'numeric' };
  document.getElementById('evento-detalles-fechas').textContent =
    `${inicio.toLocaleDateString('es-ES', opts)} - ${fin.toLocaleDateString('es-ES', opts)}`;
  document.getElementById('btn-editar-evento').onclick = () => {
    cerrarModal('modal-evento-detalles');
    iniciarEdicionEvento(evento);
  };
  document.getElementById('btn-eliminar-evento').onclick = () => {
    cerrarModal('modal-evento-detalles');
    setTimeout(() => {
      mostrarConfirmacion(
        'Eliminar Evento',
        `¿Seguro que quieres eliminar "${evento.titulo}"?`,
        () => {
          state.eventos = state.eventos.filter((e) => e.id !== evento.id);
          guardarDatos();
          renderizarCalendario();
        },
      );
    }, 200);
  };
  mostrarModal('modal-evento-detalles');
}
function mostrarResumenDia(fecha) {
  const fechaStr = fecha.toISOString().split('T')[0];
  const diaFormateado = fecha.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
  });
  const tareasDelDia = state.tareas.filter(
    (t) => t.fecha === fechaStr && !t.completada,
  );
  const eventosDelDia = state.eventos.filter(
    (e) => fechaStr >= e.fechaInicio && fechaStr <= e.fechaFin,
  );
  resumenTitulo.innerHTML = `Detalles del ${diaFormateado} <button id="btn-cerrar-resumen-dia" class="btn-cerrar-panel">${ICONS.close}</button>`;
  if (tareasDelDia.length === 0 && eventosDelDia.length === 0) {
    resumenContenido.innerHTML =
      '<p>Felicidades, no tienes eventos ni tareas pendientes para este día. :D</p>';
    return;
  }
  let html = '';
  if (eventosDelDia.length > 0) {
    html += `<h4 class="resumen-curso-titulo">Eventos</h4>`;
    html += '<ul class="resumen-curso-lista">';
    eventosDelDia.forEach((evento) => {
      html += `<li><span class="prioridad-indicador" style="background-color: ${evento.color};"></span> ${evento.titulo}</li>`;
    });
    html += '</ul>';
  }
  const tareasAgrupadas = tareasDelDia.reduce((acc, tarea) => {
    const curso = tarea.curso;
    if (!acc[curso]) acc[curso] = [];
    acc[curso].push(tarea);
    return acc;
  }, {});
  for (const curso in tareasAgrupadas) {
    html += `<h4 class="resumen-curso-titulo">${curso}</h4>`;
    html += '<ul class="resumen-curso-lista">';
    tareasAgrupadas[curso].forEach((tarea) => {
      html += `<li><span class="prioridad-indicador prioridad-${tarea.prioridad.toLowerCase()}"></span> ${tarea.titulo}</li>`;
    });
    html += '</ul>';
  }
  resumenContenido.innerHTML = html;
}
function mostrarResumenMes(mes, ano) {
  const nombreMes = new Date(ano, mes).toLocaleString('es-ES', {
    month: 'long',
  });
  resumenTitulo.innerHTML = `Resumen de ${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}`;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const tareasDelMes = state.tareas.filter(
    (t) =>
      new Date(t.fecha).getMonth() === mes &&
      new Date(t.fecha).getFullYear() === ano &&
      !t.completada,
  );
  const eventosDelMes = state.eventos.filter(
    (e) =>
      new Date(e.fechaInicio).getMonth() === mes ||
      new Date(e.fechaFin).getMonth() === mes,
  );
  if (tareasDelMes.length === 0 && eventosDelMes.length === 0) {
    resumenContenido.innerHTML =
      '<p>Felicidades, no tienes nada programado para este mes. :D</p>';
    return;
  }
  let html = '';
  if (eventosDelMes.length > 0) {
    html += `<h4 class="resumen-curso-titulo">Eventos del Mes</h4>`;
    html += '<ul class="resumen-curso-lista">';
    eventosDelMes
      .sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio))
      .forEach((evento) => {
        const inicio = new Date(evento.fechaInicio + 'T00:00:00');
        const fin = new Date(evento.fechaFin + 'T00:00:00');
        const opts = { day: 'numeric', month: 'long' };
        const fechaStr = `(${inicio.toLocaleDateString('es-ES', opts)} - ${fin.toLocaleDateString('es-ES', opts)})`;
        const esHoy = hoy >= inicio && hoy <= fin;
        const claseHoy = esHoy ? 'class="item-hoy"' : '';
        html += `<li ${claseHoy}>
                   <span class="prioridad-indicador" style="background-color: ${evento.color};"></span>
                   <div class="resumen-item-texto">
                     <span>${evento.titulo}</span>
                     <span class="resumen-fecha-evento">${fechaStr}</span>
                   </div>
                   <button class="btn-editar-resumen" data-event-id="${evento.id}" title="Editar Evento">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                   </button>
                 </li>`;
      });
    html += '</ul>';
  }
  if (tareasDelMes.length > 0) {
    const tareasAgrupadas = tareasDelMes
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .reduce((acc, tarea) => {
        const curso = tarea.curso;
        if (!acc[curso]) acc[curso] = [];
        acc[curso].push(tarea);
        return acc;
      }, {});
    html += `<h4 class="resumen-curso-titulo">Tareas del Mes</h4>`;
    for (const curso in tareasAgrupadas) {
      html += `<h5 class="resumen-subtitulo">${curso}</h5>`;
      html += '<ul class="resumen-curso-lista">';
      tareasAgrupadas[curso].forEach((tarea) => {
        const fecha = new Date(tarea.fecha + 'T00:00:00');
        const opts = { weekday: 'long', day: 'numeric' };
        const fechaStr = fecha.toLocaleDateString('es-ES', opts);
        const esHoy = fecha.getTime() === hoy.getTime();
        const claseHoy = esHoy ? 'class="item-hoy"' : '';
        html += `<li ${claseHoy}>
                   <span class="prioridad-indicador prioridad-${tarea.prioridad.toLowerCase()}"></span>
                   <strong>${fechaStr}:</strong> ${tarea.titulo}
                 </li>`;
      });
      html += '</ul>';
    }
  }
  resumenContenido.innerHTML = html;
}
export function agregarEvento(datosEvento) {
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
