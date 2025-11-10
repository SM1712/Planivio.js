// ==========================================================================
// ==                      src/pages/grupos.js                           ==
// ==========================================================================
//
// ETAPA 11.3 (Admin Miembros - Lógica UI):
// - Añadida lógica para MOSTRAR el botón de admin si el user es 'ownerId'.
// - Añadida función 'abrirModalAdminMiembros' que abre el nuevo modal.
// - Conectados los listeners e iconos del nuevo modal.
//
// ==========================================================================

import { state } from '../state.js';
import { EventBus } from '../eventBus.js';
import {
  crearGrupo,
  escucharColeccionDeGrupo,
  agregarDocumentoAGrupo,
} from '../firebase.js';
// --- INICIO ETAPA 11.3: Importar funciones de UI ---
import { mostrarAlerta, mostrarPrompt, mostrarModal } from '../ui.js';
// --- FIN ETAPA 11.3 ---
import { ICONS } from '../icons.js';

// Estado local aislado
let localState = {
  gruposFiltrados: [],
  grupoSeleccionado: null, // { id, nombre, ... }
  hiloSeleccionadoId: null,
  listaDeHilos: [],
  listaDeComentarios: [],
};

// Unsubscribe functions
let unsubscribeHilos = () => {};
let unsubscribeComentarios = () => {};

// --- 1. LÓGICA DE VISTA GRID (CUADRÍCULA) ---

/**
 * Renderiza la cuadrícula de tarjetas de grupo
 */
function renderizarVistaGrid() {
  const container = document.getElementById('grupos-grid-container');
  if (!container) return;

  const terminoBusqueda = document
    .getElementById('input-buscar-grupos')
    .value.toLowerCase();

  localState.gruposFiltrados = state.grupos.filter((g) =>
    g.nombre.toLowerCase().includes(terminoBusqueda),
  );

  if (localState.gruposFiltrados.length === 0 && terminoBusqueda.length === 0) {
    container.innerHTML =
      '<p class="lista-placeholder" style="padding: 20px; text-align: center;">No perteneces a ningún grupo. ¡Crea uno con el botón +!</p>';
    return;
  }

  if (localState.gruposFiltrados.length === 0 && terminoBusqueda.length > 0) {
    container.innerHTML =
      '<p class="lista-placeholder" style="padding: 20px; text-align: center;">No se encontraron grupos con ese nombre.</p>';
    return;
  }

  container.innerHTML = '';
  localState.gruposFiltrados.forEach((grupo) => {
    const card = document.createElement('div');
    card.className = 'grupo-card';
    card.dataset.id = grupo.id;

    const hayNotificacion = false; // Lógica futura
    const numMiembros = grupo.miembros ? grupo.miembros.length : 0;
    const numHilos = '--'; // Lógica futura

    // --- INICIO ETAPA 10: Estructura de Tarjeta Header/Footer ---
    card.innerHTML = `
      <div class="grupo-card-header">
        <h3 class="card-basic-titulo" title="${grupo.nombre}">${grupo.nombre}</h3>
        <div class="stat-item stat-miembros">
          <span class="stat-icon">👥</span>
          <span class="stat-texto">${numMiembros}</span>
        </div>
      </div>
      
      <div class="card-stats-container">
         <span class="notificacion-dot" style="display: ${hayNotificacion ? 'block' : 'none'}"></span>
         <div class="stat-item">
           <span class="stat-icon">💬</span>
           <span class="stat-texto">${numHilos} Hilos</span>
         </div>
      </div>
    `;
    // --- FIN ETAPA 10 ---
    container.appendChild(card);
  });
}

/**
 * Maneja la creación de un nuevo grupo
 */
async function handleCrearGrupo() {
  const nombreGrupo = await mostrarPrompt(
    'Crear Nuevo Grupo',
    'Ingresa el nombre para tu nuevo grupo:',
  );

  if (!nombreGrupo || !nombreGrupo.trim()) {
    return;
  }

  try {
    await crearGrupo(nombreGrupo.trim());
    mostrarAlerta('¡Éxito!', `Se creó el grupo "${nombreGrupo}".`);
  } catch (error) {
    console.error('Error al crear grupo:', error);
    mostrarAlerta('Error', 'No se pudo crear el grupo.');
  }
}

// --- 2. LÓGICA DE VISTA FORO (DETALLE) ---

/**
 * Cambia a la vista de Foro (Detalle)
 * @param {string} grupoId
 */
function mostrarVistaForo(grupoId) {
  const grupo = state.grupos.find((g) => g.id === grupoId);
  if (!grupo) return;

  localState.grupoSeleccionado = grupo;
  document.getElementById('page-grupos').classList.add('vista-foro-activa');
  document.getElementById('grupos-foro-titulo-principal').textContent =
    grupo.nombre;

  // --- INICIO ETAPA 11.3: Lógica de Visibilidad del Botón Admin ---
  const btnAdmin = document.getElementById('btn-foro-admin');
  if (btnAdmin) {
    // Comparamos el ID del usuario actual con el 'ownerId' del grupo
    if (state.currentUserId === grupo.ownerId) {
      btnAdmin.style.display = 'flex'; // Mostrar botón
    } else {
      btnAdmin.style.display = 'none'; // Ocultar botón
    }
  }
  // --- FIN ETAPA 11.3 ---

  seleccionarGrupo(grupo.id);
}

/**
 * Vuelve a la vista de Cuadrícula
 */
function mostrarVistaGrid() {
  limpiarListeners();

  localState.grupoSeleccionado = null;
  localState.hiloSeleccionadoId = null;
  localState.listaDeHilos = [];
  localState.listaDeComentarios = [];

  const page = document.getElementById('page-grupos');
  page.classList.remove('vista-foro-activa');
  page.classList.remove('chat-activo-movil');

  // --- INICIO ETAPA 11.3: Ocultar botón admin al salir ---
  const btnAdmin = document.getElementById('btn-foro-admin');
  if (btnAdmin) {
    btnAdmin.style.display = 'none';
  }
  // --- FIN ETAPA 11.3 ---

  renderizarVistaGrid();
}

/**
 * Carga los hilos y listeners para un grupo
 */
function seleccionarGrupo(grupoId) {
  limpiarListeners();

  document.getElementById('foro-hilos-lista').innerHTML =
    '<li class="lista-placeholder">Cargando hilos...</li>';
  renderizarForo();

  unsubscribeHilos = escucharColeccionDeGrupo(
    grupoId,
    'tareas',
    (hilos) => {
      localState.listaDeHilos = hilos;
      renderizarTablero();
    },
    'fechaCreacion',
    'desc',
  );

  seleccionarHilo('general');
}

/**
 * Renderiza los hilos en el panel lateral del foro
 */
function renderizarTablero() {
  const listaUI = document.getElementById('foro-hilos-lista');
  const chatGeneralUI = document.getElementById('foro-hilo-general');
  if (!listaUI || !chatGeneralUI) return;

  chatGeneralUI.classList.toggle(
    'active',
    localState.hiloSeleccionadoId === 'general',
  );

  listaUI.innerHTML = '';
  if (localState.listaDeHilos.length === 0) {
    listaUI.innerHTML =
      '<li class="lista-placeholder" style="padding: 12px;">No hay hilos en este grupo.</li>';
  }

  localState.listaDeHilos.forEach((hilo) => {
    const li = document.createElement('li');
    li.className = 'hilo-item';
    li.dataset.id = hilo.id;
    const fecha = hilo.fechaCreacion
      ? new Date(hilo.fechaCreacion.seconds * 1000).toLocaleDateString()
      : 'Sin fecha';
    li.innerHTML = `
      <span class="hilo-icono">${hilo.isCompleted ? '✅' : '📝'}</span>
      <div class="hilo-info">
        <span class="hilo-titulo">${hilo.titulo || 'Hilo sin título'}</span>
        <span class="hilo-meta">Creado: ${fecha}</span>
      </div>
    `;
    li.classList.toggle('active', hilo.id === localState.hiloSeleccionadoId);
    listaUI.appendChild(li);
  });
}

/**
 * Selecciona un hilo y carga sus comentarios
 * @param {string} hiloId
 */
function seleccionarHilo(hiloId) {
  if (localState.hiloSeleccionadoId === hiloId && hiloId !== 'general') {
    return;
  }
  if (!hiloId) {
    console.warn('[Grupos] seleccionarHilo fue llamado con un ID inválido.');
    return;
  }

  console.log(`[Grupos] Seleccionando hilo: ${hiloId}`);
  localState.hiloSeleccionadoId = hiloId;
  localState.listaDeComentarios = [];

  document.getElementById('page-grupos').classList.add('chat-activo-movil');

  if (unsubscribeComentarios) {
    unsubscribeComentarios();
    unsubscribeComentarios = () => {};
  }

  renderizarTablero();
  renderizarForo();

  unsubscribeComentarios = escucharColeccionDeGrupo(
    localState.grupoSeleccionado.id,
    'comentarios',
    (comentarios) => {
      localState.listaDeComentarios = comentarios.filter(
        (c) => c.hiloId === localState.hiloSeleccionadoId,
      );
      renderizarForo();
    },
    'fechaCreacion',
    'asc',
  );
}

/**
 * Renderiza el panel de chat (comentarios)
 */
function renderizarForo() {
  const containerUI = document.getElementById('foro-chat-comentarios');
  const input = document.getElementById('input-nuevo-comentario');
  const btn = document.getElementById('btn-enviar-comentario');
  const tituloUI = document.getElementById('foro-chat-titulo');

  if (!containerUI || !input || !btn || !tituloUI) return;

  if (!localState.hiloSeleccionadoId) {
    tituloUI.textContent = 'Selecciona un hilo';
    containerUI.innerHTML =
      '<div class="lista-placeholder">Selecciona un hilo para ver la conversación...</div>';
    input.disabled = true;
    btn.disabled = true;
    return;
  }

  input.disabled = false;
  btn.disabled = false;

  if (localState.hiloSeleccionadoId === 'general') {
    tituloUI.textContent = 'Chat General';
  } else {
    const hilo = localState.listaDeHilos.find(
      (h) => h.id === localState.hiloSeleccionadoId,
    );
    tituloUI.textContent = hilo ? hilo.titulo : 'Foro';
  }

  containerUI.innerHTML = '';
  if (localState.listaDeComentarios.length === 0) {
    containerUI.innerHTML =
      '<div class="lista-placeholder">Sé el primero en comentar.</div>';
    return;
  }

  localState.listaDeComentarios.forEach((com) => {
    const div = document.createElement('div');
    div.className = 'comentario-item';
    const fecha = com.fechaCreacion
      ? new Date(com.fechaCreacion.seconds * 1000).toLocaleString()
      : '';
    const esMio = com.autorId === state.currentUserId;
    div.classList.toggle('mio', esMio);

    div.innerHTML = `
      <div class="comentario-burbuja">
        <strong class="comentario-autor">${esMio ? 'Tú' : com.autorNombre || 'Usuario'}</strong>
        <p class="comentario-texto">${com.texto || ''}</p>
        <span class="comentario-fecha">${fecha}</span>
      </div>
    `;
    containerUI.appendChild(div);
  });

  containerUI.scrollTop = containerUI.scrollHeight;
}

/**
 * Envía un nuevo comentario al hilo activo
 */
async function enviarComentario(e) {
  if (e) {
    e.preventDefault();
  }

  const input = document.getElementById('input-nuevo-comentario');
  const texto = input.value.trim();

  if (
    !texto ||
    !localState.grupoSeleccionado ||
    !localState.hiloSeleccionadoId
  ) {
    return;
  }

  const hiloId = localState.hiloSeleccionadoId;
  const grupoId = localState.grupoSeleccionado.id;
  const coleccionComentarios = 'comentarios';

  const nuevoComentario = {
    texto: texto,
    hiloId: hiloId,
    autorId: state.currentUserId,
    autorNombre: state.config.userName || 'Usuario',
  };

  try {
    input.value = '';
    await agregarDocumentoAGrupo(
      grupoId,
      coleccionComentarios,
      nuevoComentario,
    );
  } catch (error) {
    console.error('Error al enviar comentario:', error);
    mostrarAlerta('Error', 'No se pudo enviar el comentario.');
    input.value = texto;
  }
}

/**
 * Crea un nuevo hilo (tarea) en el grupo
 */
async function crearNuevoHiloForo() {
  if (!localState.grupoSeleccionado) return;

  const titulo = await mostrarPrompt(
    'Nuevo Hilo',
    'Introduce el título para el nuevo hilo de conversación:',
  );
  if (!titulo || !titulo.trim()) return;

  const grupoId = localState.grupoSeleccionado.id;

  const nuevoHilo = {
    titulo: titulo.trim(),
    descripcion: '',
    prioridad: 'Media',
    isCompleted: false,
    creadaPor: state.currentUserId,
    asignados: [],
    padrePrivado: null,
  };

  try {
    await agregarDocumentoAGrupo(grupoId, 'tareas', nuevoHilo);
    mostrarAlerta('¡Éxito!', 'Nuevo hilo de conversación creado.');
  } catch (error) {
    console.error('Error al crear hilo:', error);
    mostrarAlerta('Error', 'No se pudo crear el hilo.');
  }
}

// --- INICIO ETAPA 11.3: Nuevas funciones de Admin ---

/**
 * Abre el modal de administración de miembros.
 * Por ahora, solo muestra un placeholder.
 */
function abrirModalAdminMiembros() {
  console.log('[Grupos] Abriendo modal de administración...');
  const listaUI = document.getElementById('lista-admin-miembros');
  if (listaUI) {
    listaUI.innerHTML =
      '<li class="lista-placeholder" style="padding: 10px">Cargando...</li>';
  }

  mostrarModal('modal-admin-miembros');

  // TODO (ETAPA 11.4):
  // 1. Implementar una función en firebase.js para buscar N perfiles de usuario.
  // 2. Llamar a esa función con los IDs de localState.grupoSeleccionado.miembros.
  // 3. Poblar la listaUI con los nombres, emails y un botón de "Expulsar".
}

// --- FIN ETAPA 11.3 ---

/**
 * Limpia todos los listeners locales
 */
function limpiarListeners() {
  console.log('[Grupos] Limpiando listeners locales...');
  if (unsubscribeHilos) {
    unsubscribeHilos();
    unsubscribeHilos = () => {};
  }
  if (unsubscribeComentarios) {
    unsubscribeComentarios();
    unsubscribeComentarios = () => {};
  }
}

// --- 3. INICIALIZACIÓN DEL MÓDULO ---

export function inicializarGrupos() {
  console.log('[Grupos] Inicializando módulo...');

  EventBus.on('gruposActualizados', () => {
    if (state.paginaActual === 'grupos' && !localState.grupoSeleccionado) {
      renderizarVistaGrid();
    }
  });

  EventBus.on('paginaCargada:grupos', () => {
    console.log('[Grupos] Evento: paginaCargada:grupos. Conectando UI...');

    document.getElementById('btn-crear-grupo').innerHTML = ICONS.add;
    document.getElementById('btn-foro-atras').innerHTML = ICONS.collapse || '←';
    document.getElementById('btn-enviar-comentario').innerHTML =
      ICONS.send || '➤';

    // --- INICIO ETAPA 11.3: Cargar iconos de admin ---
    const btnAdmin = document.getElementById('btn-foro-admin');
    if (btnAdmin) {
      btnAdmin.innerHTML = ICONS.settings || '⚙️';
    }
    const btnCerrarAdmin = document.querySelector(
      '#modal-admin-miembros .btn-cerrar-modal',
    );
    if (btnCerrarAdmin) {
      btnCerrarAdmin.innerHTML = ICONS.close || 'X';
    }
    // --- FIN ETAPA 11.3 ---

    mostrarVistaGrid();

    const page = document.getElementById('page-grupos');
    if (page && !page.dataset.listenerAttached) {
      page.dataset.listenerAttached = 'true';

      document
        .getElementById('btn-crear-grupo')
        .addEventListener('click', handleCrearGrupo);
      document
        .getElementById('input-buscar-grupos')
        .addEventListener('input', renderizarVistaGrid);
      document
        .getElementById('grupos-grid-container')
        .addEventListener('click', (e) => {
          const card = e.target.closest('.grupo-card');
          if (card) {
            mostrarVistaForo(card.dataset.id);
          }
        });

      document
        .getElementById('btn-foro-atras')
        .addEventListener('click', () => {
          const page = document.getElementById('page-grupos');
          if (page.classList.contains('chat-activo-movil')) {
            page.classList.remove('chat-activo-movil');
            localState.hiloSeleccionadoId = null;
            renderizarForo();
            renderizarTablero();
          } else {
            mostrarVistaGrid();
          }
        });

      document
        .getElementById('btn-foro-nuevo-hilo')
        .addEventListener('click', crearNuevoHiloForo);

      // --- INICIO ETAPA 11.3: Listener del botón de admin ---
      const btnAdminListener = document.getElementById('btn-foro-admin');
      if (btnAdminListener) {
        btnAdminListener.addEventListener('click', abrirModalAdminMiembros);
      }
      // --- FIN ETAPA 11.3 ---

      document
        .getElementById('foro-panel-hilos')
        .addEventListener('click', (e) => {
          const hilo = e.target.closest('.hilo-item');
          if (hilo) {
            seleccionarHilo(hilo.dataset.id);
          }
        });

      document
        .getElementById('form-nuevo-comentario')
        .addEventListener('submit', enviarComentario);

      document
        .getElementById('input-nuevo-comentario')
        .addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviarComentario();
          }
        });
    }
  });

  EventBus.on('navegarA', (data) => {
    if (data.pagina !== 'grupos' && localState.grupoSeleccionado) {
      console.log(
        '[Grupos] Saliendo de la página, limpiando listeners locales...',
      );
      mostrarVistaGrid();
    }
  });
}
