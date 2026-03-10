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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
import argon2 from 'argon2';
import { statements_login } from './db';
// ── PEPPER ─────────────────────────────────────────────────────────────────
// Carga desde variable de entorno. Si no existe usa el valor por defecto
// (solo para desarrollo — en producción SIEMPRE definir PEPPER en .env).
const PEPPER = (_a = process.env['PEPPER']) !== null && _a !== void 0 ? _a : 'Cd0GK2Dn3FNYDvc7BhguuMJG0ECg52bhsKG5AXfREFXEhgHT';
// ── Opciones Argon2id ──────────────────────────────────────────────────────
const argonOpts = {
    type: argon2.argon2id,
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
export function hashPasswd(plainpass) {
    return __awaiter(this, void 0, void 0, function* () {
        return argon2.hash(PEPPER + plainpass, argonOpts);
    });
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
export function verifyPasswd(password, username) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        // ── 1. Buscar usuario en la BD ─────────────────────────────────────────
        const row = statements_login.consulta_usuario.get({ username });
        if (!row) {
            // No revelar si el usuario existe o no
            return { status: 'LOGIN_ERROR', message: 'Usuario o contraseña incorrectos.' };
        }
        // ── 2. Verificar contraseña con Argon2id + PEPPER ──────────────────────
        try {
            const passOK = yield argon2.verify(row.Password, PEPPER + password);
            if (passOK) {
                return {
                    status: 'LOGIN_OK',
                    id: row.id,
                    username: row.Usuario,
                    role: (_a = row.role) !== null && _a !== void 0 ? _a : 1, // rol por defecto: 1 (usuario estándar)
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
    });
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
export function createUser(usuario_1, correo_1, password_1) {
    return __awaiter(this, arguments, void 0, function* (usuario, correo, password, ip = '0.0.0.0', role = 1) {
        try {
            const hash = yield hashPasswd(password);
            const ahora = new Date().toISOString();
            statements_login.crear_usuario.run({
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
    });
}
