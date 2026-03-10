// ─────────────────────────────────────────────────────────────────────────────
//  auth.route.ts
//  Ruta Express: POST /api/auth/login
//
//  Integra el módulo auth.ts (verifyPasswd / Argon2id) con la tabla Login
//  de SQLite. Registra la IP y actualiza FechaModificacion en cada acceso.
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { verifyPasswd }              from './auth';          // tu módulo auth.ts
import { statements_login }          from './db';            // ver db.ts más abajo

const router = Router();

// ── Tipos que refleja la tabla Login ─────────────────────────────────────────
interface LoginRow {
  id:               number;
  Usuario:          string;
  Correo:           string;
  Password:         string;   // hash Argon2id almacenado en BD
  Ip:               string;
  FerchaCreacion:   string;   // typo original de la BD — no modificar
  FechaModificacon: string;   // typo original de la BD — no modificar
}

// ── Body que llega desde el frontend (login.html) ────────────────────────────
interface LoginBody {
  Usuario:  string;   // Login.Usuario — max 60 chars
  Password: string;   // texto plano; se verifica con Argon2id en auth.ts
  Ip?:      string;   // IP detectada en cliente (se confirma con req.ip)
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {

  const { Usuario, Password, Ip: clientIp }: LoginBody = req.body ?? {};

  // ── 1. Validación básica de campos ────────────────────────────────────────
  if (
    !Usuario  || typeof Usuario  !== 'string' || Usuario.trim().length  === 0 ||
    !Password || typeof Password !== 'string' || Password.length         === 0
  ) {
    return res.status(400).json({
      status:  'LOGIN_ERROR',
      message: 'Usuario y contraseña son obligatorios.',
    });
  }

  // ── 2. Determinar IP real (servidor tiene prioridad sobre cliente) ─────────
  const realIp: string =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    clientIp ||
    '0.0.0.0';

  // ── 3. Llamar a verifyPasswd (auth.ts — Argon2id + PEPPER) ───────────────
  //       verifyPasswd espera (password: string, username: string)
  //       y devuelve LoginOk | LoginError
  const authResult = await verifyPasswd(Password, Usuario.trim());

  // ── 4. Manejar resultado ──────────────────────────────────────────────────
  if (authResult.status === 'LOGIN_ERROR') {
    // No revelar si el usuario existe o no — mensaje genérico
    return res.status(401).json({
      status:  'LOGIN_ERROR',
      message: 'Usuario o contraseña incorrectos.',
    });
  }

  // ── 5. LOGIN_OK: actualizar Login.Ip y Login.FechaModificacon ─────────────
  const ahora = new Date().toISOString();

  try {
    statements_login.actualizar_acceso.run({
      Ip:               realIp,
      FechaModificacon: ahora,          // nombre exacto del campo en la BD
      id:               authResult.id,
    });
  } catch (err) {
    // No bloqueamos el login si falla el update de auditoría,
    // pero sí lo registramos en consola
    console.error('[auth.route] Error al actualizar acceso en Login:', err);
  }

  // ── 6. Responder al cliente ───────────────────────────────────────────────
  return res.status(200).json({
    status:   'LOGIN_OK',
    id:       authResult.id,
    username: authResult.username,
    role:     authResult.role,
  });
});

export default router;


// ─────────────────────────────────────────────────────────────────────────────
//  db.ts  (fragmento — statements para la tabla Login)
//
//  Añade este bloque a tu db.ts existente junto con statements_usuarios
// ─────────────────────────────────────────────────────────────────────────────

/*
import Database from 'better-sqlite3';

const db = new Database('renovacloud.db');

// ── Statements tabla Login ────────────────────────────────────────────────────
export const statements_login = {

  // Consultar usuario por Usuario (usado en auth.ts como username)
  consulta_usuario: db.prepare<{ username: string }, LoginRow>(`
    SELECT id, Usuario, Correo, Password, Ip, FerchaCreacion, FechaModificacon
    FROM Login
    WHERE Usuario = :username
    LIMIT 1
  `),

  // Actualizar IP y FechaModificacon tras login exitoso
  actualizar_acceso: db.prepare<{ Ip: string; FechaModificacon: string; id: number }>(`
    UPDATE Login
    SET Ip               = :Ip,
        FechaModificacon = :FechaModificacon
    WHERE id = :id
  `),

  // Crear nuevo usuario (útil para el panel de administración)
  crear_usuario: db.prepare<{
    Usuario: string; Correo: string; Password: string; Ip: string;
    FerchaCreacion: string; FechaModificacon: string;
  }>(`
    INSERT INTO Login (Usuario, Correo, Password, Ip, FerchaCreacion, FechaModificacon)
    VALUES (:Usuario, :Correo, :Password, :Ip, :FerchaCreacion, :FechaModificacon)
  `),
};
*/


// ─────────────────────────────────────────────────────────────────────────────
//  app.ts  (fragmento — cómo registrar la ruta en Express)
// ─────────────────────────────────────────────────────────────────────────────

/*
import express    from 'express';
import authRouter from './auth.route';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Proxy inverso (nginx / caddy): confiar en X-Forwarded-For
app.set('trust proxy', 1);

// Montar rutas de autenticación
app.use('/api/auth', authRouter);

app.listen(3000, () => console.log('RenovaCloud API escuchando en :3000'));
*/


// ─────────────────────────────────────────────────────────────────────────────
//  auth.ts  (hashPasswd — helper para crear usuarios desde consola / seed)
//
//  Uso:
//    import { hashPasswd } from './auth';
//    const hash = await hashPasswd('miContraseñaSegura');
//    statements_login.crear_usuario.run({
//      Usuario: 'admin', Correo: 'admin@empresa.com',
//      Password: hash,   Ip: '0.0.0.0',
//      FerchaCreacion: new Date().toISOString(),
//      FechaModificacon: new Date().toISOString(),
//    });
// ─────────────────────────────────────────────────────────────────────────────
