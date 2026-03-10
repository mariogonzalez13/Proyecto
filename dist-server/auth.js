"use strict";
// ═══════════════════════════════════════════════════════════════════════════
//  auth.ts  — RenovaCloud Módulo de Autenticación
//
//  Basado en tu implementación original con Argon2id + PEPPER.
//  Integrado con la tabla Login de SQLite (better-sqlite3).
//
//  Instalar dependencias:
//    npm install argon2
//    npm install --save-dev @types/node
// ═══════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPasswd = hashPasswd;
exports.verifyPasswd = verifyPasswd;
exports.createUser = createUser;
const argon2_1 = __importDefault(require("argon2"));
const db_1 = require("./db");
// ── PEPPER ─────────────────────────────────────────────────────────────────
// Carga desde variable de entorno. Si no existe usa el valor por defecto
// (solo para desarrollo — en producción SIEMPRE definir PEPPER en .env).
const PEPPER = process.env['PEPPER'] ?? 'Cd0GK2Dn3FNYDvc7BhguuMJG0ECg52bhsKG5AXfREFXEhgHT';
// ── Opciones Argon2id ──────────────────────────────────────────────────────
const argonOpts = {
    type: argon2_1.default.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
};
// ═══════════════════════════════════════════════════════════════════════════
//  hashPasswd
//  Genera el hash Argon2id de una contraseña en texto plano.
//  Usar al CREAR o CAMBIAR contraseñas (nunca al verificar).
//
//  Ejemplo:
//    const hash = await hashPasswd('miContraseña123');
//    statements_login.crear_usuario.run({ ..., Password: hash });
// ═══════════════════════════════════════════════════════════════════════════
async function hashPasswd(plainpass) {
    return argon2_1.default.hash(PEPPER + plainpass, argonOpts);
}
// ═══════════════════════════════════════════════════════════════════════════
//  verifyPasswd
//  Verifica las credenciales contra la tabla Login.
//  Devuelve LoginOk | LoginError — nunca lanza excepciones al llamador.
//
//  Flujo:
//    1. Busca el usuario por Login.Usuario
//    2. Verifica PEPPER + password contra el hash almacenado (Argon2id)
//    3. Retorna LoginOk con id, username y role si es correcto
//    4. Retorna LoginError con mensaje genérico si falla (sin revelar causa)
// ═══════════════════════════════════════════════════════════════════════════
async function verifyPasswd(password, username) {
    // ── 1. Buscar usuario en la BD ─────────────────────────────────────────
    const row = db_1.statements_login.consulta_usuario.get({ username });
    if (!row) {
        // No revelar si el usuario existe o no
        return { status: 'LOGIN_ERROR', message: 'Usuario o contraseña incorrectos.' };
    }
    // ── 2. Verificar contraseña con Argon2id + PEPPER ──────────────────────
    try {
        const passOK = await argon2_1.default.verify(row.Password, PEPPER + password);
        if (passOK) {
            return {
                status: 'LOGIN_OK',
                id: row.id,
                username: row.Usuario,
                role: row.role ?? 1, // rol por defecto: 1 (usuario estándar)
            };
        }
        else {
            return { status: 'LOGIN_ERROR', message: 'Usuario o contraseña incorrectos.' };
        }
    }
    catch (err) {
        // Error interno de Argon2 (hash corrupto, etc.) — loguear pero no exponer
        console.error('[auth.ts] Error al verificar contraseña:', err);
        return { status: 'LOGIN_ERROR', message: 'Error interno al verificar credenciales.' };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
//  createUser  (helper de administración / seed)
//  Crea un nuevo usuario en la tabla Login con la contraseña hasheada.
//
//  Uso desde consola:
//    npx ts-node -e "
//      import { createUser } from './auth';
//      createUser('admin', 'admin@empresa.com', 'miPassword123').then(console.log);
//    "
// ═══════════════════════════════════════════════════════════════════════════
async function createUser(usuario, correo, password, ip = '0.0.0.0', role = 1) {
    try {
        const hash = await hashPasswd(password);
        const ahora = new Date().toISOString();
        db_1.statements_login.crear_usuario.run({
            Usuario: usuario,
            Correo: correo,
            Password: hash,
            Ip: ip,
            FerchaCreacion: ahora, // typo original de la BD
            FechaModificacon: ahora, // typo original de la BD
            role,
        });
        return { ok: true, message: `Usuario "${usuario}" creado correctamente.` };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[auth.ts] Error al crear usuario:', msg);
        return { ok: false, message: msg };
    }
}
