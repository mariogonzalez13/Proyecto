"use strict";
// ═══════════════════════════════════════════════════════════════════════════
//  login.ts  — RenovaCloud Login Controller
//  strict: true  |  target: ES2020  |  lib: DOM, ES2020
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
// ── Configuración (constantes puras, sin DOM) ──────────────────────────────
const API_URL = '/api/auth/login';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const REDIRECT = 'dashboard.html';
// ── Arranque — TODO el código vive dentro de este listener ─────────────────
document.addEventListener('DOMContentLoaded', () => {
    // ── Referencias al DOM (seguras: DOM ya existe aquí) ──────────────────
    const inputUsuario = document.getElementById('inputUsuario');
    const inputPassword = document.getElementById('inputPassword');
    const btnLogin = document.getElementById('btnLogin');
    const btnText = document.getElementById('btnText');
    const btnIcon = document.getElementById('btnIcon');
    const alertError = document.getElementById('alertError');
    const alertErrorMsg = document.getElementById('alertErrorMsg');
    const alertSuccess = document.getElementById('alertSuccess');
    const lockoutBanner = document.getElementById('lockoutBanner');
    const lockoutTimer = document.getElementById('lockoutTimer');
    const ipDisplay = document.getElementById('ipDisplay');
    const ipSmall = document.getElementById('ipSmall');
    const sessionDate = document.getElementById('sessionDate');
    const attemptsBar = document.getElementById('attemptsBar');
    const attemptsDots = document.getElementById('attemptsDots');
    const attemptsText = document.getElementById('attemptsText');
    const errUsuario = document.getElementById('errUsuario');
    const errPassword = document.getElementById('errPassword');
    const rememberMe = document.getElementById('rememberMe');
    const togglePw = document.getElementById('togglePw');
    const eyeIcon = document.getElementById('eyeIcon');
    // ── Estado interno ─────────────────────────────────────────────────────
    let attempts = 0;
    let lockedUntil = null;
    let lockTimer = null;
    let detectedIP = '';
    // ── Barra de sesión: IP + fecha ────────────────────────────────────────
    void (() => __awaiter(void 0, void 0, void 0, function* () {
        sessionDate.textContent = new Date().toLocaleDateString('es-ES', {
            weekday: 'short', day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit',
        });
        try {
            const res = yield fetch('https://api.ipify.org?format=json');
            const json = yield res.json();
            detectedIP = json.ip;
        }
        catch (_a) {
            detectedIP = '127.0.0.1';
        }
        ipDisplay.textContent = detectedIP;
        ipSmall.textContent = detectedIP;
    }))();
    // ── Pasos del proceso auth ─────────────────────────────────────────────
    function setStep(n) {
        [1, 2, 3].forEach(i => {
            const el = document.getElementById(`step${i}`);
            if (!el)
                return;
            el.classList.remove('active', 'done');
            if (i < n)
                el.classList.add('done');
            if (i === n)
                el.classList.add('active');
        });
    }
    // ── Toggle password ────────────────────────────────────────────────────
    togglePw.addEventListener('click', () => {
        const hidden = inputPassword.type === 'password';
        inputPassword.type = hidden ? 'text' : 'password';
        eyeIcon.className = hidden ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
    // ── Alertas ────────────────────────────────────────────────────────────
    function showError(msg) {
        alertErrorMsg.textContent = msg;
        alertError.classList.add('show');
        alertSuccess.classList.remove('show');
    }
    function hideAlerts() {
        alertError.classList.remove('show');
        alertSuccess.classList.remove('show');
    }
    function clearFieldErrors() {
        inputUsuario.classList.remove('is-invalid');
        inputPassword.classList.remove('is-invalid');
        errUsuario.style.display = 'none';
        errPassword.style.display = 'none';
    }
    // ── Estado del botón ───────────────────────────────────────────────────
    function setLoading(on) {
        btnLogin.disabled = on;
        btnText.textContent = on ? 'Verificando…' : 'Iniciar sesión';
        btnIcon.className = on ? 'spinner-sm' : 'bi bi-arrow-right';
    }
    // ── Indicador de intentos ──────────────────────────────────────────────
    function renderAttempts() {
        if (attempts === 0) {
            attemptsBar.classList.remove('show');
            return;
        }
        attemptsBar.classList.add('show');
        attemptsDots.innerHTML = Array.from({ length: MAX_ATTEMPTS }, (_, i) => `<div class="attempt-dot ${i < attempts ? 'used' : ''}"></div>`).join('');
        const left = MAX_ATTEMPTS - attempts;
        attemptsText.textContent = left > 0
            ? `${left} intento${left !== 1 ? 's' : ''} restante${left !== 1 ? 's' : ''}`
            : 'Bloqueando cuenta…';
    }
    // ── Lockout ────────────────────────────────────────────────────────────
    function startLockout() {
        lockedUntil = Date.now() + LOCKOUT_MS;
        lockoutBanner.classList.add('show');
        hideAlerts();
        attemptsBar.classList.remove('show');
        btnLogin.disabled = true;
        lockTimer = setInterval(() => {
            const ms = (lockedUntil !== null && lockedUntil !== void 0 ? lockedUntil : 0) - Date.now();
            if (ms <= 0) {
                if (lockTimer)
                    clearInterval(lockTimer);
                lockoutBanner.classList.remove('show');
                attempts = 0;
                lockedUntil = null;
                btnLogin.disabled = false;
                renderAttempts();
                return;
            }
            const m = String(Math.floor(ms / 60000)).padStart(2, '0');
            const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
            lockoutTimer.textContent = `${m}:${s}`;
        }, 500);
    }
    // ── Validación ─────────────────────────────────────────────────────────
    function validate() {
        clearFieldErrors();
        let ok = true;
        if (!inputUsuario.value.trim()) {
            inputUsuario.classList.add('is-invalid');
            errUsuario.style.display = 'block';
            ok = false;
        }
        if (!inputPassword.value) {
            inputPassword.classList.add('is-invalid');
            errPassword.style.display = 'block';
            ok = false;
        }
        return ok;
    }
    // ── Login handler ──────────────────────────────────────────────────────
    function handleLogin() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (lockedUntil !== null && Date.now() < lockedUntil)
                return;
            hideAlerts();
            if (!validate())
                return;
            setLoading(true);
            setStep(2);
            const payload = {
                Usuario: inputUsuario.value.trim(),
                Password: inputPassword.value,
                Ip: detectedIP,
            };
            try {
                const res = yield fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    credentials: 'include',
                });
                const result = yield res.json();
                if (result.status === 'LOGIN_OK') {
                    setStep(3);
                    setLoading(false);
                    alertSuccess.classList.add('show');
                    btnText.textContent = '✓ Acceso concedido';
                    btnIcon.className = 'bi bi-check2';
                    sessionStorage.setItem('rc_user', result.username);
                    sessionStorage.setItem('rc_role', String(result.role));
                    if (rememberMe.checked)
                        localStorage.setItem('rc_remember', result.username);
                    setTimeout(() => { window.location.href = REDIRECT; }, 850);
                }
                else {
                    setStep(1);
                    setLoading(false);
                    attempts++;
                    renderAttempts();
                    if (attempts >= MAX_ATTEMPTS) {
                        startLockout();
                    }
                    else {
                        showError((_a = result.message) !== null && _a !== void 0 ? _a : 'Usuario o contraseña incorrectos.');
                        inputPassword.value = '';
                        inputPassword.focus();
                    }
                }
            }
            catch (err) {
                setStep(1);
                setLoading(false);
                showError('No se pudo conectar con el servidor. Revisa la conexión.');
                console.error('[login.ts]', err);
            }
        });
    }
    // ── Eventos ────────────────────────────────────────────────────────────
    btnLogin.addEventListener('click', () => { void handleLogin(); });
    [inputUsuario, inputPassword].forEach(el => {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')
                void handleLogin();
        });
        el.addEventListener('input', () => { clearFieldErrors(); hideAlerts(); });
    });
    // ── Pre-rellenar "recordarme" ──────────────────────────────────────────
    const savedUser = localStorage.getItem('rc_remember');
    if (savedUser) {
        inputUsuario.value = savedUser;
        rememberMe.checked = true;
        inputPassword.focus();
    }
}); // fin DOMContentLoaded
