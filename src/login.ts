// ═══════════════════════════════════════════════════════════════════════════
//  login.ts  — RenovaCloud Login Controller
//  strict: true  |  target: ES2020  |  lib: DOM, ES2020
// ═══════════════════════════════════════════════════════════════════════════

// ── Tipos que devuelve el backend (auth.ts) ────────────────────────────────
interface LoginOk {
  status:   'LOGIN_OK';
  id:       number;
  username: string;
  role:     number;
}
interface LoginError {
  status:  'LOGIN_ERROR';
  message: string;
}
type LoginResult = LoginOk | LoginError;

interface LoginPayload {
  Usuario:  string;
  Password: string;
  Ip:       string;
}

// ── Configuración (constantes puras, sin DOM) ──────────────────────────────
const API_URL:      string = '/api/auth/login';
const MAX_ATTEMPTS: number = 5;
const LOCKOUT_MS:   number = 15 * 60 * 1000;
const REDIRECT:     string = 'dashboard.html';

// ── Arranque — TODO el código vive dentro de este listener ─────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── Referencias al DOM (seguras: DOM ya existe aquí) ──────────────────
  const inputUsuario  = document.getElementById('inputUsuario')  as HTMLInputElement;
  const inputPassword = document.getElementById('inputPassword') as HTMLInputElement;
  const btnLogin      = document.getElementById('btnLogin')      as HTMLButtonElement;
  const btnText       = document.getElementById('btnText')       as HTMLElement;
  const btnIcon       = document.getElementById('btnIcon')       as HTMLElement;
  const alertError    = document.getElementById('alertError')    as HTMLElement;
  const alertErrorMsg = document.getElementById('alertErrorMsg') as HTMLElement;
  const alertSuccess  = document.getElementById('alertSuccess')  as HTMLElement;
  const lockoutBanner = document.getElementById('lockoutBanner') as HTMLElement;
  const lockoutTimer  = document.getElementById('lockoutTimer')  as HTMLElement;
  const ipDisplay     = document.getElementById('ipDisplay')     as HTMLElement;
  const ipSmall       = document.getElementById('ipSmall')       as HTMLElement;
  const sessionDate   = document.getElementById('sessionDate')   as HTMLElement;
  const attemptsBar   = document.getElementById('attemptsBar')   as HTMLElement;
  const attemptsDots  = document.getElementById('attemptsDots')  as HTMLElement;
  const attemptsText  = document.getElementById('attemptsText')  as HTMLElement;
  const errUsuario    = document.getElementById('errUsuario')    as HTMLElement;
  const errPassword   = document.getElementById('errPassword')   as HTMLElement;
  const rememberMe    = document.getElementById('rememberMe')    as HTMLInputElement;
  const togglePw      = document.getElementById('togglePw')      as HTMLButtonElement;
  const eyeIcon       = document.getElementById('eyeIcon')       as HTMLElement;

  // ── Estado interno ─────────────────────────────────────────────────────
  let attempts:    number = 0;
  let lockedUntil: number | null = null;
  let lockTimer:   ReturnType<typeof setInterval> | null = null;
  let detectedIP:  string = '';

  // ── Barra de sesión: IP + fecha ────────────────────────────────────────
  void (async () => {
    sessionDate.textContent = new Date().toLocaleDateString('es-ES', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
    try {
      const res  = await fetch('https://api.ipify.org?format=json');
      const json = await res.json() as { ip: string };
      detectedIP = json.ip;
    } catch {
      detectedIP = '127.0.0.1';
    }
    ipDisplay.textContent = detectedIP;
    ipSmall.textContent   = detectedIP;
  })();

  // ── Pasos del proceso auth ─────────────────────────────────────────────
  function setStep(n: 1 | 2 | 3): void {
    ([1, 2, 3] as const).forEach(i => {
      const el = document.getElementById(`step${i}`);
      if (!el) return;
      el.classList.remove('active', 'done');
      if (i < n)  el.classList.add('done');
      if (i === n) el.classList.add('active');
    });
  }

  // ── Toggle password ────────────────────────────────────────────────────
  togglePw.addEventListener('click', () => {
    const hidden       = inputPassword.type === 'password';
    inputPassword.type = hidden ? 'text' : 'password';
    eyeIcon.className  = hidden ? 'bi bi-eye-slash' : 'bi bi-eye';
  });

  // ── Alertas ────────────────────────────────────────────────────────────
  function showError(msg: string): void {
    alertErrorMsg.textContent = msg;
    alertError.classList.add('show');
    alertSuccess.classList.remove('show');
  }
  function hideAlerts(): void {
    alertError.classList.remove('show');
    alertSuccess.classList.remove('show');
  }
  function clearFieldErrors(): void {
    inputUsuario.classList.remove('is-invalid');
    inputPassword.classList.remove('is-invalid');
    errUsuario.style.display  = 'none';
    errPassword.style.display = 'none';
  }

  // ── Estado del botón ───────────────────────────────────────────────────
  function setLoading(on: boolean): void {
    btnLogin.disabled    = on;
    btnText.textContent  = on ? 'Verificando…' : 'Iniciar sesión';
    btnIcon.className    = on ? 'spinner-sm'   : 'bi bi-arrow-right';
  }

  // ── Indicador de intentos ──────────────────────────────────────────────
  function renderAttempts(): void {
    if (attempts === 0) { attemptsBar.classList.remove('show'); return; }
    attemptsBar.classList.add('show');
    attemptsDots.innerHTML = Array.from({ length: MAX_ATTEMPTS }, (_, i) =>
      `<div class="attempt-dot ${i < attempts ? 'used' : ''}"></div>`
    ).join('');
    const left = MAX_ATTEMPTS - attempts;
    attemptsText.textContent = left > 0
      ? `${left} intento${left !== 1 ? 's' : ''} restante${left !== 1 ? 's' : ''}`
      : 'Bloqueando cuenta…';
  }

  // ── Lockout ────────────────────────────────────────────────────────────
  function startLockout(): void {
    lockedUntil = Date.now() + LOCKOUT_MS;
    lockoutBanner.classList.add('show');
    hideAlerts();
    attemptsBar.classList.remove('show');
    btnLogin.disabled = true;

    lockTimer = setInterval(() => {
      const ms = (lockedUntil ?? 0) - Date.now();
      if (ms <= 0) {
        if (lockTimer) clearInterval(lockTimer);
        lockoutBanner.classList.remove('show');
        attempts = 0; lockedUntil = null;
        btnLogin.disabled = false;
        renderAttempts();
        return;
      }
      const m = String(Math.floor(ms / 60_000)).padStart(2, '0');
      const s = String(Math.floor((ms % 60_000) / 1_000)).padStart(2, '0');
      lockoutTimer.textContent = `${m}:${s}`;
    }, 500);
  }

  // ── Validación ─────────────────────────────────────────────────────────
  function validate(): boolean {
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
  async function handleLogin(): Promise<void> {
    if (lockedUntil !== null && Date.now() < lockedUntil) return;
    hideAlerts();
    if (!validate()) return;

    setLoading(true);
    setStep(2);

    const payload: LoginPayload = {
      Usuario:  inputUsuario.value.trim(),
      Password: inputPassword.value,
      Ip:       detectedIP,
    };

    try {
      const res    = await fetch(API_URL, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(payload),
        credentials: 'include',
      });
      const result = await res.json() as LoginResult;

      if (result.status === 'LOGIN_OK') {
        setStep(3);
        setLoading(false);
        alertSuccess.classList.add('show');
        btnText.textContent = '✓ Acceso concedido';
        btnIcon.className   = 'bi bi-check2';
        sessionStorage.setItem('rc_user', result.username);
        sessionStorage.setItem('rc_role', String(result.role));
        if (rememberMe.checked) localStorage.setItem('rc_remember', result.username);
        setTimeout(() => { window.location.href = REDIRECT; }, 850);

      } else {
        setStep(1);
        setLoading(false);
        attempts++;
        renderAttempts();
        if (attempts >= MAX_ATTEMPTS) {
          startLockout();
        } else {
          showError(result.message ?? 'Usuario o contraseña incorrectos.');
          inputPassword.value = '';
          inputPassword.focus();
        }
      }

    } catch (err) {
      setStep(1);
      setLoading(false);
      showError('No se pudo conectar con el servidor. Revisa la conexión.');
      console.error('[login.ts]', err);
    }
  }

  // ── Eventos ────────────────────────────────────────────────────────────
  btnLogin.addEventListener('click', () => { void handleLogin(); });

  [inputUsuario, inputPassword].forEach(el => {
    el.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') void handleLogin();
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