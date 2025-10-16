import { state } from '../state.js';
import { guardarDatos } from '../utils.js';
import {
  mostrarConfirmacion,
  cerrarModal,
  mostrarModal,
  popularSelectorDeCursos,
} from '../ui.js';
import { ICONS } from '../icons.js';

let apunteActivoId = null;
let saveTimeout;
let notoEmojiFont = null;
let isFontLoading = false;

async function cargarFuenteParaPDF() {
  if (notoEmojiFont) return true;
  if (isFontLoading) {
    alert(
      'La fuente para PDF se está descargando. Por favor, inténtalo de nuevo en un momento.',
    );
    return false;
  }

  isFontLoading = true;
  try {
    const response = await fetch(
      'https://cdn.jsdelivr.net/npm/noto-emoji@latest/fonts/NotoEmoji-Regular.ttf',
    );
    if (!response.ok) throw new Error('Network response was not ok');
    const fontBlob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Font = reader.result.split(',')[1];
        notoEmojiFont = base64Font;
        console.log('Fuente NotoEmoji cargada y lista para PDFs.');
        isFontLoading = false;
        resolve(true);
      };
      reader.readAsDataURL(fontBlob);
    });
  } catch (error) {
    console.error('No se pudo cargar la fuente de emojis para el PDF:', error);
    alert(
      'Error crítico: No se pudo cargar la fuente para generar el PDF. Revisa la conexión a internet.',
    );
    isFontLoading = false;
    return false;
  }
}

function addPageNumbers(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' },
    );
  }
}

async function descargarApuntesSeleccionados(
  ids = state.apuntesSeleccionadosIds,
) {
  if (ids.length === 0) return;

  const fontLoaded = await cargarFuenteParaPDF();
  if (!fontLoaded) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const apuntesADescargar = state.apuntes.filter((apunte) =>
    ids.includes(apunte.id),
  );
  const accentColor = state.config.accent_color;

  doc.addFileToVFS('NotoEmoji-Regular.ttf', notoEmojiFont);
  doc.addFont('NotoEmoji-Regular.ttf', 'NotoEmoji', 'normal');
  doc.addFont('NotoEmoji-Regular.ttf', 'NotoEmoji', 'bold');

  const body = [];
  apuntesADescargar.forEach((apunte) => {
    const fecha = new Date(apunte.fechaModificacion).toLocaleDateString(
      'es-ES',
    );
    const titulo = apunte.titulo || 'Apunte sin título';
    const meta = `Curso: ${apunte.curso} | Última Modificación: ${fecha}`;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = apunte.contenido.replace(/<div>/g, '\n');
    const contenidoTexto = tempDiv.innerText || '';

    body.push([
      {
        content: titulo,
        styles: {
          font: 'NotoEmoji',
          fontStyle: 'bold',
          fontSize: 14,
          textColor: accentColor,
        },
      },
    ]);
    body.push([
      {
        content: meta,
        styles: {
          font: 'NotoEmoji',
          fontSize: 9,
          textColor: [100, 100, 100],
          cellPadding: { bottom: 4 },
        },
      },
    ]);
    body.push([
      {
        content: contenidoTexto,
        styles: {
          font: 'NotoEmoji',
          fontSize: 11,
          textColor: [50, 50, 50],
          cellPadding: { bottom: 10 },
        },
      },
    ]);
  });

  doc.autoTable({
    head: [
      [
        {
          content: 'Planivio - Apuntes Exportados',
          styles: {
            fillColor: false,
            textColor: accentColor,
            fontSize: 18,
            font: 'NotoEmoji',
            fontStyle: 'bold',
          },
        },
      ],
    ],
    body: body,
    theme: 'plain',
    startY: 25,
    styles: { cellPadding: { top: 2, right: 0, bottom: 0, left: 0 } },
    columnStyles: { 0: { cellWidth: 'auto' } },
    didDrawPage: (data) => {
      doc.setLineWidth(0.5);
      doc.setDrawColor(accentColor);
      doc.line(
        data.settings.margin.left,
        20,
        doc.internal.pageSize.width - data.settings.margin.right,
        20,
      );
      addPageNumbers(doc);
    },
    margin: { top: 30, left: 15, right: 15 },
  });

  let fileName;
  if (apuntesADescargar.length === 1) {
    fileName = (apuntesADescargar[0].titulo || 'Apunte')
      .replace(/[^a-z0-9\s-]/gi, '_')
      .substring(0, 50)
      .trim();
  } else {
    fileName = `Planivio-Apuntes-${Date.now()}`;
  }
  doc.save(`${fileName}.pdf`);
}

function imprimirApuntesSeleccionados(ids = state.apuntesSeleccionadosIds) {
  if (ids.length === 0) return;
  const apuntesAImprimir = state.apuntes.filter((apunte) =>
    ids.includes(apunte.id),
  );
  const accentColor = state.config.accent_color;

  let printHtml = `
        <style>
            @media print {
                /* CORRECCIÓN: Se eliminan los márgenes para ocultar encabezados/pies de página del navegador */
                @page { 
                    margin: 0; 
                    size: A4;
                }
                /* Se añade padding al body para compensar la falta de margen */
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
                    -webkit-print-color-adjust: exact;
                    color-adjust: exact;
                    padding: 2cm; /* Padding interno para el contenido */
                }
                h2 { 
                    color: ${accentColor}; 
                    font-size: 16pt; 
                    margin-top: 0;
                    margin-bottom: 5px; 
                }
                .apunte-impreso { 
                    page-break-inside: avoid; 
                    border-top: 1px solid #eee; 
                    padding-top: 20px; 
                    margin-top: 20px; 
                }
                .apunte-impreso:first-of-type { 
                    border-top: none; 
                    margin-top: 0; 
                    padding-top: 0; 
                }
                .meta { 
                    font-size: 9pt; 
                    color: #555; 
                    margin-top: 0; 
                    margin-bottom: 15px; 
                }
                .contenido { 
                    font-size: 11pt; 
                    line-height: 1.6; 
                    color: #333; 
                    word-wrap: break-word; 
                }
                .contenido * {
                    white-space: pre-wrap !important;
                }
            }
        </style>
    `; // CORRECCIÓN: El <h1> ha sido eliminado de aquí.

  apuntesAImprimir.forEach((apunte) => {
    const fecha = new Date(apunte.fechaModificacion).toLocaleDateString(
      'es-ES',
    );
    const contenidoHtml = apunte.contenido;

    printHtml += `
            <div class="apunte-impreso">
                <h2>${apunte.titulo || 'Apunte sin título'}</h2>
                <p class="meta">Curso: ${apunte.curso} | Última Modificación: ${fecha}</p>
                <div class="contenido">${contenidoHtml}</div>
            </div>
        `;
  });

  const printContainer = document.createElement('div');
  printContainer.id = 'print-container';
  printContainer.innerHTML = printHtml;
  document.body.appendChild(printContainer);

  setTimeout(() => {
    window.print();
    document.body.removeChild(printContainer);
  }, 100);
}

function descargarApunteActual() {
  if (apunteActivoId === null) return;
  descargarApuntesSeleccionados([apunteActivoId]);
}

function imprimirApunteActual() {
  if (apunteActivoId === null) return;
  imprimirApuntesSeleccionados([apunteActivoId]);
}

function autoGrowTitulo() {
  const inputTituloEl = document.getElementById('input-titulo-apunte');
  if (inputTituloEl) {
    inputTituloEl.style.height = 'auto';
    inputTituloEl.style.height = `${inputTituloEl.scrollHeight}px`;
  }
}

function popularFiltroDeCursosApuntes() {
  const selector = document.getElementById('filtro-curso-apuntes');
  if (!selector) return;
  const cursosConApuntes = [
    ...new Set(state.apuntes.map((a) => a.curso)),
  ].filter(Boolean);
  selector.innerHTML = '<option value="todos">Todos los Cursos</option>';
  cursosConApuntes.sort().forEach((nombreCurso) => {
    const opcion = document.createElement('option');
    opcion.value = nombreCurso;
    opcion.textContent = nombreCurso;
    selector.appendChild(opcion);
  });
  selector.value = state.filtroCursoApuntes;
}

function renderizarListaApuntes() {
  const listaApuntesEl = document.getElementById('lista-apuntes');
  if (!listaApuntesEl || !listaApuntesEl.parentElement) return;
  const scrollPosition = listaApuntesEl.parentElement.scrollTop;
  listaApuntesEl.innerHTML = '';

  let apuntesAMostrar = state.apuntes;
  if (state.filtroCursoApuntes !== 'todos') {
    apuntesAMostrar = state.apuntes.filter(
      (apunte) => apunte.curso === state.filtroCursoApuntes,
    );
  }

  const apuntesOrdenados = [...apuntesAMostrar].sort((a, b) => {
    if (a.fijado && !b.fijado) return -1;
    if (!a.fijado && b.fijado) return 1;
    return new Date(b.fechaModificacion) - new Date(a.fechaModificacion);
  });

  if (apuntesOrdenados.length === 0) {
    listaApuntesEl.innerHTML =
      '<li class="apunte-item-empty"><p>Crea tu primer apunte.</p></li>';
  } else {
    apuntesOrdenados.forEach((apunte) => {
      const fecha = new Date(apunte.fechaCreacion).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
      });
      const curso = apunte.curso || 'General';
      const preview = apunte.contenido
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/\s+/g, ' ')
        .substring(0, 120);
      const li = document.createElement('li');
      li.className = 'apunte-item';
      li.dataset.id = apunte.id;
      const isSelected = state.apuntesSeleccionadosIds.includes(apunte.id);

      if (apunte.id === apunteActivoId) li.classList.add('active');
      if (apunte.fijado) li.classList.add('fijado');
      if (isSelected) li.classList.add('seleccionado');

      li.innerHTML = `
                <div class="apunte-selection-control">
                    <input type="checkbox" id="select-apunte-${apunte.id}" ${isSelected ? 'checked' : ''}>
                    <label for="select-apunte-${apunte.id}"></label>
                </div>
                <div class="apunte-item-content">
                    <h4 class="apunte-item-titulo">${apunte.titulo || 'Apunte sin título'}</h4>
                    <p class="apunte-item-meta">${curso} - ${fecha}</p>
                    <p class="apunte-item-preview">${preview || 'Sin contenido...'}</p>
                </div>
                <div class="apunte-item-actions">
                    <div class="apunte-menu-container">
                        <button class="btn-icon btn-apunte-menu" data-action="toggle-menu">${ICONS.dots_vertical}</button>
                        <div class="apunte-actions-dropdown">
                            <button data-action="seleccionar">Seleccionar</button>
                            <button data-action="eliminar" class="btn-eliminar-apunte-item"><span>Eliminar</span></button>
                        </div>
                    </div>
                    <button class="btn-icon btn-apunte-fijar ${apunte.fijado ? 'active' : ''}" data-action="fijar" title="Fijar apunte">${ICONS.pin}</button>
                </div>
            `;
      listaApuntesEl.appendChild(li);
    });
  }
  if (listaApuntesEl.parentElement) {
    listaApuntesEl.parentElement.scrollTop = scrollPosition;
  }
}

function renderizarEditor() {
  const apunte = state.apuntes.find((a) => a.id === apunteActivoId);
  const inputTituloEl = document.getElementById('input-titulo-apunte');
  const trixEditorEl = document.querySelector('trix-editor');
  const selectCursoEl = document.getElementById('select-curso-apunte');
  const btnEliminarApunteEl = document.getElementById('btn-eliminar-apunte');

  if (inputTituloEl && trixEditorEl && selectCursoEl && btnEliminarApunteEl) {
    if (apunte) {
      inputTituloEl.value = apunte.titulo;
      if (trixEditorEl.editor) trixEditorEl.editor.loadHTML(apunte.contenido);
      selectCursoEl.value = apunte.curso || 'General';
      btnEliminarApunteEl.style.display = 'block';
    } else {
      inputTituloEl.value = '';
      if (trixEditorEl.editor) trixEditorEl.editor.loadHTML('');
      selectCursoEl.value = state.cursos[0] || 'General';
      btnEliminarApunteEl.style.display = 'none';
    }
  }
  setTimeout(autoGrowTitulo, 0);
}

function renderizarBarraAcciones() {
  const panelListaApuntes = document.getElementById('panel-lista-apuntes');
  if (!panelListaApuntes) return;
  panelListaApuntes.classList.toggle(
    'modo-seleccion',
    state.apuntesEnModoSeleccion,
  );

  if (!state.apuntesEnModoSeleccion) return;

  const selectionInfo = document.getElementById('apuntes-selection-info');
  const selectAllCheckbox = document.getElementById('select-all-apuntes');
  if (!selectionInfo || !selectAllCheckbox) return;

  const totalSeleccionados = state.apuntesSeleccionadosIds.length;
  const totalApuntesVisibles = document.querySelectorAll(
    '#lista-apuntes li[data-id]',
  ).length;
  selectionInfo.textContent = `${totalSeleccionados} seleccionado(s)`;

  if (totalSeleccionados === totalApuntesVisibles && totalApuntesVisibles > 0) {
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

function renderizarPaginaApuntes() {
  popularFiltroDeCursosApuntes();
  renderizarListaApuntes();
  renderizarBarraAcciones();
}

function handleInput() {
  if (apunteActivoId === null) {
    const titulo = document.getElementById('input-titulo-apunte')?.value.trim();
    const contenido = document
      .querySelector('trix-editor')
      ?.editor.getDocument()
      .toString()
      .trim();
    if (titulo === '' && contenido === '') return;
    crearNuevoApunte();
  }
  handleAutoSave();
}

function crearNuevoApunte() {
  const nuevoApunte = {
    id: Date.now(),
    titulo: document.getElementById('input-titulo-apunte').value.trim(),
    contenido: document.querySelector('trix-editor').value,
    curso: document.getElementById('select-curso-apunte').value,
    fechaCreacion: new Date().toISOString(),
    fechaModificacion: new Date().toISOString(),
    fijado: false,
  };
  state.apuntes.unshift(nuevoApunte);
  apunteActivoId = nuevoApunte.id;
  renderizarPaginaApuntes();
}

function handleAutoSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const apunte = state.apuntes.find((a) => a.id === apunteActivoId);
    if (apunte) {
      const tituloAnterior = apunte.titulo;
      apunte.titulo = document
        .getElementById('input-titulo-apunte')
        .value.trim();
      apunte.contenido = document.querySelector('trix-editor').value;
      apunte.curso = document.getElementById('select-curso-apunte').value;
      apunte.fechaModificacion = new Date().toISOString();
      guardarDatos();
      if (apunte.titulo !== tituloAnterior) {
        renderizarPaginaApuntes();
      }
    }
  }, 500);
}

function seleccionarNuevoApunte() {
  if (state.apuntesEnModoSeleccion) {
    exitSelectionMode();
  }
  apunteActivoId = null;
  renderizarPaginaApuntes();
  renderizarEditor();
  document.getElementById('input-titulo-apunte')?.focus();
}

function eliminarApunte(id) {
  if (id === null) return;
  const apunte = state.apuntes.find((a) => a.id === id);
  if (!apunte) return;

  mostrarConfirmacion(
    'Eliminar Apunte',
    `¿Estás seguro de que quieres eliminar "${apunte.titulo || 'este apunte'}"?`,
    () => {
      state.apuntes = state.apuntes.filter((a) => a.id !== id);
      if (apunteActivoId === id) {
        apunteActivoId = null;
        renderizarEditor();
      }
      exitSelectionMode();
      guardarDatos();
      renderizarPaginaApuntes();
    },
  );
}

function exitSelectionMode() {
  state.apuntesEnModoSeleccion = false;
  state.apuntesSeleccionadosIds = [];
  renderizarPaginaApuntes();
}

function handleSelectAll(e) {
  const apuntesVisiblesIds = Array.from(
    document.querySelectorAll('#lista-apuntes li[data-id]'),
  ).map((li) => parseInt(li.dataset.id));
  if (e.target.checked) {
    state.apuntesSeleccionadosIds = [
      ...new Set([...state.apuntesSeleccionadosIds, ...apuntesVisiblesIds]),
    ];
  } else {
    state.apuntesSeleccionadosIds = state.apuntesSeleccionadosIds.filter(
      (id) => !apuntesVisiblesIds.includes(id),
    );
  }
  if (state.apuntesSeleccionadosIds.length === 0) {
    exitSelectionMode();
  } else {
    renderizarPaginaApuntes();
  }
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
      if (state.apuntesSeleccionadosIds.includes(apunteActivoId)) {
        apunteActivoId = null;
        renderizarEditor();
      }
      exitSelectionMode();
      guardarDatos();
    },
  );
}

function handleSeleccionarApunte(apunteLi) {
  if (state.apuntesEnModoSeleccion) return;
  apunteActivoId = parseInt(apunteLi.dataset.id, 10);
  renderizarPaginaApuntes();
  renderizarEditor();
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
    dropdown?.classList.toggle('visible');
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

function toggleFijarApunte(id) {
  const apunte = state.apuntes.find((a) => a.id === id);
  if (apunte) {
    apunte.fijado = !apunte.fijado;
    guardarDatos();
    renderizarPaginaApuntes();
  }
}

export function inicializarApuntes() {
  const selectCursoApunte = document.getElementById('select-curso-apunte');
  if (selectCursoApunte) {
    popularSelectorDeCursos(selectCursoApunte);
  }
  renderizarPaginaApuntes();
  renderizarEditor();

  const btnNuevoApunteEl = document.getElementById('btn-nuevo-apunte');
  if (btnNuevoApunteEl && !btnNuevoApunteEl.dataset.initialized) {
    btnNuevoApunteEl.addEventListener('click', seleccionarNuevoApunte);
    btnNuevoApunteEl.dataset.initialized = 'true';
  }

  const btnEliminarApunteEl = document.getElementById('btn-eliminar-apunte');
  if (btnEliminarApunteEl) {
    btnEliminarApunteEl.addEventListener('click', () =>
      eliminarApunte(apunteActivoId),
    );
  }

  const listaApuntesEl = document.getElementById('lista-apuntes');
  if (listaApuntesEl) {
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
  }

  const inputTituloEl = document.getElementById('input-titulo-apunte');
  if (inputTituloEl) {
    inputTituloEl.addEventListener('input', () => {
      autoGrowTitulo();
      handleInput();
    });
  }

  const trixEditorEl = document.querySelector('trix-editor');
  if (trixEditorEl) {
    trixEditorEl.addEventListener('trix-change', handleInput);
  }

  const selectCursoEditor = document.getElementById('select-curso-apunte');
  if (selectCursoEditor) {
    selectCursoEditor.addEventListener('change', handleAutoSave);
  }

  const filtroCursoSelect = document.getElementById('filtro-curso-apuntes');
  if (filtroCursoSelect) {
    filtroCursoSelect.addEventListener('change', (e) => {
      state.filtroCursoApuntes = e.target.value;
      renderizarPaginaApuntes();
    });
  }

  const selectAllCheckbox = document.getElementById('select-all-apuntes');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', handleSelectAll);
  }

  const btnDeleteSelected = document.getElementById('btn-delete-selected');
  if (btnDeleteSelected) {
    btnDeleteSelected.innerHTML = ICONS.delete;
    btnDeleteSelected.addEventListener('click', eliminarApuntesSeleccionados);
  }

  const btnPrintSelected = document.getElementById('btn-print-selected');
  if (btnPrintSelected) {
    btnPrintSelected.innerHTML = ICONS.print;
    btnPrintSelected.addEventListener('click', () =>
      imprimirApuntesSeleccionados(),
    );
  }

  const btnDownloadSelected = document.getElementById('btn-download-selected');
  if (btnDownloadSelected) {
    btnDownloadSelected.innerHTML = ICONS.download;
    btnDownloadSelected.addEventListener('click', () =>
      descargarApuntesSeleccionados(),
    );
  }

  const btnEditorMenu = document.getElementById('btn-editor-menu');
  const editorMenuDropdown = document.getElementById('editor-menu-dropdown');
  if (btnEditorMenu && editorMenuDropdown) {
    btnEditorMenu.innerHTML = ICONS.menu;
    btnEditorMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      editorMenuDropdown.classList.toggle('visible');
    });
    document.addEventListener('click', (e) => {
      if (
        btnEditorMenu &&
        !btnEditorMenu.contains(e.target) &&
        !editorMenuDropdown.contains(e.target)
      ) {
        editorMenuDropdown.classList.remove('visible');
      }
    });
  }

  const btnDescargarActual = document.getElementById('btn-descargar-actual');
  if (btnDescargarActual) {
    btnDescargarActual.addEventListener('click', () => {
      descargarApunteActual();
      if (editorMenuDropdown) editorMenuDropdown.classList.remove('visible');
    });
  }

  const btnImprimirActual = document.getElementById('btn-imprimir-actual');
  if (btnImprimirActual) {
    btnImprimirActual.addEventListener('click', () => {
      imprimirApunteActual();
      if (editorMenuDropdown) editorMenuDropdown.classList.remove('visible');
    });
  }
}
