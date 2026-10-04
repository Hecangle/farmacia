/**
 * nav.js - Barra de navegación común, tasa del día y utilidades globales
 * Farmacia - Sistema Autónomo HTML + JS
 */

function renderNavbar(paginaActiva = 'index') {
  const user = obtenerUsuarioActual();
  const nombreUsuario = user ? user.nombre : 'Usuario';
  const rolUsuario = user ? (user.rol === 'admin' ? 'Administrador' : 'Cajero') : '';
  const tasaActual = parseFloat(dbObtenerConfig('tasa_dolar', '36.50')) || 36.50;
  const nombreFarmacia = dbObtenerConfig('nombre_farmacia', 'Farmacia');

  const navHtml = `
    <header class="top-navbar">
      <a href="index.html" class="brand-container">
        <div class="brand-icon-box">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/>
          </svg>
        </div>
        <div class="brand-text">
          <h1>${nombreFarmacia}</h1>
          <span>Sistema Integral de Farmacia</span>
        </div>
      </a>

      <div class="nav-actions">
        <!-- Píldora de Tasa del Dólar -->
        <button type="button" class="badge-rate" onclick="abrirModalTasaRapida()" title="Haga clic para actualizar la tasa">
          <span>💵 1 $ = <strong>Bs. ${tasaActual.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></span>
          <small style="text-decoration: underline; font-size: 0.72rem; color: #0369a1;">Cambiar</small>
        </button>

        <!-- Usuario Activo -->
        <div class="user-profile">
          <div class="user-avatar">${(nombreUsuario.charAt(0) || 'A').toUpperCase()}</div>
          <div class="user-info">
            <span class="user-name">${nombreUsuario}</span>
            <span class="user-role">${rolUsuario}</span>
          </div>
        </div>

        <!-- Cerrar Sesión -->
        <button type="button" class="btn-nav-logout" onclick="cerrarSesion()" title="Cerrar sesión">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
          </svg>
          <span>Salir</span>
        </button>
      </div>
    </header>

    <!-- Modal Rápido de Tasa de Cambio -->
    <div id="modal_tasa_rapida" class="modal-overlay" style="display: none;">
      <div class="modal-box" style="max-width: 440px;">
        <div class="modal-header">
          <h3>💵 Actualizar Tasa del Dólar</h3>
          <button type="button" class="modal-close" onclick="cerrarModalTasaRapida()">&times;</button>
        </div>
        <div class="modal-body">
          <p style="color: #1e293b; font-size: 1rem; font-weight: 550; margin-bottom: 1rem;">
            Ingrese el valor de la tasa oficial del día (Bs por cada 1 USD):
          </p>
          <div class="form-group">
            <label class="form-label" for="input_tasa_rapida">Tasa en Bolívares (Bs.):</label>
            <input type="number" step="0.01" min="0.01" id="input_tasa_rapida" class="form-control" value="${tasaActual}" style="font-size: 1.25rem; font-weight: 800;">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="cerrarModalTasaRapida()">Cancelar</button>
          <button type="button" class="btn btn-primary" onclick="guardarTasaRapida()">Guardar Tasa</button>
        </div>
      </div>
    </div>
  `;

  const cont = document.getElementById('navbar_container');
  if (cont) {
    cont.innerHTML = navHtml;
  }
}

function abrirModalTasaRapida() {
  const m = document.getElementById('modal_tasa_rapida');
  if (m) {
    m.style.display = 'flex';
    const inp = document.getElementById('input_tasa_rapida');
    if (inp) {
      inp.focus();
      inp.select();
    }
  }
}

function cerrarModalTasaRapida() {
  const m = document.getElementById('modal_tasa_rapida');
  if (m) m.style.display = 'none';
}

async function guardarTasaRapida() {
  const inp = document.getElementById('input_tasa_rapida');
  const nuevaTasa = parseFloat(inp.value);
  if (!nuevaTasa || nuevaTasa <= 0) {
    alert('Por favor ingrese un valor de tasa válido.');
    return;
  }

  await dbGuardarConfig('tasa_dolar', nuevaTasa.toFixed(2));
  const hoyStr = new Date().toISOString().split('T')[0];
  await dbGuardarConfig('ultima_fecha_tasa', hoyStr);

  cerrarModalTasaRapida();
  // Recargar navbar o refrescar
  location.reload();
}

/**
 * Formatear número a moneda venezolana (Bs.)
 */
function formatearBs(num) {
  const n = parseFloat(num) || 0;
  return 'Bs. ' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formatear número a divisa ($ USD)
 */
function formatearUsd(num) {
  const n = parseFloat(num) || 0;
  return '$ ' + n.toFixed(2);
}
