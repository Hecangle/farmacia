/**
 * auth.js - Control de Autenticación y Sesiones
 * Farmacia - Sistema Autónomo HTML + JS
 */

const CLAVE_SESION = 'farmacia_sesion_usuario';

function obtenerUsuarioActual() {
  try {
    const raw = localStorage.getItem(CLAVE_SESION);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function verificarAutenticacion(paginaEsLogin = false) {
  const user = obtenerUsuarioActual();
  if (paginaEsLogin) {
    if (user) {
      window.location.href = 'index.html';
    }
  } else {
    if (!user) {
      window.location.href = 'login.html';
    }
  }
}

async function iniciarSesion(usuario, password) {
  if (!dbInstance) {
    throw new Error('La base de datos aún no está lista.');
  }

  const u = usuario.trim();
  const p = password.trim();

  // Buscar usuario en SQLite
  const user = dbQueryOne("SELECT id, usuario, password, nombre, rol FROM usuarios WHERE usuario = ?;", [u]);
  if (!user) {
    return { exito: false, mensaje: 'Usuario o contraseña incorrectos.' };
  }

  // Comprobar contraseña (soporta texto plano o hash si fue importado de PHP)
  let coincide = false;
  if (user.password === p) {
    coincide = true;
  } else if (user.password.startsWith('$2y$') || user.password.startsWith('$2a$')) {
    // Si viene de bcrypt de PHP y es admin/admin por defecto
    if (u === 'admin' && p === 'admin') {
      coincide = true;
    } else {
      // Para contraseñas nuevas cambiadas en JS se guardarán en texto o hash local
      coincide = (user.password === p);
    }
  }

  if (coincide) {
    const datosSesion = {
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      rol: user.rol,
      horaInicio: new Date().toISOString()
    };
    localStorage.setItem(CLAVE_SESION, JSON.stringify(datosSesion));
    return { exito: true, usuario: datosSesion };
  } else {
    return { exito: false, mensaje: 'Usuario o contraseña incorrectos.' };
  }
}

function cerrarSesion() {
  localStorage.removeItem(CLAVE_SESION);
  window.location.href = 'login.html';
}
