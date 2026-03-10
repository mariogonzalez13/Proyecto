// ═══════════════════════════════════════════════════════════════════════════
//  db.ts  — RenovaCloud Base de datos SQLite
//
//  Gestiona la conexión y los prepared statements para:
//    · Tabla Login    (autenticación)
//    · Tabla Servicios (datos principales)
//
//  Instalar:
//    npm install better-sqlite3
//    npm install --save-dev @types/better-sqlite3
// ═══════════════════════════════════════════════════════════════════════════
import Database from 'better-sqlite3';
import path from 'path';
// ── Conexión ───────────────────────────────────────────────────────────────
const DB_PATH = path.resolve(process.cwd(), 'renovacloud.db');
const db = new Database(DB_PATH);
// Optimizaciones de rendimiento para SQLite
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
// ═══════════════════════════════════════════════════════════════════════════
//  Crear tablas si no existen
// ═══════════════════════════════════════════════════════════════════════════
db.exec(`
  CREATE TABLE IF NOT EXISTS "Servicios" (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    "nombre"        TEXT    CHECK(length("nombre") <= 256)   NOT NULL,
    "Producto"      TEXT    CHECK("Producto" IN ('Dominio','Cert_SSL','Pack_alojamiento','Otros')) NOT NULL,
    "FechaCaducidad" TIMESTAMP NOT NULL,
    "Precio"        REAL    NOT NULL,
    "Renovacion"    INTEGER CHECK("Renovacion" IN (0,1))     NOT NULL,
    "Estado"        TEXT    CHECK("Estado" IN ('Activo','Avisado','Renovado','Baja_Traslado','Baja_Caducidad')) NOT NULL,
    "Notas"         TEXT    CHECK(length("Notas") <= 256)    NOT NULL DEFAULT '',
    "Registro"      TEXT    CHECK("Registro" IN ('N/A_CertPacks','Correo_Dominio')) NOT NULL,
    "Cliente"       TEXT    CHECK(length("Cliente") <= 100)  NOT NULL,
    "Contacto"      TEXT    CHECK(length("Contacto") <= 100) NOT NULL DEFAULT '',
    "Mail"          TEXT    CHECK(length("Mail") <= 256)     NOT NULL DEFAULT '',
    "Proveedor"     TEXT    CHECK("Proveedor" IN ('Openprovider','datarush')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "Login" (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    "Usuario"         TEXT    CHECK(length("Usuario") <= 60)   NOT NULL UNIQUE,
    "Correo"          TEXT    CHECK(length("Correo") <= 256)   NOT NULL,
    "Password"        TEXT    CHECK(length("Password") <= 100) NOT NULL,
    "Ip"              TEXT    CHECK(length("Ip") <= 20)        NOT NULL DEFAULT '0.0.0.0',
    "FerchaCreacion"  TIMESTAMP NOT NULL,
    "FechaModificacon" TIMESTAMP NOT NULL,
    "role"            INTEGER NOT NULL DEFAULT 1
  );
`);
// ═══════════════════════════════════════════════════════════════════════════
//  Statements — tabla Login
// ═══════════════════════════════════════════════════════════════════════════
export const statements_login = {
    // Buscar usuario por nombre (usado en auth.ts → verifyPasswd)
    consulta_usuario: db.prepare(`
    SELECT id, Usuario, Correo, Password, Ip,
           FerchaCreacion, FechaModificacon, role
    FROM   Login
    WHERE  Usuario = :username
    LIMIT  1
  `),
    // Actualizar IP y FechaModificacon tras login exitoso (usado en auth.route.ts)
    actualizar_acceso: db.prepare(`
    UPDATE Login
    SET    Ip               = :Ip,
           FechaModificacon = :FechaModificacon
    WHERE  id = :id
  `),
    // Crear nuevo usuario (usado en auth.ts → createUser)
    crear_usuario: db.prepare(`
    INSERT INTO Login (Usuario, Correo, Password, Ip, FerchaCreacion, FechaModificacon, role)
    VALUES (:Usuario, :Correo, :Password, :Ip, :FerchaCreacion, :FechaModificacon, :role)
  `),
    // Listar todos los usuarios (para panel de administración)
    listar_usuarios: db.prepare(`
    SELECT id, Usuario, Correo, Ip, FerchaCreacion, FechaModificacon, role
    FROM   Login
    ORDER  BY id ASC
  `),
    // Eliminar usuario por id
    eliminar_usuario: db.prepare(`
    DELETE FROM Login WHERE id = :id
  `),
};
// ═══════════════════════════════════════════════════════════════════════════
//  Statements — tabla Servicios
// ═══════════════════════════════════════════════════════════════════════════
export const statements_servicios = {
    // GET /api/servicios — listar todos
    listar: db.prepare(`
    SELECT * FROM Servicios ORDER BY FechaCaducidad ASC
  `),
    // GET /api/servicios/:id — obtener uno
    obtener: db.prepare(`
    SELECT * FROM Servicios WHERE id = :id LIMIT 1
  `),
    // POST /api/servicios — crear
    crear: db.prepare(`
    INSERT INTO Servicios
      (nombre, Producto, FechaCaducidad, Precio, Renovacion,
       Estado, Notas, Registro, Cliente, Contacto, Mail, Proveedor)
    VALUES
      (:nombre, :Producto, :FechaCaducidad, :Precio, :Renovacion,
       :Estado, :Notas, :Registro, :Cliente, :Contacto, :Mail, :Proveedor)
  `),
    // PUT /api/servicios/:id — actualizar
    actualizar: db.prepare(`
    UPDATE Servicios SET
      nombre         = :nombre,
      Producto       = :Producto,
      FechaCaducidad = :FechaCaducidad,
      Precio         = :Precio,
      Renovacion     = :Renovacion,
      Estado         = :Estado,
      Notas          = :Notas,
      Registro       = :Registro,
      Cliente        = :Cliente,
      Contacto       = :Contacto,
      Mail           = :Mail,
      Proveedor      = :Proveedor
    WHERE id = :id
  `),
    // DELETE /api/servicios/:id — eliminar
    eliminar: db.prepare(`
    DELETE FROM Servicios WHERE id = :id
  `),
    // Servicios que caducan en los próximos N días (para alertas)
    proximos_a_caducar: db.prepare(`
    SELECT * FROM Servicios
    WHERE  Estado NOT IN ('Baja_Traslado','Baja_Caducidad')
    AND    FechaCaducidad <= date('now', '+' || :dias || ' days')
    AND    FechaCaducidad >= date('now')
    ORDER  BY FechaCaducidad ASC
  `),
};
export default db;
