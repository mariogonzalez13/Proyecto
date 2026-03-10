# RenovaCloud — Guía de pruebas

## 1. Estructura de archivos

```
renovacloud/
├── src/
│   ├── login.html
│   ├── login.css
│   ├── login.ts
│   ├── dashboard.html
│   ├── dashboard.css
│   └── dashboard.ts
├── backend/
│   ├── auth.ts          ← tu módulo Argon2id
│   ├── auth.route.ts    ← ruta Express
│   └── db.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 2. Instalar dependencias

```bash
npm create vite@latest renovacloud -- --template vanilla-ts
cd renovacloud

# Dependencias de producción
npm install bootstrap @popperjs/core

# Dependencias de desarrollo
npm install --save-dev @types/bootstrap vite typescript
```

Si ya tienes `@types/bootstrap` instalado, borra el bloque
`declare namespace bootstrap { ... }` del `dashboard.ts`.

---

## 3. Configurar Vite

Crea `vite.config.ts` en la raíz:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',           // los HTML están en src/
  build: {
    outDir: '../dist',
    rollupOptions: {
      input: {
        login:     'src/login.html',
        dashboard: 'src/dashboard.html',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Redirige las llamadas a la API al backend Express
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

En cada HTML, cambia la línea del script a:

```html
<!-- login.html -->
<script type="module" src="login.ts"></script>

<!-- dashboard.html -->
<script type="module" src="dashboard.ts"></script>
```

---

## 4. Arrancar el frontend

```bash
npm run dev
# → http://localhost:5173/login.html
# → http://localhost:5173/dashboard.html
```

---

## 5. Qué probar en el LOGIN

| Prueba                         | Pasos                                                   | Resultado esperado                        |
|--------------------------------|---------------------------------------------------------|-------------------------------------------|
| Campos vacíos                  | Pulsar "Iniciar sesión" sin rellenar nada               | Bordes rojos + mensajes de error          |
| Solo usuario                   | Rellenar usuario, dejar password vacío                  | Error solo en password                    |
| Credenciales incorrectas       | Usuario o password mal (backend real) / cualquier cosa (mock) | Alerta roja + intento marcado en rojo |
| 5 intentos fallidos            | Fallar 5 veces seguidas                                 | Banner de bloqueo con cuenta atrás 15 min |
| Toggle password                | Pulsar el ojo                                           | El texto de la contraseña se muestra      |
| Recordarme                     | Marcar checkbox, login OK, cerrar y reabrir             | Usuario pre-rellenado                     |
| Enter en los campos            | Escribir y pulsar Enter                                 | Mismo efecto que el botón                 |
| IP detectada                   | Observar la barra de sesión                             | IP real o 127.0.0.1                       |
| Indicador de pasos             | Durante el login ver el panel izquierdo                 | Pasos 1→2→3 se iluminan                   |

**Con backend real** — credenciales de prueba:
```bash
# Crear usuario de prueba (ejecutar una vez)
npx ts-node -e "
  import { hashPasswd } from './backend/auth';
  import { statements_login } from './backend/db';
  hashPasswd('admin123').then(hash => {
    statements_login.crear_usuario.run({
      Usuario: 'admin', Correo: 'admin@test.com',
      Password: hash,   Ip: '0.0.0.0',
      FerchaCreacion:   new Date().toISOString(),
      FechaModificacon: new Date().toISOString(),
    });
    console.log('Usuario creado');
  });
"
```

**Sin backend (solo frontend)** — el fetch fallará y aparecerá:
> "No se pudo conectar con el servidor."
Esto es correcto. Para simular un login OK sin backend, ver sección 7.

---

## 6. Qué probar en el DASHBOARD

| Prueba                    | Pasos                                                        | Resultado esperado                         |
|---------------------------|--------------------------------------------------------------|--------------------------------------------|
| Carga inicial             | Abrir dashboard.html                                         | Tabla con 10 filas, KPIs correctos         |
| Buscar                    | Escribir "empresa a" en el buscador                          | Solo filas de Empresa A                    |
| Filtrar por producto      | Seleccionar "Dominio"                                        | Solo dominios                              |
| Filtrar por estado        | Seleccionar "Activo"                                         | Solo activos                               |
| Combinar filtros          | Dominio + Activo                                             | Intersección correcta                      |
| Ordenar columnas          | Clicar cabecera "Precio"                                     | Orden ascendente/descendente               |
| Paginación                | Añadir >8 registros y navegar                                | Páginas correctas, info actualizada        |
| Crear servicio            | Botón "Nuevo servicio" → rellenar → Guardar                  | Fila nueva en tabla, KPIs actualizados     |
| Validación modal          | Guardar con campos vacíos                                    | Error rojo en el modal                     |
| Editar servicio           | Botón lápiz → cambiar precio → Guardar                       | Fila actualizada                           |
| Eliminar servicio         | Botón papelera → confirmar                                   | Fila eliminada, KPIs actualizados          |
| Cancelar eliminación      | Botón papelera → Cancelar                                    | Nada cambia                                |
| Toast                     | Crear / editar / eliminar                                    | Notificación verde o roja aparece          |
| Badges de fecha           | Registros con fecha pasada o <30 días                        | Rojo / naranja con icono de aviso          |
| Logout                    | Botón de salir                                               | Redirige a login.html                      |
| Responsive (móvil)        | Reducir ventana a <900px                                     | Sidebar desaparece, tabla scrollable       |

---

## 7. Simular LOGIN_OK sin backend

Abre la consola del navegador en `login.html` e intercepta el fetch:

```js
// Pegar en la consola antes de hacer login
const original = window.fetch;
window.fetch = async (url, opts) => {
  if (String(url).includes('/api/auth/login')) {
    return new Response(JSON.stringify({
      status: 'LOGIN_OK', id: 1, username: 'admin', role: 1
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return original(url, opts);
};
```

Ahora cualquier credencial funciona y redirige al dashboard.

---

## 8. Compilar para producción

```bash
npm run build
# Genera dist/ con HTML, CSS y JS minificados y listos para desplegar
```
