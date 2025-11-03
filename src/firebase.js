// ==========================================================================
// ==                          src/firebase.js                           ==
// ==========================================================================
//
// Esta es la capa de servicio de Firestore.
// Es el ÚNICO archivo (además de main.js para auth) que habla
// directamente con los servicios de Firebase.
//
// Importa las funciones que necesitamos desde el objeto global que
// creamos en index.html.
//
// ==========================================================================

import { state } from './state.js'; // Necesario para la migración

const {
  db,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  getDocs,
} = window.firebaseServices;

export { db, doc };

let userId = null; // Guardaremos el ID del usuario logueado

/**
 * Guarda el ID del usuario actual. Llamado por main.js al iniciar sesión.
 * @param {string} uid - El User ID de Firebase Authentication.
 */
export function setFirebaseUserId(uid) {
  userId = uid;
  console.log('[Firebase] User ID establecido:', uid);
}

// ==========================================================================
// ==                FUNCIONES PARA CONFIGURACIÓN (Documento Único)        ==
// ==========================================================================

/**
 * Guarda/Actualiza datos en el documento de configuración del usuario.
 * @param {object} configData - Objeto SOLO con los campos a actualizar. Ej: { theme: 'dark' }
 */
export async function guardarConfig(configData) {
  if (!userId) {
    console.warn('[Firebase] User ID no seteado, no se puede guardar config.');
    return;
  }
  const docRef = doc(db, 'usuarios', userId, 'config', 'userConfig');
  try {
    // setDoc con merge:true = actualiza o crea sin sobrescribir el documento entero
    await setDoc(docRef, configData, { merge: true });
    console.log('[Firebase] Config guardada:', configData);
  } catch (e) {
    console.error('[Firebase] Error al guardar config: ', e);
    // Podríamos emitir un evento de error aquí si quisiéramos
  }
}

/**
 * Escucha cambios EN TIEMPO REAL en el documento de configuración.
 * @param {function} callback - Función que se ejecutará cada vez que la config cambie.
 * @returns {Function} Una función para desuscribirse del listener.
 */
export function escucharConfig(callback) {
  if (!userId) {
    console.warn('[Firebase] User ID no seteado, no se puede escuchar config.');
    return () => {}; // Devuelve una función vacía para desuscribirse
  }
  const docRef = doc(db, 'usuarios', userId, 'config', 'userConfig');

  const unsubscribe = onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        console.log('[Firebase] Config recibida:', docSnap.data());
        callback(docSnap.data()); // Llama al callback con los datos
      } else {
        // El documento no existe (primera vez del usuario?), usa config por defecto
        console.log('[Firebase] No existe config, usando default.');
        callback(null); // Llama con null para indicar que no existe
      }
    },
    (error) => {
      console.error('[Firebase] Error al escuchar config: ', error);
    },
  );

  return unsubscribe; // Devuelve la función para poder parar la escucha
}

// ==========================================================================
// ==              FUNCIONES GENÉRICAS PARA COLECCIONES                  ==
// ==========================================================================

/**
 * Escucha cambios EN TIEMPO REAL en una colección específica del usuario.
 * @param {string} nombreColeccion - Ej: 'cursos', 'tareas'.
 * @param {function} callback - Función que se ejecutará cada vez que la colección cambie.
 * @returns {Function} Una función para desuscribirse del listener.
 */
export function escucharColeccion(nombreColeccion, callback) {
  if (!userId) {
    console.warn(
      `[Firebase] User ID no seteado, no se puede escuchar ${nombreColeccion}.`,
    );
    return () => {};
  }
  const coleccionRef = collection(db, 'usuarios', userId, nombreColeccion);

  const unsubscribe = onSnapshot(
    coleccionRef,
    (querySnapshot) => {
      const datosArray = [];
      querySnapshot.forEach((doc) => {
        // Combinamos los datos del documento con su ID
        datosArray.push({ ...doc.data(), id: doc.id });
      });
      console.log(
        `[Firebase] ${nombreColeccion} recibidos:`,
        datosArray.length,
        'documentos',
      );
      callback(datosArray); // Llama al callback con el array completo
    },
    (error) => {
      console.error(`[Firebase] Error al escuchar ${nombreColeccion}: `, error);
    },
  );

  return unsubscribe;
}

/**
 * Agrega un nuevo documento a una colección específica del usuario.
 * Firestore asignará un ID automáticamente.
 * @param {string} nombreColeccion - Ej: 'tareas', 'apuntes'.
 * @param {object} datos - El objeto a guardar (SIN el campo 'id').
 * @returns {Promise<string>} El ID del nuevo documento creado.
 */
export async function agregarDocumento(nombreColeccion, datos) {
  if (!userId)
    throw new Error(
      `[Firebase] No autenticado. No se puede agregar a ${nombreColeccion}.`,
    );

  try {
    const coleccionRef = collection(db, 'usuarios', userId, nombreColeccion);
    // addDoc crea un documento con ID automático
    const docRef = await addDoc(coleccionRef, datos);
    console.log(
      `[Firebase] Documento agregado a ${nombreColeccion} con ID:`,
      docRef.id,
    );
    return docRef.id; // Devuelve el ID generado por Firestore
  } catch (error) {
    console.error(
      `[Firebase] Error al agregar documento a ${nombreColeccion}:`,
      error,
    );
    throw error; // Relanza el error para que la función que llama lo maneje
  }
}

/**
 * Actualiza campos específicos de un documento existente.
 * @param {string} nombreColeccion - Ej: 'tareas', 'apuntes'.
 * @param {string} docId - El ID del documento a actualizar.
 * @param {object} datosActualizar - Objeto SOLO con los campos a modificar. Ej: { completada: true }
 */
export async function actualizarDocumento(
  nombreColeccion,
  docId,
  datosActualizar,
) {
  if (!userId)
    throw new Error(
      `[Firebase] No autenticado. No se puede actualizar ${nombreColeccion}.`,
    );
  if (!docId)
    throw new Error(
      `[Firebase] ID de documento inválido para actualizar ${nombreColeccion}.`,
    );

  try {
    const docRef = doc(db, 'usuarios', userId, nombreColeccion, String(docId)); // Asegura ID string
    await updateDoc(docRef, datosActualizar);
    console.log(
      `[Firebase] Documento ${docId} en ${nombreColeccion} actualizado:`,
      datosActualizar,
    );
  } catch (error) {
    console.error(
      `[Firebase] Error al actualizar documento ${docId} en ${nombreColeccion}:`,
      error,
    );
    throw error;
  }
}

/**
 * Elimina un documento específico de una colección.
 * @param {string} nombreColeccion - Ej: 'tareas', 'apuntes'.
 * @param {string} docId - El ID del documento a eliminar.
 */
export async function eliminarDocumento(nombreColeccion, docId) {
  if (!userId)
    throw new Error(
      `[Firebase] No autenticado. No se puede eliminar ${nombreColeccion}.`,
    );
  if (!docId)
    throw new Error(
      `[Firebase] ID de documento inválido para eliminar ${nombreColeccion}.`,
    );

  try {
    const docRef = doc(db, 'usuarios', userId, nombreColeccion, String(docId)); // Asegura ID string
    await deleteDoc(docRef);
    console.log(
      `[Firebase] Documento ${docId} eliminado de ${nombreColeccion}.`,
    );
  } catch (error) {
    console.error(
      `[Firebase] Error al eliminar documento ${docId} de ${nombreColeccion}:`,
      error,
    );
    throw error;
  }
}

/**
 * MODIFICADO: Agrega el evento de cumpleaños recurrente.
 * 1. Calcula la *próxima* fecha de cumpleaños.
 * 2. Resta un año a esa fecha para crear un "punto de anclaje" para el generador.
 * 3. Guarda las fechas como strings "YYYY-MM-DD".
 * @param {string} fechaString - La fecha en formato "YYYY-MM-DD".
 */
export async function agregarEventoCumpleaños(fechaString) {
  if (!userId) {
    console.warn(
      '[Firebase] No hay usuario para agregar evento de cumpleaños.',
    );
    return;
  }

  // --- Lógica para calcular la próxima ocurrencia ---
  const parts = fechaString.split('-');
  const birthMonth = parseInt(parts[1], 10);
  const birthDay = parseInt(parts[2], 10);

  const today = new Date();
  const currentYear = today.getFullYear();

  let proximoCumpleaños = new Date(
    Date.UTC(currentYear, birthMonth - 1, birthDay, 12, 0, 0),
  );

  const todayUTC = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  if (todayUTC > proximoCumpleaños) {
    proximoCumpleaños.setUTCFullYear(currentYear + 1);
  }

  // --- Corrección de lógica (de la última vez) ---
  const fechaAnclaje = new Date(proximoCumpleaños);
  fechaAnclaje.setUTCFullYear(proximoCumpleaños.getUTCFullYear() - 1);

  // ==========================================================
  // ==                ¡INICIO DE LA CORRECCIÓN!               ==
  // ==========================================================
  // Convertimos la fecha de anclaje a un string "YYYY-MM-DD"
  // Tu calendario.js (línea 37) espera este formato, no un ISO string completo.
  const fechaAnclajeString = fechaAnclaje.toISOString().split('T')[0];
  // ==========================================================
  // ==                  ¡FIN DE LA CORRECCIÓN!                ==
  // ==========================================================

  const nuevoEvento = {
    titulo: 'Cumpleaños!!! 🥳🎉',
    fechaInicio: fechaAnclajeString, // <-- CORREGIDO A "YYYY-MM-DD"
    fechaFin: fechaAnclajeString, // <-- CORREGIDO A "YYYY-MM-DD"
    esDiaCompleto: true,
    curso: null,
    proyectoId: null,
    descripcion: '¡Mi cumpleaños!',
    color: '#f39c12',
    recurrencia: {
      tipo: 'anual',
      fin: null,
    },
  };

  try {
    await agregarDocumento('eventos', nuevoEvento);
    console.log(
      '[Firebase] Evento de cumpleaños agregado con fecha de anclaje:',
      fechaAnclajeString,
    );
  } catch (error) {
    console.error('[Firebase] Error al crear el evento de cumpleaños:', error);
  }
}

// ==========================================================================
// ==              FUNCIONES AVANZADAS (Batch y Query)                   ==
// ==========================================================================

/**
 * Crea un nuevo lote de escritura.
 * @returns {object} El objeto WriteBatch de Firestore.
 */
export function crearBatch() {
  if (!userId)
    throw new Error(`[Firebase] No autenticado. No se puede crear batch.`);
  return writeBatch(db);
}

/**
 * Crea una consulta de Firestore.
 * @param {string} nombreColeccion - La colección sobre la que consultar.
 * @param {Array} condiciones - Un array de condiciones [campo, operador, valor].
 * @returns {object} Un objeto de consulta de Firestore.
 */
export function crearConsulta(nombreColeccion, ...condiciones) {
  if (!userId)
    throw new Error(
      `[Firebase] No autenticado. No se puede consultar ${nombreColeccion}.`,
    );
  const coleccionRef = collection(db, 'usuarios', userId, nombreColeccion);

  // Mapeamos las condiciones a objetos 'where' de Firestore
  const whereConstraints = condiciones.map((c) => where(c[0], c[1], c[2]));

  return query(coleccionRef, ...whereConstraints);
}

/**
 * Ejecuta una consulta una vez (no en tiempo real).
 * @param {object} consulta - El objeto de consulta creado con crearConsulta.
 * @returns {Promise<Array>} Un array con los documentos (datos + id).
 */
export async function ejecutarConsulta(consulta) {
  try {
    const querySnapshot = await getDocs(consulta);
    const resultados = [];
    querySnapshot.forEach((doc) => {
      resultados.push({ ...doc.data(), id: doc.id });
    });
    return resultados;
  } catch (error) {
    console.error('[Firebase] Error al ejecutar consulta:', error);
    throw error;
  }
}

// ==========================================================================
// ==                      FUNCIÓN DE MIGRACIÓN                          ==
// ==========================================================================

/**
 * Sube TODOS los datos de localStorage a Firestore DE UNA SOLA VEZ.
 * (Función para la Fase P3.1)
 * @param {object} estadoLocal - El objeto 'state' completo leído desde localStorage.
 */
export async function migrarDatosDesdeLocalStorage(estadoLocal) {
  if (!userId) throw new Error('[Firebase] No se puede migrar sin User ID.');
  console.log('[Firebase] Iniciando migración desde localStorage...');

  try {
    const batch = writeBatch(db);

    // 1. Guardar Configuración
    const configRef = doc(db, 'usuarios', userId, 'config', 'userConfig');
    batch.set(configRef, estadoLocal.config || {});

    // 2. Guardar Cursos (usando su ID como ID del documento)
    if (estadoLocal.cursos && estadoLocal.cursos.length > 0) {
      estadoLocal.cursos.forEach((curso) => {
        // Aseguramos que el ID sea string
        const docId = String(curso.id);
        // Creamos un nuevo objeto sin el 'id' dentro, ya que es el ID del doc
        const { id, ...cursoData } = curso;
        const cursoRef = doc(db, 'usuarios', userId, 'cursos', docId);
        batch.set(cursoRef, cursoData);
      });
    }

    // 3. Guardar Tareas
    if (estadoLocal.tareas && estadoLocal.tareas.length > 0) {
      estadoLocal.tareas.forEach((tarea) => {
        const docId = String(tarea.id);
        const { id, ...tareaData } = tarea;
        const tareaRef = doc(db, 'usuarios', userId, 'tareas', docId);
        batch.set(tareaRef, tareaData);
      });
    }

    // 4. Guardar Apuntes
    if (estadoLocal.apuntes && estadoLocal.apuntes.length > 0) {
      estadoLocal.apuntes.forEach((apunte) => {
        const docId = String(apunte.id);
        const { id, ...apunteData } = apunte;
        const apunteRef = doc(db, 'usuarios', userId, 'apuntes', docId);
        batch.set(apunteRef, apunteData);
      });
    }

    // 5. Guardar Eventos
    if (estadoLocal.eventos && estadoLocal.eventos.length > 0) {
      estadoLocal.eventos.forEach((evento) => {
        const docId = String(evento.id);
        const { id, ...eventoData } = evento;
        const eventoRef = doc(db, 'usuarios', userId, 'eventos', docId);
        batch.set(eventoRef, eventoData);
      });
    }

    // 6. Guardar Proyectos
    if (estadoLocal.proyectos && estadoLocal.proyectos.length > 0) {
      estadoLocal.proyectos.forEach((proyecto) => {
        const docId = String(proyecto.id);
        const { id, ...proyectoData } = proyecto;
        const proyectoRef = doc(db, 'usuarios', userId, 'proyectos', docId);
        batch.set(proyectoRef, proyectoData);
      });
    }

    // Ejecutar todas las escrituras del batch
    await batch.commit();

    console.log('[Firebase] Migración completada con éxito.');
  } catch (error) {
    console.error('[Firebase] Error durante la migración:', error);
    throw error; // Relanzar para que main.js lo maneje
  }
}
