/**
 * ticket.js - Generación de Comprobante / Ticket Impreso con SQLite en JS
 * Farmacia - Sistema Autónomo HTML + JS
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await inicializarBD('libs/sql-wasm.wasm');
    cargarDatosTicket();
  } catch (err) {
    console.error('Error inicializando ticket:', err);
    alert('Error al cargar la base de datos para el comprobante: ' + err.message);
  }
});

function cargarDatosTicket() {
  const params = new URLSearchParams(window.location.search);
  const ventaId = params.get('id');
  const codigoVenta = params.get('codigo');

  let venta = null;
  if (ventaId) {
    venta = dbQueryOne(`
      SELECT v.*, u.nombre as cajero, c.nombres as cli_nombres, c.apellidos as cli_apellidos, c.cedula as cli_cedula, c.telefono as cli_telefono
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE v.id = ?;
    `, [parseInt(ventaId)]);
  } else if (codigoVenta) {
    venta = dbQueryOne(`
      SELECT v.*, u.nombre as cajero, c.nombres as cli_nombres, c.apellidos as cli_apellidos, c.cedula as cli_cedula, c.telefono as cli_telefono
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE v.codigo_venta = ?;
    `, [codigoVenta]);
  } else {
    // Si no se pasa parámetro, cargar la última venta registrada
    venta = dbQueryOne(`
      SELECT v.*, u.nombre as cajero, c.nombres as cli_nombres, c.apellidos as cli_apellidos, c.cedula as cli_cedula, c.telefono as cli_telefono
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      LEFT JOIN clientes c ON v.cliente_id = c.id
      ORDER BY v.id DESC LIMIT 1;
    `);
  }

  if (!venta) {
    document.body.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #b91c1c; font-family: sans-serif;">
        <h3>❌ Venta no encontrada</h3>
        <p>No se encontró el comprobante solicitado en la base de datos.</p>
        <a href="ventas.html" class="btn btn-primary" style="display: inline-block; margin-top: 1rem;">← Volver al Punto de Venta</a>
      </div>
    `;
    return;
  }

  // 1. Datos de la Farmacia
  document.getElementById('tkt_nombre_farmacia').textContent = dbObtenerConfig('nombre_farmacia', 'Farmacia');
  document.getElementById('tkt_rif').textContent = dbObtenerConfig('rif_farmacia', 'J-40123456-7');
  document.getElementById('tkt_dir').textContent = dbObtenerConfig('direccion_farmacia', 'Av. Principal, Edif. Central, PB');
  document.getElementById('tkt_tel').textContent = dbObtenerConfig('telefono_farmacia', '0212-5551234');

  // 2. Datos de la Venta
  document.getElementById('tkt_codigo').textContent = venta.codigo_venta;
  document.getElementById('tkt_fecha').textContent = venta.fecha;
  document.getElementById('tkt_cajero').textContent = venta.cajero || 'Administrador';

  // 3. Datos del Cliente
  const nombreCli = venta.cli_nombres ? `${venta.cli_nombres} ${venta.cli_apellidos}` : 'Consumidor Final';
  const cedulaCli = venta.cli_cedula || 'No especificada';
  document.getElementById('tkt_cliente_nombre').textContent = nombreCli;
  document.getElementById('tkt_cliente_cedula').textContent = cedulaCli;

  if (venta.cli_telefono) {
    document.getElementById('tkt_cliente_tel').textContent = venta.cli_telefono;
    document.getElementById('tkt_box_telf').style.display = 'block';
  }

  // 4. Ítems del Detalle
  const detalles = dbQuery("SELECT * FROM detalle_ventas WHERE venta_id = ?;", [venta.id]);
  const tbody = document.getElementById('tkt_tbody_items');
  let htmlItems = '';

  detalles.forEach(d => {
    htmlItems += `
      <tr>
        <td style="vertical-align: top;">${d.cantidad}</td>
        <td>
          <strong>${d.nombre_medicamento}</strong><br>
          <small style="color: #475569;">Cod: ${d.codigo_interno} (Bs. ${d.precio_unitario_bs.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})})</small>
        </td>
        <td style="text-align: right; font-weight: bold; vertical-align: top;">
          ${d.subtotal_bs.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = htmlItems;

  // 5. Totales y Método de Pago
  document.getElementById('tkt_total_bs').textContent = `Bs. ${venta.total_bs.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  document.getElementById('tkt_total_usd').textContent = `$ ${venta.total_usd.toFixed(2)}`;
  document.getElementById('tkt_tasa').textContent = `Bs. ${venta.tasa_dolar.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} / $`;
  document.getElementById('tkt_metodo').textContent = venta.metodo_pago;

  // 6. Notas / Seriales de billetes si aplica
  const boxNotas = document.getElementById('tkt_box_notas');
  if (venta.notas && venta.notas.trim()) {
    boxNotas.textContent = venta.notas;
    boxNotas.style.display = 'block';
  } else {
    boxNotas.style.display = 'none';
  }
}
