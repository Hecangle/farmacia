/**
 * clientes.js - Gestión de Clientes con SQLite en JS
 * Farmacia - Sistema Autónomo HTML + JS
 */

let listaClientes = [];

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacion(false);

  try {
    await inicializarBD('libs/sql-wasm.wasm');
    renderNavbar('clientes');
    cargarClientes();
  } catch (err) {
    console.error('Error inicializando clientes:', err);
    alert('Error al inicializar la base de datos: ' + err.message);
  }
});

function cargarClientes() {
  listaClientes = dbQuery(`
    SELECT c.*, COUNT(v.id) as total_compras 
    FROM clientes c
    LEFT JOIN ventas v ON c.id = v.cliente_id
    GROUP BY c.id
    ORDER BY c.nombres ASC;
  `);

  filtrarClientes();
}

function filtrarClientes() {
  const q = (document.getElementById('cli_buscar').value || '').trim().toLowerCase();
  const filtrados = listaClientes.filter(c => {
    return !q || 
      c.cedula.toLowerCase().includes(q) || 
      c.nombres.toLowerCase().includes(q) || 
      c.apellidos.toLowerCase().includes(q) ||
      (c.telefono && c.telefono.toLowerCase().includes(q));
  });

  renderizarTablaClientes(filtrados);
}

function renderizarTablaClientes(items) {
  const tbody = document.getElementById('cli_tabla_body');
  const contador = document.getElementById('cli_total_contador');
  contador.textContent = String(items.length);

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">No se encontraron clientes.</td></tr>`;
    return;
  }

  let html = '';
  items.forEach(c => {
    html += `
      <tr>
        <td><code style="font-weight: 800; color: #047857; font-size: 0.95rem;">${c.cedula}</code></td>
        <td><strong style="color: #020617; font-size: 0.98rem;">${c.nombres} ${c.apellidos}</strong></td>
        <td>${c.telefono || '<span style="color: #94a3b8;">No registrado</span>'}</td>
        <td><small style="color: #475569;">${c.direccion || 'Sin dirección'}</small></td>
        <td style="text-align: center;">
          <span class="badge ${c.total_compras > 0 ? 'badge-primary' : 'badge-neutral'}">
            ${c.total_compras} compras
          </span>
        </td>
        <td style="text-align: center;">
          <div style="display: inline-flex; gap: 0.4rem;">
            <button type="button" class="btn btn-outline" onclick="verHistorialCliente(${c.id})" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;" title="Ver compras del cliente">
              📜
            </button>
            <button type="button" class="btn btn-outline" onclick="abrirModalCliente(${c.id})" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;" title="Editar cliente">
              ✏️
            </button>
            <button type="button" class="btn btn-danger" onclick="eliminarCliente(${c.id})" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;" title="Eliminar cliente">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Modal Registrar / Editar
function abrirModalCliente(clienteId = null) {
  const modal = document.getElementById('modal_cliente');
  const titulo = document.getElementById('modal_cli_titulo');

  if (clienteId) {
    const c = dbQueryOne("SELECT * FROM clientes WHERE id = ?;", [clienteId]);
    if (!c) return;
    titulo.textContent = '✏️ Editar Cliente';
    document.getElementById('modal_cli_id').value = c.id;
    document.getElementById('input_cli_cedula').value = c.cedula;
    document.getElementById('input_cli_nombres').value = c.nombres;
    document.getElementById('input_cli_apellidos').value = c.apellidos;
    document.getElementById('input_cli_telefono').value = c.telefono || '';
    document.getElementById('input_cli_direccion').value = c.direccion || '';
  } else {
    titulo.textContent = '👤 Registrar Cliente';
    document.getElementById('form_cliente').reset();
    document.getElementById('modal_cli_id').value = '';
  }

  modal.style.display = 'flex';
}

function cerrarModalCliente() {
  document.getElementById('modal_cliente').style.display = 'none';
}

async function guardarCliente(e) {
  e.preventDefault();
  const idVal = document.getElementById('modal_cli_id').value;
  const cedula = document.getElementById('input_cli_cedula').value.trim();
  const nombres = document.getElementById('input_cli_nombres').value.trim();
  const apellidos = document.getElementById('input_cli_apellidos').value.trim();
  const telefono = document.getElementById('input_cli_telefono').value.trim();
  const direccion = document.getElementById('input_cli_direccion').value.trim();

  if (!cedula || !nombres || !apellidos) {
    alert('Por favor complete los campos obligatorios: Cédula, Nombres y Apellidos.');
    return;
  }

  // Validar cédula única
  if (!idVal) {
    const existe = dbQueryOne("SELECT id FROM clientes WHERE cedula = ?;", [cedula]);
    if (existe) {
      alert(`La cédula "${cedula}" ya está registrada.`);
      return;
    }
  } else {
    const existe = dbQueryOne("SELECT id FROM clientes WHERE cedula = ? AND id != ?;", [cedula, parseInt(idVal)]);
    if (existe) {
      alert(`La cédula "${cedula}" ya está registrada para otro cliente.`);
      return;
    }
  }

  try {
    if (idVal) {
      await dbRun(`
        UPDATE clientes 
        SET cedula = ?, nombres = ?, apellidos = ?, telefono = ?, direccion = ?
        WHERE id = ?;
      `, [cedula, nombres, apellidos, telefono, direccion, parseInt(idVal)]);
    } else {
      await dbInsert(`
        INSERT INTO clientes (cedula, nombres, apellidos, telefono, direccion)
        VALUES (?, ?, ?, ?, ?);
      `, [cedula, nombres, apellidos, telefono, direccion]);
    }

    cerrarModalCliente();
    cargarClientes();
    alert('Cliente guardado exitosamente.');
  } catch (err) {
    console.error('Error guardando cliente:', err);
    alert('Error al guardar cliente: ' + err.message);
  }
}

async function eliminarCliente(id) {
  const c = dbQueryOne("SELECT nombres, apellidos FROM clientes WHERE id = ?;", [id]);
  if (!c) return;

  if (confirm(`¿Está seguro de que desea eliminar al cliente "${c.nombres} ${c.apellidos}"?`)) {
    try {
      await dbRun("DELETE FROM clientes WHERE id = ?;", [id]);
      cargarClientes();
      alert('Cliente eliminado correctamente.');
    } catch (err) {
      console.error('Error eliminando cliente:', err);
      alert('Error al eliminar cliente: ' + err.message);
    }
  }
}

// Historial de compras
function verHistorialCliente(clienteId) {
  const c = dbQueryOne("SELECT * FROM clientes WHERE id = ?;", [clienteId]);
  if (!c) return;

  document.getElementById('historial_cliente_info').textContent = 
    `Cliente: ${c.nombres} ${c.apellidos} (Cédula: ${c.cedula}) - Teléfono: ${c.telefono || 'N/A'}`;

  const ventas = dbQuery(`
    SELECT id, codigo_venta, fecha, total_bs, total_usd, metodo_pago 
    FROM ventas 
    WHERE cliente_id = ?
    ORDER BY fecha DESC;
  `, [clienteId]);

  const tbody = document.getElementById('historial_tabla_body');
  if (ventas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">Este cliente aún no tiene compras registradas.</td></tr>`;
  } else {
    let html = '';
    ventas.forEach(v => {
      html += `
        <tr>
          <td><code style="font-weight: 800; color: #047857;">${v.codigo_venta}</code></td>
          <td style="font-size: 0.88rem; color: #475569;">${v.fecha}</td>
          <td><span class="badge badge-neutral">${v.metodo_pago}</span></td>
          <td style="text-align: right; font-weight: 850; color: #047857;">${formatearBs(v.total_bs)}</td>
          <td style="text-align: right; font-weight: 650; color: #334155;">${formatearUsd(v.total_usd)}</td>
          <td style="text-align: center;">
            <a href="ticket.html?id=${v.id}" target="_blank" class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">
              🖨️ Ver
            </a>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  document.getElementById('modal_historial').style.display = 'flex';
}

function cerrarModalHistorial() {
  document.getElementById('modal_historial').style.display = 'none';
}
