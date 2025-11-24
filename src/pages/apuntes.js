// ==========================================================================
// ==                      src/pages/apuntes.js                          ==
// ==========================================================================
//
// Módulo de Apuntes, migrado a la arquitectura "Pulso".
// (Versión 3 - Corregido "race condition" de autoguardado y error de selección)
//
// ==========================================================================

import { state } from '../state.js';
// import { guardarDatos } from '../utils.js'; // <-- ELIMINADO
import { EventBus } from '../eventBus.js'; // <-- AÑADIDO
// --- INICIO NUEVAS IMPORTACIONES FIREBASE ---
import {
  db,
  doc,
  agregarDocumento,
  actualizarDocumento,
  eliminarDocumento,
  crearBatch,
} from '../firebase.js';
// --- FIN NUEVAS IMPORTACIONES FIREBASE ---
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

  // Verifica que pdfmake y html-to-pdfmake estén cargados
  if (!window.pdfMake || !window.htmlToPdfmake) {
    console.error('Error: Las bibliotecas pdfMake o html-to-pdfmake no están cargadas.');
    if (typeof mostrarAlerta === 'function') {
      mostrarAlerta(
        'Error',
        'No se pudo generar el PDF. Las bibliotecas necesarias no están disponibles.',
      );
    } else {
      alert('Error: Las bibliotecas necesarias para PDF no están disponibles.');
    }
    return;
  }

  const apuntesADescargar = state.apuntes.filter((apunte) =>
    ids.includes(apunte.id),
  );
  const accentColor = state.config.accent_color || '#0078d7';

  // Definición base del documento
  const docDefinition = {
    content: [],
    styles: {
      titulo: {
        fontSize: 18,
        bold: true,
        color: accentColor,
        margin: [0, 0, 0, 10]
      },
      meta: {
        fontSize: 10,
        color: '#555555',
        margin: [0, 0, 0, 15]
      },
      htmlContent: {
        fontSize: 11,
        color: '#333333'
      }
    },
    defaultStyle: {
      font: 'Roboto' // pdfmake usa Roboto por defecto en vfs_fonts
    }
  };

  apuntesADescargar.forEach((apunte, index) => {
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

    // 1. Título del apunte
    docDefinition.content.push({ text: titulo, style: 'titulo' });

    // 2. Metadatos
    docDefinition.content.push({ text: meta, style: 'meta' });

    // 3. Contenido HTML convertido a pdfmake
    // htmlToPdfmake espera un string HTML o un elemento DOM.
    // Usamos el contenido HTML directo del apunte.
    // Es importante manejar estilos básicos que html-to-pdfmake soporta.
    const htmlContent = htmlToPdfmake(apunte.contenido, {
      defaultStyles: {
        // Estilos por defecto para elementos HTML
        p: { margin: [0, 0, 0, 10] },
        ul: { margin: [0, 0, 0, 10] },
        ol: { margin: [0, 0, 0, 10] },
        li: { margin: [0, 0, 0, 5] },
        h1: { fontSize: 16, bold: true, margin: [0, 10, 0, 5] },
        h2: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
        h3: { fontSize: 12, bold: true, margin: [0, 10, 0, 5] },
        strong: { bold: true },
        b: { bold: true },
        em: { italics: true },
        i: { italics: true },
        u: { decoration: 'underline' }
      }
    });

    docDefinition.content.push(htmlContent);

    // 4. Salto de página si no es el último apunte
    if (index < apuntesADescargar.length - 1) {
      docDefinition.content.push({ text: '', pageBreak: 'after' });
    }
  });

  try {
    let fileName;
    if (apuntesADescargar.length === 1) {
      fileName = (apuntesADescargar[0].titulo || 'Apunte')
        .replace(/[^a-z0-9\s-]/gi, '_')
        .substring(0, 50)
        .trim();
    } else {
      fileName = `Planivio-Apuntes-${Date.now()}`;
    }
    
    pdfMake.createPdf(docDefinition).download(`${fileName}.pdf`);
    console.log('[Apuntes] PDF generado y descargado con pdfmake.');

  } catch (error) {
    console.error('Error al generar el PDF con pdfmake:', error);
    if (typeof mostrarAlerta === 'function') {
      mostrarAlerta(
        'Error PDF',
        'Ocurrió un error al generar el documento PDF.',
      );
    } else {
      alert(
        'Error PDF: Ocurrió un error al generar el documento PDF.',
      );
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
        ? state.proyectos.find(
            (p) => String(p.id) === String(apunte.proyectoId),
          )?.nombre // Comparamos string
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
      const isSelected = state.apuntesSeleccionadosIds.some(
        (id) => String(id) === String(apunte.id),
      ); // Comparamos string
      if (String(apunte.id) === String(apunteActivoId))
        li.classList.add('active');
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
  const apunte = state.apuntes.find(
    (a) => String(a.id) === String(apunteActivoId),
  );
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
      // --- VISIBILILIDAD BOTÓN ELIMINAR ---
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

/**
 * MODIFICADO: Esta función ahora solo dispara el autoguardado (debounced).
 */
function handleInput() {
  autoGrowTitulo();
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(handleAutoSave, 500); // Llama a la función "inteligente"
}

/**
 * MODIFICADO: Esta función ahora es "inteligente".
 * Decide si crear un nuevo apunte o actualizar uno existente.
 */
async function handleAutoSave() {
  const titulo = document.getElementById('input-titulo-apunte')?.value.trim();
  const contenido = tinymce.get('editor-tinymce')?.getContent() || '';

  // Si no hay ID, y no hay texto, no hacer nada.
  if (apunteActivoId === null && titulo === '' && contenido === '') {
    return;
  }

  // Preparar los datos que se van a guardar
  const datosApunte = {
    titulo: titulo,
    contenido: contenido,
    curso: document.getElementById('select-curso-apunte').value,
    proyectoId: document.getElementById('select-proyecto-apunte').value || null,
    fechaModificacion: new Date().toISOString(),
    tags: (document.getElementById('input-tags-apunte')?.value || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag !== '')
      .filter((tag, index, self) => self.indexOf(tag) === index),
  };

  if (apunteActivoId === null) {
    // --- MODO CREAR ---
    const datosCreacion = {
      ...datosApunte,
      fechaCreacion: new Date().toISOString(),
      fijado: false,
      isFavorito:
        document
          .getElementById('btn-editor-favorito')
          ?.classList.contains('active') || false,
    };
    try {
      const nuevoId = await agregarDocumento('apuntes', datosCreacion);
      apunteActivoId = nuevoId; // ¡CLAVE! Se setea el ID
      // Mostrar el botón de eliminar ahora que el apunte existe
      const btnEliminarEditorEl = document.getElementById(
        'btn-editor-eliminar',
      );
      if (btnEliminarEditorEl) {
        btnEliminarEditorEl.style.display = 'inline-flex';
      }

      // --- INICIO CORRECCIÓN BUG 1 ---
      // Forzar renderizado del editor AHORA que tenemos el ID.
      // Esto evita que el listener de 'apuntesActualizados' lo reinicie.
      renderizarEditor();
      // --- FIN CORRECCIÓN BUG 1 ---
    } catch (error) {
      console.error('[Apuntes] Error al crear nuevo apunte:', error);
      mostrarAlerta('Error', 'No se pudo crear el apunte.');
    }
  } else {
    // --- MODO ACTUALIZAR ---
    try {
      await actualizarDocumento('apuntes', String(apunteActivoId), datosApunte);

      // Optimización: Forzar render local solo si cambia algo en la lista
      const apunteLocal = state.apuntes.find(
        (a) => String(a.id) === String(apunteActivoId),
      );
      if (
        apunteLocal &&
        (apunteLocal.titulo !== datosApunte.titulo ||
          apunteLocal.curso !== datosApunte.curso ||
          apunteLocal.proyectoId !== datosApunte.proyectoId ||
          JSON.stringify(apunteLocal.tags) !== JSON.stringify(datosApunte.tags))
      ) {
        // Actualizar el estado local inmediatamente para el renderizado
        Object.assign(apunteLocal, datosApunte);
        renderizarListaApuntes(); // Render local para feedback inmediato
      }
    } catch (error) {
      console.error(
        `[Apuntes] Error al actualizar apunte ${apunteActivoId}:`,
        error,
      );
      mostrarAlerta('Error', 'No se pudo guardar el apunte.');
    }
  }
}

// --- crearNuevoApunte() fue fusionada con handleAutoSave ---

function seleccionarNuevoApunte() {
  if (state.apuntesEnModoSeleccion) {
    exitSelectionMode();
  }
  apunteActivoId = null; // Marcar que no hay apunte seleccionado
  renderizarListaApuntes(); // Quitar 'active' de la lista
  renderizarEditor(); // Limpia el editor

  // --- Lógica Móvil ---
  if (window.innerWidth <= 900) {
    abrirEditorMovil(); // Abre el overlay del editor
  } else {
    document.getElementById('input-titulo-apunte')?.focus(); // Foco normal en escritorio
  }
  // ------------------
}

/**
 * MODIFICADO: Usa eliminarDocumento y es async.
 */
function eliminarApunte(id) {
  if (id === null) return;
  const apunte = state.apuntes.find((a) => String(a.id) === String(id));
  if (!apunte) return;
  mostrarConfirmacion(
    'Eliminar Apunte',
    `¿Estás seguro de que quieres eliminar "${apunte.titulo || 'este apunte'}"?`,
    async () => {
      // <-- AÑADIDO async
      try {
        await eliminarDocumento('apuntes', String(id)); // <-- AÑADIDO
        console.log(`[Apuntes] Apunte ${id} eliminado.`);
        if (String(apunteActivoId) === String(id)) {
          apunteActivoId = null;
          renderizarEditor(); // Esto ocultará el botón eliminar del editor
        }
        exitSelectionMode();
        // guardarDatos(); // <-- ELIMINADO
        // renderizarPaginaApuntes(); // <-- ELIMINADO (El listener lo hará)
      } catch (error) {
        console.error(`[Apuntes] Error al eliminar apunte ${id}:`, error);
        mostrarAlerta('Error', 'No se pudo eliminar el apunte.');
      }
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
  ).map((li) => li.dataset.id); // IDs son strings
  if (e.target.checked) {
    state.apuntesSeleccionadosIds = [
      ...new Set([...state.apuntesSeleccionadosIds, ...apuntesVisiblesIds]),
    ];
  } else {
    state.apuntesSeleccionadosIds = state.apuntesSeleccionadosIds.filter(
      (id) => !apuntesVisiblesIds.includes(String(id)), // Comparamos string
    );
  }
  if (state.apuntesSeleccionadosIds.length === 0) {
    exitSelectionMode();
  } else {
    renderizarPaginaApuntes();
  }
}

/**
 * MODIFICADO: Usa crearBatch y es async.
 */
function eliminarApuntesSeleccionados() {
  const count = state.apuntesSeleccionadosIds.length;
  if (count === 0) return;
  mostrarConfirmacion(
    'Eliminar Apuntes',
    `¿Estás seguro de que quieres eliminar ${count} apunte(s) seleccionado(s)?`,
    async () => {
      // <-- AÑADIDO async
      try {
        const batch = crearBatch();
        const userId = state.currentUserId;
        state.apuntesSeleccionadosIds.forEach((id) => {
          const docRef = doc(db, 'usuarios', userId, 'apuntes', String(id));
          batch.delete(docRef);
        });
        await batch.commit();
        console.log(`[Apuntes] ${count} apuntes eliminados en batch.`);

        if (
          state.apuntesSeleccionadosIds.some(
            (id) => String(id) === String(apunteActivoId),
          )
        ) {
          apunteActivoId = null;
          renderizarEditor();
        }
        exitSelectionMode();
        // guardarDatos(); // <-- ELIMINADO
        // renderizarPaginaApuntes() será llamado por el listener
      } catch (error) {
        console.error('[Apuntes] Error al eliminar apuntes en batch:', error);
        mostrarAlerta('Error', 'No se pudieron eliminar los apuntes.');
      }
    },
  );
}

/**
 * --- INICIO CORRECCIÓN BUG 2 ---
 * Eliminada la comprobación redundante que impedía la selección
 */
function handleSeleccionarApunte(apunteLi) {
  if (state.apuntesEnModoSeleccion) return; // No hacer nada si está en modo selección

  const nuevoId = apunteLi.dataset.id; // ID es string

  // El bloque 'if (nuevoId === apunteActivoId ...)' fue ELIMINADO.
  // Siempre se debe renderizar al hacer clic.

  apunteActivoId = nuevoId; // Establecer el nuevo ID activo
  renderizarListaApuntes(); // Actualiza la lista para marcar el nuevo activo
  renderizarEditor(); // Carga el contenido del apunte seleccionado

  // --- Lógica Móvil ---
  if (window.innerWidth <= 900) {
    abrirEditorMovil(); // Abre el overlay del editor
  }
  // ------------------
}
/**
 * --- FIN CORRECCIÓN BUG 2 ---
 */

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
  const idStr = String(apunteId);
  const index = state.apuntesSeleccionadosIds.indexOf(idStr);
  if (index > -1) {
    state.apuntesSeleccionadosIds.splice(index, 1);
  } else {
    state.apuntesSeleccionadosIds.push(idStr);
  }
  if (state.apuntesSeleccionadosIds.length === 0) {
    exitSelectionMode();
  } else {
    renderizarPaginaApuntes();
  }
}

/**
 * MODIFICADO: Usa actualizarDocumento y es async.
 */
async function toggleFijarApunte(id) {
  const apunte = state.apuntes.find((a) => String(a.id) === String(id));
  if (apunte) {
    const nuevoEstado = !apunte.fijado;
    try {
      await actualizarDocumento('apuntes', String(id), { fijado: nuevoEstado });
      // guardarDatos(); // <-- ELIMINADO
      // renderizarPaginaApuntes(); // <-- ELIMINADO (El listener lo hará)
    } catch (error) {
      console.error(`[Apuntes] Error al fijar apunte ${id}:`, error);
      mostrarAlerta('Error', 'No se pudo actualizar el apunte.');
      // No revertir, el listener corregirá
    }
  }
}

/**
 * MODIFICADO: Usa actualizarDocumento y es async.
 */
async function toggleFavorito(id) {
  const apunte = state.apuntes.find((a) => String(a.id) === String(id));
  if (apunte) {
    const nuevoEstado = !apunte.isFavorito;
    try {
      await actualizarDocumento('apuntes', String(id), {
        isFavorito: nuevoEstado,
      });
      // guardarDatos(); // <-- ELIMINADO
      // renderizarPaginaApuntes(); // <-- ELIMINADO (El listener lo hará)
      if (String(id) === String(apunteActivoId)) {
        const btnFavoritoEl = document.getElementById('btn-editor-favorito');
        if (btnFavoritoEl) {
          btnFavoritoEl.innerHTML = nuevoEstado
            ? ICONS.star_filled
            : ICONS.star_outline;
          btnFavoritoEl.classList.toggle('active', nuevoEstado);
        }
      }
    } catch (error) {
      console.error(`[Apuntes] Error al marcar favorito apunte ${id}:`, error);
      mostrarAlerta('Error', 'No se pudo actualizar el apunte.');
      // No revertir
    }
  }
}

/**
 * MODIFICADO: Ahora es async y llama a handleAutoSave (que crea el apunte).
 */
async function toggleEditorFavorito() {
  if (apunteActivoId === null) {
    // Si es un apunte nuevo, forzar guardado para crearlo
    await handleAutoSave();
    // Si después del guardado sigue sin haber ID (ej. vacío), no hacer nada
    if (apunteActivoId === null) return;
  }

  const apunte = state.apuntes.find(
    (a) => String(a.id) === String(apunteActivoId),
  );
  if (apunte) {
    await toggleFavorito(apunteActivoId);
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
      // --- CORREGIDO: Ambas acciones llaman a handleInput (el debouncer) ---
      editor.on('input', handleInput);
      editor.on('change', handleInput);
      // -----------------------------------------------------------------
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

/**
 * Función interna que conecta los listeners al DOM de la página.
 * Se llama CADA VEZ que se carga la página de apuntes.
 * @param {object} data - Datos pasados por el EventBus (ej: data.id)
 */
function conectarUIApuntes(data) {
  // 1. Establecer el apunte activo (si viene de otra página)
  apunteActivoId = data?.id || null; // <-- MODIFICADO
  // state.apunteSeleccionadoId = null; // <-- ELIMINADO
  // guardarDatos(); // <-- ELIMINADO

  // 2. Obtener el selector de curso del editor y popularlo
  const selectCursoApunte = document.getElementById('select-curso-apunte');
  if (selectCursoApunte) {
    popularSelectorDeCursos(selectCursoApunte, false);
    // Preseleccionar curso si viene de la página de cursos
    if (!apunteActivoId && data?.cursoId) {
      // <-- MODIFICADO
      const curso = state.cursos.find(
        (c) => String(c.id) === String(data.cursoId), // <-- MODIFICADO
      );
      if (
        curso &&
        selectCursoApunte.querySelector(`option[value="${curso.nombre}"]`)
      ) {
        selectCursoApunte.value = curso.nombre;
      }
      // state.cursoSeleccionadoId = null; // <-- ELIMINADO
      // guardarDatos(); // <-- ELIMINADO
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
        const apunteId = apunteLi.dataset.id; // ID es String
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
      const apunteId = apunteLi.dataset.id; // ID es String
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
      inputTituloEl.addEventListener('input', handleInput); // <-- CORREGIDO
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
} // Fin de conectarUIApuntes

/**
 * MODIFICADO: Esta es la nueva función principal.
 * Solo se suscribe a los eventos del EventBus.
 */
export function inicializarApuntes() {
  console.log('[Apuntes] Inicializando y suscribiendo a eventos...');

  // --- Listeners de Modales (se adjuntan una sola vez al inicio) ---
  // (Estos modales están en index.html, por eso se adjuntan aquí)
  // (Asegurarse que los ID de los modales de apuntes estén en index.html si existen)
  // ... (No hay modales de apuntes en index.html, así que no se necesita) ...

  // 1. Escuchar cuándo el HTML de esta página se carga en el DOM
  EventBus.on('paginaCargada:apuntes', (data) => {
    console.log(
      '[Apuntes] Evento: paginaCargada:apuntes recibido. Conectando listeners de UI...',
    );
    conectarUIApuntes(data); // Llama a la función que hace el trabajo
  });

  // 2. Escuchar cuándo cambian los datos de apuntes
  EventBus.on('apuntesActualizados', () => {
    // Si la página de apuntes está visible, re-renderiza
    if (state.paginaActual === 'apuntes') {
      console.log(
        '[Apuntes] Evento: apuntesActualizados recibido. Renderizando...',
      );
      renderizarPaginaApuntes();

      // --- INICIO CORRECCIÓN BUG 1 ---
      // NO llamar a renderizarEditor() aquí.
      // Si el apunte activo es el que cambió, el autoguardado lo manejará.
      // Si el apunte activo fue eliminado, el listener de 'eliminar' lo manejará.
      // renderizarEditor(); // <-- ELIMINADO
      // --- FIN CORRECCIÓN BUG 1 ---
    }
  });

  // 3. Escuchar cuándo cambian los cursos o proyectos (para los selectores y filtros)
  const refrescarDependencias = () => {
    if (state.paginaActual === 'apuntes') {
      console.log(
        '[Apuntes] Evento: dependencias (cursos/proyectos) actualizadas. Actualizando selectores...',
      );
      // Repopular selectores en editor
      popularSelectorDeCursos(
        document.getElementById('select-curso-apunte'),
        false,
      );
      popularSelectorDeProyectos('select-proyecto-apunte');
      // Actualizar menú de filtros
      renderizarMenuFiltros();
      // Re-renderizar lista por si cambiaron nombres de cursos/proyectos
      renderizarListaApuntes();
    }
  };
  EventBus.on('cursosActualizados', refrescarDependencias);
  EventBus.on('proyectosActualizados', refrescarDependencias);
} // Fin de inicializarApuntes
