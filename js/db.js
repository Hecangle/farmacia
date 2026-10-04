/**
 * db.js - Motor de Base de Datos SQLite en JavaScript (sql.js + IndexedDB)
 * Farmacia - Sistema Autónomo HTML + JS
 */

const DB_NAME = 'FarmaciaSQLiteDB';
const DB_STORE = 'sqlite_store';
const DB_KEY = 'farmacia_db_file';
const DB_VERSION = 1;

let dbInstance = null;
let sqlEngine = null;

/**
 * Abrir o inicializar la base de datos IndexedDB para almacenar el archivo SQLite (.db)
 */
function abrirIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Obtener los bytes del archivo SQLite guardado en IndexedDB
 */
async function cargarDesdeIndexedDB() {
  try {
    const idb = await abrirIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.get(DB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error leyendo de IndexedDB:', err);
    return null;
  }
}

/**
 * Guardar los bytes del archivo SQLite en IndexedDB
 */
async function guardarEnIndexedDB(bytes) {
  try {
    const idb = await abrirIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      const req = store.put(bytes, DB_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error guardando en IndexedDB:', err);
    return false;
  }
}

/**
 * Convertir cadena base64 a Uint8Array
 */
function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Inicializar el motor sql.js y cargar o crear la base de datos
 */
async function inicializarBD(rutaWasm = 'libs/sql-wasm.wasm') {
  if (dbInstance) return dbInstance;

  // 1. Inicializar sql.js con wasm binario embebido si existe para evitar bloqueos de CORS en file://
  if (!sqlEngine) {
    if (typeof SQL_WASM_BASE64 !== 'undefined' && SQL_WASM_BASE64.length > 100) {
      const wasmBinary = base64ToUint8Array(SQL_WASM_BASE64);
      sqlEngine = await initSqlJs({ wasmBinary });
    } else {
      sqlEngine = await initSqlJs({
        locateFile: file => {
          if (file.endsWith('.wasm')) return rutaWasm;
          return 'libs/' + file;
        }
      });
    }
  }

  // 2. Intentar cargar desde IndexedDB
  const bytesGuardados = await cargarDesdeIndexedDB();

  if (bytesGuardados && bytesGuardados.length > 0) {
    try {
      dbInstance = new sqlEngine.Database(bytesGuardados);
      dbInstance.exec("PRAGMA foreign_keys = ON;");
      asegurarEsquema(dbInstance);
      console.log('Base de datos SQLite cargada desde IndexedDB.');
      return dbInstance;
    } catch (e) {
      console.warn('Error al leer base de datos guardada en IndexedDB, reintentando con archivo base...', e);
    }
  }

  // 3. Si no existe en IndexedDB, intentar cargar desde farmacia.db en esta misma carpeta
  try {
    const resp = await fetch('farmacia.db');
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      if (buffer.byteLength > 0) {
        dbInstance = new sqlEngine.Database(new Uint8Array(buffer));
        dbInstance.exec("PRAGMA foreign_keys = ON;");
        asegurarEsquema(dbInstance);
        await guardarEnIndexedDB(dbInstance.export());
        console.log('Base de datos inicial cargada desde farmacia.db local.');
        return dbInstance;
      }
    }
  } catch (errFetch) {
    console.log('Fetch a farmacia.db no disponible, intentando binario embebido...');
  }

  // 4. Si fetch falló (por ejemplo, en protocolo file://), usar el binario embebido de farmacia.db
  if (typeof INITIAL_DB_BASE64 !== 'undefined' && INITIAL_DB_BASE64.length > 100) {
    const dbBytes = base64ToUint8Array(INITIAL_DB_BASE64);
    dbInstance = new sqlEngine.Database(dbBytes);
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    asegurarEsquema(dbInstance);
    await guardarEnIndexedDB(dbInstance.export());
    console.log('Base de datos inicial cargada desde binario embebido de farmacia.db.');
    return dbInstance;
  }

  // 5. Si no hay archivo externo, crear base de datos nueva con esquema completo y datos iniciales
  dbInstance = new sqlEngine.Database();
  dbInstance.exec("PRAGMA foreign_keys = ON;");
  crearTablasIniciales(dbInstance);
  asegurarEsquema(dbInstance);
  await guardarEnIndexedDB(dbInstance.export());
  console.log('Nueva base de datos SQLite creada con datos de demostración.');

  return dbInstance;
}

function asegurarEsquema(db) {
  try {
    db.exec("ALTER TABLE medicamentos ADD COLUMN activo INTEGER NOT NULL DEFAULT 1;");
  } catch (e) {
    // Columna ya existe
  }
}

/**
 * Crear tablas y registros por defecto si la base de datos es nueva
 */
function crearTablasIniciales(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS configuracion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT UNIQUE NOT NULL,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'admin',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cedula TEXT UNIQUE NOT NULL,
      nombres TEXT NOT NULL,
      apellidos TEXT NOT NULL,
      telefono TEXT NULL,
      direccion TEXT NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medicamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_interno TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      laboratorio TEXT NOT NULL,
      tipo TEXT NOT NULL,
      cantidad_presentacion TEXT NOT NULL,
      precio_compra REAL NOT NULL DEFAULT 0.0,
      precio_venta_usd REAL NOT NULL DEFAULT 0.0,
      stock INTEGER NOT NULL DEFAULT 0,
      stock_minimo INTEGER NOT NULL DEFAULT 3,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_venta TEXT UNIQUE NOT NULL,
      cliente_id INTEGER NULL,
      usuario_id INTEGER NULL,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_bs REAL NOT NULL,
      total_usd REAL NOT NULL,
      tasa_dolar REAL NOT NULL,
      metodo_pago TEXT NOT NULL DEFAULT 'Punto de Venta',
      notas TEXT NULL,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS detalle_ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      medicamento_id INTEGER NOT NULL,
      codigo_interno TEXT NOT NULL,
      nombre_medicamento TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      precio_unitario_bs REAL NOT NULL,
      precio_unitario_usd REAL NOT NULL,
      subtotal_bs REAL NOT NULL,
      subtotal_usd REAL NOT NULL,
      FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
      FOREIGN KEY (medicamento_id) REFERENCES medicamentos(id)
    );

    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicamento_id INTEGER NOT NULL,
      tipo_movimiento TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      stock_anterior INTEGER NOT NULL,
      stock_nuevo INTEGER NOT NULL,
      precio_compra_usd REAL NULL,
      motivo TEXT NOT NULL,
      usuario_id INTEGER NULL,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medicamento_id) REFERENCES medicamentos(id) ON DELETE CASCADE
    );
  `);

  // Configuraciones iniciales
  const configs = [
    ['nombre_farmacia', 'Farmacia'],
    ['rif_farmacia', 'J-40123456-7'],
    ['direccion_farmacia', 'Av. Principal, Edif. Central, PB'],
    ['telefono_farmacia', '0212-5551234'],
    ['tasa_dolar', '36.50'],
    ['margen_ganancia', '30'],
    ['ultima_fecha_tasa', ''],
    ['stock_minimo_global', '3']
  ];
  for (const [c, v] of configs) {
    db.run("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?);", [c, v]);
  }

  // Usuario administrador por defecto (usuario: admin, clave: admin)
  db.run("INSERT OR IGNORE INTO usuarios (usuario, password, nombre, rol) VALUES (?, ?, ?, ?);", [
    'admin',
    'admin',
    'Super Administrador',
    'admin'
  ]);

  // Medicamentos de demostración
  const meds = [
    ['MED-0001', 'Acetaminofén 500mg', 'Laboratorios Calox', 'Tabletas', '10 tabletas', 0.80, 1.20, 25, 3],
    ['MED-0002', 'Ibuprofeno 400mg', 'Elmor', 'Cápsulas blandas', '10 cápsulas', 1.10, 1.60, 15, 3],
    ['MED-0003', 'Amoxicilina 500mg', 'Genven', 'Cápsulas', '12 cápsulas', 2.50, 3.50, 2, 3],
    ['MED-0004', 'Loratadina 10mg', 'Behrens', 'Tabletas', '10 tabletas', 0.90, 1.35, 18, 3],
    ['MED-0005', 'Omeprazol 20mg', 'Meyer', 'Cápsulas', '14 cápsulas', 1.40, 2.10, 3, 3]
  ];
  for (const m of meds) {
    db.run(`INSERT OR IGNORE INTO medicamentos 
      (codigo_interno, nombre, laboratorio, tipo, cantidad_presentacion, precio_compra, precio_venta_usd, stock, stock_minimo) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`, m);
  }

  // Cliente inicial
  db.run(`INSERT OR IGNORE INTO clientes (cedula, nombres, apellidos, telefono, direccion) 
    VALUES (?, ?, ?, ?, ?);`, [
      'V-12345678', 'Consumidor', 'Final', '0414-0000000', 'Ciudad'
    ]);
}

/**
 * Consulta SQL que retorna un arreglo de objetos [{columna: valor, ...}]
 */
function dbQuery(sql, params = []) {
  if (!dbInstance) throw new Error('Base de datos no inicializada.');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Consulta SQL que retorna la primera fila o null
 */
function dbQueryOne(sql, params = []) {
  const rows = dbQuery(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Ejecuta una sentencia SQL (INSERT, UPDATE, DELETE) y persiste automáticamente en IndexedDB
 */
async function dbRun(sql, params = []) {
  if (!dbInstance) throw new Error('Base de datos no inicializada.');
  dbInstance.run(sql, params);
  await dbSave();
  return {
    changes: dbInstance.getRowsModified()
  };
}

/**
 * Ejecuta un INSERT y retorna el id generado (last_insert_rowid)
 */
async function dbInsert(sql, params = []) {
  if (!dbInstance) throw new Error('Base de datos no inicializada.');
  dbInstance.run(sql, params);
  const res = dbQueryOne("SELECT last_insert_rowid() AS id;");
  await dbSave();
  return res ? res.id : null;
}

/**
 * Persiste los cambios actuales de la BD en IndexedDB y en el archivo físico si hay servidor web
 */
async function dbSave() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  await guardarEnIndexedDB(data);

  // Intentar sincronizar el archivo físico farmacia.db en esta misma carpeta
  try {
    fetch('sync_db.php', {
      method: 'POST',
      body: data
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Exportar y descargar el archivo .db actual
 */
function dbExportarArchivo(nombreArchivo = 'farmacia.db') {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const blob = new Blob([data], { type: 'application/x-sqlite3' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/**
 * Importar un archivo .db seleccionado por el usuario
 */
async function dbImportarArchivo(file) {
  if (!file) return false;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function() {
      try {
        const u8 = new Uint8Array(this.result);
        const tempDb = new sqlEngine.Database(u8);
        tempDb.exec("PRAGMA foreign_keys = ON;");
        // Verificar que tenga tablas válidas
        const tables = tempDb.exec("SELECT name FROM sqlite_master WHERE type='table';");
        if (tables.length > 0) {
          dbInstance = tempDb;
          await guardarEnIndexedDB(u8);
          resolve(true);
        } else {
          reject(new Error('El archivo no parece ser una base de datos SQLite válida.'));
        }
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Resetear la base de datos a los valores de fábrica
 */
async function dbResetearAFabrica() {
  if (!sqlEngine) return false;
  dbInstance = new sqlEngine.Database();
  dbInstance.exec("PRAGMA foreign_keys = ON;");
  crearTablasIniciales(dbInstance);
  await guardarEnIndexedDB(dbInstance.export());
  return true;
}

/**
 * Helper para obtener valor de configuración
 */
function dbObtenerConfig(clave, valorPorDefecto = '') {
  const row = dbQueryOne("SELECT valor FROM configuracion WHERE clave = ?;", [clave]);
  return row ? row.valor : valorPorDefecto;
}

/**
 * Helper para guardar valor de configuración
 */
async function dbGuardarConfig(clave, valor) {
  const row = dbQueryOne("SELECT id FROM configuracion WHERE clave = ?;", [clave]);
  if (row) {
    await dbRun("UPDATE configuracion SET valor = ? WHERE clave = ?;", [String(valor), clave]);
  } else {
    await dbRun("INSERT INTO configuracion (clave, valor) VALUES (?, ?);", [clave, String(valor)]);
  }
}
