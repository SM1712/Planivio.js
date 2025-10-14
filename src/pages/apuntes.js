import { state } from '../state.js';
import { guardarDatos } from '../utils.js';
import { mostrarConfirmacion } from '../ui.js';
import { ICONS } from '../icons.js';

let apunteActivold = null;
let saveTimeout;

// ELEMENTOS DEL DOM
const panelListaApuntes = document.getElementById('panel-lista-apuntes');
const listaApuntesEl = document.getElementById('lista-apuntes');
const inputTituloEl = document.getElementById('input-titulo-apunte');
const trixEditorEl = document.querySelector('trix-editor');
const btnNuevoApunteEl = document.getElementById('btn-nuevo-apunte');
const btnEliminarApunteEl = document.getElementById('btn-eliminar-apunte');
const selectCursoEl = document.getElementById('select-curso-apunte');
const btnEditorMenuEl = document.getElementById('btn-editor-menu');
const actionsBar = document.getElementById('apuntes-actions-bar');
const selectionInfo = document.getElementById('apuntes-selection-info');
const selectAllCheckbox = document.getElementById('select-all-apuntes');
const btnDeleteSelected = document.getElementById('btn-delete-selected');
const btnPrintSelected = document.getElementById('btn-print-selected');
const btnDownloadSelected = document.getElementById('btn-download-selected');

function autoGrowTitulo() {
  inputTituloEl.style.height = 'auto';
  inputTituloEl.style.height = `${inputTituloEl.scrollHeight}px`;
}

function popularFiltroDeCursosApuntes() {
  const selector = document.getElementById('filtro-curso-apuntes');
  if (!selector) return;

  const cursosConApuntes = [...new Set(state.apuntes.map((a) => a.curso))];

  selector.innerHTML = '<option value="todos">Todos los Cursos</option>';
  cursosConApuntes.sort().forEach((nombreCurso) => {
    const opcion = document.createElement('option');
    opcion.value = nombreCurso;
    opcion.textContent = nombreCurso;
    selector.appendChild(opcion);
  });

  selector.value = state.filtroCursoApuntes;
}

export function inicializarApuntes() {
  if (btnNuevoApunteEl.dataset.initialized) return;

  btnEditorMenuEl.innerHTML = ICONS.menu;
  btnDeleteSelected.innerHTML = ICONS.delete;
  btnPrintSelected.innerHTML = ICONS.print;
  btnDownloadSelected.innerHTML = ICONS.download;

  btnNuevoApunteEl.addEventListener('click', seleccionarNuevoApunte);
  btnEliminarApunteEl.addEventListener('click', () =>
    eliminarApunte(apunteActivold),
  );

  listaApuntesEl.addEventListener('click', (e) => {
    const apunteLi = e.target.closest('li[data-id]');
    if (!apunteLi) return;

    const apunteId = parseInt(apunteLi.dataset.id, 10);
    const actionBtn = e.target.closest('button[data-action]');
    const checkbox = e.target.closest('input[type="checkbox"]');

    if (actionBtn) {
      e.stopPropagation();
      handleActionClick(actionBtn.dataset.action, apunteId);
    } else if (checkbox || state.apuntesEnModoSeleccion) {
      handleCheckboxClick(apunteId);
    } else {
      handleSeleccionarApunte(apunteLi);
    }
  });

  selectAllCheckbox.addEventListener('change', handleSelectAll);
  btnDeleteSelected.addEventListener('click', eliminarApuntesSeleccionados);
  btnDownloadSelected.addEventListener('click', descargarApuntesSeleccionados);
  btnPrintSelected.addEventListener('click', imprimirApuntesSeleccionados);

  const filtroCursoSelect = document.getElementById('filtro-curso-apuntes');
  if (filtroCursoSelect) {
    filtroCursoSelect.addEventListener('change', (e) => {
      state.filtroCursoApuntes = e.target.value;
      renderizarListaApuntes();
    });
  }

  const editorMenuDropdown = document.getElementById('editor-menu-dropdown');

  btnEditorMenuEl.addEventListener('click', (e) => {
    e.stopPropagation();
    editorMenuDropdown.classList.toggle('visible');
  });

  document
    .getElementById('btn-descargar-actual')
    .addEventListener('click', () => {
      descargarApunteActual();
      editorMenuDropdown.classList.remove('visible');
    });

  document
    .getElementById('btn-imprimir-actual')
    .addEventListener('click', () => {
      imprimirApunteActual();
      editorMenuDropdown.classList.remove('visible');
    });

  window.addEventListener('click', (e) => {
    if (!e.target.closest('.apunte-item-actions')) {
      document
        .querySelectorAll('.apunte-actions-dropdown.visible')
        .forEach((d) => d.classList.remove('visible'));
    }
    if (!e.target.closest('.editor-menu-container')) {
      editorMenuDropdown.classList.remove('visible');
    }
  });

  inputTituloEl.addEventListener('input', () => {
    autoGrowTitulo();
    handleInput();
  });
  trixEditorEl.addEventListener('trix-change', handleInput);
  selectCursoEl.addEventListener('change', handleAutoSave);

  btnNuevoApunteEl.dataset.initialized = 'true';
}

function handleActionClick(action, apunteId) {
  if (action === 'toggle-menu') {
    const dropdown = document.querySelector(
      `li[data-id='${apunteId}'] .apunte-actions-dropdown`,
    );
    document
      .querySelectorAll('.apunte-actions-dropdown.visible')
      .forEach((d) => {
        if (d !== dropdown) d.classList.remove('visible');
      });
    dropdown.classList.toggle('visible');
  }
  if (action === 'eliminar') {
    eliminarApunte(apunteId);
  }
  if (action === 'fijar') {
    toggleFijarApunte(apunteId);
  }
  if (action === 'seleccionar') {
    if (!state.apuntesEnModoSeleccion) state.apuntesEnModoSeleccion = true;

    if (!state.apuntesSeleccionadosIds.includes(apunteId)) {
      state.apuntesSeleccionadosIds.push(apunteId);
    }
    renderizarPaginaApuntes();
  }
}

function handleCheckboxClick(apunteId) {
  const index = state.apuntesSeleccionadosIds.indexOf(apunteId);
  if (index > -1) {
    state.apuntesSeleccionadosIds.splice(index, 1);
  } else {
    state.apuntesSeleccionadosIds.push(apunteId);
  }

  if (state.apuntesSeleccionadosIds.length === 0) {
    exitSelectionMode();
  } else {
    renderizarPaginaApuntes();
  }
}

function handleSelectAll(e) {
  if (e.target.checked) {
    state.apuntesSeleccionadosIds = state.apuntes.map((apunte) => apunte.id);
  } else {
    state.apuntesSeleccionadosIds = [];
    exitSelectionMode();
  }
  renderizarPaginaApuntes();
}

function exitSelectionMode() {
  state.apuntesEnModoSeleccion = false;
  state.apuntesSeleccionadosIds = [];
  renderizarPaginaApuntes();
}

function eliminarApuntesSeleccionados() {
  const count = state.apuntesSeleccionadosIds.length;
  if (count === 0) return;

  mostrarConfirmacion(
    'Eliminar Apuntes',
    `¿Estás seguro de que quieres eliminar ${count} apunte(s) seleccionado(s)?`,
    () => {
      state.apuntes = state.apuntes.filter(
        (apunte) => !state.apuntesSeleccionadosIds.includes(apunte.id),
      );
      if (state.apuntesSeleccionadosIds.includes(apunteActivold)) {
        apunteActivold = null;
        renderizarEditor();
      }
      exitSelectionMode();
      guardarDatos();
    },
  );
}

export function renderizarPaginaApuntes() {
  panelListaApuntes.classList.toggle(
    'modo-seleccion',
    state.apuntesEnModoSeleccion,
  );
  popularFiltroDeCursosApuntes();
  renderizarListaApuntes();
  renderizarBarraAcciones();
}

function renderizarBarraAcciones() {
  if (!state.apuntesEnModoSeleccion) return;

  const totalSeleccionados = state.apuntesSeleccionadosIds.length;
  const totalApuntes = state.apuntes.length;

  selectionInfo.textContent = `${totalSeleccionados} seleccionado(s)`;

  if (totalSeleccionados === totalApuntes && totalApuntes > 0) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else if (totalSeleccionados > 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }
}

export function popularSelectorDeCursosApuntes() {
  selectCursoEl.innerHTML = '';
  state.cursos.forEach((curso) => {
    const option = document.createElement('option');
    option.value = curso;
    option.textContent = curso;
    selectCursoEl.appendChild(option);
  });
}

export function renderizarListaApuntes() {
  if (!listaApuntesEl) return;
  const scrollPosition = listaApuntesEl.parentElement.scrollTop;
  listaApuntesEl.innerHTML = '';

  let apuntesAMostrar = state.apuntes;
  if (state.filtroCursoApuntes !== 'todos') {
    apuntesAMostrar = state.apuntes.filter(
      (apunte) => apunte.curso === state.filtroCursoApuntes,
    );
  }

  const apuntesOrdenados = [...apuntesAMostrar].sort((a, b) => {
    if ((a.fijado || false) && !(b.fijado || false)) return -1;
    if (!(a.fijado || false) && (b.fijado || false)) return 1;
    return new Date(b.fechaModificacion) - new Date(a.fechaModificacion);
  });

  if (apuntesOrdenados.length === 0) {
    listaApuntesEl.innerHTML =
      '<p style="padding: 15px; color: var(--text-muted);">Crea tu primer apunte.</p>';
  } else {
    apuntesOrdenados.forEach((apunte) => {
      const fecha = new Date(apunte.fechaCreacion).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const curso = apunte.curso || 'General';
      const preview = apunte.contenido
        .replace(/<[^>]*>?/gm, '')
        .replace(/\s+/g, ' ')
        .substring(0, 120);

      const li = document.createElement('li');
      li.className = 'apunte-item';
      li.dataset.id = apunte.id;

      const isSelected = state.apuntesSeleccionadosIds.includes(apunte.id);

      if (apunte.id === apunteActivold) li.classList.add('active');
      if (apunte.fijado) li.classList.add('fijado');
      if (isSelected) li.classList.add('seleccionado');

      li.innerHTML = `
        <div class="apunte-selection-control">
          <input type="checkbox" id="select-apunte-${apunte.id}" ${
            isSelected ? 'checked' : ''
          }>
          <label for="select-apunte-${apunte.id}"></label>
        </div>
        <div class="apunte-item-content">
          <h4 class="apunte-item-titulo">${
            apunte.titulo || 'Apunte sin título'
          }</h4>
          <p class="apunte-item-meta">${curso} - ${fecha}</p>
          <p class="apunte-item-preview">${preview || 'Sin contenido...'}</p>
        </div>
        <div class="apunte-item-actions">
          <div class="apunte-menu-container">
            <button class="btn-icon btn-apunte-menu" data-action="toggle-menu">
              ${ICONS.dots_vertical}
            </button>
            <div class="apunte-actions-dropdown">
              <button data-action="seleccionar">Seleccionar</button>
              <button data-action="eliminar" class="btn-eliminar-apunte-item">
                <span>Eliminar</span>
              </button>
            </div>
          </div>
          <button class="btn-icon btn-apunte-fijar ${
            apunte.fijado ? 'active' : ''
          }" data-action="fijar" title="Fijar apunte">
            ${ICONS.pin}
          </button>
        </div>
      `;
      listaApuntesEl.appendChild(li);
    });
  }
  listaApuntesEl.parentElement.scrollTop = scrollPosition;
}

export function renderizarEditor() {
  const apunte = state.apuntes.find((a) => a.id === apunteActivold);
  if (apunte) {
    inputTituloEl.value = apunte.titulo;
    trixEditorEl.editor.loadHTML(apunte.contenido);
    selectCursoEl.value = apunte.curso || 'General';
    btnEliminarApunteEl.style.display = 'block';
  } else {
    inputTituloEl.value = '';
    trixEditorEl.editor.loadHTML('');
    selectCursoEl.value = state.cursos[0] || 'General';
    btnEliminarApunteEl.style.display = 'none';
  }
  setTimeout(autoGrowTitulo, 0);
}

function handleInput() {
  if (apunteActivold === null) {
    const titulo = inputTituloEl.value.trim();
    const contenido = trixEditorEl.editor.getDocument().toString().trim();
    if (titulo === '' && contenido === '') return;
    crearNuevoApunte();
  }
  handleAutoSave();
}

function handleSeleccionarApunte(apunteLi) {
  if (state.apuntesEnModoSeleccion) return;

  apunteActivold = parseInt(apunteLi.dataset.id, 10);
  renderizarPaginaApuntes();
  renderizarEditor();
}

function seleccionarNuevoApunte() {
  if (state.apuntesEnModoSeleccion) {
    exitSelectionMode();
  }
  apunteActivold = null;
  renderizarPaginaApuntes();
  renderizarEditor();
  inputTituloEl.focus();
}

function crearNuevoApunte() {
  const nuevoApunte = {
    id: Date.now(),
    titulo: inputTituloEl.value.trim(),
    contenido: trixEditorEl.value,
    curso: selectCursoEl.value,
    fechaCreacion: new Date().toISOString(),
    fechaModificacion: new Date().toISOString(),
    fijado: false,
  };
  state.apuntes.unshift(nuevoApunte);
  apunteActivold = nuevoApunte.id;
  renderizarPaginaApuntes();
}

function toggleFijarApunte(id) {
  const apunte = state.apuntes.find((a) => a.id === id);
  if (apunte) {
    apunte.fijado = !(apunte.fijado || false);
    guardarDatos();
    renderizarPaginaApuntes();
  }
}

function eliminarApunte(id) {
  if (id === null) return;
  const apunte = state.apuntes.find((a) => a.id === id);
  if (!apunte) return;

  mostrarConfirmacion(
    'Eliminar Apunte',
    `¿Estás seguro de que quieres eliminar "${
      apunte.titulo || 'este apunte'
    }"?`,
    () => {
      state.apuntes = state.apuntes.filter((a) => a.id !== id);
      if (apunteActivold === id) {
        apunteActivold = null;
      }
      exitSelectionMode();
      guardarDatos();
      renderizarEditor();
    },
  );
}

function handleAutoSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const apunte = state.apuntes.find((a) => a.id === apunteActivold);
    if (apunte) {
      const tituloAnterior = apunte.titulo;
      apunte.titulo = inputTituloEl.value.trim();
      apunte.contenido = trixEditorEl.value;
      apunte.curso = selectCursoEl.value;
      apunte.fechaModificacion = new Date().toISOString();
      guardarDatos();
      if (apunte.titulo !== tituloAnterior) {
        renderizarPaginaApuntes();
      }
    }
  }, 500);
}

function addPageNumbers(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(150);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' },
    );
  }
}

function descargarApuntesSeleccionados() {
  const ids = state.apuntesSeleccionadosIds;
  if (ids.length === 0) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const apuntesADescargar = state.apuntes.filter((apunte) =>
    ids.includes(apunte.id),
  );

  let y = 15;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const maxWidth = 180;
  const accentColor = state.config.accent_color;

  const checkPageBreak = (alturaAdicional) => {
    if (y + alturaAdicional > pageHeight - margin - 10) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFontSize(18);
  doc.setTextColor(accentColor);
  doc.text('Planivio - Apuntes Exportados', margin, y);
  y += 10;
  doc.setLineWidth(0.5);
  doc.setDrawColor(accentColor);
  doc.line(margin, y, 200, y);
  y += 10;

  apuntesADescargar.forEach((apunte, index) => {
    let contenidoConSaltos = apunte.contenido
      .replace(/<\/div>|<\/p>|<\/li>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contenidoConSaltos;
    const contenidoSimple = (
      tempDiv.textContent ||
      tempDiv.innerText ||
      ''
    ).trim();

    const titleLines = doc.splitTextToSize(
      apunte.titulo || 'Apunte sin título',
      maxWidth,
    );
    const contentLines = doc.splitTextToSize(contenidoSimple, maxWidth);
    const alturaTotalEstimada =
      titleLines.length * 7 + 10 + contentLines.length * 5 + 20;

    checkPageBreak(alturaTotalEstimada);

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(accentColor);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 7;

    const fecha = new Date(apunte.fechaModificacion).toLocaleDateString(
      'es-ES',
    );
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(
      `Curso: ${apunte.curso} | Última Modificación: ${fecha}`,
      margin,
      y,
    );
    y += 10;

    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(contentLines, margin, y);
    y += contentLines.length * 5 + 15;

    if (index < apuntesADescargar.length - 1) {
      checkPageBreak(10);
      doc.setLineWidth(0.2);
      doc.setDrawColor(150);
      doc.line(margin, y, 200, y);
      y += 10;
    }
  });

  addPageNumbers(doc);

  let fileName;
  if (apuntesADescargar.length === 1) {
    const singleTitle = apuntesADescargar[0].titulo || 'Apunte sin título';
    fileName = singleTitle
      .replace(/[^a-z0-9\s-]/gi, '_')
      .substring(0, 50)
      .trim();
  } else {
    fileName = `Apuntes-Planivio-${Date.now()}`;
  }

  doc.save(`${fileName}.pdf`);
}

function imprimirApuntesSeleccionados() {
  const ids = state.apuntesSeleccionadosIds;
  if (ids.length === 0) return;

  const apuntesAImprimir = state.apuntes.filter((apunte) =>
    ids.includes(apunte.id),
  );

  const accentColor = state.config.accent_color;
  let printHtml = `<h1 style="color: ${accentColor}; border-bottom-color: ${accentColor};">Planivio - Apuntes Exportados</h1>`;

  apuntesAImprimir.forEach((apunte) => {
    const fecha = new Date(apunte.fechaModificacion).toLocaleDateString(
      'es-ES',
    );

    const contenidoLimpio = apunte.contenido
      .replace(/<div>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contenidoLimpio;
    const contenidoTexto = tempDiv.textContent || tempDiv.innerText || '';

    printHtml += `
      <div class="apunte-impreso">
        <h2 style="color: ${accentColor};">${apunte.titulo || 'Apunte sin título'}</h2>
        <p class="meta">Curso: ${apunte.curso} | Última Modificación: ${fecha}</p>
        <div class="contenido" style="white-space: pre-wrap;">${contenidoTexto}</div>
      </div>
    `;
  });

  const printContainer = document.createElement('div');
  printContainer.id = 'print-container';
  printContainer.innerHTML = printHtml;
  document.body.appendChild(printContainer);

  window.print();

  document.body.removeChild(printContainer);
}

function descargarApunteActual() {
  if (apunteActivold === null) return;

  const apunte = state.apuntes.find((a) => a.id === apunteActivold);
  if (!apunte) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const margin = 15;
  const maxWidth = 180;
  let y = margin;
  const accentColor = state.config.accent_color;

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(accentColor);
  const titleLines = doc.splitTextToSize(
    apunte.titulo || 'Apunte sin título',
    maxWidth,
  );
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 5;

  const fecha = new Date(apunte.fechaModificacion).toLocaleDateString('es-ES');
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100);
  doc.text(`Curso: ${apunte.curso} | Última Modificación: ${fecha}`, margin, y);
  y += 10;

  let contenidoConSaltos = apunte.contenido
    .replace(/<\/div>|<\/p>|<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = contenidoConSaltos;
  const contenidoSimple = (
    tempDiv.textContent ||
    tempDiv.innerText ||
    ''
  ).trim();

  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(contenidoSimple, margin, y, { maxWidth });

  addPageNumbers(doc);

  const fileName = (apunte.titulo || 'Apunte sin título')
    .replace(/[^a-z0-9\s-]/gi, '_')
    .substring(0, 50)
    .trim();
  doc.save(`${fileName}.pdf`);
}

function imprimirApunteActual() {
  if (apunteActivold === null) return;

  const apunte = state.apuntes.find((a) => a.id === apunteActivold);
  if (!apunte) return;

  const fecha = new Date(apunte.fechaModificacion).toLocaleDateString('es-ES');

  const contenidoLimpio = apunte.contenido
    .replace(/<div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = contenidoLimpio;
  const contenidoTexto = tempDiv.textContent || tempDiv.innerText || '';

  const accentColor = state.config.accent_color;
  let printHtml = `
    <h1 style="color: ${accentColor}; border-bottom-color: ${accentColor};">${apunte.titulo || 'Apunte sin título'}</h1>
    <p class="meta">Curso: ${apunte.curso} | Última Modificación: ${fecha}</p>
    <div class="contenido" style="white-space: pre-wrap;">${contenidoTexto}</div>
  `;

  const printContainer = document.createElement('div');
  printContainer.id = 'print-container';
  printContainer.innerHTML = `<div class="apunte-impreso">${printHtml}</div>`;
  document.body.appendChild(printContainer);

  window.print();

  document.body.removeChild(printContainer);
}
