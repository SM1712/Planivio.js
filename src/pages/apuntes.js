import { state } from '../state.js';
import { guardarDatos } from '../utils.js';
import {
  mostrarConfirmacion,
  cerrarModal,
  mostrarModal,
  popularSelectorDeCursos,
  popularSelectorDeProyectos,
} from '../ui.js';
import { ICONS } from '../icons.js';

let apunteActivoId = null;
let saveTimeout;

let filtroCurso = 'todos';
let filtroProyecto = 'todos';
let filtroTag = 'todos';
let mostrarSoloFavoritos = false;
let ordenFechaAsc = false;
let searchTermApuntes = '';
let filtrosDropdownClickHandler = null;

function abrirEditorMovil() {
  const editorPanel = document.getElementById('panel-editor-apuntes');
  if (editorPanel) {
    editorPanel.classList.add('visible-movil');
    // Forzar renderizado del editor si TinyMCE ya está inicializado
    const editor = tinymce.get('editor-tinymce');
    if (editor) {
      // Un pequeño truco para forzar el redibujado a veces necesario
      editor.execCommand('mceRepaint');
      // Enfocar el título (o el editor si no hay título)
      setTimeout(() => {
        const tituloInput = document.getElementById('input-titulo-apunte');
        if (tituloInput && tituloInput.value === '') {
          tituloInput.focus();
        } else if (editor) {
          editor.focus();
        }
      }, 350); // Esperar que termine la animación
    }
  }
}

function cerrarEditorMovil() {
  const editorPanel = document.getElementById('panel-editor-apuntes');
  if (editorPanel) {
    editorPanel.classList.remove('visible-movil');
    // Opcional: Deseleccionar apunte activo para claridad al volver a la lista
    // apunteActivoId = null;
    // renderizarListaApuntes(); // Actualiza la lista para quitar el 'active'
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

  // Verifica que jsPDF esté cargado antes de usarlo
  if (!window.jspdf || !window.jspdf.jsPDF) {
    console.error('Error: La biblioteca jsPDF no está cargada.');
    // Assuming mostrarAlerta is globally available or imported
    if (typeof mostrarAlerta === 'function') {
      mostrarAlerta(
        'Error',
        'No se pudo generar el PDF. La biblioteca jsPDF no está disponible.',
      );
    } else {
      alert('Error: La biblioteca jsPDF no está disponible.'); // Fallback alert
    }
    return;
  }
  // Verifica que jsPDF-AutoTable esté cargado
  if (typeof window.jspdf.jsPDF.API?.autoTable !== 'function') {
    // Use optional chaining for safety
    console.error('Error: El plugin jsPDF-AutoTable no está cargado.');
    if (typeof mostrarAlerta === 'function') {
      mostrarAlerta(
        'Error',
        'No se pudo generar la tabla del PDF. El plugin jsPDF-AutoTable no está disponible.',
      );
    } else {
      alert('Error: El plugin jsPDF-AutoTable no está disponible.'); // Fallback alert
    }
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const apuntesADescargar = state.apuntes.filter((apunte) =>
    ids.includes(apunte.id),
  );
  const accentColor = state.config.accent_color;

  const body = [];
  apuntesADescargar.forEach((apunte) => {
    const fecha = new Date(apunte.fechaModificacion).toLocaleDateString(
      'es-ES',
    );
    const titulo = apunte.titulo || 'Apunte sin título';
    const proyecto = apunte.proyectoId
      ? state.proyectos.find((p) => p.id === apunte.proyectoId)?.nombre
      : null;

    let meta = `Curso: ${apunte.curso}`;
    if (proyecto) {
      meta += ` | Proyecto: ${proyecto}`;
    }
    if (apunte.tags && apunte.tags.length > 0) {
      meta += ` | Etiquetas: ${apunte.tags.join(', ')}`;
    }
    meta += ` | Última Modificación: ${fecha}`;

    // Usar DIV temporal para extraer texto
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = apunte.contenido;
    const contenidoTexto = tempDiv.textContent || tempDiv.innerText || '';

    body.push([
      {
        content: titulo,
        styles: {
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
          fontSize: 11,
          textColor: [50, 50, 50],
          cellPadding: { bottom: 10 },
        },
      },
    ]);
  }); // Fin forEach

  try {
    doc.autoTable({
      head: [
        [
          {
            content: 'Planivio - Apuntes Exportados',
            styles: {
              fillColor: false,
              textColor: accentColor,
              fontSize: 18,
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
        addPageNumbers(doc); // Assuming addPageNumbers is defined elsewhere
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
  } catch (error) {
    console.error('Error al generar la tabla PDF con jsPDF-AutoTable:', error);
    // Assuming mostrarAlerta is globally available or imported
    if (typeof mostrarAlerta === 'function') {
      mostrarAlerta(
        'Error PDF',
        'Ocurrió un error al generar la tabla del documento PDF.',
      );
    } else {
      alert(
        'Error PDF: Ocurrió un error al generar la tabla del documento PDF.',
      ); // Fallback alert
    }
  }
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
                @page { margin: 0; size: A4; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; -webkit-print-color-adjust: exact; color-adjust: exact; padding: 2cm; }
                h2 { color: ${accentColor}; font-size: 16pt; margin-top: 0; margin-bottom: 5px; }
                .apunte-impreso { page-break-inside: avoid; border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; }
                .apunte-impreso:first-of-type { border-top: none; margin-top: 0; padding-top: 0; }
                .meta { font-size: 9pt; color: #555; margin-top: 0; margin-bottom: 15px; }
                .contenido { font-size: 11pt; line-height: 1.6; color: #333; word-wrap: break-word; }
                .contenido * { white-space: pre-wrap !important; }
            }
        </style>
    `;
  apuntesAImprimir.forEach((apunte) => {
    const fecha = new Date(apunte.fechaModificacion).toLocaleDateString(
      'es-ES',
    );
    const proyecto = apunte.proyectoId
      ? state.proyectos.find((p) => p.id === apunte.proyectoId)?.nombre
      : null;

    let meta = `Curso: ${apunte.curso}`;
    if (proyecto) {
      meta += ` | Proyecto: ${proyecto}`;
    }
    if (apunte.tags && apunte.tags.length > 0) {
      meta += ` | Etiquetas: ${apunte.tags.join(', ')}`;
    }
    meta += ` | Última Modificación: ${fecha}`;

    const contenidoHtml = apunte.contenido;
    printHtml += `
            <div class="apunte-impreso">
                <h2>${apunte.titulo || 'Apunte sin título'}</h2>
                <p class="meta">${meta}</p>
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

function renderizarListaApuntes() {
  const listaApuntesEl = document.getElementById('lista-apuntes');
  if (!listaApuntesEl || !listaApuntesEl.parentElement) return;
  const scrollPosition = listaApuntesEl.parentElement.scrollTop;
  listaApuntesEl.innerHTML = '';

  // --- Lógica de Filtrado ---
  const terminoBusqueda = searchTermApuntes.toLowerCase(); // Usar la nueva variable

  let apuntesFiltrados = state.apuntes.filter((apunte) => {
    // 0. Búsqueda por Título (¡NUEVO!)
    if (
      terminoBusqueda &&
      !apunte.titulo.toLowerCase().includes(terminoBusqueda)
    ) {
      return false;
    }
    // 1. Filtro Curso
    if (filtroCurso !== 'todos' && apunte.curso !== filtroCurso) {
      return false;
    }
    // 2. Filtro Proyecto
    if (
      filtroProyecto !== 'todos' &&
      String(apunte.proyectoId) !== filtroProyecto
    ) {
      // Convertimos a string para comparar, ya que el value del select es string
      return false;
    }
    // 3. Filtro Favoritos
    if (mostrarSoloFavoritos && !apunte.isFavorito) {
      return false;
    }
    // 4. Filtro Tag
    if (
      filtroTag !== 'todos' &&
      (!apunte.tags || !apunte.tags.includes(filtroTag))
    ) {
      return false;
    }
    // Si pasa todos los filtros, se muestra
    return true;
  });
  // -------------------------

  // --- Lógica de Ordenamiento ---
  const apuntesOrdenados = [...apuntesFiltrados].sort((a, b) => {
    // 1. Favoritos (sin cambios)
    if (a.isFavorito && !b.isFavorito) return -1;
    if (!a.isFavorito && b.isFavorito) return 1;
    // 2. Fijados (sin cambios)
    if (a.fijado && !b.fijado) return -1;
    if (!a.fijado && b.fijado) return 1;
    // 3. Orden por Fecha (modificado)
    const fechaA = new Date(a.fechaModificacion);
    const fechaB = new Date(b.fechaModificacion);
    return ordenFechaAsc ? fechaA - fechaB : fechaB - fechaA; // Ascendente o Descendente
  });
  // ----------------------------

  if (apuntesOrdenados.length === 0) {
    // Mensaje dinámico si no hay resultados por búsqueda o filtro
    listaApuntesEl.innerHTML = terminoBusqueda
      ? '<li class="apunte-item-empty"><p>No se encontraron apuntes para "' +
        searchTermApuntes +
        '".</p></li>'
      : '<li class="apunte-item-empty"><p>No se encontraron apuntes con los filtros actuales.</p></li>';
  } else {
    apuntesOrdenados.forEach((apunte) => {
      // ... (resto del renderizado del <li> sin cambios) ...
      const fecha = new Date(apunte.fechaCreacion).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
      });
      const curso = apunte.curso || 'General';
      const proyecto = apunte.proyectoId
        ? state.proyectos.find((p) => p.id === apunte.proyectoId)?.nombre
        : null;

      let tagsHtml = '';
      if (apunte.tags && apunte.tags.length > 0) {
        tagsHtml = '<div class="apunte-item-tags">';
        apunte.tags.forEach((tag) => {
          tagsHtml += `<span class="apunte-tag">#${tag}</span>`;
        });
        tagsHtml += '</div>';
      }

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
      if (apunte.isFavorito) li.classList.add('favorito');

      let metaInfo = curso;
      if (proyecto) {
        metaInfo += ` / ${proyecto}`;
      }
      metaInfo += ` - ${fecha}`;

      const pinBtnHtml = `<button class="btn-icon btn-apunte-fijar ${apunte.fijado ? 'active' : ''}" data-action="fijar" title="Fijar apunte">${ICONS.pin}</button>`;
      const favoritoBtnHtml = `<button class="btn-icon btn-apunte-favorito ${apunte.isFavorito ? 'active' : ''}" data-action="favorito" title="Marcar como favorito">${apunte.isFavorito ? ICONS.star_filled : ICONS.star_outline}</button>`;
      const menuBtnHtml = `<div class="apunte-menu-container"><button class="btn-icon btn-apunte-menu" data-action="toggle-menu">${ICONS.dots_vertical}</button><div class="apunte-actions-dropdown"><button data-action="seleccionar">Seleccionar</button><button data-action="eliminar" class="btn-eliminar-apunte-item"><span>Eliminar</span></button></div></div>`;

      li.innerHTML = `
                <div class="apunte-selection-control">
                    <input type="checkbox" id="select-apunte-${apunte.id}" ${isSelected ? 'checked' : ''}>
                    <label for="select-apunte-${apunte.id}"></label>
                </div>
                <div class="apunte-item-content">
                    <h4 class="apunte-item-titulo">${apunte.titulo || 'Apunte sin título'}</h4>
                    <p class="apunte-item-meta">${metaInfo}</p>
                    <p class="apunte-item-preview">${preview || 'Sin contenido...'}</p>
                    ${tagsHtml} 
                </div>
                <div class="apunte-item-actions">
                    ${menuBtnHtml}     
                    ${pinBtnHtml}      
                    ${favoritoBtnHtml} 
                </div>
            `;
      listaApuntesEl.appendChild(li);
    });
  }
  if (listaApuntesEl.parentElement) {
    listaApuntesEl.parentElement.scrollTop = scrollPosition;
  }
}

// ===== INICIO DE CAMBIOS (renderizarEditor) =====
function renderizarEditor() {
  const apunte = state.apuntes.find((a) => a.id === apunteActivoId);
  const inputTituloEl = document.getElementById('input-titulo-apunte');
  const selectCursoEl = document.getElementById('select-curso-apunte');
  // Se elimina btnEliminarApunteEl del footer
  const btnFavoritoEl = document.getElementById('btn-editor-favorito');
  const selectProyectoEl = document.getElementById('select-proyecto-apunte');
  const inputTagsEl = document.getElementById('input-tags-apunte');
  // --- NUEVO ELEMENTO ---
  const btnEliminarEditorEl = document.getElementById('btn-editor-eliminar');
  // --------------------

  const editor = tinymce.get('editor-tinymce');

  // Añadimos btnEliminarEditorEl a la condición
  if (
    inputTituloEl &&
    selectCursoEl &&
    btnFavoritoEl &&
    selectProyectoEl &&
    inputTagsEl &&
    btnEliminarEditorEl
  ) {
    popularSelectorDeProyectos('select-proyecto-apunte');

    if (apunte) {
      inputTituloEl.value = apunte.titulo;

      if (editor) {
        editor.setContent(apunte.contenido);
      }

      selectCursoEl.value = apunte.curso || 'General';
      // --- VISIBILIDAD BOTÓN ELIMINAR ---
      btnEliminarEditorEl.style.display = 'inline-flex'; // Mostrar como icono flex
      // ---------------------------------

      selectProyectoEl.value = apunte.proyectoId || '';
      btnFavoritoEl.innerHTML = apunte.isFavorito
        ? ICONS.star_filled
        : ICONS.star_outline;
      btnFavoritoEl.classList.toggle('active', apunte.isFavorito);

      inputTagsEl.value = apunte.tags ? apunte.tags.join(', ') : '';
    } else {
      // Si es un apunte nuevo
      inputTituloEl.value = '';

      if (editor) {
        editor.setContent('');
      }

      const primerCurso = state.cursos.find((c) => !c.isArchivado);
      selectCursoEl.value = primerCurso ? primerCurso.nombre : 'General';
      // --- VISIBILIDAD BOTÓN ELIMINAR ---
      btnEliminarEditorEl.style.display = 'none'; // Ocultar si es nuevo
      // ---------------------------------

      selectProyectoEl.value = '';
      btnFavoritoEl.innerHTML = ICONS.star_outline;
      btnFavoritoEl.classList.remove('active');

      inputTagsEl.value = '';
    }
  }
  setTimeout(autoGrowTitulo, 0);
}
// ===== FIN DE CAMBIOS (renderizarEditor) =====

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
  renderizarListaApuntes();
  renderizarBarraAcciones();
}
function handleInput() {
  if (apunteActivoId === null) {
    const titulo = document.getElementById('input-titulo-apunte')?.value.trim();
    const contenido = tinymce.get('editor-tinymce')?.getContent().trim() || '';

    if (titulo === '' && contenido === '') return;
    crearNuevoApunte();
  }
  handleAutoSave();
}
function crearNuevoApunte() {
  const tagsInput = document.getElementById('input-tags-apunte');
  const tagsArray = tagsInput
    ? tagsInput.value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== '')
        .filter((tag, index, self) => self.indexOf(tag) === index)
    : [];

  const nuevoApunte = {
    id: Date.now(),
    titulo: document.getElementById('input-titulo-apunte').value.trim(),
    contenido: tinymce.get('editor-tinymce')?.getContent() || '',
    curso: document.getElementById('select-curso-apunte').value,
    fechaCreacion: new Date().toISOString(),
    fechaModificacion: new Date().toISOString(),
    fijado: false,
    isFavorito:
      document
        .getElementById('btn-editor-favorito')
        ?.classList.contains('active') || false,
    proyectoId:
      parseInt(document.getElementById('select-proyecto-apunte').value) || null,
    tags: tagsArray,
  };
  state.apuntes.unshift(nuevoApunte);
  apunteActivoId = nuevoApunte.id;
  renderizarPaginaApuntes();

  // --- MOSTRAR BOTÓN ELIMINAR DEL EDITOR ---
  const btnEliminarEditorEl = document.getElementById('btn-editor-eliminar');
  if (btnEliminarEditorEl) {
    btnEliminarEditorEl.style.display = 'inline-flex';
  }
  // ---------------------------------------
}
function handleAutoSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const apunte = state.apuntes.find((a) => a.id === apunteActivoId);
    if (apunte) {
      const tituloAnterior = apunte.titulo;
      const cursoAnterior = apunte.curso;
      const proyectoAnterior = apunte.proyectoId;
      const tagsAnteriores = JSON.stringify(apunte.tags);

      apunte.titulo = document
        .getElementById('input-titulo-apunte')
        .value.trim();
      apunte.contenido = tinymce.get('editor-tinymce')?.getContent() || '';
      apunte.curso = document.getElementById('select-curso-apunte').value;
      apunte.proyectoId =
        parseInt(document.getElementById('select-proyecto-apunte').value) ||
        null;

      const tagsInput = document.getElementById('input-tags-apunte');
      const tagsArray = tagsInput
        ? tagsInput.value
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag !== '')
            .filter((tag, index, self) => self.indexOf(tag) === index)
        : [];
      apunte.tags = tagsArray;

      apunte.fechaModificacion = new Date().toISOString();

      guardarDatos();

      if (
        apunte.titulo !== tituloAnterior ||
        apunte.curso !== cursoAnterior ||
        apunte.proyectoId !== proyectoAnterior ||
        JSON.stringify(apunte.tags) !== tagsAnteriores
      ) {
        if (apunte.curso !== cursoAnterior) {
          popularFiltroDeCursosApuntes();
        }
        renderizarListaApuntes();
      }
    }
  }, 500);
}
function seleccionarNuevoApunte() {
  if (state.apuntesEnModoSeleccion) {
    exitSelectionMode();
  }
  apunteActivoId = null; // Marcar que no hay apunte seleccionado
  // renderizarListaApuntes(); // No es necesario aquí si no cambiamos selección visual
  renderizarEditor(); // Limpia el editor

  // --- Lógica Móvil ---
  if (window.innerWidth <= 900) {
    abrirEditorMovil(); // Abre el overlay del editor
  } else {
    document.getElementById('input-titulo-apunte')?.focus(); // Foco normal en escritorio
  }
  // ------------------
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
        renderizarEditor(); // Esto ocultará el botón eliminar del editor
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
  if (state.apuntesEnModoSeleccion) return; // No hacer nada si está en modo selección

  const nuevoId = parseInt(apunteLi.dataset.id, 10);

  // Evitar recargar si ya está seleccionado (útil en escritorio)
  if (nuevoId === apunteActivoId && window.innerWidth > 900) {
    return;
  }

  apunteActivoId = nuevoId; // Establecer el nuevo ID activo
  renderizarListaApuntes(); // Actualiza la lista para marcar el nuevo activo
  renderizarEditor(); // Carga el contenido del apunte seleccionado

  // --- Lógica Móvil ---
  if (window.innerWidth <= 900) {
    abrirEditorMovil(); // Abre el overlay del editor
  }
  // ------------------
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
  if (action === 'favorito') {
    toggleFavorito(apunteId);
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
function toggleFavorito(id) {
  const apunte = state.apuntes.find((a) => a.id === id);
  if (apunte) {
    apunte.isFavorito = !apunte.isFavorito;
    guardarDatos();
    renderizarPaginaApuntes();
    if (id === apunteActivoId) {
      const btnFavoritoEl = document.getElementById('btn-editor-favorito');
      if (btnFavoritoEl) {
        btnFavoritoEl.innerHTML = apunte.isFavorito
          ? ICONS.star_filled
          : ICONS.star_outline;
        btnFavoritoEl.classList.toggle('active', apunte.isFavorito);
      }
    }
  }
}
function toggleEditorFavorito() {
  if (apunteActivoId === null) return;

  const apunte = state.apuntes.find((a) => a.id === apunteActivoId);
  if (apunte) {
    toggleFavorito(apunteActivoId);
  }
}
function inicializarTinyMCE() {
  tinymce.remove('#editor-tinymce');

  tinymce.init({
    selector: '#editor-tinymce',
    promotion: false,
    branding: false,
    menubar: false,
    statusbar: false,
    plugins: 'autoresize lists link autolink',
    toolbar:
      'bold italic underline strikethrough | ' +
      'backcolor | ' +
      'bullist numlist | ' +
      'link | ' +
      'undo redo',
    autoresize_bottom_margin: 20,
    content_style: `
    html { 
        /* Asegura que el html ocupe toda la altura del iframe */
        height: 100%; 
      }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
        line-height: 1.6;
        color: var(--text-base);
        padding: 0 10px !important; /* Ajustado padding */
        margin: 0; /* Asegura que no haya márgenes extraños */
        height: 100%; /* Ocupa toda la altura del html */
        box-sizing: border-box; /* Incluye padding en la altura */
        overflow-y: auto !important; /* ¡Clave! Añade scroll vertical al body */
      }
      a { color: var(--accent-color); }
      ::marker { color: var(--text-muted); }
    `,
    skin: document.body.classList.contains('dark-theme')
      ? 'oxide-dark'
      : 'oxide',
    content_css: document.body.classList.contains('dark-theme')
      ? 'dark'
      : 'default',

    setup: (editor) => {
      editor.on('init', () => {
        editor.getContainer().style.visibility = 'visible';
        renderizarEditor();
      });
      editor.on('input', () => {
        handleInput();
      });
      editor.on('change', () => {
        handleAutoSave();
      });
    },
  });
}

function renderizarMenuFiltros() {
  const menuEl = document.getElementById('menu-filtros-apuntes-dropdown');
  if (!menuEl) return;

  const cursosDisponibles = state.cursos.filter((c) => !c.isArchivado);
  const proyectosDisponibles = state.proyectos;
  const tagsUsadas = [
    ...new Set(state.apuntes.flatMap((a) => a.tags || [])),
  ].sort();

  // --- HTML del Menú (Usando ICONS.expand) ---
  menuEl.innerHTML = `
    <div class="filtro-seccion">
      <div class="filtro-seccion-titulo">Ordenar por Fecha</div>
      <div class="filtro-opcion ${!ordenFechaAsc ? 'active' : ''}" data-action="ordenar" data-valor="desc">Más Recientes Primero</div>
      <div class="filtro-opcion ${ordenFechaAsc ? 'active' : ''}" data-action="ordenar" data-valor="asc">Más Antiguos Primero</div>
    </div>

    <div class="filtro-seccion">
       <div class="filtro-seccion-titulo">Favoritos</div>
       <div class="filtro-opcion ${mostrarSoloFavoritos ? 'active' : ''}" data-action="filtrar-favoritos" data-valor="si">Mostrar Solo Favoritos</div>
       <div class="filtro-opcion ${!mostrarSoloFavoritos ? 'active' : ''}" data-action="filtrar-favoritos" data-valor="no">Mostrar Todos</div>
    </div>

    <div class="filtro-seccion">
      <div class="filtro-submenu-toggle" data-action="toggle-submenu" data-submenu="curso">
        <span>Curso</span>
        <span class="valor-actual">${filtroCurso === 'todos' ? 'Todos' : state.cursos.find((c) => c.nombre === filtroCurso)?.nombre || 'Todos'}</span>
        <span class="submenu-icono">${ICONS.expand}</span> </div>
      <div class="filtro-submenu hidden" data-submenu-id="curso">
        <div class="filtro-opcion ${filtroCurso === 'todos' ? 'active' : ''}" data-action="filtrar-curso" data-valor="todos">Todos los Cursos</div>
        ${cursosDisponibles
          .map(
            (curso) => `
          <div class="filtro-opcion ${filtroCurso === curso.nombre ? 'active' : ''}" data-action="filtrar-curso" data-valor="${curso.nombre}">
            ${curso.emoji ? curso.emoji + ' ' : ''}${curso.nombre}
          </div>
        `,
          )
          .join('')}
      </div>
    </div>

    <div class="filtro-seccion">
      <div class="filtro-submenu-toggle" data-action="toggle-submenu" data-submenu="proyecto">
        <span>Proyecto</span>
        <span class="valor-actual">${filtroProyecto === 'todos' ? 'Todos' : state.proyectos.find((p) => String(p.id) === filtroProyecto)?.nombre || 'Todos'}</span>
        <span class="submenu-icono">${ICONS.expand}</span> </div>
      <div class="filtro-submenu hidden" data-submenu-id="proyecto">
        <div class="filtro-opcion ${filtroProyecto === 'todos' ? 'active' : ''}" data-action="filtrar-proyecto" data-valor="todos">Todos los Proyectos</div>
        ${proyectosDisponibles
          .map(
            (proyecto) => `
          <div class="filtro-opcion ${filtroProyecto === String(proyecto.id) ? 'active' : ''}" data-action="filtrar-proyecto" data-valor="${proyecto.id}">
            ${proyecto.nombre}
          </div>
        `,
          )
          .join('')}
      </div>
    </div>

    ${
      tagsUsadas.length > 0
        ? `
    <div class="filtro-seccion">
      <div class="filtro-submenu-toggle" data-action="toggle-submenu" data-submenu="tag">
        <span>Etiqueta</span>
        <span class="valor-actual">${filtroTag === 'todos' ? 'Todas' : `#${filtroTag}`}</span>
        <span class="submenu-icono">${ICONS.expand}</span> </div>
      <div class="filtro-submenu hidden" data-submenu-id="tag">
        <div class="filtro-opcion ${filtroTag === 'todos' ? 'active' : ''}" data-action="filtrar-tag" data-valor="todos">Todas las Etiquetas</div>
        ${tagsUsadas
          .map(
            (tag) => `
          <div class="filtro-opcion ${filtroTag === tag ? 'active' : ''}" data-action="filtrar-tag" data-valor="${tag}">
            #${tag}
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
    `
        : ''
    }
  `;
}
function handleFiltrosDropdownClick(event) {
  const target = event.target;
  const opcion = target.closest('[data-action]');
  if (!opcion) return;

  const action = opcion.dataset.action;
  const valor = opcion.dataset.valor;
  const submenuId = opcion.dataset.submenu;

  let necesitaRenderLista = false;

  switch (action) {
    case 'ordenar':
      ordenFechaAsc = valor === 'asc';
      necesitaRenderLista = true;
      break;
    case 'filtrar-favoritos':
      mostrarSoloFavoritos = valor === 'si';
      necesitaRenderLista = true;
      break;
    case 'filtrar-curso':
      filtroCurso = valor;
      necesitaRenderLista = true;
      break;
    case 'filtrar-proyecto':
      filtroProyecto = valor;
      necesitaRenderLista = true;
      break;
    case 'filtrar-tag':
      filtroTag = valor;
      necesitaRenderLista = true;
      break;
    case 'toggle-submenu':
      const submenuEl = document.querySelector(
        `.filtro-submenu[data-submenu-id="${submenuId}"]`,
      );
      if (submenuEl) {
        submenuEl.classList.toggle('hidden');
        opcion.classList.toggle('abierto');
      }
      // No necesita re-renderizar la lista, solo abre/cierra
      break;
    default:
      return; // Acción desconocida
  }

  // Si se aplicó un filtro/orden, re-renderiza el menú y la lista
  if (necesitaRenderLista) {
    renderizarMenuFiltros(); // Actualiza visualmente el menú (checks, valores actuales)
    renderizarListaApuntes(); // Aplica los filtros a la lista
  }

  // Importante: No cerramos el menú aquí para permitir selecciones múltiples
  event.stopPropagation(); // Evita que el clic cierre el menú inmediatamente
}

export function inicializarApuntes() {
  // 1. Establecer el apunte activo (si viene de otra página)
  apunteActivoId = state.apunteSeleccionadoId || null;
  state.apunteSeleccionadoId = null;
  guardarDatos();

  // 2. Obtener el selector de curso del editor y popularlo
  const selectCursoApunte = document.getElementById('select-curso-apunte');
  if (selectCursoApunte) {
    popularSelectorDeCursos(selectCursoApunte, false);
    // Preseleccionar curso si viene de la página de cursos
    if (!apunteActivoId && state.cursoSeleccionadoId) {
      const curso = state.cursos.find(
        (c) => c.id === state.cursoSeleccionadoId,
      );
      if (
        curso &&
        selectCursoApunte.querySelector(`option[value="${curso.nombre}"]`)
      ) {
        selectCursoApunte.value = curso.nombre;
      }
      state.cursoSeleccionadoId = null;
      guardarDatos();
    }
  }

  // Renderizado inicial
  renderizarListaApuntes(); // Renderiza con filtros/búsqueda actuales
  inicializarTinyMCE();
  renderizarEditor(); // Renderiza según apunteActivoId

  // --- Lógica de Scroll (Solo Escritorio) ---
  if (apunteActivoId && window.innerWidth > 900) {
    setTimeout(() => {
      const apunteElemento = document.querySelector(
        `li[data-id="${apunteActivoId}"]`,
      );
      if (apunteElemento) {
        const scrollContainer =
          document.getElementById('lista-apuntes')?.parentElement;
        if (scrollContainer) {
          // Lógica para calcular scroll y centrar
          const containerRect = scrollContainer.getBoundingClientRect();
          const noteRect = apunteElemento.getBoundingClientRect();
          const noteTopRelativeToContainer = noteRect.top - containerRect.top;
          const containerHeight = scrollContainer.clientHeight;
          const noteHeight = apunteElemento.offsetHeight;
          const offset = containerHeight / 2 - noteHeight / 2;
          const newScrollTop =
            scrollContainer.scrollTop + noteTopRelativeToContainer - offset;
          scrollContainer.scrollTo({ top: newScrollTop, behavior: 'smooth' });
        } else {
          console.warn(
            "No se encontró el 'parentElement' de #lista-apuntes, usando scrollIntoView() de emergencia.",
          );
          apunteElemento.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
        // Resaltado temporal
        apunteElemento.classList.add('resaltado-temporal');
        setTimeout(
          () => apunteElemento.classList.remove('resaltado-temporal'),
          2500,
        );
      }
    }, 100);
  }

  // --- LISTENERS ---

  // Input Búsqueda
  const inputBuscarApuntes = document.getElementById('input-buscar-apuntes');
  if (inputBuscarApuntes) {
    inputBuscarApuntes.value = searchTermApuntes; // Restore value
    if (!inputBuscarApuntes.dataset.listenerAttached) {
      inputBuscarApuntes.addEventListener('input', (e) => {
        searchTermApuntes = e.target.value;
        renderizarListaApuntes();
      });
      inputBuscarApuntes.dataset.listenerAttached = 'true';
    }
  }

  // Botón Nuevo Apunte
  const btnNuevoApunteEl = document.getElementById('btn-nuevo-apunte');
  if (btnNuevoApunteEl) {
    btnNuevoApunteEl.innerHTML = ICONS.add;
    if (!btnNuevoApunteEl.dataset.listenerAttached) {
      btnNuevoApunteEl.addEventListener('click', seleccionarNuevoApunte);
      btnNuevoApunteEl.dataset.listenerAttached = 'true';
    }
  }

  // Botón Eliminar (Editor Header)
  const btnEliminarEditorEl = document.getElementById('btn-editor-eliminar');
  if (btnEliminarEditorEl) {
    btnEliminarEditorEl.innerHTML = ICONS.delete;
    if (!btnEliminarEditorEl.dataset.listenerAttached) {
      btnEliminarEditorEl.addEventListener('click', () => {
        if (apunteActivoId !== null) {
          eliminarApunte(apunteActivoId);
        }
      });
      btnEliminarEditorEl.dataset.listenerAttached = 'true';
    }
  }

  // --- Listener Lista de Apuntes (CORREGIDO y con Long Press) ---
  const listaApuntesEl = document.getElementById('lista-apuntes'); // Declarado UNA SOLA VEZ
  if (listaApuntesEl) {
    let touchstartTime = 0;
    let touchstartX = 0;
    let touchstartY = 0;
    let longPressTimeout = null;
    const LONG_PRESS_DURATION = 500;
    const MAX_MOVE_THRESHOLD = 10;

    // Limpiar listeners previos si existen
    if (listaApuntesEl.dataset.touchStartListener)
      listaApuntesEl.removeEventListener(
        'touchstart',
        listaApuntesEl._touchStartHandler,
      );
    if (listaApuntesEl.dataset.touchEndListener)
      listaApuntesEl.removeEventListener(
        'touchend',
        listaApuntesEl._touchEndHandler,
      );
    if (listaApuntesEl.dataset.touchMoveListener)
      listaApuntesEl.removeEventListener(
        'touchmove',
        listaApuntesEl._touchMoveHandler,
      );
    if (listaApuntesEl.dataset.clickListener)
      listaApuntesEl.removeEventListener('click', listaApuntesEl._clickHandler);

    // --- Handler Touch Start ---
    const touchStartHandler = (e) => {
      const apunteLi = e.target.closest('li[data-id]');
      if (!apunteLi || state.apuntesEnModoSeleccion) return;
      touchstartTime = Date.now();
      touchstartX = e.touches[0].clientX;
      touchstartY = e.touches[0].clientY;
      longPressTimeout = setTimeout(() => {
        longPressTimeout = null;
        const apunteId = parseInt(apunteLi.dataset.id, 10);
        state.apuntesEnModoSeleccion = true;
        if (!state.apuntesSeleccionadosIds.includes(apunteId)) {
          state.apuntesSeleccionadosIds.push(apunteId);
        }
        renderizarPaginaApuntes();
      }, LONG_PRESS_DURATION);
    };

    // --- Handler Touch Move ---
    const touchMoveHandler = (e) => {
      if (!longPressTimeout) return;
      const deltaX = Math.abs(e.touches[0].clientX - touchstartX);
      const deltaY = Math.abs(e.touches[0].clientY - touchstartY);
      if (deltaX > MAX_MOVE_THRESHOLD || deltaY > MAX_MOVE_THRESHOLD) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
      }
    };

    // --- Handler Touch End ---
    const touchEndHandler = (e) => {
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
        handleTap(e.target); // Llama a la lógica de tap normal
      }
    };

    // --- Handler Click (para escritorio y fallback) ---
    const clickHandler = (e) => {
      if (e.pointerType === 'touch' && !state.apuntesEnModoSeleccion) return;
      handleTap(e.target);
    };

    // --- Función Unificada para Tap/Click ---
    const handleTap = (targetElement) => {
      const apunteLi = targetElement.closest('li[data-id]');
      if (!apunteLi) return;
      const apunteId = parseInt(apunteLi.dataset.id, 10);
      const actionBtn = targetElement.closest('button[data-action]');
      const checkbox = targetElement.closest('input[type="checkbox"]');
      if (actionBtn) {
        handleActionClick(actionBtn.dataset.action, apunteId);
      } else if (checkbox || state.apuntesEnModoSeleccion) {
        handleCheckboxClick(apunteId);
      } else {
        handleSeleccionarApunte(apunteLi);
      }
    };

    // Adjuntar los nuevos listeners
    listaApuntesEl.addEventListener('touchstart', touchStartHandler);
    listaApuntesEl.addEventListener('touchend', touchEndHandler);
    listaApuntesEl.addEventListener('touchmove', touchMoveHandler);
    listaApuntesEl.addEventListener('click', clickHandler);

    // Guardar referencias y marcar listeners
    listaApuntesEl._touchStartHandler = touchStartHandler;
    listaApuntesEl._touchEndHandler = touchEndHandler;
    listaApuntesEl._touchMoveHandler = touchMoveHandler;
    listaApuntesEl._clickHandler = clickHandler;
    listaApuntesEl.dataset.touchStartListener = 'true';
    listaApuntesEl.dataset.touchEndListener = 'true';
    listaApuntesEl.dataset.touchMoveListener = 'true';
    listaApuntesEl.dataset.clickListener = 'true';
  }
  // --- Fin Listener Lista de Apuntes ---

  // Input Título
  const inputTituloEl = document.getElementById('input-titulo-apunte');
  if (inputTituloEl) {
    if (!inputTituloEl.dataset.listenerAttached) {
      inputTituloEl.addEventListener('input', () => {
        autoGrowTitulo();
        handleInput();
      });
      inputTituloEl.dataset.listenerAttached = 'true';
    }
  }

  // Select Curso (Editor)
  const selectCursoEditor = document.getElementById('select-curso-apunte');
  if (selectCursoEditor) {
    if (!selectCursoEditor.dataset.listenerAttached) {
      selectCursoEditor.addEventListener('change', handleAutoSave);
      selectCursoEditor.dataset.listenerAttached = 'true';
    }
  }

  // Select Proyecto (Editor)
  const selectProyectoEditor = document.getElementById(
    'select-proyecto-apunte',
  );
  if (selectProyectoEditor) {
    if (!selectProyectoEditor.dataset.listenerAttached) {
      selectProyectoEditor.addEventListener('change', handleAutoSave);
      selectProyectoEditor.dataset.listenerAttached = 'true';
    }
  }

  // Input Tags (Editor)
  const inputTagsEditor = document.getElementById('input-tags-apunte');
  if (inputTagsEditor) {
    if (!inputTagsEditor.dataset.listenerAttached) {
      inputTagsEditor.addEventListener('change', handleAutoSave);
      inputTagsEditor.dataset.listenerAttached = 'true';
    }
  }

  // Botón Favorito (Editor)
  const btnEditorFavorito = document.getElementById('btn-editor-favorito');
  if (btnEditorFavorito) {
    if (!btnEditorFavorito.dataset.listenerAttached) {
      btnEditorFavorito.addEventListener('click', toggleEditorFavorito);
      btnEditorFavorito.dataset.listenerAttached = 'true';
    }
  }

  // Botón Cerrar (Editor Móvil)
  const btnCerrarEditorMovil = document.getElementById(
    'btn-cerrar-editor-movil',
  );
  if (btnCerrarEditorMovil) {
    btnCerrarEditorMovil.innerHTML = ICONS.close;
    if (!btnCerrarEditorMovil.dataset.listenerAttached) {
      btnCerrarEditorMovil.addEventListener('click', cerrarEditorMovil);
      btnCerrarEditorMovil.dataset.listenerAttached = 'true';
    }
  }

  // Filtros Dropdown
  const btnFiltros = document.getElementById('btn-filtros-apuntes');
  const menuFiltros = document.getElementById('menu-filtros-apuntes-dropdown');
  if (btnFiltros && menuFiltros) {
    btnFiltros.innerHTML = ICONS.filter;
    if (!btnFiltros.dataset.listenerAttached) {
      btnFiltros.addEventListener('click', (e) => {
        e.stopPropagation();
        const menuVisible = !menuFiltros.classList.contains('hidden');
        if (!menuVisible) renderizarMenuFiltros();
        menuFiltros.classList.toggle('hidden');
      });
      btnFiltros.dataset.listenerAttached = 'true';
    }
    if (filtrosDropdownClickHandler)
      menuFiltros.removeEventListener('click', filtrosDropdownClickHandler);
    filtrosDropdownClickHandler = handleFiltrosDropdownClick;
    menuFiltros.addEventListener('click', filtrosDropdownClickHandler);
    if (!document.body.dataset.apuntesFiltroListener) {
      document.addEventListener(
        'click',
        (e) => {
          const menu = document.getElementById('menu-filtros-apuntes-dropdown'); // Re-get elements inside listener
          const btn = document.getElementById('btn-filtros-apuntes');
          if (
            menu &&
            btn &&
            !menu.classList.contains('hidden') &&
            !menu.contains(e.target) &&
            !btn.contains(e.target)
          ) {
            menu.classList.add('hidden');
          }
        },
        true,
      );
      document.body.dataset.apuntesFiltroListener = 'true';
    }
  }

  // Barra Selección Múltiple y Menú Editor
  const selectAllCheckbox = document.getElementById('select-all-apuntes');
  if (selectAllCheckbox) {
    if (!selectAllCheckbox.dataset.listenerAttached) {
      selectAllCheckbox.addEventListener('change', handleSelectAll);
      selectAllCheckbox.dataset.listenerAttached = 'true';
    }
  }
  const btnDeleteSelected = document.getElementById('btn-delete-selected');
  if (btnDeleteSelected) {
    btnDeleteSelected.innerHTML = ICONS.delete;
    if (!btnDeleteSelected.dataset.listenerAttached) {
      btnDeleteSelected.addEventListener('click', eliminarApuntesSeleccionados);
      btnDeleteSelected.dataset.listenerAttached = 'true';
    }
  }
  const btnPrintSelected = document.getElementById('btn-print-selected');
  if (btnPrintSelected) {
    btnPrintSelected.innerHTML = ICONS.print;
    if (!btnPrintSelected.dataset.listenerAttached) {
      btnPrintSelected.addEventListener('click', () =>
        imprimirApuntesSeleccionados(),
      );
      btnPrintSelected.dataset.listenerAttached = 'true';
    }
  }
  const btnDownloadSelected = document.getElementById('btn-download-selected');
  if (btnDownloadSelected) {
    btnDownloadSelected.innerHTML = ICONS.download;
    if (!btnDownloadSelected.dataset.listenerAttached) {
      btnDownloadSelected.addEventListener('click', () =>
        descargarApuntesSeleccionados(),
      );
      btnDownloadSelected.dataset.listenerAttached = 'true';
    }
  }
  const btnEditorMenu = document.getElementById('btn-editor-menu');
  const editorMenuDropdown = document.getElementById('editor-menu-dropdown');
  if (btnEditorMenu && editorMenuDropdown) {
    btnEditorMenu.innerHTML = ICONS.menu;
    if (!btnEditorMenu.dataset.listenerAttached) {
      btnEditorMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        editorMenuDropdown.classList.toggle('visible');
      });
      btnEditorMenu.dataset.listenerAttached = 'true';
    }
    if (!document.body.dataset.apuntesEditorMenuListener) {
      document.addEventListener('click', (e) => {
        const menu = document.getElementById('editor-menu-dropdown');
        const btn = document.getElementById('btn-editor-menu');
        if (
          menu &&
          btn &&
          menu.classList.contains('visible') &&
          !menu.contains(e.target) &&
          !btn.contains(e.target)
        ) {
          menu.classList.remove('visible');
        }
      });
      document.body.dataset.apuntesEditorMenuListener = 'true';
    }
  }
  const btnDescargarActual = document.getElementById('btn-descargar-actual');
  if (btnDescargarActual) {
    if (!btnDescargarActual.dataset.listenerAttached) {
      btnDescargarActual.addEventListener('click', () => {
        descargarApunteActual();
        document
          .getElementById('editor-menu-dropdown')
          ?.classList.remove('visible');
      });
      btnDescargarActual.dataset.listenerAttached = 'true';
    }
  }
  const btnImprimirActual = document.getElementById('btn-imprimir-actual');
  if (btnImprimirActual) {
    if (!btnImprimirActual.dataset.listenerAttached) {
      btnImprimirActual.addEventListener('click', () => {
        imprimirApunteActual();
        document
          .getElementById('editor-menu-dropdown')
          ?.classList.remove('visible');
      });
      btnImprimirActual.dataset.listenerAttached = 'true';
    }
  }
} // Fin de inicializarApuntes
