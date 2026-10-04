/**
 * configuracion.js - Lógica de Configuración, Respaldos SQLite y Usuarios en JS
 * Farmacia - Sistema Autónomo HTML + JS
 */

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacion(false);

  try {
    await inicializarBD('libs/sql-wasm.wasm');
    renderNavbar('configuracion');
    cargarConfiguracionGeneral();
    cargarListaUsuarios();
  } catch (err) {
    console.error('Error inicializando configuración:', err);
    alert('Error al inicializar la base de datos: ' + err.message);
  }
});

function cargarConfiguracionGeneral() {
  document.getElementById('cfg_nombre').value = dbObtenerConfig('nombre_farmacia', 'Farmacia');
  document.getElementById('cfg_rif').value = dbObtenerConfig('rif_farmacia', 'J-40123456-7');
  document.getElementById('cfg_telefono').value = dbObtenerConfig('telefono_farmacia', '0212-5551234');
  document.getElementById('cfg_direccion').value = dbObtenerConfig('direccion_farmacia', 'Av. Principal, Edif. Central, PB');
  document.getElementById('cfg_tasa').value = dbObtenerConfig('tasa_dolar', '36.50');
  document.getElementById('cfg_margen').value = dbObtenerConfig('margen_ganancia', '30');
}

async function guardarConfiguracionGeneral(e) {
  e.preventDefault();
  const nombre = document.getElementById('cfg_nombre').value.trim();
  const rif = document.getElementById('cfg_rif').value.trim();
  const tel = document.getElementById('cfg_telefono').value.trim();
  const dir = document.getElementById('cfg_direccion').value.trim();
  const tasa = parseFloat(document.getElementById('cfg_tasa').value) || 36.50;
  const margen = parseInt(document.getElementById('cfg_margen').value) || 30;

  try {
    await dbGuardarConfig('nombre_farmacia', nombre);
    await dbGuardarConfig('rif_farmacia', rif);
    await dbGuardarConfig('telefono_farmacia', tel);
    await dbGuardarConfig('direccion_farmacia', dir);
    await dbGuardarConfig('tasa_dolar', tasa.toFixed(2));
    await dbGuardarConfig('margen_ganancia', margen);

    const hoyStr = new Date().toISOString().split('T')[0];
    await dbGuardarConfig('ultima_fecha_tasa', hoyStr);

    alert('Configuración comercial y parámetros actualizados con éxito.');
    location.reload();
  } catch (err) {
    console.error('Error guardando configuración:', err);
    alert('Error al guardar configuración: ' + err.message);
  }
}

// Respaldo de Base de Datos SQLite
function descargarBaseDatos() {
  const hoyStr = new Date().toISOString().split('T')[0];
  dbExportarArchivo(`farmacia_respaldo_${hoyStr}.db`);
}

async function manejarImportacionArchivo(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (confirm(`¿Está seguro de que desea importar el archivo "${file.name}"? Esto reemplazará los datos actuales.`)) {
    try {
      await dbImportarArchivo(file);
      alert('¡Base de datos SQLite importada con éxito! La página se recargará ahora.');
      location.reload();
    } catch (err) {
      console.error('Error importando base de datos:', err);
      alert('Error al importar la base de datos: ' + err.message);
    }
  } else {
    e.target.value = '';
  }
}

async function confirmarResetFabrica() {
  if (confirm('⚠️ ¿ATENCIÓN: Está seguro de que desea restablecer la base de datos a los valores de demostración iniciales? Se borrarán las ventas y registros actuales.')) {
    try {
      await dbResetearAFabrica();
      alert('Base de datos restablecida a los valores iniciales.');
      location.reload();
    } catch (err) {
      console.error('Error reseteando base de datos:', err);
      alert('Error al restablecer la base de datos: ' + err.message);
    }
  }
}

// Gestión de Usuarios
function cargarListaUsuarios() {
  const usuarios = dbQuery("SELECT id, usuario, nombre, rol FROM usuarios ORDER BY id ASC;");
  const tbody = document.getElementById('cfg_tbody_usuarios');

  let html = '';
  usuarios.forEach(u => {
    const esAdmin = u.usuario === 'admin';
    html += `
      <tr>
        <td><strong style="color: #020617;">${u.usuario}</strong></td>
        <td>${u.nombre}</td>
        <td><span class="badge ${u.rol === 'admin' ? 'badge-primary' : 'badge-neutral'}">${u.rol}</span></td>
        <td style="text-align: center;">
          ${!esAdmin ? `
            <button type="button" class="btn btn-danger" onclick="eliminarUsuario(${u.id}, '${u.usuario}')" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" title="Eliminar usuario">
              ✕
            </button>
          ` : '<span style="color: #94a3b8; font-size: 0.8rem;">Principal</span>'}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function abrirModalNuevoUsuario() {
  document.getElementById('form_usuario').reset();
  document.getElementById('modal_usuario').style.display = 'flex';
}

function cerrarModalUsuario() {
  document.getElementById('modal_usuario').style.display = 'none';
}

async function guardarUsuario(e) {
  e.preventDefault();
  const u = document.getElementById('usr_usuario').value.trim();
  const n = document.getElementById('usr_nombre').value.trim();
  const p = document.getElementById('usr_password').value.trim();
  const r = document.getElementById('usr_rol').value;

  if (!u || !n || !p) {
    alert('Por favor complete todos los campos requeridos.');
    return;
  }

  const existe = dbQueryOne("SELECT id FROM usuarios WHERE usuario = ?;", [u]);
  if (existe) {
    alert(`El nombre de usuario "${u}" ya existe. Elija otro nombre.`);
    return;
  }

  try {
    await dbInsert("INSERT INTO usuarios (usuario, password, nombre, rol) VALUES (?, ?, ?, ?);", [u, p, n, r]);
    cerrarModalUsuario();
    cargarListaUsuarios();
    alert(`Usuario "${u}" creado exitosamente.`);
  } catch (err) {
    console.error('Error creando usuario:', err);
    alert('Error al crear usuario: ' + err.message);
  }
}

async function eliminarUsuario(id, username) {
  if (confirm(`¿Desea eliminar al usuario "${username}"?`)) {
    try {
      await dbRun("DELETE FROM usuarios WHERE id = ?;", [id]);
      cargarListaUsuarios();
      alert('Usuario eliminado correctamente.');
    } catch (err) {
      console.error('Error eliminando usuario:', err);
      alert('Error al eliminar usuario: ' + err.message);
    }
  }
}
