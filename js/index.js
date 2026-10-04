/**
 * index.js - Lógica del Dashboard / Panel Principal
 * Farmacia - Sistema Autónomo HTML + JS
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Proteger ruta
  verificarAutenticacion(false);

  // 2. Inicializar SQLite
  try {
    await inicializarBD('libs/sql-wasm.wasm');
    renderNavbar('index');
    cargarDatosDashboard();
    verificarTasaDelDia();
    inicializarConsultorRapido();
  } catch (err) {
    console.error('Error cargando SQLite en index:', err);
    alert('Error al inicializar la base de datos SQLite: ' + err.message);
  }
});

let consultorDebounce = null;

function inicializarConsultorRapido() {
  const input = document.getElementById('consultor_rapido_input');
  const dropdown = document.getElementById('consultor_resultados_dropdown');
  const btnLimpiar = document.getElementById('consultor_btn_limpiar');
  if (!input || !dropdown) return;

  const tasaDolar = parseFloat(dbObtenerConfig('tasa_dolar', '36.50')) || 36.50;

  input.addEventListener('input', function() {
    clearTimeout(consultorDebounce);
    const q = this.value.trim();

    if (q.length === 0) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      if (btnLimpiar) btnLimpiar.style.display = 'none';
      return;
    }

    if (btnLimpiar) btnLimpiar.style.display = 'flex';

    consultorDebounce = setTimeout(() => {
      const sql = `
        SELECT id, codigo_interno, nombre, laboratorio, tipo, cantidad_presentacion, precio_venta_usd, stock, stock_minimo 
        FROM medicamentos 
        WHERE (COALESCE(activo, 1) = 1) AND (nombre LIKE ? OR codigo_interno LIKE ? OR laboratorio LIKE ?)
        ORDER BY (stock > 0) DESC, nombre ASC 
        LIMIT 15;
      `;
      const param = `%${q}%`;
      const items = dbQuery(sql, [param, param, param]);

      if (!items || items.length === 0) {
        dropdown.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; color: #64748b; font-weight: 600;">
            ❌ No se encontraron medicamentos que coincidan con "<strong>${q}</strong>".
          </div>
        `;
        dropdown.style.display = 'block';
        return;
      }

      let html = '';
      items.forEach(m => {
        const precioBs = m.precio_venta_usd * tasaDolar;
        const sinStock = m.stock <= 0;
        let badgeStock = `<span class="stock-tag stock-ok">Stock: ${m.stock} disp.</span>`;
        if (sinStock) {
          badgeStock = `<span class="stock-tag stock-danger">Agotado (0 disp.)</span>`;
        } else if (m.stock <= m.stock_minimo) {
          badgeStock = `<span class="stock-tag stock-warning">⚠️ Stock bajo (${m.stock})</span>`;
        }

        html += `
          <div class="quick-result-item" onclick="location.href='ventas.html?buscar=${encodeURIComponent(m.codigo_interno)}'">
            <div class="quick-result-info">
              <div class="quick-result-title">
                <h4>${m.nombre}</h4>
                <span class="quick-result-code">${m.codigo_interno}</span>
                ${badgeStock}
              </div>
              <div class="quick-result-sub">
                ${m.laboratorio} &bull; ${m.tipo} (${m.cantidad_presentacion})
              </div>
            </div>
            <div class="quick-result-pricing">
              <div class="quick-price-bs">${formatearBs(precioBs)}</div>
              <div class="quick-price-usd">${formatearUsd(m.precio_venta_usd)}</div>
              <a href="ventas.html?buscar=${encodeURIComponent(m.codigo_interno)}" class="quick-btn-vender" onclick="event.stopPropagation()">
                <span>💳 Facturar</span>
              </a>
            </div>
          </div>
        `;
      });

      dropdown.innerHTML = html;
      dropdown.style.display = 'block';
    }, 180);
  });

  // Cerrar dropdown al hacer clic afuera
  document.addEventListener('click', (e) => {
    const container = document.querySelector('.quick-search-container');
    if (container && !container.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

function limpiarConsultorRapido() {
  const input = document.getElementById('consultor_rapido_input');
  const dropdown = document.getElementById('consultor_resultados_dropdown');
  const btnLimpiar = document.getElementById('consultor_btn_limpiar');
  if (input) {
    input.value = '';
    input.focus();
  }
  if (dropdown) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
  }
  if (btnLimpiar) btnLimpiar.style.display = 'none';
}

function cargarDatosDashboard() {
  const user = obtenerUsuarioActual();
  const nombreUser = user ? (user.nombre || user.usuario) : 'Usuario';
  document.getElementById('dash_bienvenida').textContent = `Bienvenido(a), ${nombreUser}`;

  // 1. Estadísticas de ventas de hoy
  const hoyStr = new Date().toISOString().split('T')[0];
  const qVentas = dbQueryOne(`
    SELECT COUNT(*) as cant, COALESCE(SUM(total_bs), 0) as total_bs, COALESCE(SUM(total_usd), 0) as total_usd 
    FROM ventas 
    WHERE strftime('%Y-%m-%d', fecha) = ?;
  `, [hoyStr]) || { cant: 0, total_bs: 0, total_usd: 0 };

  document.getElementById('kpi_ventas_bs').textContent = formatearBs(qVentas.total_bs);
  document.getElementById('kpi_ventas_sub').textContent = `${qVentas.cant} ventas (${formatearUsd(qVentas.total_usd)})`;

  // 2. Total medicamentos
  const qMeds = dbQueryOne("SELECT COUNT(*) as total FROM medicamentos WHERE COALESCE(activo, 1) = 1;") || { total: 0 };
  document.getElementById('kpi_total_meds').textContent = `${qMeds.total} registrados`;
  const badgeMeds = document.getElementById('badge_total_meds');
  if (badgeMeds) badgeMeds.textContent = `${qMeds.total} Fármacos`;

  // 3. Total clientes
  const qClientes = dbQueryOne("SELECT COUNT(*) as total FROM clientes;") || { total: 0 };
  document.getElementById('kpi_total_clientes').textContent = `${qClientes.total} clientes activos`;
  const badgeClientes = document.getElementById('badge_total_clientes');
  if (badgeClientes) badgeClientes.textContent = `${qClientes.total} Clientes`;

  // 4. Alertas de stock bajo
  const qAlertas = dbQueryOne("SELECT COUNT(*) as total FROM medicamentos WHERE COALESCE(activo, 1) = 1 AND stock <= stock_minimo;") || { total: 0 };
  const totalAlertas = qAlertas.total;
  const kpiAlertasVal = document.getElementById('kpi_stock_bajo');
  const kpiAlertasIcon = document.getElementById('kpi_alerta_icon');

  kpiAlertasVal.textContent = `${totalAlertas} por reponer`;
  if (totalAlertas > 0) {
    kpiAlertasVal.style.color = 'var(--danger)';
    kpiAlertasIcon.className = 'kpi-icon red';
  } else {
    kpiAlertasVal.style.color = 'var(--primary-hover)';
    kpiAlertasIcon.className = 'kpi-icon green';
  }

  // 5. Tasa Dólar y Margen
  const tasa = parseFloat(dbObtenerConfig('tasa_dolar', '36.50')) || 36.50;
  const margen = dbObtenerConfig('margen_ganancia', '30');
  document.getElementById('kpi_tasa_dolar').textContent = formatearBs(tasa);
  document.getElementById('kpi_margen_sub').textContent = `Margen: ${margen}%`;
}

function verificarTasaDelDia() {
  const hoyStr = new Date().toISOString().split('T')[0];
  const ultimaFecha = dbObtenerConfig('ultima_fecha_tasa', '');

  if (ultimaFecha !== hoyStr) {
    // Si la tasa no se ha confirmado hoy, abrir el modal de confirmación rápida
    setTimeout(() => {
      abrirModalTasaRapida();
    }, 400);
  }
}
