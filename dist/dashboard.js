"use strict";
// ═══════════════════════════════════════════════════════════════════════════
//  dashboard.ts  — RenovaCloud Dashboard Controller
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
// ── Configuración (sin DOM) ────────────────────────────────────────────────
const API_BASE = '/api/servicios';
const PAGE_SIZE = 8;
// ── Arranque — TODO el código vive dentro de este listener ─────────────────
document.addEventListener('DOMContentLoaded', () => {
    var _a;
    // ── Referencias al DOM (seguras: el DOM existe aquí) ──────────────────
    const tableBody = document.getElementById('tableBody');
    const paginInfo = document.getElementById('paginInfo');
    const paginBtns = document.getElementById('paginBtns');
    const searchInput = document.getElementById('searchInput');
    const filterProducto = document.getElementById('filterProducto');
    const filterEstado = document.getElementById('filterEstado');
    const sidebarCount = document.getElementById('sidebarCount');
    const topbarDate = document.getElementById('topbarDate');
    const sidebarUser = document.getElementById('sidebarUser');
    const avatarInitial = document.getElementById('avatarInitial');
    const logoutBtn = document.getElementById('logoutBtn');
    const btnNuevo = document.getElementById('btnNuevo');
    const btnGuardar = document.getElementById('btnGuardar');
    const btnConfirmDel = document.getElementById('btnConfirmDelete');
    const modalTitle = document.getElementById('modalTitle');
    const modalError = document.getElementById('modalError');
    const deleteNombre = document.getElementById('deleteNombre');
    const toastMsg = document.getElementById('toastMsg');
    const appToast = document.getElementById('appToast');
    // ── Bootstrap instances ────────────────────────────────────────────────
    const bsModal = new bootstrap.Modal(document.getElementById('servicioModal'));
    const bsDeleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
    const bsToast = new bootstrap.Toast(appToast, { delay: 2800 });
    // ── Estado de la app ───────────────────────────────────────────────────
    let data = [];
    let filtered = [];
    let editingId = null;
    let deleteId = null;
    let sortCol = 'FechaCaducidad';
    let sortDir = 'asc';
    let currentPage = 1;
    // ── Helpers de fecha ───────────────────────────────────────────────────
    function formatDate(ts) {
        const d = new Date(ts);
        return isNaN(d.getTime())
            ? '—'
            : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    function daysUntil(ts) {
        return Math.round((new Date(ts).getTime() - Date.now()) / 86400000);
    }
    function dateClass(ts) {
        const d = daysUntil(ts);
        if (d < 0)
            return 'fecha-exp';
        if (d < 30)
            return 'fecha-warn';
        return 'fecha-ok';
    }
    function dateIcon(ts) {
        const d = daysUntil(ts);
        if (d < 0)
            return '<i class="bi bi-x-circle-fill text-danger ms-1" title="Caducado"></i>';
        if (d < 30)
            return '<i class="bi bi-exclamation-circle-fill text-warning ms-1" title="Próximo a caducar"></i>';
        return '';
    }
    function toDatetimeLocal(ts) {
        const d = new Date(ts);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    // ── Badges HTML ────────────────────────────────────────────────────────
    function estadoBadge(e) {
        const cls = {
            Activo: 'activo', Avisado: 'avisado', Renovado: 'renovado',
            Baja_Traslado: 'baja_traslado', Baja_Caducidad: 'baja_caducidad',
        };
        const ico = {
            Activo: 'bi-check-circle-fill', Avisado: 'bi-bell-fill', Renovado: 'bi-arrow-repeat',
            Baja_Traslado: 'bi-arrow-right-circle', Baja_Caducidad: 'bi-x-circle',
        };
        return `<span class="badge-estado estado-${cls[e]}"><i class="bi ${ico[e]}"></i> ${e}</span>`;
    }
    function productoBadge(p) {
        const cls = {
            Dominio: 'prod-dominio', Cert_SSL: 'prod-cert_ssl',
            Pack_alojamiento: 'prod-pack_alojamiento', Otros: 'prod-otros',
        };
        return `<span class="badge-producto ${cls[p]}">${p}</span>`;
    }
    function renovBadge(v) {
        return v
            ? `<span class="badge-renov renov-si"><i class="bi bi-check2"></i> Sí</span>`
            : `<span class="badge-renov renov-no"><i class="bi bi-x"></i> No</span>`;
    }
    function provBadge(p) {
        return `<span class="badge-prov prov-badge">${p}</span>`;
    }
    // ── Toast ──────────────────────────────────────────────────────────────
    function showToast(msg, ok = true) {
        toastMsg.textContent = msg;
        appToast.style.background = ok ? '#16a34a' : '#dc2626';
        bsToast.show();
    }
    // ── KPIs ───────────────────────────────────────────────────────────────
    function updateKPIs() {
        const activos = data.filter(s => s.Estado === 'Activo').length;
        const proximos = data.filter(s => { const d = daysUntil(s.FechaCaducidad); return d >= 0 && d < 30; }).length;
        const sinRenov = data.filter(s => s.Renovacion === 0).length;
        const totalPrecio = data.reduce((a, s) => a + s.Precio, 0);
        document.getElementById('kpiTotal').textContent = String(data.length);
        document.getElementById('kpiActivos').textContent = String(activos);
        document.getElementById('kpiProximos').textContent = String(proximos);
        document.getElementById('kpiSinRenov').textContent = String(sinRenov);
        document.getElementById('kpiTotal2').textContent = `${totalPrecio.toFixed(2)} €`;
        sidebarCount.textContent = String(data.length);
    }
    // ── Filtrar + ordenar ──────────────────────────────────────────────────
    function applyFilters() {
        const q = searchInput.value.toLowerCase().trim();
        const prd = filterProducto.value;
        const est = filterEstado.value;
        filtered = data.filter(s => (!q || s.nombre.toLowerCase().includes(q) ||
            s.Cliente.toLowerCase().includes(q) ||
            s.Mail.toLowerCase().includes(q)) &&
            (!prd || s.Producto === prd) &&
            (!est || s.Estado === est));
        filtered.sort((a, b) => {
            let va = a[sortCol];
            let vb = b[sortCol];
            if (typeof va === 'string')
                va = va.toLowerCase();
            if (typeof vb === 'string')
                vb = vb.toLowerCase();
            if (va < vb)
                return sortDir === 'asc' ? -1 : 1;
            if (va > vb)
                return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        currentPage = 1;
        render();
    }
    // ── Render tabla + paginación ──────────────────────────────────────────
    function render() {
        const total = filtered.length;
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        currentPage = Math.min(currentPage, pages);
        const start = (currentPage - 1) * PAGE_SIZE;
        const slice = filtered.slice(start, start + PAGE_SIZE);
        tableBody.innerHTML = slice.length === 0
            ? `<tr><td colspan="10"><div class="empty-state">
           <i class="bi bi-inbox"></i>
           <p>No se encontraron servicios con los filtros aplicados.</p>
         </div></td></tr>`
            : slice.map(s => `
          <tr data-id="${s.id}">
            <td class="td-nombre">${s.nombre}</td>
            <td>${productoBadge(s.Producto)}</td>
            <td class="${dateClass(s.FechaCaducidad)} td-mono">
              ${formatDate(s.FechaCaducidad)}${dateIcon(s.FechaCaducidad)}
            </td>
            <td class="td-precio">${s.Precio.toFixed(2)} €</td>
            <td>${renovBadge(s.Renovacion)}</td>
            <td>${estadoBadge(s.Estado)}</td>
            <td>
              <div style="font-weight:500;font-size:.82rem">${s.Cliente}</div>
              <div style="font-size:.75rem;color:var(--muted)">${s.Mail}</div>
            </td>
            <td>${provBadge(s.Proveedor)}</td>
            <td class="td-notas" title="${s.Notas}">${s.Notas || '—'}</td>
            <td>
              <div class="actions">
                <button class="btn-action"     data-action="edit" data-id="${s.id}" title="Editar">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn-action del" data-action="del"  data-id="${s.id}" title="Eliminar">
                  <i class="bi bi-trash3"></i>
                </button>
              </div>
            </td>
          </tr>`).join('');
        paginInfo.textContent = total
            ? `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, total)} de ${total} servicios`
            : '0 servicios';
        paginBtns.innerHTML = '';
        const mkBtn = (label, page, active, disabled) => {
            const b = document.createElement('button');
            b.className = 'pag-btn' + (active ? ' active' : '');
            b.textContent = label;
            b.disabled = disabled;
            if (!disabled && !active)
                b.addEventListener('click', () => { currentPage = page; render(); });
            return b;
        };
        paginBtns.appendChild(mkBtn('‹', currentPage - 1, false, currentPage === 1));
        for (let p = 1; p <= pages; p++)
            paginBtns.appendChild(mkBtn(String(p), p, p === currentPage, false));
        paginBtns.appendChild(mkBtn('›', currentPage + 1, false, currentPage === pages));
    }
    // ── Sort headers ───────────────────────────────────────────────────────
    document.querySelectorAll('thead th[data-col]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset['col'];
            sortDir = (sortCol === col && sortDir === 'asc') ? 'desc' : 'asc';
            sortCol = col;
            document.querySelectorAll('thead th[data-col] i')
                .forEach(i => { i.className = 'bi bi-chevron-expand'; });
            const ico = th.querySelector('i');
            if (ico)
                ico.className = sortDir === 'asc' ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
            applyFilters();
        });
    });
    // ── Row actions (delegation) ───────────────────────────────────────────
    tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn)
            return;
        const id = Number(btn.dataset['id']);
        const row = data.find(s => s.id === id);
        if (!row)
            return;
        if (btn.dataset['action'] === 'edit')
            openEdit(row);
        if (btn.dataset['action'] === 'del')
            openDelete(row);
    });
    // ── Leer formulario modal ──────────────────────────────────────────────
    function readForm() {
        const g = (id) => document.getElementById(id);
        const nombre = g('f_nombre').value.trim();
        const producto = g('f_producto').value;
        const fecha = g('f_fecha').value;
        const precio = parseFloat(g('f_precio').value);
        const renovacion = parseInt(g('f_renovacion').value, 10);
        const estado = g('f_estado').value;
        const registro = g('f_registro').value;
        const proveedor = g('f_proveedor').value;
        const cliente = g('f_cliente').value.trim();
        const contacto = g('f_contacto').value.trim();
        const mail = g('f_mail').value.trim();
        const notas = g('f_notas').value.trim();
        if (!nombre || !producto || !fecha || isNaN(precio) || !estado || !registro || !proveedor || !cliente) {
            modalError.textContent = 'Completa todos los campos obligatorios (*).';
            modalError.classList.remove('d-none');
            return null;
        }
        return { nombre, Producto: producto, FechaCaducidad: fecha, Precio: precio,
            Renovacion: renovacion, Estado: estado, Notas: notas, Registro: registro,
            Cliente: cliente, Contacto: contacto, Mail: mail, Proveedor: proveedor };
    }
    function clearForm() {
        ['f_nombre', 'f_producto', 'f_fecha', 'f_precio', 'f_estado',
            'f_registro', 'f_proveedor', 'f_cliente', 'f_contacto', 'f_mail', 'f_notas']
            .forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById('f_renovacion').value = '1';
    }
    // ── Modal: Nuevo ───────────────────────────────────────────────────────
    btnNuevo.addEventListener('click', () => {
        editingId = null;
        modalTitle.textContent = 'Nuevo Servicio';
        clearForm();
        modalError.classList.add('d-none');
        bsModal.show();
    });
    // ── Modal: Editar ──────────────────────────────────────────────────────
    function openEdit(s) {
        editingId = s.id;
        modalTitle.textContent = 'Editar Servicio';
        const g = (id) => document.getElementById(id);
        g('f_nombre').value = s.nombre;
        g('f_producto').value = s.Producto;
        g('f_fecha').value = toDatetimeLocal(s.FechaCaducidad);
        g('f_precio').value = String(s.Precio);
        g('f_renovacion').value = String(s.Renovacion);
        g('f_estado').value = s.Estado;
        g('f_registro').value = s.Registro;
        g('f_proveedor').value = s.Proveedor;
        g('f_cliente').value = s.Cliente;
        g('f_contacto').value = s.Contacto;
        g('f_mail').value = s.Mail;
        g('f_notas').value = s.Notas;
        modalError.classList.add('d-none');
        bsModal.show();
    }
    // ── Guardar ────────────────────────────────────────────────────────────
    btnGuardar.addEventListener('click', () => {
        void (() => __awaiter(void 0, void 0, void 0, function* () {
            modalError.classList.add('d-none');
            const payload = readForm();
            if (!payload)
                return;
            if (editingId !== null) {
                // TODO: await fetch(`${API_BASE}/${editingId}`, { method:'PUT', ... })
                const idx = data.findIndex(s => s.id === editingId);
                if (idx > -1)
                    data[idx] = Object.assign({ id: editingId }, payload);
                showToast('Servicio actualizado correctamente.');
            }
            else {
                // TODO: const res = await fetch(API_BASE, { method:'POST', ... })
                const newId = Math.max(0, ...data.map(s => s.id)) + 1;
                data.push(Object.assign({ id: newId }, payload));
                showToast('Servicio creado correctamente.');
            }
            bsModal.hide();
            updateKPIs();
            applyFilters();
        }))();
    });
    // ── Eliminar ───────────────────────────────────────────────────────────
    function openDelete(s) {
        deleteId = s.id;
        deleteNombre.textContent = `"${s.nombre}"`;
        bsDeleteModal.show();
    }
    btnConfirmDel.addEventListener('click', () => {
        void (() => __awaiter(void 0, void 0, void 0, function* () {
            if (deleteId === null)
                return;
            // TODO: await fetch(`${API_BASE}/${deleteId}`, { method:'DELETE', ... })
            data = data.filter(s => s.id !== deleteId);
            bsDeleteModal.hide();
            showToast('Servicio eliminado.', false);
            updateKPIs();
            applyFilters();
        }))();
    });
    // ── Logout ─────────────────────────────────────────────────────────────
    logoutBtn.addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'login.html';
    });
    // ── Filtros ────────────────────────────────────────────────────────────
    searchInput.addEventListener('input', applyFilters);
    filterProducto.addEventListener('change', applyFilters);
    filterEstado.addEventListener('change', applyFilters);
    // ── Cargar datos (mock → reemplazar por fetch real) ────────────────────
    function loadData() {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: const res = await fetch(API_BASE, { credentials: 'include' });
            //       data = await res.json() as Servicio[];
            data = [
                { id: 1, nombre: 'ejemplo.com', Producto: 'Dominio', FechaCaducidad: '2025-02-15T00:00:00', Precio: 12.50, Renovacion: 1, Estado: 'Avisado', Notas: 'Vence pronto', Registro: 'Correo_Dominio', Cliente: 'Empresa A', Contacto: 'Juan García', Mail: 'juan@a.com', Proveedor: 'Openprovider' },
                { id: 2, nombre: 'tienda-online.es', Producto: 'Dominio', FechaCaducidad: '2025-08-20T00:00:00', Precio: 9.00, Renovacion: 1, Estado: 'Activo', Notas: '', Registro: 'Correo_Dominio', Cliente: 'Empresa B', Contacto: 'Ana Martínez', Mail: 'ana@b.com', Proveedor: 'Openprovider' },
                { id: 3, nombre: 'ssl-tienda.crt', Producto: 'Cert_SSL', FechaCaducidad: '2024-11-30T00:00:00', Precio: 49.00, Renovacion: 0, Estado: 'Baja_Caducidad', Notas: 'Caducado, sin uso', Registro: 'N/A_CertPacks', Cliente: 'Empresa B', Contacto: 'Ana Martínez', Mail: 'ana@b.com', Proveedor: 'datarush' },
                { id: 4, nombre: 'hosting-pro', Producto: 'Pack_alojamiento', FechaCaducidad: '2025-12-01T00:00:00', Precio: 120.00, Renovacion: 1, Estado: 'Activo', Notas: 'Plan business', Registro: 'N/A_CertPacks', Cliente: 'Empresa C', Contacto: 'Carlos López', Mail: 'car@c.com', Proveedor: 'datarush' },
                { id: 5, nombre: 'app-movil.com', Producto: 'Dominio', FechaCaducidad: '2025-03-10T00:00:00', Precio: 11.00, Renovacion: 1, Estado: 'Renovado', Notas: 'Renovado manualmente', Registro: 'Correo_Dominio', Cliente: 'Empresa A', Contacto: 'Juan García', Mail: 'juan@a.com', Proveedor: 'Openprovider' },
                { id: 6, nombre: 'ssl-principal', Producto: 'Cert_SSL', FechaCaducidad: '2025-06-15T00:00:00', Precio: 89.00, Renovacion: 1, Estado: 'Activo', Notas: 'Wildcard', Registro: 'N/A_CertPacks', Cliente: 'Empresa D', Contacto: 'Laura Sanz', Mail: 'lau@d.com', Proveedor: 'Openprovider' },
                { id: 7, nombre: 'blog-empresa.net', Producto: 'Dominio', FechaCaducidad: '2024-09-05T00:00:00', Precio: 8.50, Renovacion: 0, Estado: 'Baja_Traslado', Notas: 'Trasladado', Registro: 'Correo_Dominio', Cliente: 'Empresa E', Contacto: 'Pedro Ruiz', Mail: 'ped@e.com', Proveedor: 'datarush' },
                { id: 8, nombre: 'pack-básico-web', Producto: 'Pack_alojamiento', FechaCaducidad: '2025-04-22T00:00:00', Precio: 60.00, Renovacion: 1, Estado: 'Avisado', Notas: '', Registro: 'N/A_CertPacks', Cliente: 'Empresa F', Contacto: 'Marta Díaz', Mail: 'mar@f.com', Proveedor: 'datarush' },
                { id: 9, nombre: 'otros-servicio', Producto: 'Otros', FechaCaducidad: '2025-10-10T00:00:00', Precio: 35.00, Renovacion: 1, Estado: 'Activo', Notas: 'Servicio personalizado', Registro: 'N/A_CertPacks', Cliente: 'Empresa G', Contacto: 'Sofía Blanco', Mail: 'sof@g.com', Proveedor: 'Openprovider' },
                { id: 10, nombre: 'dominio-test.io', Producto: 'Dominio', FechaCaducidad: '2025-05-01T00:00:00', Precio: 15.00, Renovacion: 0, Estado: 'Activo', Notas: 'Dominio de pruebas', Registro: 'Correo_Dominio', Cliente: 'Empresa H', Contacto: 'Marcos Torres', Mail: 'marc@h.com', Proveedor: 'Openprovider' },
            ];
        });
    }
    // ── Inicio ─────────────────────────────────────────────────────────────
    topbarDate.textContent = new Date().toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const user = (_a = sessionStorage.getItem('rc_user')) !== null && _a !== void 0 ? _a : 'admin';
    sidebarUser.textContent = user;
    avatarInitial.textContent = user.charAt(0).toUpperCase();
    void loadData().then(() => { updateKPIs(); applyFilters(); });
}); // fin DOMContentLoaded
