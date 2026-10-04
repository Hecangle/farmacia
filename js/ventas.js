/**
 * ventas.js - Lógica del Punto de Venta (POS) con SQLite en JavaScript
 * Farmacia - Sistema Autónomo HTML + JS
 */

let carrito = [];
let tasaDolar = 36.50;
let totalBsGlobal = 0;
let totalUsdGlobal = 0;
let ultimaVentaGenerada = null;

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacion(false);

  try {
    await inicializarBD('libs/sql-wasm.wasm');
    renderNavbar('ventas');
    tasaDolar = parseFloat(dbObtenerConfig('tasa_dolar', '36.50')) || 36.50;
    document.getElementById('pos_tasa_txt').textContent = `Bs. ${tasaDolar.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} / $`;

    cargarClienteGenerico();
    cambiarMetodoPago();
    renderizarCarrito();

    // Event listeners para cédula de identidad
    const inputCedula = document.getElementById('pos_cedula');
    if (inputCedula) {
      inputCedula.addEventListener('focus', function() {
        if (this.value.trim() === '0') {
          this.value = '';
        } else {
          this.select();
        }
      });

      inputCedula.addEventListener('click', function() {
        if (this.value.trim() === '0') {
          this.value = '';
        }
      });

      inputCedula.addEventListener('blur', function() {
        if (this.value.trim() === '') {
          cargarClienteGenerico();
        }
      });

      inputCedula.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(debounceCedula);
          buscarClientePorCedula();
        }
      });
    }

    // Event listener para cerrar dropdown de búsqueda al hacer clic fuera
    document.addEventListener('click', (e) => {
      const searchBox = document.querySelector('.pos-search-box');
      if (searchBox && !searchBox.contains(e.target)) {
        ocultarResultadosBusqueda();
      }
    });

    // Auto-búsqueda si viene con parámetro ?buscar=... desde el index
    const urlParams = new URLSearchParams(window.location.search);
    const medBuscar = urlParams.get('buscar');
    if (medBuscar) {
      const inp = document.getElementById('pos_buscar_med');
      if (inp) {
        inp.value = medBuscar;
        buscarMedicamentosPos(medBuscar);
      }
    }
  } catch (err) {
    console.error('Error inicializando ventas:', err);
    alert('Error al inicializar la base de datos: ' + err.message);
  }
});

let debounceCedula = null;

function onInputCedula(val) {
  clearTimeout(debounceCedula);
  const cedula = val.trim();
  if (cedula === '') {
    mostrarNoRegistrado('');
    return;
  }
  // Si escribe pocos caracteres y no es 0, esperar a que complete o pulse Buscar
  if (cedula.length < 4 && cedula !== '0') {
    mostrarNoRegistrado(cedula);
    return;
  }
  debounceCedula = setTimeout(() => {
    ejecutarBusquedaCliente(cedula);
  }, 300);
}

function buscarClientePorCedula() {
  clearTimeout(debounceCedula);
  const inputCedula = document.getElementById('pos_cedula');
  const cedula = inputCedula ? inputCedula.value.trim() : '';
  if (cedula === '') {
    cargarClienteGenerico();
  } else {
    ejecutarBusquedaCliente(cedula);
  }
}

function ejecutarBusquedaCliente(cedula) {
  if (!cedula || cedula.trim() === '') {
    mostrarNoRegistrado('');
    return;
  }

  const raw = cedula.trim().toLowerCase();
  const clean = raw.replace(/[^0-9a-z]/g, '');
  const withoutV = raw.replace(/^[vvejp]-?/, '');
  const withV = 'v-' + withoutV;

  // Búsqueda por COINCIDENCIA EXACTA (no usar LIKE parcial para evitar coincidencias erróneas)
  const sql = `
    SELECT * FROM clientes 
    WHERE LOWER(cedula) = ? 
       OR LOWER(cedula) = ? 
       OR LOWER(cedula) = ?
       OR LOWER(REPLACE(REPLACE(cedula, '-', ''), ' ', '')) = ?
    LIMIT 1;
  `;
  const c = dbQueryOne(sql, [raw, withV, withoutV, clean]);

  if (c) {
    const comprasRow = dbQueryOne("SELECT COUNT(*) as total FROM ventas WHERE cliente_id = ?;", [c.id]);
    c.total_compras = comprasRow ? comprasRow.total : 0;
    seleccionarCliente(c, false);
  } else {
    mostrarNoRegistrado(cedula);
  }
}

function seleccionarCliente(c, actualizarInput = false) {
  if (actualizarInput) {
    const inputCedula = document.getElementById('pos_cedula');
    if (inputCedula) inputCedula.value = c.cedula;
  }

  const hiddenId = document.getElementById('pos_cliente_id');
  if (hiddenId) hiddenId.value = c.id;

  const nombreComp = document.getElementById('cliente_nombre_completo');
  if (nombreComp) nombreComp.textContent = `${c.nombres} ${c.apellidos}`;

  const cedVal = document.getElementById('cliente_cedula_val');
  if (cedVal) cedVal.textContent = c.cedula;

  const telVal = document.getElementById('cliente_tel_val');
  if (telVal) telVal.textContent = c.telefono || 'Sin teléfono';

  const badgeCompras = document.getElementById('cliente_compras_badge');
  const totalCompras = parseInt(c.total_compras || 0);

  if (badgeCompras) {
    const esGenerico = (c.cedula === '0' || (c.nombres === 'Cliente' && c.apellidos === 'Genérico'));
    if (esGenerico) {
      badgeCompras.textContent = '🛍️ Cliente Mostrador (Venta rápida / Genérico)';
      badgeCompras.style.background = '#e0f2fe';
      badgeCompras.style.color = '#0369a1';
    } else if (totalCompras === 0) {
      badgeCompras.textContent = '🛍️ Nuevo paciente (0 compras anteriores)';
      badgeCompras.style.background = '#f1f5f9';
      badgeCompras.style.color = '#475569';
    } else {
      badgeCompras.textContent = `🛍️ Historial: Ha realizado ${totalCompras} ${totalCompras === 1 ? 'compra' : 'compras'} en la farmacia`;
      badgeCompras.style.background = '#e0f2fe';
      badgeCompras.style.color = '#0369a1';
    }
  }

  const boxNoEnc = document.getElementById('cliente_no_encontrado_box');
  if (boxNoEnc) boxNoEnc.style.display = 'none';

  const boxEnc = document.getElementById('cliente_encontrado_box');
  if (boxEnc) boxEnc.style.display = 'block';
}

function mostrarNoRegistrado(cedula) {
  const hiddenId = document.getElementById('pos_cliente_id');
  if (hiddenId) hiddenId.value = '';

  const boxEnc = document.getElementById('cliente_encontrado_box');
  if (boxEnc) boxEnc.style.display = 'none';

  const boxNoEnc = document.getElementById('cliente_no_encontrado_box');
  const titulo = document.getElementById('no_encontrado_titulo_html');
  const desc = document.getElementById('no_encontrado_desc_html');

  if (!cedula || cedula.trim() === '') {
    if (titulo) titulo.innerHTML = '⚠️ <strong>No registrado</strong>';
    if (desc) desc.textContent = 'Ingrese la cédula del cliente o pulse Registrar para agregarlo.';
  } else {
    const safeCedula = cedula.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (titulo) titulo.innerHTML = `⚠️ <strong>No registrado</strong> (<code>${safeCedula}</code>)`;
    if (desc) desc.textContent = 'No coincide con ningún cliente registrado. Pulse Registrar para darlo de alta.';
  }
  if (boxNoEnc) boxNoEnc.style.display = 'flex';
}

function quitarClienteSeleccionado() {
  const inputCedula = document.getElementById('pos_cedula');
  if (inputCedula) {
    inputCedula.value = '';
    inputCedula.focus();
  }
  cargarClienteGenerico();
}

function abrirRegistroConCedula() {
  const inputCedula = document.getElementById('pos_cedula');
  const cedula = inputCedula ? inputCedula.value.trim() : '';
  const cliCed = document.getElementById('cli_cedula');
  if (cliCed) cliCed.value = cedula;
  const boxNoEnc = document.getElementById('cliente_no_encontrado_box');
  if (boxNoEnc) boxNoEnc.style.display = 'none';
  abrirModalNuevoCliente();
}

function cargarClienteGenerico() {
  let c = dbQueryOne("SELECT * FROM clientes WHERE cedula = '0' OR (nombres = 'Cliente' AND apellidos = 'Genérico') LIMIT 1;");
  if (!c) {
    c = dbQueryOne("SELECT * FROM clientes ORDER BY id ASC LIMIT 1;");
  }
  if (c) {
    const comprasRow = dbQueryOne("SELECT COUNT(*) as total FROM ventas WHERE cliente_id = ?;", [c.id]);
    c.total_compras = comprasRow ? comprasRow.total : 0;
    seleccionarCliente(c, true);
  } else {
    mostrarNoRegistrado('');
  }
}

// Búsqueda en vivo de medicamentos
function buscarMedicamentosPos(query) {
  const q = query.trim();
  const dropdown = document.getElementById('pos_dropdown_resultados');

  if (q.length < 1) {
    ocultarResultadosBusqueda();
    return;
  }

  const sql = `
    SELECT id, codigo_interno, nombre, laboratorio, tipo, cantidad_presentacion, precio_venta_usd, stock, stock_minimo 
    FROM medicamentos 
    WHERE (COALESCE(activo, 1) = 1) AND (nombre LIKE ? OR codigo_interno LIKE ? OR laboratorio LIKE ?)
    ORDER BY (stock > 0) DESC, nombre ASC 
    LIMIT 12;
  `;
  const param = `%${q}%`;
  const resultados = dbQuery(sql, [param, param, param]);

  if (resultados.length === 0) {
    dropdown.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: #64748b; font-weight: 600;">
        ❌ No se encontraron medicamentos con "${q}".
      </div>
    `;
    dropdown.style.display = 'block';
    return;
  }

  let html = '';
  resultados.forEach(m => {
    const precioBs = m.precio_venta_usd * tasaDolar;
    const sinStock = m.stock <= 0;
    const bajoStock = m.stock <= m.stock_minimo && !sinStock;

    let badgeStock = `<span class="badge badge-success" style="font-size: 0.82rem;">Stock: ${m.stock}</span>`;
    if (sinStock) {
      badgeStock = `<span class="badge badge-danger" style="font-size: 0.82rem;">Agotado (0)</span>`;
    } else if (bajoStock) {
      badgeStock = `<span class="badge badge-warning" style="font-size: 0.82rem;">Bajo Stock: ${m.stock}</span>`;
    }

    html += `
      <div class="search-result-item" onclick="seleccionarMedicamentoPos(${m.id})" style="${sinStock ? 'opacity: 0.55; cursor: not-allowed;' : ''}">
        <div>
          <strong style="color: #020617; font-size: 1rem;">${m.nombre}</strong>
          <div style="font-size: 0.84rem; color: #475569; margin-top: 0.15rem;">
            Cod: <code style="font-weight: 700; color: #047857;">${m.codigo_interno}</code> | ${m.laboratorio} (${m.tipo} - ${m.cantidad_presentacion})
          </div>
        </div>
        <div style="text-align: right; margin-left: 1rem;">
          <div style="font-size: 1.05rem; font-weight: 850; color: #047857;">
            ${formatearBs(precioBs)}
          </div>
          <div style="font-size: 0.85rem; color: #334155; font-weight: 600;">
            ${formatearUsd(m.precio_venta_usd)}
          </div>
          <div style="margin-top: 0.2rem;">${badgeStock}</div>
        </div>
      </div>
    `;
  });

  dropdown.innerHTML = html;
  dropdown.style.display = 'block';
}

function ocultarResultadosBusqueda() {
  const dropdown = document.getElementById('pos_dropdown_resultados');
  if (dropdown) dropdown.style.display = 'none';
}

function seleccionarMedicamentoPos(medId) {
  const med = dbQueryOne("SELECT * FROM medicamentos WHERE id = ?;", [medId]);
  if (!med) return;

  if (med.stock <= 0) {
    alert(`El medicamento "${med.nombre}" está agotado (Stock: 0).`);
    return;
  }

  // Verificar si ya está en el carrito
  const idx = carrito.findIndex(item => item.id === med.id);
  if (idx >= 0) {
    if (carrito[idx].cantidad + 1 > med.stock) {
      alert(`No puede agregar más unidades de "${med.nombre}". Stock máximo disponible: ${med.stock}.`);
      return;
    }
    carrito[idx].cantidad += 1;
  } else {
    carrito.push({
      id: med.id,
      codigo: med.codigo_interno,
      nombre: med.nombre,
      lab: med.laboratorio,
      tipo: med.tipo,
      precio_usd: med.precio_venta_usd,
      precio_bs: med.precio_venta_usd * tasaDolar,
      stock_actual: med.stock,
      cantidad: 1
    });
  }

  // Limpiar campo de búsqueda
  const inpSearch = document.getElementById('pos_buscar_med');
  if (inpSearch) inpSearch.value = '';
  ocultarResultadosBusqueda();

  renderizarCarrito();
}

function renderizarCarrito() {
  const tbody = document.getElementById('pos_carrito_body');
  const cantItemsElem = document.getElementById('pos_cant_items');
  const btnProcesar = document.getElementById('btn_procesar_venta');

  if (carrito.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: #64748b; font-weight: 600;">
          🛒 El carrito está vacío. Busque y seleccione medicamentos arriba para agregarlos a la venta.
        </td>
      </tr>
    `;
    cantItemsElem.textContent = '0';
    totalBsGlobal = 0;
    totalUsdGlobal = 0;
    actualizarTotalesCard();
    btnProcesar.disabled = true;
    return;
  }

  btnProcesar.disabled = false;
  let totalBs = 0;
  let totalUsd = 0;
  let totalCant = 0;
  let html = '';

  carrito.forEach((item, index) => {
    const subtotalBs = item.precio_bs * item.cantidad;
    const subtotalUsd = item.precio_usd * item.cantidad;
    totalBs += subtotalBs;
    totalUsd += subtotalUsd;
    totalCant += item.cantidad;

    html += `
      <tr>
        <td><code style="font-weight: 800; color: #047857; font-size: 0.95rem;">${item.codigo}</code></td>
        <td>
          <strong style="color: #020617; font-size: 0.98rem;">${item.nombre}</strong><br>
          <small style="color: #475569;">${item.lab} (${item.tipo}) - Disp: ${item.stock_actual}</small>
        </td>
        <td style="text-align: right; font-weight: 650; color: #334155;">${formatearUsd(item.precio_usd)}</td>
        <td style="text-align: right; font-weight: 750; color: #0f172a;">${formatearBs(item.precio_bs)}</td>
        <td style="text-align: center;">
          <div style="display: inline-flex; align-items: center; border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: white;">
            <button type="button" onclick="modificarCantidad(${index}, -1)" style="border: none; background: #f1f5f9; padding: 0.25rem 0.6rem; cursor: pointer; font-weight: 800; font-size: 1rem;">-</button>
            <input type="number" min="1" max="${item.stock_actual}" value="${item.cantidad}" onchange="cambiarCantidadDirecta(${index}, this.value)" style="width: 50px; text-align: center; border: none; font-weight: 800; font-size: 1rem; color: #020617;">
            <button type="button" onclick="modificarCantidad(${index}, 1)" style="border: none; background: #f1f5f9; padding: 0.25rem 0.6rem; cursor: pointer; font-weight: 800; font-size: 1rem;">+</button>
          </div>
        </td>
        <td style="text-align: right; font-weight: 850; font-size: 1.05rem; color: #047857;">${formatearBs(subtotalBs)}</td>
        <td style="text-align: center;">
          <button type="button" onclick="eliminarDelCarrito(${index})" style="background: none; border: none; color: #ef4444; font-size: 1.25rem; cursor: pointer;" title="Quitar ítem">
            ✕
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  cantItemsElem.textContent = String(totalCant);
  totalBsGlobal = totalBs;
  totalUsdGlobal = totalUsd;
  actualizarTotalesCard();
  actualizarDetallesMetodoPago();
}

function modificarCantidad(index, delta) {
  const item = carrito[index];
  if (!item) return;

  const nuevaCant = item.cantidad + delta;
  if (nuevaCant <= 0) {
    eliminarDelCarrito(index);
    return;
  }
  if (nuevaCant > item.stock_actual) {
    alert(`No hay suficiente inventario disponible. Stock máximo: ${item.stock_actual}.`);
    return;
  }
  item.cantidad = nuevaCant;
  renderizarCarrito();
}

function cambiarCantidadDirecta(index, valor) {
  const item = carrito[index];
  if (!item) return;

  let val = parseInt(valor) || 1;
  if (val <= 0) val = 1;
  if (val > item.stock_actual) {
    alert(`Stock máximo disponible: ${item.stock_actual}.`);
    val = item.stock_actual;
  }
  item.cantidad = val;
  renderizarCarrito();
}

function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
  renderizarCarrito();
}

function limpiarCarrito() {
  if (carrito.length === 0) return;
  if (confirm('¿Está seguro de que desea vaciar todos los ítems del carrito?')) {
    carrito = [];
    renderizarCarrito();
  }
}

function actualizarTotalesCard() {
  document.getElementById('pos_total_bs_txt').textContent = formatearBs(totalBsGlobal);
  document.getElementById('pos_total_usd_txt').textContent = formatearUsd(totalUsdGlobal);
}

// Métodos de Pago
function cambiarMetodoPago() {
  const metodo = document.getElementById('pos_metodo_pago').value;
  const cont = document.getElementById('pos_detalles_pago');
  if (!cont) return;

  if (metodo === 'Punto de Venta') {
    cont.innerHTML = `
      <div style="background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: var(--radius-md); padding: 0.85rem 1rem; font-size: 0.95rem; color: #1e293b; display: flex; align-items: center; gap: 0.6rem;">
        <span style="font-size: 1.3rem;">💳</span>
        <span><strong>Punto de Venta:</strong> Pago procesado con tarjeta por terminal bancario.</span>
      </div>
    `;
  } else if (metodo === 'Efectivo Bs') {
    cont.innerHTML = `
      <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
        <label class="form-label" for="pos_pago_bs_recibido" style="font-size: 0.95rem; margin-bottom: 0.35rem; color: #064e3b; font-weight: 750;">
          💵 Monto Recibido en Efectivo (Bs.):
        </label>
        <div style="position: relative;">
          <input type="number" step="0.01" min="0" id="pos_pago_bs_recibido" class="form-control" placeholder="Ej: 500.00" oninput="calcularVueltoBs()" style="padding-left: 2.75rem; font-size: 1.15rem; font-weight: 750;">
          <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); font-weight: 800; color: #047857; font-size: 1rem;">Bs.</span>
        </div>
        <div id="pos_bs_vuelto_box" style="margin-top: 0.6rem;"></div>
      </div>
    `;
    setTimeout(() => {
      const inp = document.getElementById('pos_pago_bs_recibido');
      if (inp) inp.focus();
    }, 100);
  } else if (metodo === 'Dólares Efectivo') {
    cont.innerHTML = `
      <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
        <label class="form-label" for="pos_pago_usd_recibido" style="font-size: 0.95rem; margin-bottom: 0.35rem; color: #064e3b; font-weight: 750;">
          💵 Cantidad en Dólares Recibida ($ USD):
        </label>
        <div style="position: relative;">
          <input type="number" step="0.01" min="0" id="pos_pago_usd_recibido" class="form-control" placeholder="Ej: 20.00" oninput="calcularVueltoUsd()" style="padding-left: 2.5rem; font-size: 1.15rem; font-weight: 750;">
          <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); font-weight: 800; color: #047857; font-size: 1.05rem;">$</span>
        </div>

        <div style="margin-top: 0.75rem; background: #ffffff; border: 1.5px solid #bbf7d0; border-radius: 8px; padding: 0.65rem 0.85rem;">
          <div style="display: flex; align-items: center; gap: 0.55rem; user-select: none;">
            <input type="checkbox" id="pos_dolar_es_multiple" onchange="toggleVariosBilletesDolar(this.checked)" style="width: 1.2rem; height: 1.2rem; accent-color: #059669; cursor: pointer;">
            <label for="pos_dolar_es_multiple" style="font-weight: 750; color: #064e3b; font-size: 0.95rem; cursor: pointer; margin-bottom: 0;">
              ¿Son varios billetes?
            </label>
          </div>
          <div style="margin-top: 0.55rem;">
            <label class="form-label" id="pos_dolar_serial_lbl" for="pos_dolar_serial" style="font-size: 0.88rem; margin-bottom: 0.25rem; color: #064e3b; font-weight: 700;">
              Serial del billete (Opcional):
            </label>
            <input type="text" id="pos_dolar_serial" class="form-control" placeholder="Ej: MB12345678A" style="font-size: 0.95rem; font-weight: 600;">
          </div>
        </div>

        <div id="pos_usd_conversion_box" style="margin-top: 0.6rem;"></div>
      </div>
    `;
    setTimeout(() => {
      const inp = document.getElementById('pos_pago_usd_recibido');
      if (inp) inp.focus();
    }, 100);
  } else if (metodo === 'Pago Móvil') {
    cont.innerHTML = `
      <div style="background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
        <div style="font-weight: 800; font-size: 0.95rem; color: #1e3a8a; margin-bottom: 0.65rem;">
          📱 Datos del Pago Móvil:
        </div>
        <div class="form-row" style="margin-bottom: 0.65rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="pos_pm_referencia" style="font-size: 0.88rem; margin-bottom: 0.25rem;">N° Referencia (*):</label>
            <input type="text" id="pos_pm_referencia" class="form-control" placeholder="Ej: 648291" style="font-size: 0.95rem; font-weight: 700;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="pos_pm_banco" style="font-size: 0.88rem; margin-bottom: 0.25rem;">Banco de donde lo hizo (*):</label>
            <input type="text" list="lista_bancos_ve" id="pos_pm_banco" class="form-control" placeholder="Ej: Banesco, BDV, Mercantil..." style="font-size: 0.95rem; font-weight: 600;">
            <datalist id="lista_bancos_ve">
              <option value="Banesco">
              <option value="Banco de Venezuela (BDV)">
              <option value="Mercantil">
              <option value="BBVA Provincial">
              <option value="Bancaribe">
              <option value="BNC (Banco Nacional de Crédito)">
              <option value="Bancamiga">
              <option value="Banco Bicentenario">
              <option value="Banco Exterior">
              <option value="Banco Plaza">
              <option value="Banco Fondo Común (BFC)">
              <option value="100% Banco">
              <option value="Banco Sofitasa">
              <option value="Bancrecer">
            </datalist>
          </div>
        </div>
        <div class="form-row" style="margin-top: 0.65rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="pos_pm_telefono" style="font-size: 0.88rem; margin-bottom: 0.25rem;">Teléfono de donde lo hizo (*):</label>
            <input type="text" id="pos_pm_telefono" class="form-control" placeholder="Ej: 0414-1234567" style="font-size: 0.95rem; font-weight: 600;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="pos_pm_monto" style="font-size: 0.88rem; margin-bottom: 0.25rem;">Monto Pagado en Bs (*):</label>
            <input type="number" step="0.01" min="0" id="pos_pm_monto" class="form-control" placeholder="0.00" value="${totalBsGlobal > 0 ? totalBsGlobal.toFixed(2) : ''}" style="font-size: 0.95rem; font-weight: 750;">
          </div>
        </div>
      </div>
    `;
    setTimeout(() => {
      const inp = document.getElementById('pos_pm_referencia');
      if (inp) inp.focus();
    }, 100);
  }
}

function toggleVariosBilletesDolar(esMultiple) {
  const lbl = document.getElementById('pos_dolar_serial_lbl');
  const inp = document.getElementById('pos_dolar_serial');
  if (!lbl || !inp) return;

  if (esMultiple) {
    lbl.textContent = 'Seriales de los billetes (Opcional):';
    inp.placeholder = 'Ej: MB12345678A, LF87654321B...';
  } else {
    lbl.textContent = 'Serial del billete (Opcional):';
    inp.placeholder = 'Ej: MB12345678A';
  }
}

function calcularVueltoBs() {
  const box = document.getElementById('pos_bs_vuelto_box');
  if (!box) return;
  const inputElem = document.getElementById('pos_pago_bs_recibido');
  const inputBs = inputElem ? parseFloat(inputElem.value) || 0 : 0;

  if (inputBs <= 0) {
    box.innerHTML = '';
    return;
  }

  const diff = inputBs - totalBsGlobal;
  if (diff > 0.009) {
    box.innerHTML = `
      <div style="background: #d1fae5; border: 1.5px solid #10b981; border-radius: 8px; padding: 0.5rem 0.75rem; color: #064e3b; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 750;">🔄 Vuelto a Entregar:</span>
        <strong style="font-size: 1.25rem; color: #047857;">Bs. ${diff.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
      </div>
    `;
  } else if (Math.abs(diff) <= 0.009) {
    box.innerHTML = `
      <div style="background: #e0f2fe; border: 1.5px solid #0284c7; border-radius: 8px; padding: 0.45rem 0.75rem; color: #0369a1; font-weight: 750; text-align: center;">
        ✓ Pago exacto en Bolívares.
      </div>
    `;
  } else {
    box.innerHTML = `
      <div style="background: #fee2e2; border: 1.5px solid #ef4444; border-radius: 8px; padding: 0.45rem 0.75rem; color: #991b1b; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 750;">⚠️ Monto Incompleto:</span>
        <strong style="color: #b91c1c;">Faltan: Bs. ${Math.abs(diff).toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
      </div>
    `;
  }
}

function calcularVueltoUsd() {
  const box = document.getElementById('pos_usd_conversion_box');
  if (!box) return;
  const inputElem = document.getElementById('pos_pago_usd_recibido');
  const inputUsd = inputElem ? parseFloat(inputElem.value) || 0 : 0;

  if (inputUsd <= 0) {
    box.innerHTML = '';
    return;
  }

  const equivBs = inputUsd * tasaDolar;
  const diffBs = equivBs - totalBsGlobal;
  const diffUsd = diffBs / tasaDolar;

  let htmlConversion = `
    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 0.5rem 0.75rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-weight: 650; color: #334155; font-size: 0.9rem;">Equivalente recibido:</span>
      <strong style="font-size: 1.1rem; color: #0f172a;">Bs. ${equivBs.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
    </div>
  `;

  if (diffBs > 0.009) {
    box.innerHTML = htmlConversion + `
      <div style="background: #d1fae5; border: 1.5px solid #10b981; border-radius: 8px; padding: 0.5rem 0.75rem; color: #064e3b;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 750;">🔄 Vuelto en Bolívares:</span>
          <strong style="font-size: 1.25rem; color: #047857;">Bs. ${diffBs.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
        </div>
        <div style="font-size: 0.88rem; color: #065f46; text-align: right; margin-top: 0.25rem; font-weight: 700;">
          (O en divisas: $ ${diffUsd.toFixed(2)})
        </div>
      </div>
    `;
  } else if (Math.abs(diffBs) <= 0.009) {
    box.innerHTML = htmlConversion + `
      <div style="background: #e0f2fe; border: 1.5px solid #0284c7; border-radius: 8px; padding: 0.45rem 0.75rem; color: #0369a1; font-weight: 750; text-align: center;">
        ✓ Pago exacto en Dólares.
      </div>
    `;
  } else {
    box.innerHTML = htmlConversion + `
      <div style="background: #fee2e2; border: 1.5px solid #ef4444; border-radius: 8px; padding: 0.45rem 0.75rem; color: #991b1b; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 750;">⚠️ Monto Incompleto:</span>
        <strong style="color: #b91c1c;">Faltan: Bs. ${Math.abs(diffBs).toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ($ ${Math.abs(diffUsd).toFixed(2)})</strong>
      </div>
    `;
  }
}

function actualizarDetallesMetodoPago() {
  const metodo = document.getElementById('pos_metodo_pago') ? document.getElementById('pos_metodo_pago').value : 'Punto de Venta';
  if (metodo === 'Efectivo Bs') {
    calcularVueltoBs();
  } else if (metodo === 'Dólares Efectivo') {
    calcularVueltoUsd();
  } else if (metodo === 'Pago Móvil') {
    const inpMontoPm = document.getElementById('pos_pm_monto');
    if (inpMontoPm) {
      inpMontoPm.value = totalBsGlobal > 0 ? totalBsGlobal.toFixed(2) : '';
    }
  }
}

// Procesar Venta en SQLite
async function procesarVentaPos() {
  if (carrito.length === 0) {
    alert('El carrito está vacío. Agregue medicamentos antes de procesar.');
    return;
  }

  // 1. Validar existencias actuales en SQLite
  for (const item of carrito) {
    const row = dbQueryOne("SELECT stock, nombre FROM medicamentos WHERE id = ?;", [item.id]);
    if (!row) {
      alert(`El medicamento "${item.nombre}" ya no existe en el catálogo.`);
      return;
    }
    if (row.stock < item.cantidad) {
      alert(`Inventario insuficiente para "${row.nombre}". Stock disponible: ${row.stock}, solicitado: ${item.cantidad}.`);
      return;
    }
  }

  const clienteIdVal = document.getElementById('pos_cliente_id').value;
  const clienteId = clienteIdVal ? parseInt(clienteIdVal) : null;
  const metodoPago = document.getElementById('pos_metodo_pago').value;
  const user = obtenerUsuarioActual();
  const usuarioId = user ? user.id : 1;

  let notasDetalle = '';
  let textoVueltoModal = '';

  if (metodoPago === 'Efectivo Bs') {
    const inpBs = document.getElementById('pos_pago_bs_recibido');
    const recibido = inpBs ? parseFloat(inpBs.value) || 0 : 0;
    if (recibido > 0) {
      const vuelto = Math.max(0, recibido - totalBsGlobal);
      notasDetalle = `Efectivo Bs: Pagó con Bs. ${recibido.toLocaleString('es-VE', {minimumFractionDigits: 2})} | Vuelto: Bs. ${vuelto.toLocaleString('es-VE', {minimumFractionDigits: 2})}`;
      if (vuelto > 0) {
        textoVueltoModal = `🔄 Vuelto a entregar al cliente: Bs. ${vuelto.toLocaleString('es-VE', {minimumFractionDigits: 2})}`;
      }
    }
  } else if (metodoPago === 'Dólares Efectivo') {
    const inpUsd = document.getElementById('pos_pago_usd_recibido');
    const recibidoUsd = inpUsd ? parseFloat(inpUsd.value) || 0 : 0;
    const esMultiple = document.getElementById('pos_dolar_es_multiple') ? document.getElementById('pos_dolar_es_multiple').checked : false;
    const serialDolar = document.getElementById('pos_dolar_serial') ? document.getElementById('pos_dolar_serial').value.trim() : '';

    let infoBilletes = esMultiple ? ' (Varios billetes)' : '';
    let infoSerial = serialDolar ? ` | Serial${esMultiple ? 'es' : ''}: ${serialDolar}` : '';

    if (recibidoUsd > 0) {
      const equivBs = recibidoUsd * tasaDolar;
      const vueltoBs = Math.max(0, equivBs - totalBsGlobal);
      const vueltoUsd = vueltoBs / tasaDolar;
      notasDetalle = `Dólares $: Pagó con $ ${recibidoUsd.toFixed(2)}${infoBilletes}${infoSerial} (equiv. Bs. ${equivBs.toLocaleString('es-VE', {minimumFractionDigits: 2})}) | Vuelto: Bs. ${vueltoBs.toLocaleString('es-VE', {minimumFractionDigits: 2})} ($ ${vueltoUsd.toFixed(2)})`;
      if (vueltoBs > 0) {
        textoVueltoModal = `🔄 Vuelto a entregar al cliente: Bs. ${vueltoBs.toLocaleString('es-VE', {minimumFractionDigits: 2})} (o $ ${vueltoUsd.toFixed(2)})`;
      }
    } else {
      if (serialDolar || esMultiple) {
        notasDetalle = `Dólares $${infoBilletes}${infoSerial}`;
      }
    }
  } else if (metodoPago === 'Pago Móvil') {
    const ref = document.getElementById('pos_pm_referencia') ? document.getElementById('pos_pm_referencia').value.trim() : '';
    const banco = document.getElementById('pos_pm_banco') ? document.getElementById('pos_pm_banco').value.trim() : '';
    const telf = document.getElementById('pos_pm_telefono') ? document.getElementById('pos_pm_telefono').value.trim() : '';
    const monto = document.getElementById('pos_pm_monto') ? parseFloat(document.getElementById('pos_pm_monto').value) || 0 : 0;

    if (!ref || !banco || !telf) {
      alert('Por favor complete los datos obligatorios del Pago Móvil: Referencia, Banco y Teléfono.');
      return;
    }
    notasDetalle = `Pago Móvil: Ref [${ref}] | Banco: ${banco} | Telf: ${telf} | Monto: Bs. ${monto.toLocaleString('es-VE', {minimumFractionDigits: 2})}`;
  }

  const btnProcesar = document.getElementById('btn_procesar_venta');
  btnProcesar.disabled = true;
  btnProcesar.innerHTML = 'Procesando venta...';

  try {
    // Generar código de factura correlativo
    const anioActual = new Date().getFullYear();
    const countVentas = (dbQueryOne("SELECT COUNT(*) as total FROM ventas;") || { total: 0 }).total;
    const codigoVenta = `FAC-${anioActual}-${String(countVentas + 1).padStart(4, '0')}`;
    const fechaHora = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 1. Insertar Venta
    const ventaId = await dbInsert(`
      INSERT INTO ventas (codigo_venta, cliente_id, usuario_id, fecha, total_bs, total_usd, tasa_dolar, metodo_pago, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [codigoVenta, clienteId, usuarioId, fechaHora, totalBsGlobal, totalUsdGlobal, tasaDolar, metodoPago, notasDetalle]);

    // 2. Insertar Detalle y Actualizar Inventario (Kardex y Stock)
    for (const item of carrito) {
      const subBs = item.precio_bs * item.cantidad;
      const subUsd = item.precio_usd * item.cantidad;

      // Detalle de venta
      await dbRun(`
        INSERT INTO detalle_ventas 
        (venta_id, medicamento_id, codigo_interno, nombre_medicamento, cantidad, precio_unitario_bs, precio_unitario_usd, subtotal_bs, subtotal_usd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [ventaId, item.id, item.codigo, item.nombre, item.cantidad, item.precio_bs, item.precio_usd, subBs, subUsd]);

      // Stock anterior y nuevo
      const medRow = dbQueryOne("SELECT stock FROM medicamentos WHERE id = ?;", [item.id]);
      const stockAnterior = medRow ? medRow.stock : item.stock_actual;
      const stockNuevo = stockAnterior - item.cantidad;

      // Actualizar stock de medicamento
      await dbRun("UPDATE medicamentos SET stock = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?;", [stockNuevo, item.id]);

      // Registrar movimiento de salida en inventario (Kardex)
      await dbRun(`
        INSERT INTO movimientos_inventario 
        (medicamento_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, fecha)
        VALUES (?, 'SALIDA', ?, ?, ?, ?, ?, ?);
      `, [item.id, item.cantidad, stockAnterior, stockNuevo, `Venta ${codigoVenta}`, usuarioId, fechaHora]);
    }

    ultimaVentaGenerada = {
      id: ventaId,
      codigo: codigoVenta,
      total_bs: totalBsGlobal,
      total_usd: totalUsdGlobal
    };

    // Mostrar modal de éxito
    document.getElementById('modal_exitosa_codigo').textContent = codigoVenta;
    document.getElementById('modal_exitosa_total').textContent = formatearBs(totalBsGlobal);
    const boxVuelto = document.getElementById('modal_exitosa_vuelto_box');
    if (textoVueltoModal) {
      boxVuelto.textContent = textoVueltoModal;
      boxVuelto.style.display = 'block';
    } else {
      boxVuelto.style.display = 'none';
    }

    document.getElementById('modal_venta_exitosa').style.display = 'flex';

    // Limpiar carrito y restablecer cliente por defecto
    carrito = [];
    renderizarCarrito();
    quitarClienteSeleccionado();

  } catch (err) {
    console.error('Error al procesar venta:', err);
    alert('Error al guardar la venta en la base de datos: ' + err.message);
  } finally {
    btnProcesar.disabled = false;
    btnProcesar.innerHTML = `
      <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
      <span>Procesar Venta</span>
    `;
  }
}

function cerrarModalVentaExitosa() {
  document.getElementById('modal_venta_exitosa').style.display = 'none';
}

function imprimirTicketExitosa() {
  if (ultimaVentaGenerada && ultimaVentaGenerada.id) {
    window.open(`ticket.html?id=${ultimaVentaGenerada.id}`, '_blank');
  }
}

// Modal Nuevo Cliente Rápido
function abrirModalNuevoCliente() {
  document.getElementById('cli_cedula').value = '';
  document.getElementById('cli_nombres').value = '';
  document.getElementById('cli_apellidos').value = '';
  document.getElementById('cli_telefono').value = '';
  document.getElementById('cli_direccion').value = '';
  document.getElementById('modal_nuevo_cliente').style.display = 'flex';
  setTimeout(() => {
    document.getElementById('cli_cedula').focus();
  }, 100);
}

function cerrarModalNuevoCliente() {
  document.getElementById('modal_nuevo_cliente').style.display = 'none';
}

async function guardarNuevoClientePos() {
  const cedula = document.getElementById('cli_cedula').value.trim();
  const nombres = document.getElementById('cli_nombres').value.trim();
  const apellidos = document.getElementById('cli_apellidos').value.trim();
  const telefono = document.getElementById('cli_telefono').value.trim();
  const direccion = document.getElementById('cli_direccion').value.trim();

  if (!cedula || !nombres || !apellidos) {
    alert('Por favor complete los campos obligatorios: Cédula, Nombres y Apellidos.');
    return;
  }

  // Verificar si la cédula ya existe
  const existe = dbQueryOne("SELECT id FROM clientes WHERE cedula = ?;", [cedula]);
  if (existe) {
    alert('Ya existe un cliente registrado con esta cédula de identidad.');
    return;
  }

  try {
    const newId = await dbInsert(`
      INSERT INTO clientes (cedula, nombres, apellidos, telefono, direccion)
      VALUES (?, ?, ?, ?, ?);
    `, [cedula, nombres, apellidos, telefono, direccion]);

    cerrarModalNuevoCliente();
    const nuevo = dbQueryOne("SELECT * FROM clientes WHERE id = ?;", [newId]);
    if (nuevo) {
      seleccionarCliente(nuevo, true);
    }
    alert(`Cliente "${nombres} ${apellidos}" registrado y seleccionado con éxito.`);
  } catch (err) {
    console.error('Error guardando cliente:', err);
    alert('Error al registrar cliente: ' + err.message);
  }
}
