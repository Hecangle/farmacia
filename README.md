# Sistema Farmacéutico - Versión Autónoma en HTML + JavaScript & SQLite

Esta versión se encuentra alojada en la carpeta `solo_html_script/` y funciona **100% en el lado del cliente (Frontend)** utilizando únicamente **HTML5, CSS3 y JavaScript moderno**, ejecutando el motor de base de datos **SQLite compilado a WebAssembly (sql.js)**.

---

## 🚀 Características Principales

1. **SQLite 100% en JavaScript**:
   - Todas las llamadas, consultas (`SELECT`), inserciones (`INSERT`), actualizaciones (`UPDATE`), transacciones y relaciones de claves foráneas se ejecutan directamente en JavaScript usando `sql.js`.
   - Incluye los binarios locales `libs/sql-wasm.js` y `libs/sql-wasm.wasm`, por lo que **no requiere conexión a internet** para funcionar.

2. **Persistencia Automática en IndexedDB**:
   - Cada vez que se realiza un cambio (venta, nuevo medicamento, entrada/salida de stock, nuevo cliente o cambio de configuración), la base de datos SQLite se exporta en memoria y se guarda automáticamente en el almacenamiento local del navegador (`IndexedDB`).
   - Al recargar la página o navegar entre vistas (`index.html`, `ventas.html`, `medicamentos.html`, etc.), los datos se leen directamente de `IndexedDB`.

3. **Carga Inicial Inteligente**:
   - En el primer inicio, el sistema intenta leer e importar automáticamente el archivo existente `data/farmacia.db`.
   - Si no está disponible, genera automáticamente el esquema completo (7 tablas) e inicializa medicamentos de demostración y el usuario administrador.

4. **Herramientas de Respaldo (.db)**:
   - **Exportar Copia de Seguridad**: Descarga el archivo `.db` de SQLite directamente a su computadora desde la sección de Configuración.
   - **Importar Base de Datos**: Permite seleccionar y restaurar cualquier archivo `.db` de SQLite existente.
   - **Restaurar de Fábrica**: Permite reiniciar a los datos iniciales de demostración en un clic.

---

## 📂 Estructura de Archivos

```text
www/solo_html_script/
├── index.html            <- Panel Principal / Dashboard con estadísticas en tiempo real
├── ventas.html           <- Punto de Venta (POS) con buscador, carrito dinámico y formas de pago
├── medicamentos.html     <- Catálogo de medicamentos, filtros por tipo, precios y existencias
├── inventario.html       <- Control de inventario, registro de entradas/salidas y Kardex
├── clientes.html         <- Administración de clientes, registro e historial de compras
├── reportes.html         <- Reportes financieros, desglose por métodos de pago y fármacos top
├── configuracion.html    <- Parámetros de farmacia, tasa de cambio $, usuarios y respaldo .db
├── ticket.html           <- Comprobante de venta para impresión térmica (80mm/58mm)
├── login.html            <- Pantalla de inicio de sesión con fondo corporativo
├── css/
│   └── style.css         <- Estilos modernos con paleta cuidada, tarjetas glassmorphism y alto contraste
├── js/
│   ├── db.js             <- Motor SQLite en JS (sql.js + IndexedDB + Importación/Exportación)
│   ├── auth.js           <- Autenticación y gestión de sesiones de usuario
│   ├── nav.js            <- Barra de navegación dinámica común y modal de tasa del dólar
│   ├── index.js          <- Lógica del Dashboard y KPIs
│   ├── ventas.js         <- Lógica del Punto de Venta (POS) y procesamiento de ventas
│   ├── medicamentos.js   <- Lógica de administración y cálculo de precios de medicamentos
│   ├── inventario.js     <- Lógica de entradas, salidas y Kardex de inventario
│   ├── clientes.js       <- Lógica de gestión e historial de clientes
│   ├── reportes.js       <- Lógica de reportes y cierres financieros
│   ├── configuracion.js  <- Lógica de ajustes comerciales, usuarios y respaldos
│   └── ticket.js         <- Lógica de renderizado e impresión de tickets de venta
├── libs/
│   ├── sql-wasm.js       <- Biblioteca sql.js (WebAssembly)
│   └── sql-wasm.wasm     <- Binario WebAssembly de SQLite
└── img/
    ├── fondo.png         <- Fondo corporativo
    ├── icono.ico         <- Icono de la aplicación
    └── icono.png         <- Icono de la marca
```

---

## 🔑 Credenciales de Acceso Predeterminadas

- **Usuario:** `admin`
- **Contraseña:** `admin`

---

## 💡 Cómo Usarlo

Abra `login.html` o `index.html` en su navegador o entorno de escritorio (CEF). Todo funcionará de manera local, ultrarrápida y sin necesidad de un servidor PHP para el backend.
