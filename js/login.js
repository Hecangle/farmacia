/**
 * login.js - Lógica de Inicio de Sesión
 * Farmacia - Sistema Autónomo HTML + JS
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Si ya tiene sesión activa, redirigir a index.html
  verificarAutenticacion(true);

  // 2. Inicializar SQLite
  try {
    await inicializarBD('libs/sql-wasm.wasm');
    document.getElementById('login_db_loading').style.display = 'none';
    document.getElementById('form_login').style.display = 'block';

    const nombreFarmacia = dbObtenerConfig('nombre_farmacia', 'Farmacia');
    const tituloElem = document.getElementById('login_nombre_farmacia');
    if (tituloElem) tituloElem.textContent = nombreFarmacia;
  } catch (err) {
    document.getElementById('login_db_loading').innerHTML = `
      <div style="color: #b91c1c; font-size: 0.95rem;">
        ❌ Error cargando SQLite: ${err.message || err}
      </div>
    `;
    console.error('Error al iniciar base de datos:', err);
  }
});

async function manejarLogin(e) {
  e.preventDefault();
  const errorBox = document.getElementById('login_error');
  const errorTexto = document.getElementById('login_error_texto');
  const btn = document.getElementById('btn_login');

  errorBox.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Verificando...';

  const usuario = document.getElementById('usuario').value;
  const password = document.getElementById('password').value;

  try {
    const res = await iniciarSesion(usuario, password);
    if (res.exito) {
      window.location.href = 'index.html';
    } else {
      errorTexto.textContent = '⚠️ ' + (res.mensaje || 'Credenciales inválidas.');
      errorBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Iniciar Sesión';
    }
  } catch (err) {
    errorTexto.textContent = '⚠️ Error en autenticación: ' + (err.message || err);
    errorBox.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Iniciar Sesión';
  }
}
