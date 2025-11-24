// ==========================================================================
// ==
// ==                          src/firebase.js
// ==
// ==    (MODIFICADO - ETAPA 11.1: Añadido 'ownerId' a 'crearGrupo')
// ==
// ==========================================================================

import { state } from './state.js';

const {
  db,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection, // <-- ¡NUEVA IMPORTACIÓN NECESARIA!
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  getDocs,
  orderBy, // <-- AÑADIDO (ETAPA 2)
  Timestamp, // <-- AÑADIDO (ETAPA 2)
  collectionGroup, // <-- AÑADIDO (ETAPA 11.4)
} = window.firebaseServices;

export { db, doc };

let userId = null;

export function setFirebaseUserId(uid) {
  userId = uid;
  console.log('[Firebase] User ID establecido:', uid);
}

// ==========================================================================
// ==      ETAPA 6: PERSISTENCIA OFFLINE (Habilitar)
// ==========================================================================
try {
  if (window.firebaseServices.enableMultiTabIndexedDbPersistence) {
    window.firebaseServices.enableMultiTabIndexedDbPersistence(db)
      .then(() => {
        console.log('[Firebase] Persistencia offline (Multi-Tab) habilitada.');
      })
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          console.warn('[Firebase] Persistencia falló: Múltiples pestañas abiertas (aunque usamos Multi-Tab?).');
        } else if (err.code == 'unimplemented') {
          console.warn('[Firebase] El navegador no soporta persistencia.');
        }
      });
  } else if (window.firebaseServices.enableIndexedDbPersistence) {
     // Fallback por si acaso
     window.firebaseServices.enableIndexedDbPersistence(db)
      .then(() => console.log('[Firebase] Persistencia offline (Single-Tab) habilitada.'))
      .catch((err) => console.warn('[Firebase] Persistencia Single-Tab falló:', err));
  }
} catch (e) {
  console.warn('[Firebase] Error al intentar habilitar persistencia:', e);
}

// ==========================================================================
// ==                FUNCIONES PARA CONFIGURACIÓN (Documento Único)        ==
// ==========================================================================

export async function guardarConfig(configData) {
  if (!userId) {
    console.warn('[Firebase] User ID no seteado, no se puede guardar config.');
    return;
  }
  const docRef = doc(db, 'usuarios', userId, 'config', 'userConfig');
  try {
    await setDoc(docRef, configData, { merge: true });
    console.log('[Firebase] Config guardada:', configData);
  } catch (e) {
    console.error('[Firebase] Error al guardar config: ', e);
  }
}

export function escucharConfig(callback) {
  if (!userId) {
    console.warn('[Firebase] User ID no seteado, no se puede escuchar config.');
    return () => {};
  }
  const docRef = doc(db, 'usuarios', userId, 'config', 'userConfig');

  const unsubscribe = onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        console.log('[Firebase] Config recibida:', docSnap.data());
        callback(docSnap.data());
      } else {
        console.log('[Firebase] No existe config, usando default.');
        callback(null);
      }
    },
    (error) => {
      console.error('[Firebase] Error al escuchar config: ', error);
    },
  );

  return unsubscribe;
}

export async function getDocumento(nombreColeccion, docId) {
  if (!userId) {
    console.warn(`[Firebase] User ID no seteado, no se puede obtener doc.`);
    return null;
  }
  const docRef = doc(db, 'usuarios', userId, nombreColeccion, docId);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log(
        `[Firebase] No existe el documento: ${nombreColeccion}/${docId}`,
      );
      return null;
    }
  } catch (error) {
    console.error(`[Firebase] Error al obtener documento ${docId}:`, error);
    throw error;
  }
}

// ==========================================================================
// ==              FUNCIONES GENÉRICAS PARA COLECCIONES                  ==
// ==========================================================================

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
        datosArray.push({ ...doc.data(), id: doc.id });
      });
      console.log(
        `[Firebase] ${nombreColeccion} recibidos:`,
        datosArray.length,
        'documentos',
      );
      callback(datosArray);
    },
    (error) => {
      console.error(`[Firebase] Error al escuchar ${nombreColeccion}: `, error);
    },
  );

  return unsubscribe;
}

export async function agregarDocumento(nombreColeccion, datos) {
  if (!userId)
    throw new Error(
      `[Firebase] No autenticado. No se puede agregar a ${nombreColeccion}.`,
    );

  try {
    const coleccionRef = collection(db, 'usuarios', userId, nombreColeccion);
    const docRef = await addDoc(coleccionRef, datos);
    console.log(
      `[Firebase] Documento agregado a ${nombreColeccion} con ID:`,
      docRef.id,
    );
    return docRef.id;
  } catch (error) {
    console.error(
      `[Firebase] Error al agregar documento a ${nombreColeccion}:`,
      error,
    );
    throw error;
  }
}

// ==========================================================================
// ==     FUNCIONES PARA COLECCIONES RAÍZ (GRUPOS)
// ==========================================================================

/**
 * Agrega un documento a una colección RAÍZ (ej. /grupos)
 */
async function agregarDocumentoRaiz(nombreColeccion, datos) {
  if (!userId)
    throw new Error(
      `[Firebase] No autenticado. No se puede agregar a ${nombreColeccion}.`,
    );

  try {
    const coleccionRef = collection(db, nombreColeccion);
    const docRef = await addDoc(coleccionRef, datos);
    console.log(
      `[Firebase] Documento agregado a /${nombreColeccion} con ID:`,
      docRef.id,
    );
    return docRef.id;
  } catch (error) {
    console.error(
      `[Firebase] Error al agregar documento a /${nombreColeccion}:`,
      error,
    );
    throw error;
  }
}

/**
 * Escucha la colección RAÍZ /grupos para encontrar
 * aquellos donde el usuario actual es miembro.
 */
export function escucharGruposDelUsuario(callback) {
  if (!userId) {
    console.warn(`[Firebase] User ID no seteado, no se puede escuchar grupos.`);
    return () => {};
  }

  const coleccionRef = collection(db, 'grupos');
  const q = query(coleccionRef, where('miembros', 'array-contains', userId));

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const datosArray = [];
      querySnapshot.forEach((doc) => {
        datosArray.push({ ...doc.data(), id: doc.id });
      });
      console.log(
        `[Firebase] Grupos (raíz) recibidos:`,
        datosArray.length,
        'documentos',
      );
      callback(datosArray);
    },
    (error) => {
      console.error(`[Firebase] Error al escuchar /grupos: `, error);
    },
  );

  return unsubscribe;
}

/**
 * Agrega un documento a una subcolección de un grupo en la raíz.
 * (p.ej. /grupos/{grupoId}/tareas)
 */
export async function agregarDocumentoAGrupo(grupoId, nombreColeccion, datos) {
  if (!userId)
    throw new Error(
      `[Firebase] No autenticado. No se puede agregar a ${grupoId}.`,
    );
  if (!grupoId) throw new Error(`[Firebase] ID de grupo inválido.`);

  try {
    const datosConTimestamp = {
      ...datos,
      fechaCreacion: Timestamp.now(),
    };
    const coleccionRef = collection(db, 'grupos', grupoId, nombreColeccion);
    const docRef = await addDoc(coleccionRef, datosConTimestamp);
    console.log(
      `[Firebase] Documento agregado a /grupos/${grupoId}/${nombreColeccion} con ID:`,
      docRef.id,
    );
    return docRef.id;
  } catch (error) {
    console.error(
      `[Firebase] Error al agregar documento al grupo ${grupoId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Escucha una subcolección de un grupo específico.
 * (p.ej. /grupos/{grupoId}/tareas)
 */
export function escucharColeccionDeGrupo(
  grupoId,
  nombreColeccion,
  callback,
  campoOrden,
  direccionOrden = 'asc',
) {
  if (!userId) {
    console.warn(
      `[Firebase] User ID no seteado, no se puede escuchar ${grupoId}/${nombreColeccion}.`,
    );
    return () => {};
  }
  if (!grupoId) {
    console.warn(`[Firebase] ID de grupo inválido, no se puede escuchar.`);
    return () => {};
  }

  const coleccionRef = collection(db, 'grupos', grupoId, nombreColeccion);

  const q = campoOrden
    ? query(coleccionRef, orderBy(campoOrden, direccionOrden))
    : query(coleccionRef);

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const datosArray = [];
      querySnapshot.forEach((doc) => {
        datosArray.push({ ...doc.data(), id: doc.id });
      });
      callback(datosArray);
    },
    (error) => {
      console.error(
        `[Firebase] Error al escuchar /grupos/${grupoId}/${nombreColeccion}: `,
        error,
      );
    },
  );

  return unsubscribe;
}

/**
 * ETAPA 11.1 (Rediseño): Crea un nuevo documento de grupo
 */
export async function crearGrupo(nombreGrupo) {
  if (!userId) throw new Error(`[Firebase] No autenticado.`);

  const nuevoGrupo = {
    nombre: nombreGrupo,
    // El creador es el primer miembro
    miembros: [userId],
    // --- INICIO ETAPA 11.1 ---
    // Guardamos quién es el dueño para la administración
    ownerId: userId,
    // --- FIN ETAPA 11.1 ---
    fechaCreacion: Timestamp.now(),
  };

  try {
    const docId = await agregarDocumentoRaiz('grupos', nuevoGrupo);
    console.log(`[Firebase] Nuevo grupo creado con ID: ${docId}`);
    return docId;
  } catch (error) {
    console.error(`[Firebase] Error al crear grupo:`, error);
    throw error;
  }
}

// ==========================================================================
// ==     ETAPA 11.4: FUNCIONES DE GESTIÓN DE MIEMBROS (Backend)
// ==========================================================================

/**
 * Busca un usuario por su email exacto usando collectionGroup en 'config'.
 * Requiere que el email esté guardado en el documento 'userConfig'.
 */
export async function buscarUsuarioPorEmail(email) {
  if (!userId) throw new Error(`[Firebase] No autenticado.`);
  
  console.log(`[Firebase] Buscando usuario por email: ${email}`);
  
  // Buscando en TODAS las subcolecciones llamadas 'config'
  // donde el documento (userConfig) tenga el campo 'email' igual al buscado.
  // NOTA: Esto requiere un índice de exención de collectionGroup si 'config' es muy común,
  // pero para este caso de uso debería funcionar o pedir índice.
  // El documento específico es 'userConfig', pero collectionGroup busca en la colección.
  
  try {
    const q = query(
      collectionGroup(db, 'config'),
      where('email', '==', email)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('[Firebase] No se encontró usuario con ese email.');
      return null;
    }
    
    // Debería haber solo uno, pero tomamos el primero
    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();
    
    // El ID del documento es 'userConfig', pero necesitamos el ID del USUARIO (padre del padre)
    // Estructura: usuarios/{userId}/config/userConfig
    const userDocRef = docSnap.ref.parent.parent; 
    const foundUserId = userDocRef.id;
    
    return {
      uid: foundUserId,
      nombre: data.userName || 'Usuario',
      email: data.email,
      photoURL: data.photoURL || null // Si lo guardamos
    };
    
  } catch (error) {
    console.error('[Firebase] Error al buscar usuario:', error);
    throw error;
  }
}

/**
 * Agrega un UID al array 'miembros' de un grupo.
 */
export async function agregarMiembroAGrupo(grupoId, nuevoMiembroId) {
  if (!userId) throw new Error(`[Firebase] No autenticado.`);
  
  try {
    const grupoRef = doc(db, 'grupos', grupoId);
    const grupoSnap = await getDoc(grupoRef);
    
    if (!grupoSnap.exists()) {
      throw new Error('El grupo no existe.');
    }
    
    const grupoData = grupoSnap.data();
    
    // Verificar permisos (solo el dueño puede agregar por ahora, o cualquier miembro?)
    // Por ahora permitimos que cualquier miembro agregue, o restringimos al owner.
    // El requisito decía "administrar los grupos", asumimos owner.
    if (grupoData.ownerId && grupoData.ownerId !== userId) {
       throw new Error('Solo el administrador del grupo puede agregar miembros.');
    }
    
    const miembrosActuales = grupoData.miembros || [];
    
    if (miembrosActuales.includes(nuevoMiembroId)) {
      throw new Error('El usuario ya es miembro del grupo.');
    }
    
    const nuevosMiembros = [...miembrosActuales, nuevoMiembroId];
    
    await updateDoc(grupoRef, { miembros: nuevosMiembros });
    console.log(`[Firebase] Miembro ${nuevoMiembroId} agregado al grupo ${grupoId}`);
    
  } catch (error) {
    console.error('[Firebase] Error al agregar miembro:', error);
    throw error;
  }
}

/**
 * Obtiene los detalles (nombre, email) de una lista de UIDs.
 * Nota: Esto hace N lecturas, optimizar si son muchos.
 */
export async function obtenerDetallesMiembros(memberIds) {
  if (!userId) return [];
  
  const detalles = [];
  
  for (const mid of memberIds) {
    try {
      // Leemos su config pública
      const configRef = doc(db, 'usuarios', mid, 'config', 'userConfig');
      const configSnap = await getDoc(configRef);
      
      if (configSnap.exists()) {
        const data = configSnap.data();
        detalles.push({
          id: mid,
          nombre: data.userName || 'Usuario',
          email: data.email || 'Sin email',
          photoURL: data.photoURL || null,
          esOwner: false // Se calculará fuera
        });
      } else {
        detalles.push({ id: mid, nombre: 'Usuario Desconocido', email: '---' });
      }
    } catch (e) {
      console.warn(`Error al leer detalles de ${mid}`, e);
      detalles.push({ id: mid, nombre: 'Error', email: '---' });
    }
  }
  
  return detalles;
}

// ==========================================================================
// ==     FUNCIONES DE CRUD PRIVADAS (Actualizar, Eliminar, etc.)
// ==========================================================================
// (Aquí van el resto de tus funciones: actualizarDocumento, eliminarDocumento, etc.)

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
    const docRef = doc(db, 'usuarios', userId, nombreColeccion, String(docId));
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
    const docRef = doc(db, 'usuarios', userId, nombreColeccion, String(docId));
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

export async function agregarEventoCumpleaños(fechaString) {
  if (!userId) {
    console.warn(
      '[Firebase] No hay usuario para agregar evento de cumpleaños.',
    );
    return;
  }

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

  const fechaAnclaje = new Date(proximoCumpleaños);
  fechaAnclaje.setUTCFullYear(proximoCumpleaños.getUTCFullYear() - 1);

  const fechaAnclajeString = fechaAnclaje.toISOString().split('T')[0];

  const nuevoEvento = {
    titulo: 'Cumpleaños!!! 🥳🎉',
    fechaInicio: fechaAnclajeString,
    fechaFin: fechaAnclajeString,
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

export function crearBatch() {
  if (!userId)
    throw new Error(`[Firebase] No autenticado. No se puede crear batch.`);
  return writeBatch(db);
}

export function crearConsulta(nombreColeccion, ...condiciones) {
  if (!userId)
    throw new Error(
      `[Firebase] No autenticado. No se puede consultar ${nombreColeccion}.`,
    );
  const coleccionRef = collection(db, 'usuarios', userId, nombreColeccion);
  const whereConstraints = condiciones.map((c) => where(c[0], c[1], c[2]));
  return query(coleccionRef, ...whereConstraints);
}

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
// ==      MODIFICADO: 'migrarDatosDesdeLocalStorage' (Función de Importación)
// ==========================================================================
/**
 * REFACTORIZADO (P3.4): Sube TODOS los datos de un JSON a Firestore.
 * AHORA ES ROBUSTO: Maneja 'cursos' como array de strings (viejos backups)
 * o como array de objetos (nuevos backups).
 *
 * @param {object} estadoLocal - El objeto 'state' completo leído desde el JSON.
 */
export async function migrarDatosDesdeLocalStorage(estadoLocal) {
  if (!userId) throw new Error('[Firebase] No se puede migrar sin User ID.');
  console.log('[Firebase] Iniciando migración/importación batch...');

  try {
    const batch = writeBatch(db);

    // 1. Guardar Configuración
    const configLimpia = { ...estadoLocal.config };
    if (configLimpia.userName === undefined) delete configLimpia.userName;
    const configRef = doc(db, 'usuarios', userId, 'config', 'userConfig');
    // Esta línea guarda CUALQUIER configuración que venga en el JSON,
    // incluyendo 'pulsos' y 'pulsosVistos' si existen. Es correcto.
    batch.set(configRef, configLimpia || {});

    // ==========================================================
    // ==           INICIO CORRECCIÓN RETROCOMPATIBILIDAD      ==
    // ==========================================================

    // 2. Guardar Cursos (¡Lógica robusta!)
    if (estadoLocal.cursos && estadoLocal.cursos.length > 0) {
      estadoLocal.cursos.forEach((curso) => {
        let cursoRef;
        let cursoData;

        if (typeof curso === 'string') {
          // --- CASO 1: Backup antiguo (Array de strings) ---
          // No importar 'General' (se crea solo si es necesario)
          if (curso.toLowerCase() === 'general') return;

          // Dejar que Firebase genere un ID
          cursoRef = doc(collection(db, 'usuarios', userId, 'cursos'));
          cursoData = {
            nombre: curso,
            emoji: null,
            isArchivado: false,
          };
          console.log(`[Importar] Creando curso (string): ${curso}`);
        } else if (curso && typeof curso === 'object' && curso.id) {
          // --- CASO 2: Backup nuevo (Array de objetos con ID) ---
          const docId = String(curso.id);
          const { id, ...data } = curso; // Quitar el 'id' del objeto de datos
          cursoRef = doc(db, 'usuarios', userId, 'cursos', docId);
          cursoData = data;
        } else if (
          curso &&
          typeof curso === 'object' &&
          !curso.id &&
          curso.nombre
        ) {
          // --- CASO 3: Objeto sin ID (p.ej. de 'FB-Simple') ---
          // Dejar que Firebase genere un ID
          cursoRef = doc(collection(db, 'usuarios', userId, 'cursos'));
          cursoData = curso; // Guardar el objeto tal cual
          console.log(`[Importar] Creando curso (obj sin id): ${curso.nombre}`);
        } else {
          // Caso inválido, saltar
          console.warn('[Importar] Saltando item de curso inválido:', curso);
          return;
        }

        batch.set(cursoRef, cursoData);
      });
    }

    // --- Lógica robusta para Tareas, Proyectos, etc. (Manejar IDs faltantes) ---
    // (Esta función ahora se usará para todos los imports)

    const importarColeccion = (nombreColeccion, datos) => {
      if (datos && datos.length > 0) {
        datos.forEach((item) => {
          let itemRef;
          let itemData;
          if (item && typeof item === 'object' && item.id) {
            // Caso 1: Objeto con ID (normal)
            const docId = String(item.id);
            const { id, ...data } = item;
            itemRef = doc(db, 'usuarios', userId, nombreColeccion, docId);
            itemData = data;
          } else if (item && typeof item === 'object') {
            // Caso 2: Objeto sin ID (dejar que FB genere uno)
            itemRef = doc(collection(db, 'usuarios', userId, nombreColeccion));
            itemData = item;
            console.log(`[Importar] Creando doc sin ID en ${nombreColeccion}`);
          } else {
            console.warn(
              `[Importar] Saltando item inválido en ${nombreColeccion}:`,
              item,
            );
            return;
          }
          batch.set(itemRef, itemData);
        });
      }
    };

    // 3. Guardar Tareas
    importarColeccion('tareas', estadoLocal.tareas);
    // 4. Guardar Apuntes
    importarColeccion('apuntes', estadoLocal.apuntes);
    // 5. Guardar Eventos
    importarColeccion('eventos', estadoLocal.eventos);
    // 6. Guardar Proyectos
    importarColeccion('proyectos', estadoLocal.proyectos);

    // ==========================================================
    // ==            FIN CORRECCIÓN RETROCOMPATIBILIDAD        ==
    // ==========================================================

    await batch.commit();

    console.log('[Firebase] Migración/Importación batch completada con éxito.');
  } catch (error) {
    console.error(
      '[Firebase] Error durante la migración/importación batch:',
      error,
    );
    throw error;
  }
}
