/**
 * reportes.js - Lógica de Reportes y Estadísticas Financieras con SQLite en JS
 * Farmacia - Sistema Autónomo HTML + JS
 */

let tasaDolar = 36.50;

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacion(false);

  try {
    await inicializarBD('libs/sql-wasm.wasm');
    renderNavbar('reportes');
    tasaDolar = parseFloat(dbObtenerConfig('tasa_dolar', '36.50')) || 36.50;

    // Inicializar fechas por defecto (mes actual)
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const hoyStr = hoy.toISOString().split('T')[0];

    document.getElementById('rep_fecha_inicio').value = primerDiaMes;
    document.getElementById('rep_fecha_fin').value = hoyStr;

    generarReporte();
  } catch (err) {
    console.error('Error inicializando reportes:', err);
    alert('Error al inicializar la base de datos: ' + err.message);
  }
});

function cambiarPeriodoReporte(periodo) {
  const boxFechas = document.getElementById('rep_box_fechas');
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split('T')[0];

  if (periodo === 'personalizado') {
    boxFechas.style.display = 'flex';
  } else {
    boxFechas.style.display = 'none';

    if (periodo === 'hoy') {
      document.getElementById('rep_fecha_inicio').value = hoyStr;
      document.getElementById('rep_fecha_fin').value = hoyStr;
    } else if (periodo === 'semana') {
      const hace7Dias = new Date();
      hace7Dias.setDate(hoy.getDate() - 6);
      document.getElementById('rep_fecha_inicio').value = hace7Dias.toISOString().split('T')[0];
      document.getElementById('rep_fecha_fin').value = hoyStr;
    } else if (periodo === 'mes') {
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
      document.getElementById('rep_fecha_inicio').value = primerDia;
      document.getElementById('rep_fecha_fin').value = hoyStr;
    } else if (periodo === 'todos') {
      document.getElementById('rep_fecha_inicio').value = '2020-01-01';
      document.getElementById('rep_fecha_fin').value = '2099-12-31';
    }
    generarReporte();
  }
}

function generarReporte() {
  const fechaIni = document.getElementById('rep_fecha_inicio').value + ' 00:00:00';
  const fechaFin = document.getElementById('rep_fecha_fin').value + ' 23:59:59';
  const metodoFiltro = document.getElementById('rep_filtro_metodo').value;

  let sqlCond = "WHERE v.fecha >= ? AND v.fecha <= ?";
  const params = [fechaIni, fechaFin];

  if (metodoFiltro) {
    sqlCond += " AND v.metodo_pago = ?";
    params.push(metodoFiltro);
  }

  // 1. Obtener ventas
  const ventas = dbQuery(`
    SELECT v.*, c.nombres as cli_nombres, c.apellidos as cli_apellidos, c.cedula as cli_cedula
    FROM ventas v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    ${sqlCond}
    ORDER BY v.fecha DESC, v.id DESC;
  `, params);

  // 2. Calcular KPIs
  let totalBs = 0;
  let totalUsd = 0;
  const cantVentas = ventas.length;

  ventas.forEach(v => {
    totalBs += v.total_bs;
    totalUsd += v.total_usd;
  });

  const ticketPromedioBs = cantVentas > 0 ? (totalBs / cantVentas) : 0;

  document.getElementById('rep_kpi_total_bs').textContent = formatearBs(totalBs);
  document.getElementById('rep_kpi_total_usd').textContent = formatearUsd(totalUsd);
  document.getElementById('rep_kpi_cant_ventas').textContent = `${cantVentas} ventas`;
  document.getElementById('rep_kpi_ticket_promedio').textContent = `Ticket prom: ${formatearBs(ticketPromedioBs)}`;

  // 3. Estimar ganancia bruta
  // Comparando el subtotal USD vendido con el precio_compra en medicamentos
  const idsVentas = ventas.map(v => v.id);
  let gananciaEstimadaUsd = 0;

  if (idsVentas.length > 0) {
    const placeholders = idsVentas.map(() => '?').join(',');
    const detalles = dbQuery(`
      SELECT dv.subtotal_usd, dv.cantidad, m.precio_compra 
      FROM detalle_ventas dv
      JOIN medicamentos m ON dv.medicamento_id = m.id
      WHERE dv.venta_id IN (${placeholders});
    `, idsVentas);

    detalles.forEach(d => {
      const costoTotal = d.precio_compra * d.cantidad;
      const ganancia = d.subtotal_usd - costoTotal;
      if (ganancia > 0) gananciaEstimadaUsd += ganancia;
    });
  }

  const gananciaEstimadaBs = gananciaEstimadaUsd * tasaDolar;
  document.getElementById('rep_kpi_ganancia_usd').textContent = formatearUsd(gananciaEstimadaUsd);
  document.getElementById('rep_kpi_ganancia_bs').textContent = formatearBs(gananciaEstimadaBs);

  // 4. Desglose por método de pago
  const sqlMetodos = `
    SELECT v.metodo_pago, COUNT(v.id) as operaciones, SUM(v.total_bs) as total_bs, SUM(v.total_usd) as total_usd
    FROM ventas v
    ${sqlCond}
    GROUP BY v.metodo_pago
    ORDER BY total_bs DESC;
  `;
  const metodos = dbQuery(sqlMetodos, params);
  renderizarTablaMetodos(metodos);

  // 5. Top 10 medicamentos más vendidos
  let sqlTop = `
    SELECT dv.nombre_medicamento, SUM(dv.cantidad) as total_unidades, SUM(dv.subtotal_bs) as total_bs
    FROM detalle_ventas dv
    JOIN ventas v ON dv.venta_id = v.id
    ${sqlCond}
    GROUP BY dv.medicamento_id
    ORDER BY total_unidades DESC
    LIMIT 10;
  `;
  const topMeds = dbQuery(sqlTop, params);
  renderizarTablaTopMeds(topMeds);

  // 6. Lista detallada de ventas
  renderizarTablaVentas(ventas);
}

function renderizarTablaMetodos(items) {
  const tbody = document.getElementById('rep_tbody_metodos');
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: #64748b;">Sin operaciones.</td></tr>`;
    return;
  }
  let html = '';
  items.forEach(m => {
    html += `
      <tr>
        <td><strong>${m.metodo_pago}</strong></td>
        <td style="text-align: center;"><span class="badge badge-neutral">${m.operaciones}</span></td>
        <td style="text-align: right; font-weight: 850; color: #047857;">${formatearBs(m.total_bs)}</td>
        <td style="text-align: right; font-weight: 650; color: #334155;">${formatearUsd(m.total_usd)}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function renderizarTablaTopMeds(items) {
  const tbody = document.getElementById('rep_tbody_top_meds');
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 1.5rem; color: #64748b;">Sin datos en el período.</td></tr>`;
    return;
  }
  let html = '';
  items.forEach((m, idx) => {
    html += `
      <tr>
        <td>
          <span style="font-weight: 800; color: #047857; margin-right: 0.35rem;">#${idx + 1}</span>
          <strong style="color: #020617;">${m.nombre_medicamento}</strong>
        </td>
        <td style="text-align: center; font-weight: 850; font-size: 1.05rem; color: #0f172a;">${m.total_unidades}</td>
        <td style="text-align: right; font-weight: 750; color: #047857;">${formatearBs(m.total_bs)}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function renderizarTablaVentas(items) {
  const tbody = document.getElementById('rep_tbody_ventas');
  const contador = document.getElementById('rep_contador_ventas');
  contador.textContent = String(items.length);

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">No hay ventas registradas en el período seleccionado.</td></tr>`;
    return;
  }

  let html = '';
  items.forEach(v => {
    const nombreCliente = v.cli_nombres ? `${v.cli_nombres} ${v.cli_apellidos}` : 'Consumidor Final';
    html += `
      <tr>
        <td><code style="font-weight: 800; color: #047857;">${v.codigo_venta}</code></td>
        <td style="font-size: 0.88rem; color: #475569;">${v.fecha}</td>
        <td><span style="color: #020617; font-weight: 650;">${nombreCliente}</span></td>
        <td><span class="badge badge-neutral">${v.metodo_pago}</span></td>
        <td style="text-align: right; font-weight: 850; color: #047857;">${formatearBs(v.total_bs)}</td>
        <td style="text-align: right; font-weight: 650; color: #334155;">${formatearUsd(v.total_usd)}</td>
        <td class="no-print" style="text-align: center;">
          <a href="ticket.html?id=${v.id}" target="_blank" class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">
            🖨️ Ticket
          </a>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}
