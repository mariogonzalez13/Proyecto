// ═══════════════════════════════════════════════════════════════════════════
//  dashboard.ts  — RenovaCloud Dashboard Controller
//  strict: true  |  target: ES2020  |  lib: DOM, ES2020
// ═══════════════════════════════════════════════════════════════════════════

// ── Tipos Bootstrap (eliminar si tienes @types/bootstrap instalado) ────────
declare namespace bootstrap {
  class Modal {
    constructor(el: HTMLElement, opts?: { backdrop?: boolean | 'static'; keyboard?: boolean });
    show(): void; hide(): void; dispose(): void;
  }
  class Toast {
    constructor(el: HTMLElement, opts?: { delay?: number; autohide?: boolean });
    show(): void; hide(): void; dispose(): void;
  }
}

// ── Tipos — tabla Servicios ────────────────────────────────────────────────
type Producto  = 'Dominio' | 'Cert_SSL' | 'Pack_alojamiento' | 'Otros';
type Estado    = 'Activo'  | 'Avisado'  | 'Renovado' | 'Baja_Traslado' | 'Baja_Caducidad';
type Registro  = 'N/A_CertPacks' | 'Correo_Dominio';
type Proveedor = 'Openprovider'  | 'datarush';
type SortDir   = 'asc' | 'desc';

interface Servicio {
  id:             number;
  nombre:         string;
  Producto:       Producto;
  FechaCaducidad: string;
  Precio:         number;
  Renovacion:     0 | 1;
  Estado:         Estado;
  Notas:          string;
  Registro:       Registro;
  Cliente:        string;
  Contacto:       string;
  Mail:           string;
  Proveedor:      Proveedor;
}
type ServicioPayload = Omit<Servicio, 'id'>;
type SortCol = keyof Servicio;

// ── Configuración (sin DOM) ────────────────────────────────────────────────
const API_BASE  = '/api/servicios';
const PAGE_SIZE = 8;

// ── Arranque — TODO el código vive dentro de este listener ─────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── Referencias al DOM (seguras: el DOM existe aquí) ──────────────────
  const tableBody     = document.getElementById('tableBody')     as HTMLTableSectionElement;
  const paginInfo     = document.getElementById('paginInfo')     as HTMLElement;
  const paginBtns     = document.getElementById('paginBtns')     as HTMLElement;
  const searchInput   = document.getElementById('searchInput')   as HTMLInputElement;
  const filterProducto= document.getElementById('filterProducto')as HTMLSelectElement;
  const filterEstado  = document.getElementById('filterEstado')  as HTMLSelectElement;
  const sidebarCount  = document.getElementById('sidebarCount')  as HTMLElement;
  const topbarDate    = document.getElementById('topbarDate')    as HTMLElement;
  const sidebarUser   = document.getElementById('sidebarUser')   as HTMLElement;
  const avatarInitial = document.getElementById('avatarInitial') as HTMLElement;
  const logoutBtn     = document.getElementById('logoutBtn')     as HTMLButtonElement;
  const btnNuevo      = document.getElementById('btnNuevo')      as HTMLButtonElement;
  const btnGuardar    = document.getElementById('btnGuardar')    as HTMLButtonElement;
  const btnConfirmDel = document.getElementById('btnConfirmDelete') as HTMLButtonElement;
  const modalTitle    = document.getElementById('modalTitle')    as HTMLElement;
  const modalError    = document.getElementById('modalError')    as HTMLElement;
  const deleteNombre  = document.getElementById('deleteNombre')  as HTMLElement;
  const toastMsg      = document.getElementById('toastMsg')      as HTMLElement;
  const appToast      = document.getElementById('appToast')      as HTMLElement;

  // ── Bootstrap instances ────────────────────────────────────────────────
  const bsModal       = new bootstrap.Modal(document.getElementById('servicioModal') as HTMLElement);
  const bsDeleteModal = new bootstrap.Modal(document.getElementById('deleteModal')   as HTMLElement);
  const bsToast       = new bootstrap.Toast(appToast, { delay: 2800 });

  // ── Estado de la app ───────────────────────────────────────────────────
  let data:        Servicio[] = [];
  let filtered:    Servicio[] = [];
  let editingId:   number | null = null;
  let deleteId:    number | null = null;
  let sortCol:     SortCol = 'FechaCaducidad';
  let sortDir:     SortDir = 'asc';
  let currentPage: number  = 1;

  // ── Helpers de fecha ───────────────────────────────────────────────────
  function formatDate(ts: string): string {
    const d = new Date(ts);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function daysUntil(ts: string): number {
    return Math.round((new Date(ts).getTime() - Date.now()) / 86_400_000);
  }
  function dateClass(ts: string): string {
    const d = daysUntil(ts);
    if (d < 0)  return 'fecha-exp';
    if (d < 30) return 'fecha-warn';
    return 'fecha-ok';
  }
  function dateIcon(ts: string): string {
    const d = daysUntil(ts);
    if (d < 0)  return '<i class="bi bi-x-circle-fill text-danger ms-1" title="Caducado"></i>';
    if (d < 30) return '<i class="bi bi-exclamation-circle-fill text-warning ms-1" title="Próximo a caducar"></i>';
    return '';
  }
  function toDatetimeLocal(ts: string): string {
    const d   = new Date(ts);
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ── Badges HTML ────────────────────────────────────────────────────────
  function estadoBadge(e: Estado): string {
    const cls: Record<Estado, string> = {
      Activo:'activo', Avisado:'avisado', Renovado:'renovado',
      Baja_Traslado:'baja_traslado', Baja_Caducidad:'baja_caducidad',
    };
    const ico: Record<Estado, string> = {
      Activo:'bi-check-circle-fill', Avisado:'bi-bell-fill', Renovado:'bi-arrow-repeat',
      Baja_Traslado:'bi-arrow-right-circle', Baja_Caducidad:'bi-x-circle',
    };
    return `<span class="badge-estado estado-${cls[e]}"><i class="bi ${ico[e]}"></i> ${e}</span>`;
  }
  function productoBadge(p: Producto): string {
    const cls: Record<Producto, string> = {
      Dominio:'prod-dominio', Cert_SSL:'prod-cert_ssl',
      Pack_alojamiento:'prod-pack_alojamiento', Otros:'prod-otros',
    };
    return `<span class="badge-producto ${cls[p]}">${p}</span>`;
  }
  function renovBadge(v: 0 | 1): string {
    return v
      ? `<span class="badge-renov renov-si"><i class="bi bi-check2"></i> Sí</span>`
      : `<span class="badge-renov renov-no"><i class="bi bi-x"></i> No</span>`;
  }
  function provBadge(p: Proveedor): string {
    return `<span class="badge-prov prov-badge">${p}</span>`;
  }

  // ── Toast ──────────────────────────────────────────────────────────────
  function showToast(msg: string, ok = true): void {
    toastMsg.textContent       = msg;
    appToast.style.background  = ok ? '#16a34a' : '#dc2626';
    bsToast.show();
  }

  // ── KPIs ───────────────────────────────────────────────────────────────
  function updateKPIs(): void {
    const activos     = data.filter(s => s.Estado === 'Activo').length;
    const proximos    = data.filter(s => { const d = daysUntil(s.FechaCaducidad); return d >= 0 && d < 30; }).length;
    const sinRenov    = data.filter(s => s.Renovacion === 0).length;
    const totalPrecio = data.reduce((a, s) => a + s.Precio, 0);
    (document.getElementById('kpiTotal')    as HTMLElement).textContent = String(data.length);
    (document.getElementById('kpiActivos')  as HTMLElement).textContent = String(activos);
    (document.getElementById('kpiProximos') as HTMLElement).textContent = String(proximos);
    (document.getElementById('kpiSinRenov') as HTMLElement).textContent = String(sinRenov);
    (document.getElementById('kpiTotal2')   as HTMLElement).textContent = `${totalPrecio.toFixed(2)} €`;
    sidebarCount.textContent = String(data.length);
  }

  // ── Filtrar + ordenar ──────────────────────────────────────────────────
  function applyFilters(): void {
    const q   = searchInput.value.toLowerCase().trim();
    const prd = filterProducto.value as Producto | '';
    const est = filterEstado.value   as Estado   | '';

    filtered = data.filter(s =>
      (!q   || s.nombre.toLowerCase().includes(q)  ||
               s.Cliente.toLowerCase().includes(q) ||
               s.Mail.toLowerCase().includes(q))   &&
      (!prd || s.Producto === prd)                 &&
      (!est || s.Estado   === est)
    );

    filtered.sort((a, b) => {
      let va: string | number = a[sortCol] as string | number;
      let vb: string | number = b[sortCol] as string | number;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 :  1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

    currentPage = 1;
    render();
  }

  // ── Render tabla + paginación ──────────────────────────────────────────
  function render(): void {
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
    const mkBtn = (label: string, page: number, active: boolean, disabled: boolean): HTMLButtonElement => {
      const b = document.createElement('button');
      b.className   = 'pag-btn' + (active ? ' active' : '');
      b.textContent = label;
      b.disabled    = disabled;
      if (!disabled && !active) b.addEventListener('click', () => { currentPage = page; render(); });
      return b;
    };
    paginBtns.appendChild(mkBtn('‹', currentPage - 1, false, currentPage === 1));
    for (let p = 1; p <= pages; p++) paginBtns.appendChild(mkBtn(String(p), p, p === currentPage, false));
    paginBtns.appendChild(mkBtn('›', currentPage + 1, false, currentPage === pages));
  }

  // ── Sort headers ───────────────────────────────────────────────────────
  document.querySelectorAll<HTMLTableCellElement>('thead th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset['col'] as SortCol;
      sortDir = (sortCol === col && sortDir === 'asc') ? 'desc' : 'asc';
      sortCol = col;
      document.querySelectorAll<HTMLElement>('thead th[data-col] i')
        .forEach(i => { i.className = 'bi bi-chevron-expand'; });
      const ico = th.querySelector('i');
      if (ico) ico.className = sortDir === 'asc' ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
      applyFilters();
    });
  });

  // ── Row actions (delegation) ───────────────────────────────────────────
  tableBody.addEventListener('click', (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const id  = Number(btn.dataset['id']);
    const row = data.find(s => s.id === id);
    if (!row) return;
    if (btn.dataset['action'] === 'edit') openEdit(row);
    if (btn.dataset['action'] === 'del')  openDelete(row);
  });

  // ── Leer formulario modal ──────────────────────────────────────────────
  function readForm(): ServicioPayload | null {
    const g = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
    const nombre     = g<HTMLInputElement>('f_nombre').value.trim();
    const producto   = g<HTMLSelectElement>('f_producto').value   as Producto;
    const fecha      = g<HTMLInputElement>('f_fecha').value;
    const precio     = parseFloat(g<HTMLInputElement>('f_precio').value);
    const renovacion = parseInt(g<HTMLSelectElement>('f_renovacion').value, 10) as 0 | 1;
    const estado     = g<HTMLSelectElement>('f_estado').value     as Estado;
    const registro   = g<HTMLSelectElement>('f_registro').value   as Registro;
    const proveedor  = g<HTMLSelectElement>('f_proveedor').value  as Proveedor;
    const cliente    = g<HTMLInputElement>('f_cliente').value.trim();
    const contacto   = g<HTMLInputElement>('f_contacto').value.trim();
    const mail       = g<HTMLInputElement>('f_mail').value.trim();
    const notas      = g<HTMLTextAreaElement>('f_notas').value.trim();

    if (!nombre || !producto || !fecha || isNaN(precio) || !estado || !registro || !proveedor || !cliente) {
      modalError.textContent = 'Completa todos los campos obligatorios (*).';
      modalError.classList.remove('d-none');
      return null;
    }
    return { nombre, Producto:producto, FechaCaducidad:fecha, Precio:precio,
             Renovacion:renovacion, Estado:estado, Notas:notas, Registro:registro,
             Cliente:cliente, Contacto:contacto, Mail:mail, Proveedor:proveedor };
  }

  function clearForm(): void {
    ['f_nombre','f_producto','f_fecha','f_precio','f_estado',
     'f_registro','f_proveedor','f_cliente','f_contacto','f_mail','f_notas']
      .forEach(id => { (document.getElementById(id) as HTMLInputElement).value = ''; });
    (document.getElementById('f_renovacion') as HTMLSelectElement).value = '1';
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
  function openEdit(s: Servicio): void {
    editingId = s.id;
    modalTitle.textContent = 'Editar Servicio';
    const g = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
    g<HTMLInputElement>('f_nombre').value         = s.nombre;
    g<HTMLSelectElement>('f_producto').value      = s.Producto;
    g<HTMLInputElement>('f_fecha').value          = toDatetimeLocal(s.FechaCaducidad);
    g<HTMLInputElement>('f_precio').value         = String(s.Precio);
    g<HTMLSelectElement>('f_renovacion').value    = String(s.Renovacion);
    g<HTMLSelectElement>('f_estado').value        = s.Estado;
    g<HTMLSelectElement>('f_registro').value      = s.Registro;
    g<HTMLSelectElement>('f_proveedor').value     = s.Proveedor;
    g<HTMLInputElement>('f_cliente').value        = s.Cliente;
    g<HTMLInputElement>('f_contacto').value       = s.Contacto;
    g<HTMLInputElement>('f_mail').value           = s.Mail;
    g<HTMLTextAreaElement>('f_notas').value       = s.Notas;
    modalError.classList.add('d-none');
    bsModal.show();
  }

  // ── Guardar ────────────────────────────────────────────────────────────
  btnGuardar.addEventListener('click', () => {
    void (async () => {
      modalError.classList.add('d-none');
      const payload = readForm();
      if (!payload) return;

      if (editingId !== null) {
        // TODO: await fetch(`${API_BASE}/${editingId}`, { method:'PUT', ... })
        const idx = data.findIndex(s => s.id === editingId);
        if (idx > -1) data[idx] = { id: editingId, ...payload };
        showToast('Servicio actualizado correctamente.');
      } else {
        // TODO: const res = await fetch(API_BASE, { method:'POST', ... })
        const newId = Math.max(0, ...data.map(s => s.id)) + 1;
        data.push({ id: newId, ...payload });
        showToast('Servicio creado correctamente.');
      }

      bsModal.hide();
      updateKPIs();
      applyFilters();
    })();
  });

  // ── Eliminar ───────────────────────────────────────────────────────────
  function openDelete(s: Servicio): void {
    deleteId = s.id;
    deleteNombre.textContent = `"${s.nombre}"`;
    bsDeleteModal.show();
  }

  btnConfirmDel.addEventListener('click', () => {
    void (async () => {
      if (deleteId === null) return;
      // TODO: await fetch(`${API_BASE}/${deleteId}`, { method:'DELETE', ... })
      data = data.filter(s => s.id !== deleteId);
      bsDeleteModal.hide();
      showToast('Servicio eliminado.', false);
      updateKPIs();
      applyFilters();
    })();
  });

  // ── Logout ─────────────────────────────────────────────────────────────
  logoutBtn.addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'login.html';
  });

  // ── Filtros ────────────────────────────────────────────────────────────
  searchInput.addEventListener('input',    applyFilters);
  filterProducto.addEventListener('change', applyFilters);
  filterEstado.addEventListener('change',   applyFilters);

  // ── Cargar datos (mock → reemplazar por fetch real) ────────────────────
  async function loadData(): Promise<void> {
    // TODO: const res = await fetch(API_BASE, { credentials: 'include' });
    //       data = await res.json() as Servicio[];
    data = [
      { id:1,  nombre:'ejemplo.com',      Producto:'Dominio',          FechaCaducidad:'2025-02-15T00:00:00', Precio:12.50,  Renovacion:1, Estado:'Avisado',        Notas:'Vence pronto',           Registro:'Correo_Dominio', Cliente:'Empresa A', Contacto:'Juan García',   Mail:'juan@a.com',   Proveedor:'Openprovider' },
      { id:2,  nombre:'tienda-online.es', Producto:'Dominio',          FechaCaducidad:'2025-08-20T00:00:00', Precio:9.00,   Renovacion:1, Estado:'Activo',         Notas:'',                       Registro:'Correo_Dominio', Cliente:'Empresa B', Contacto:'Ana Martínez',  Mail:'ana@b.com',    Proveedor:'Openprovider' },
      { id:3,  nombre:'ssl-tienda.crt',   Producto:'Cert_SSL',         FechaCaducidad:'2024-11-30T00:00:00', Precio:49.00,  Renovacion:0, Estado:'Baja_Caducidad', Notas:'Caducado, sin uso',      Registro:'N/A_CertPacks',  Cliente:'Empresa B', Contacto:'Ana Martínez',  Mail:'ana@b.com',    Proveedor:'datarush' },
      { id:4,  nombre:'hosting-pro',      Producto:'Pack_alojamiento', FechaCaducidad:'2025-12-01T00:00:00', Precio:120.00, Renovacion:1, Estado:'Activo',         Notas:'Plan business',          Registro:'N/A_CertPacks',  Cliente:'Empresa C', Contacto:'Carlos López',  Mail:'car@c.com',    Proveedor:'datarush' },
      { id:5,  nombre:'app-movil.com',    Producto:'Dominio',          FechaCaducidad:'2025-03-10T00:00:00', Precio:11.00,  Renovacion:1, Estado:'Renovado',       Notas:'Renovado manualmente',   Registro:'Correo_Dominio', Cliente:'Empresa A', Contacto:'Juan García',   Mail:'juan@a.com',   Proveedor:'Openprovider' },
      { id:6,  nombre:'ssl-principal',    Producto:'Cert_SSL',         FechaCaducidad:'2025-06-15T00:00:00', Precio:89.00,  Renovacion:1, Estado:'Activo',         Notas:'Wildcard',               Registro:'N/A_CertPacks',  Cliente:'Empresa D', Contacto:'Laura Sanz',    Mail:'lau@d.com',    Proveedor:'Openprovider' },
      { id:7,  nombre:'blog-empresa.net', Producto:'Dominio',          FechaCaducidad:'2024-09-05T00:00:00', Precio:8.50,   Renovacion:0, Estado:'Baja_Traslado',  Notas:'Trasladado',             Registro:'Correo_Dominio', Cliente:'Empresa E', Contacto:'Pedro Ruiz',    Mail:'ped@e.com',    Proveedor:'datarush' },
      { id:8,  nombre:'pack-básico-web',  Producto:'Pack_alojamiento', FechaCaducidad:'2025-04-22T00:00:00', Precio:60.00,  Renovacion:1, Estado:'Avisado',        Notas:'',                       Registro:'N/A_CertPacks',  Cliente:'Empresa F', Contacto:'Marta Díaz',    Mail:'mar@f.com',    Proveedor:'datarush' },
      { id:9,  nombre:'otros-servicio',   Producto:'Otros',            FechaCaducidad:'2025-10-10T00:00:00', Precio:35.00,  Renovacion:1, Estado:'Activo',         Notas:'Servicio personalizado', Registro:'N/A_CertPacks',  Cliente:'Empresa G', Contacto:'Sofía Blanco',  Mail:'sof@g.com',    Proveedor:'Openprovider' },
      { id:10, nombre:'dominio-test.io',  Producto:'Dominio',          FechaCaducidad:'2025-05-01T00:00:00', Precio:15.00,  Renovacion:0, Estado:'Activo',         Notas:'Dominio de pruebas',     Registro:'Correo_Dominio', Cliente:'Empresa H', Contacto:'Marcos Torres', Mail:'marc@h.com',   Proveedor:'Openprovider' },
    ];
  }

  // ── Inicio ─────────────────────────────────────────────────────────────
  topbarDate.textContent = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const user = sessionStorage.getItem('rc_user') ?? 'admin';
  sidebarUser.textContent   = user;
  avatarInitial.textContent = user.charAt(0).toUpperCase();

  void loadData().then(() => { updateKPIs(); applyFilters(); });

}); // fin DOMContentLoaded