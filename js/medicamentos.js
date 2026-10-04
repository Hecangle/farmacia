/**
 * medicamentos.js - Administración de Catálogo de Medicamentos con SQLite
 * Farmacia - Sistema Autónomo HTML + JS
 */

let listaMedicamentos = [];
let tasaDolar = 36.50;

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacion(false);

  try {
    await inicializarBD('libs/sql-wasm.wasm');
    renderNavbar('medicamentos');
    tasaDolar = parseFloat(dbObtenerConfig('tasa_dolar', '36.50')) || 36.50;
    cargarMedicamentos();
  } catch (err) {
    console.error('Error inicializando medicamentos:', err);
    alert('Error al inicializar la base de datos: ' + err.message);
  }
});

let vistaPapelera = false;

function toggleVistaPapelera() {
  vistaPapelera = !vistaPapelera;
  const btn = document.getElementById('btn_toggle_papelera');
  const banner = document.getElementById('banner_papelera_aviso');
  const tituloCard = document.getElementById('titulo_lista_medicamentos');
  const btnNuevo = document.getElementById('btn_nuevo_medicamento');

  if (vistaPapelera) {
    if (btn) {
      btn.innerHTML = '← Volver al Catálogo';
      btn.className = 'btn btn-primary';
    }
    if (banner) banner.style.display = 'flex';
    if (tituloCard) tituloCard.textContent = 'Medicamentos en Papelera (Ocultos)';
    if (btnNuevo) btnNuevo.style.display = 'none';
  } else {
    if (btn) {
      btn.className = 'btn btn-outline';
      actualizarContadorPapelera();
    }
    if (banner) banner.style.display = 'none';
    if (tituloCard) tituloCard.textContent = 'Medicamentos Registrados';
    if (btnNuevo) btnNuevo.style.display = 'inline-flex';
  }
  cargarMedicamentos();
}

function actualizarContadorPapelera() {
  const btn = document.getElementById('btn_toggle_papelera');
  if (!btn || vistaPapelera) return;
  const q = dbQueryOne("SELECT COUNT(*) as total FROM medicamentos WHERE activo = 0;") || { total: 0 };
  btn.innerHTML = `🗑️ Papelera (${q.total})`;
}

function cargarMedicamentos() {
  actualizarContadorPapelera();
  if (vistaPapelera) {
    listaMedicamentos = dbQuery("SELECT * FROM medicamentos WHERE activo = 0 ORDER BY nombre ASC;");
  } else {
    listaMedicamentos = dbQuery("SELECT * FROM medicamentos WHERE COALESCE(activo, 1) = 1 ORDER BY nombre ASC;");
  }
  poblarFiltroTipos();
  filtrarMedicamentos();
}

function poblarFiltroTipos() {
  const sel = document.getElementById('med_filtro_tipo');
  if (!sel) return;
  const tiposSet = new Set();
  listaMedicamentos.forEach(m => {
    if (m.tipo) tiposSet.add(m.tipo);
  });

  let html = '<option value="">Todas las formas</option>';
  Array.from(tiposSet).sort().forEach(t => {
    html += `<option value="${t}">${t}</option>`;
  });
  sel.innerHTML = html;
}

function filtrarMedicamentos() {
  const buscar = (document.getElementById('med_filtro_buscar').value || '').trim().toLowerCase();
  const tipoFiltro = document.getElementById('med_filtro_tipo').value;
  const stockFiltro = document.getElementById('med_filtro_stock').value;

  const filtrados = listaMedicamentos.filter(m => {
    const coincideBuscar = !buscar || 
      m.nombre.toLowerCase().includes(buscar) ||
      m.codigo_interno.toLowerCase().includes(buscar) ||
      m.laboratorio.toLowerCase().includes(buscar);

    const coincideTipo = !tipoFiltro || m.tipo === tipoFiltro;

    let coincideStock = true;
    if (stockFiltro === 'disponible') coincideStock = m.stock > m.stock_minimo;
    else if (stockFiltro === 'bajo') coincideStock = m.stock <= m.stock_minimo && m.stock > 0;
    else if (stockFiltro === 'agotado') coincideStock = m.stock <= 0;

    return coincideBuscar && coincideTipo && coincideStock;
  });

  renderizarTablaMedicamentos(filtrados);
}

function limpiarFiltrosMedicamentos() {
  document.getElementById('med_filtro_buscar').value = '';
  document.getElementById('med_filtro_tipo').value = '';
  document.getElementById('med_filtro_stock').value = '';
  filtrarMedicamentos();
}

function renderizarTablaMedicamentos(items) {
  const tbody = document.getElementById('med_tabla_body');
  const contador = document.getElementById('med_total_contador');
  contador.textContent = String(items.length);

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem; color: #64748b; font-weight: 600;">
          No se encontraron medicamentos con los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  items.forEach(m => {
    const precioBs = m.precio_venta_usd * tasaDolar;
    const sinStock = m.stock <= 0;
    const bajoStock = m.stock <= m.stock_minimo && !sinStock;

    let badgeStock = `<span class="badge badge-success">${m.stock} unid.</span>`;
    if (sinStock) {
      badgeStock = `<span class="badge badge-danger">Agotado (0)</span>`;
    } else if (bajoStock) {
      badgeStock = `<span class="badge badge-warning">Bajo (${m.stock})</span>`;
    }

    html += `
      <tr>
        <td><code style="font-weight: 800; color: #047857; font-size: 0.95rem;">${m.codigo_interno}</code></td>
        <td>
          <strong style="color: #020617; font-size: 0.98rem;">${m.nombre}</strong>
        </td>
        <td><span style="color: #334155; font-weight: 600;">${m.laboratorio}</span></td>
        <td>
          <span style="font-size: 0.88rem; color: #1e293b;">${m.tipo}</span><br>
          <small style="color: #64748b;">${m.cantidad_presentacion}</small>
        </td>
        <td style="text-align: right; color: #475569; font-weight: 650;">${formatearUsd(m.precio_compra)}</td>
        <td style="text-align: right; color: #0f172a; font-weight: 750;">${formatearUsd(m.precio_venta_usd)}</td>
        <td style="text-align: right; color: #047857; font-weight: 850; font-size: 1.05rem;">${formatearBs(precioBs)}</td>
        <td style="text-align: center;">${badgeStock}</td>
        <td style="text-align: center;">
          ${vistaPapelera ? `
            <button type="button" class="btn btn-primary" onclick="restaurarMedicamento(${m.id})" style="padding: 0.25rem 0.75rem; font-size: 0.85rem; font-weight: 750;" title="Restaurar al catálogo activo">
              ♻️ Restaurar
            </button>
          ` : `
            <div style="display: inline-flex; gap: 0.4rem;">
              <button type="button" class="btn btn-outline" onclick="editarMedicamento(${m.id})" style="padding: 0.25rem 0.6rem; font-size: 0.85rem; font-weight: 750;" title="Editar fármaco">
                ✏️
              </button>
              <button type="button" class="btn btn-danger" onclick="eliminarMedicamento(${m.id})" style="padding: 0.25rem 0.6rem; font-size: 0.85rem; font-weight: 750;" title="Mover a papelera">
                🗑️
              </button>
            </div>
          `}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Modal Agregar / Editar
function abrirModalMedicamento(medId = null) {
  const modal = document.getElementById('modal_medicamento');
  const titulo = document.getElementById('modal_med_titulo');
  const boxOtro = document.getElementById('box_tipo_otro');
  boxOtro.style.display = 'none';

  if (medId) {
    const med = dbQueryOne("SELECT * FROM medicamentos WHERE id = ?;", [medId]);
    if (!med) return;
    titulo.textContent = '✏️ Editar Medicamento';
    document.getElementById('med_id').value = med.id;
    document.getElementById('med_codigo').value = med.codigo_interno;
    document.getElementById('med_nombre').value = med.nombre;
    document.getElementById('med_laboratorio').value = med.laboratorio;

    const selTipo = document.getElementById('med_tipo');
    let opcionExiste = false;
    for (let i = 0; i < selTipo.options.length; i++) {
      if (selTipo.options[i].value === med.tipo) {
        opcionExiste = true;
        break;
      }
    }

    if (opcionExiste) {
      selTipo.value = med.tipo;
    } else {
      selTipo.value = 'Otro';
      boxOtro.style.display = 'block';
      document.getElementById('med_tipo_otro').value = med.tipo;
    }

    document.getElementById('med_presentacion').value = med.cantidad_presentacion;
    document.getElementById('med_compra').value = med.precio_compra;

    let margen = 30;
    if (med.precio_compra > 0) {
      margen = Math.round(((med.precio_venta_usd - med.precio_compra) / med.precio_compra) * 100);
    }
    document.getElementById('med_margen').value = margen;
    document.getElementById('med_venta_usd').value = med.precio_venta_usd;
    document.getElementById('med_stock').value = med.stock;
    document.getElementById('med_stock_min').value = med.stock_minimo;
    recalcularDesdeVentaUsd();
  } else {
    titulo.textContent = '💊 Registrar Medicamento';
    document.getElementById('form_medicamento').reset();
    document.getElementById('med_id').value = '';
    document.getElementById('med_margen').value = dbObtenerConfig('margen_ganancia', '30');
    document.getElementById('med_stock_min').value = dbObtenerConfig('stock_minimo_global', '3');
    generarCodigoAutomatico();
    recalcularPreciosVentaModal();
  }

  modal.style.display = 'flex';
}

function cerrarModalMedicamento() {
  document.getElementById('modal_medicamento').style.display = 'none';
}

function manejarCambioTipo(valor) {
  const boxOtro = document.getElementById('box_tipo_otro');
  if (valor === 'Otro') {
    boxOtro.style.display = 'block';
    document.getElementById('med_tipo_otro').focus();
  } else {
    boxOtro.style.display = 'none';
  }
}

function generarCodigoAutomatico() {
  const q = dbQueryOne("SELECT COUNT(*) as total FROM medicamentos;");
  const count = q ? q.total + 1 : 1;
  document.getElementById('med_codigo').value = `MED-${String(count).padStart(4, '0')}`;
}

function recalcularPreciosVentaModal() {
  const compra = parseFloat(document.getElementById('med_compra').value) || 0;
  const margen = parseFloat(document.getElementById('med_margen').value) || 0;

  const ventaUsd = compra > 0 ? (compra * (1 + margen / 100)) : 0;
  document.getElementById('med_venta_usd').value = ventaUsd.toFixed(2);

  const ventaBs = ventaUsd * tasaDolar;
  document.getElementById('med_venta_bs_preview').textContent = formatearBs(ventaBs);
}

function recalcularDesdeVentaUsd() {
  const compra = parseFloat(document.getElementById('med_compra').value) || 0;
  const ventaUsd = parseFloat(document.getElementById('med_venta_usd').value) || 0;

  if (compra > 0 && ventaUsd >= compra) {
    const margen = Math.round(((ventaUsd - compra) / compra) * 100);
    document.getElementById('med_margen').value = margen;
  }

  const ventaBs = ventaUsd * tasaDolar;
  document.getElementById('med_venta_bs_preview').textContent = formatearBs(ventaBs);
}

async function guardarMedicamento(e) {
  e.preventDefault();
  const idVal = document.getElementById('med_id').value;
  const codigo = document.getElementById('med_codigo').value.trim();
  const nombre = document.getElementById('med_nombre').value.trim();
  const laboratorio = document.getElementById('med_laboratorio').value.trim();

  let tipo = document.getElementById('med_tipo').value;
  if (tipo === 'Otro') {
    const otroTxt = document.getElementById('med_tipo_otro').value.trim();
    if (!otroTxt) {
      alert('Por favor especifique la forma farmacéutica en el campo de texto.');
      return;
    }
    tipo = otroTxt;
  }

  const presentacion = document.getElementById('med_presentacion').value.trim();
  const compra = parseFloat(document.getElementById('med_compra').value) || 0;
  const ventaUsd = parseFloat(document.getElementById('med_venta_usd').value) || 0;
  const stock = parseInt(document.getElementById('med_stock').value) || 0;
  const stockMin = parseInt(document.getElementById('med_stock_min').value) || 3;

  if (!codigo || !nombre || !laboratorio || !tipo || !presentacion) {
    alert('Por favor complete todos los campos obligatorios marcados con (*).');
    return;
  }

  // Verificar código único
  if (!idVal) {
    const existe = dbQueryOne("SELECT id FROM medicamentos WHERE codigo_interno = ?;", [codigo]);
    if (existe) {
      alert(`El código interno "${codigo}" ya está registrado para otro medicamento.`);
      return;
    }
  } else {
    const existe = dbQueryOne("SELECT id FROM medicamentos WHERE codigo_interno = ? AND id != ?;", [codigo, parseInt(idVal)]);
    if (existe) {
      alert(`El código interno "${codigo}" ya está registrado para otro medicamento.`);
      return;
    }
  }

  try {
    if (idVal) {
      // Editar
      await dbRun(`
        UPDATE medicamentos SET 
          codigo_interno = ?, nombre = ?, laboratorio = ?, tipo = ?, cantidad_presentacion = ?,
          precio_compra = ?, precio_venta_usd = ?, stock = ?, stock_minimo = ?, actualizado_en = CURRENT_TIMESTAMP
        WHERE id = ?;
      `, [codigo, nombre, laboratorio, tipo, presentacion, compra, ventaUsd, stock, stockMin, parseInt(idVal)]);
    } else {
      // Insertar nuevo
      const nuevoId = await dbInsert(`
        INSERT INTO medicamentos 
        (codigo_interno, nombre, laboratorio, tipo, cantidad_presentacion, precio_compra, precio_venta_usd, stock, stock_minimo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [codigo, nombre, laboratorio, tipo, presentacion, compra, ventaUsd, stock, stockMin]);

      // Registrar movimiento de inventario inicial
      if (stock > 0) {
        const user = obtenerUsuarioActual();
        await dbRun(`
          INSERT INTO movimientos_inventario 
          (medicamento_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, precio_compra_usd, motivo, usuario_id)
          VALUES (?, 'ENTRADA', ?, 0, ?, ?, 'Inventario inicial de registro', ?);
        `, [nuevoId, stock, stock, compra, user ? user.id : 1]);
      }
    }

    cerrarModalMedicamento();
    cargarMedicamentos();
    alert('Medicamento guardado exitosamente.');
  } catch (err) {
    console.error('Error guardando medicamento:', err);
    alert('Error al guardar en la base de datos: ' + err.message);
  }
}

function editarMedicamento(id) {
  abrirModalMedicamento(id);
}

async function eliminarMedicamento(id) {
  const med = dbQueryOne("SELECT nombre FROM medicamentos WHERE id = ?;", [id]);
  if (!med) return;

  if (confirm(`¿Mover el medicamento "${med.nombre}" a la papelera?\n\n(No se perderá su historial de ventas ni reportes, y podrá restaurarlo cuando desee).`)) {
    try {
      await dbRun("UPDATE medicamentos SET activo = 0 WHERE id = ?;", [id]);
      cargarMedicamentos();
      alert(`"${med.nombre}" fue movido a la papelera.`);
    } catch (err) {
      console.error('Error enviando a papelera:', err);
      alert('Error al mover a papelera: ' + err.message);
    }
  }
}

async function restaurarMedicamento(id) {
  const med = dbQueryOne("SELECT nombre FROM medicamentos WHERE id = ?;", [id]);
  if (!med) return;

  if (confirm(`¿Desea restaurar el medicamento "${med.nombre}" al catálogo activo?`)) {
    try {
      await dbRun("UPDATE medicamentos SET activo = 1 WHERE id = ?;", [id]);
      cargarMedicamentos();
      alert(`"${med.nombre}" fue restaurado con éxito al catálogo activo.`);
    } catch (err) {
      console.error('Error restaurando medicamento:', err);
      alert('Error al restaurar: ' + err.message);
    }
  }
}
