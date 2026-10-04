/**
 * inventario.js - Lógica de Control de Inventario y Kardex con SQLite en JS
 * Farmacia - Sistema Autónomo HTML + JS
 */

let listaStock = [];
let listaKardex = [];
let tasaDolar = 36.50;

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacion(false);

  try {
    await inicializarBD('libs/sql-wasm.wasm');
    renderNavbar('inventario');
    tasaDolar = parseFloat(dbObtenerConfig('tasa_dolar', '36.50')) || 36.50;

    cargarDatosInventario();
    poblarSelectsModales();
  } catch (err) {
    console.error('Error inicializando inventario:', err);
    alert('Error al inicializar la base de datos: ' + err.message);
  }
});

function cargarDatosInventario() {
  // 1. Cargar stock
  listaStock = dbQuery("SELECT * FROM medicamentos WHERE COALESCE(activo, 1) = 1 ORDER BY (stock <= stock_minimo) DESC, nombre ASC;");

  // 2. Cargar kardex
  listaKardex = dbQuery(`
    SELECT m.fecha, m.tipo_movimiento, m.cantidad, m.stock_anterior, m.stock_nuevo, m.motivo,
           med.codigo_interno, med.nombre as nombre_med, med.laboratorio
    FROM movimientos_inventario m
    JOIN medicamentos med ON m.medicamento_id = med.id
    ORDER BY m.fecha DESC, m.id DESC;
  `);

  actualizarKpisInventario();
  filtrarTablaStock();
  filtrarKardex();
}

function actualizarKpisInventario() {
  const totalProds = listaStock.length;
  let totalUnidades = 0;
  let valorTotalUsd = 0;
  let alertas = 0;

  listaStock.forEach(m => {
    totalUnidades += m.stock;
    valorTotalUsd += (m.stock * m.precio_compra);
    if (m.stock <= m.stock_minimo) alertas++;
  });

  const valorTotalBs = valorTotalUsd * tasaDolar;

  document.getElementById('inv_kpi_total_productos').textContent = `${totalProds} ítems`;
  document.getElementById('inv_kpi_unidades').textContent = `${totalUnidades} unidades en stock`;
  document.getElementById('inv_kpi_valor_usd').textContent = formatearUsd(valorTotalUsd);
  document.getElementById('inv_kpi_valor_bs').textContent = formatearBs(valorTotalBs);

  const kpiAlertas = document.getElementById('inv_kpi_alertas');
  const iconAlertas = document.getElementById('inv_alerta_icon');
  kpiAlertas.textContent = `${alertas} por reponer`;
  if (alertas > 0) {
    kpiAlertas.style.color = 'var(--danger)';
    iconAlertas.className = 'kpi-icon red';
  } else {
    kpiAlertas.style.color = 'var(--primary-hover)';
    iconAlertas.className = 'kpi-icon green';
  }
}

function cambiarPestanaInventario(pestana) {
  const btnStock = document.getElementById('tab_btn_stock');
  const btnKardex = document.getElementById('tab_btn_kardex');
  const vistaStock = document.getElementById('vista_stock');
  const vistaKardex = document.getElementById('vista_kardex');

  if (pestana === 'stock') {
    btnStock.classList.add('active');
    btnKardex.classList.remove('active');
    vistaStock.style.display = 'block';
    vistaKardex.style.display = 'none';
  } else {
    btnKardex.classList.add('active');
    btnStock.classList.remove('active');
    vistaKardex.style.display = 'block';
    vistaStock.style.display = 'none';
  }
}

function filtrarTablaStock() {
  const q = (document.getElementById('inv_buscar_stock').value || '').trim().toLowerCase();
  const filtrados = listaStock.filter(m => {
    return !q || m.nombre.toLowerCase().includes(q) || m.codigo_interno.toLowerCase().includes(q) || m.laboratorio.toLowerCase().includes(q);
  });

  const tbody = document.getElementById('inv_tbody_stock');
  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #64748b;">No se encontraron medicamentos.</td></tr>`;
    return;
  }

  let html = '';
  filtrados.forEach(m => {
    const sinStock = m.stock <= 0;
    const bajoStock = m.stock <= m.stock_minimo && !sinStock;

    let badge = `<span class="badge badge-success">Normal</span>`;
    if (sinStock) badge = `<span class="badge badge-danger">Agotado</span>`;
    else if (bajoStock) badge = `<span class="badge badge-warning">Stock Crítico</span>`;

    html += `
      <tr>
        <td><code style="font-weight: 800; color: #047857;">${m.codigo_interno}</code></td>
        <td><strong style="color: #020617;">${m.nombre}</strong></td>
        <td>${m.laboratorio}</td>
        <td><small style="color: #475569;">${m.tipo} (${m.cantidad_presentacion})</small></td>
        <td style="text-align: right; font-weight: 650; color: #334155;">${formatearUsd(m.precio_compra)}</td>
        <td style="text-align: center; font-weight: 850; font-size: 1.05rem; color: ${sinStock ? '#ef4444' : (bajoStock ? '#b45309' : '#047857')};">
          ${m.stock}
        </td>
        <td style="text-align: center; color: #64748b; font-weight: 600;">${m.stock_minimo}</td>
        <td style="text-align: center;">${badge}</td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-outline" onclick="abrirModalEntradaRapida(${m.id})" style="padding: 0.25rem 0.5rem; font-size: 0.85rem; font-weight: 750;">
            📥 + Reponer
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function filtrarKardex() {
  const q = (document.getElementById('inv_buscar_kardex').value || '').trim().toLowerCase();
  const tipo = document.getElementById('inv_filtro_kardex_tipo').value;

  const filtrados = listaKardex.filter(k => {
    const coincideQ = !q || k.nombre_med.toLowerCase().includes(q) || k.codigo_interno.toLowerCase().includes(q) || k.motivo.toLowerCase().includes(q);
    const coincideTipo = !tipo || k.tipo_movimiento === tipo;
    return coincideQ && coincideTipo;
  });

  const tbody = document.getElementById('inv_tbody_kardex');
  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">No hay registros de movimientos en el Kardex.</td></tr>`;
    return;
  }

  let html = '';
  filtrados.forEach(k => {
    const esEntrada = k.tipo_movimiento === 'ENTRADA';
    const badge = esEntrada ? 
      `<span class="badge badge-success">📥 ENTRADA</span>` : 
      `<span class="badge badge-danger">📤 SALIDA</span>`;

    html += `
      <tr>
        <td style="font-size: 0.88rem; color: #334155; white-space: nowrap;">${k.fecha}</td>
        <td style="text-align: center;">${badge}</td>
        <td>
          <strong style="color: #020617;">${k.nombre_med}</strong><br>
          <small style="color: #64748b;">Cod: ${k.codigo_interno} | ${k.laboratorio}</small>
        </td>
        <td style="text-align: center; font-weight: 850; font-size: 1.05rem; color: ${esEntrada ? '#047857' : '#b91c1c'};">
          ${esEntrada ? '+' : '-'}${k.cantidad}
        </td>
        <td style="text-align: center; color: #475569; font-weight: 600;">${k.stock_anterior}</td>
        <td style="text-align: center; color: #020617; font-weight: 800;">${k.stock_nuevo}</td>
        <td style="font-size: 0.92rem; color: #1e293b; font-weight: 550;">${k.motivo}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function poblarSelectsModales() {
  const selEnt = document.getElementById('ent_med_id');
  const selSal = document.getElementById('sal_med_id');
  if (!selEnt || !selSal) return;

  let opts = '<option value="">-- Seleccione el fármaco --</option>';
  listaStock.forEach(m => {
    opts += `<option value="${m.id}">${m.nombre} (${m.codigo_interno}) - Stock actual: ${m.stock}</option>`;
  });

  selEnt.innerHTML = opts;
  selSal.innerHTML = opts;
}

// Modal Entrada
function abrirModalEntrada() {
  document.getElementById('form_entrada').reset();
  poblarSelectsModales();
  document.getElementById('modal_entrada').style.display = 'flex';
}

function abrirModalEntradaRapida(medId) {
  abrirModalEntrada();
  document.getElementById('ent_med_id').value = medId;
}

function cerrarModalEntrada() {
  document.getElementById('modal_entrada').style.display = 'none';
}

async function guardarEntradaStock(e) {
  e.preventDefault();
  const medId = parseInt(document.getElementById('ent_med_id').value);
  const cant = parseInt(document.getElementById('ent_cantidad').value) || 0;
  const costo = parseFloat(document.getElementById('ent_costo').value) || null;
  const motivo = document.getElementById('ent_motivo').value.trim();

  if (!medId || cant <= 0 || !motivo) {
    alert('Por favor complete los campos obligatorios.');
    return;
  }

  const med = dbQueryOne("SELECT stock, precio_compra, nombre FROM medicamentos WHERE id = ?;", [medId]);
  if (!med) return;

  const stockAnterior = med.stock;
  const stockNuevo = stockAnterior + cant;
  const nuevoCosto = (costo !== null && costo > 0) ? costo : med.precio_compra;
  const user = obtenerUsuarioActual();
  const fechaHora = new Date().toISOString().replace('T', ' ').substring(0, 19);

  try {
    // 1. Actualizar medicamento
    await dbRun(`
      UPDATE medicamentos 
      SET stock = ?, precio_compra = ?, actualizado_en = CURRENT_TIMESTAMP 
      WHERE id = ?;
    `, [stockNuevo, nuevoCosto, medId]);

    // 2. Registrar en kardex
    await dbRun(`
      INSERT INTO movimientos_inventario 
      (medicamento_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, precio_compra_usd, motivo, usuario_id, fecha)
      VALUES (?, 'ENTRADA', ?, ?, ?, ?, ?, ?, ?);
    `, [medId, cant, stockAnterior, stockNuevo, nuevoCosto, motivo, user ? user.id : 1, fechaHora]);

    cerrarModalEntrada();
    cargarDatosInventario();
    poblarSelectsModales();
    alert(`Entrada registrada. Nuevo stock de "${med.nombre}": ${stockNuevo} unidades.`);
  } catch (err) {
    console.error('Error registrando entrada:', err);
    alert('Error al registrar entrada: ' + err.message);
  }
}

// Modal Salida
function abrirModalSalida() {
  document.getElementById('form_salida').reset();
  poblarSelectsModales();
  document.getElementById('sal_disponible_info').textContent = 'Stock disponible: -';
  document.getElementById('modal_salida').style.display = 'flex';
}

function cerrarModalSalida() {
  document.getElementById('modal_salida').style.display = 'none';
}

function actualizarMaximoSalida(medId) {
  if (!medId) {
    document.getElementById('sal_disponible_info').textContent = 'Stock disponible: -';
    return;
  }
  const med = dbQueryOne("SELECT stock FROM medicamentos WHERE id = ?;", [parseInt(medId)]);
  if (med) {
    document.getElementById('sal_disponible_info').textContent = `Stock disponible: ${med.stock} unidades`;
    document.getElementById('sal_cantidad').max = med.stock;
  }
}

async function guardarSalidaStock(e) {
  e.preventDefault();
  const medId = parseInt(document.getElementById('sal_med_id').value);
  const cant = parseInt(document.getElementById('sal_cantidad').value) || 0;
  const motivo = document.getElementById('sal_motivo').value.trim();

  if (!medId || cant <= 0) {
    alert('Por favor complete los campos obligatorios.');
    return;
  }

  const med = dbQueryOne("SELECT stock, nombre FROM medicamentos WHERE id = ?;", [medId]);
  if (!med) return;

  if (cant > med.stock) {
    alert(`No puede retirar ${cant} unidades. El stock disponible actual es de ${med.stock}.`);
    return;
  }

  const stockAnterior = med.stock;
  const stockNuevo = stockAnterior - cant;
  const user = obtenerUsuarioActual();
  const fechaHora = new Date().toISOString().replace('T', ' ').substring(0, 19);

  try {
    // 1. Actualizar medicamento
    await dbRun(`
      UPDATE medicamentos 
      SET stock = ?, actualizado_en = CURRENT_TIMESTAMP 
      WHERE id = ?;
    `, [stockNuevo, medId]);

    // 2. Registrar en kardex
    await dbRun(`
      INSERT INTO movimientos_inventario 
      (medicamento_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, fecha)
      VALUES (?, 'SALIDA', ?, ?, ?, ?, ?, ?);
    `, [medId, cant, stockAnterior, stockNuevo, motivo, user ? user.id : 1, fechaHora]);

    cerrarModalSalida();
    cargarDatosInventario();
    poblarSelectsModales();
    alert(`Salida de inventario registrada. Stock restante de "${med.nombre}": ${stockNuevo} unidades.`);
  } catch (err) {
    console.error('Error registrando salida:', err);
    alert('Error al registrar salida: ' + err.message);
  }
}
