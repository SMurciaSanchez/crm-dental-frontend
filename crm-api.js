/**
 * CRM Dental UNICOC — Integración con Backend
 * Conecta el prototipo HTML con la API REST en localhost:3000
 */

const API = 'http://localhost:3000/api';

// ══════════════════════════════════════════════════════════════
// TOKEN Y SESIÓN
// ══════════════════════════════════════════════════════════════
const Auth = {
  getAccess:  () => localStorage.getItem('crm_access'),
  getRefresh: () => localStorage.getItem('crm_refresh'),
  save(access, refresh) {
    localStorage.setItem('crm_access', access);
    if (refresh) localStorage.setItem('crm_refresh', refresh);
  },
  clear() {
    localStorage.removeItem('crm_access');
    localStorage.removeItem('crm_refresh');
    localStorage.removeItem('crm_user');
  },
  saveUser(u) { localStorage.setItem('crm_user', JSON.stringify(u)); },
  getUser()   { try { return JSON.parse(localStorage.getItem('crm_user')); } catch { return null; } },
  isLogged()  { return !!this.getAccess(); },
};

// ══════════════════════════════════════════════════════════════
// CLIENTE HTTP
// ══════════════════════════════════════════════════════════════
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = Auth.getAccess();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(API + path, { ...options, headers });

  // Intentar renovar token si expiró
  if (res.status === 401 && Auth.getRefresh()) {
    const r = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: Auth.getRefresh() }),
    });
    if (r.ok) {
      const { data } = await r.json();
      Auth.save(data.accessToken, null);
      headers['Authorization'] = `Bearer ${data.accessToken}`;
      res = await fetch(API + path, { ...options, headers });
    } else {
      Auth.clear();
      location.reload();
      return;
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de red' }));
    throw Object.assign(new Error(err.error || 'Error'), { status: res.status, data: err });
  }
  return res.json();
}

const get  = (path) => api(path);
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
const patch = (path, body) => api(path, { method: 'PATCH', body: JSON.stringify(body) });
const del  = (path) => api(path, { method: 'DELETE' });

// ══════════════════════════════════════════════════════════════
// AUTH — OVERRIDE DE doLogin y doRegister
// ══════════════════════════════════════════════════════════════
window.doLogin = async function () {
  const email = document.getElementById('login-email')?.value?.trim();
  const pass  = document.getElementById('login-pass')?.value;
  const doc   = document.getElementById('login-doc')?.value?.trim();

  if (!email || !pass || !doc) {
    showToast('⚠ Completa todos los campos obligatorios');
    return;
  }

  const btn = document.querySelector('#ap-login .btn-teal');
  if (btn) { btn.disabled = true; btn.textContent = 'Ingresando...'; }

  try {
    const { data } = await post('/auth/login', { email, password: pass, numeroDocumento: doc });
    Auth.save(data.accessToken, data.refreshToken);

    // Cargar perfil
    const me = await get('/auth/me');
    Auth.saveUser(me.data);

    document.getElementById('auth-wrapper')?.classList.add('hidden');
    showToast('✅ Sesión iniciada correctamente');
    actualizarPerfil(me.data);
    cargarDashboard();
  } catch (err) {
    if (err.data?.requiresMFA) {
      showToast('🔐 Ingresa tu código MFA');
      document.getElementById('mfa-section')?.classList.remove('hidden');
    } else {
      showToast('❌ ' + (err.message || 'Credenciales inválidas'));
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Iniciar sesión →'; }
  }
};

window.doRegister = async function () {
  const nombres   = document.getElementById('reg-nombres')?.value?.trim();
  const apellidos = document.getElementById('reg-apellidos')?.value?.trim();
  const email     = document.getElementById('reg-email')?.value?.trim();
  const pass      = document.getElementById('reg-pass')?.value;
  const doc       = document.getElementById('reg-doc')?.value?.trim();
  const terms     = document.getElementById('reg-terms')?.checked;

  // Rol seleccionado
  const rolMap = { paciente: 'PACIENTE', estudiante: 'ESTUDIANTE', docente: 'DOCENTE', profesional: 'PROFESIONAL' };
  const rolEl  = document.querySelector('.role-opt.selected');
  const rolKey = rolEl?.id?.replace('role-', '') || 'paciente';
  const rol    = rolMap[rolKey] || 'PACIENTE';

  if (!nombres || !apellidos || !email || !pass || !doc) {
    showToast('⚠ Completa todos los campos obligatorios'); return;
  }
  if (!terms) { showToast('⚠ Debes aceptar los términos y condiciones'); return; }
  if (pass.length < 8) { showToast('⚠ Contraseña mínimo 8 caracteres'); return; }

  // Datos extra por rol
  const extra = {};
  if (rol === 'ESTUDIANTE') {
    extra.codigoEstudiantil = document.getElementById('reg-codigo')?.value?.trim();
    extra.semestre = parseInt(document.getElementById('reg-semestre')?.value) || 1;
  }
  if (rol === 'DOCENTE' || rol === 'PROFESIONAL') {
    extra.registroProfesional = document.getElementById('reg-registro')?.value?.trim();
    extra.especialidad = document.getElementById('reg-especialidad')?.value?.trim();
  }

  try {
    await post('/auth/register', {
      nombres, apellidos, email, password: pass,
      numeroDocumento: doc, rol, habeasData: terms, ...extra,
    });
    showAuthPanel('login');
    showToast('✅ Cuenta creada — ya puedes iniciar sesión');
  } catch (err) {
    showToast('❌ ' + (err.message || 'Error al registrar'));
  }
};

// Logout
window.doLogout = async function () {
  try { await post('/auth/logout', { refreshToken: Auth.getRefresh() }); } catch {}
  Auth.clear();
  location.reload();
};

// ══════════════════════════════════════════════════════════════
// PERFIL EN SIDEBAR
// ══════════════════════════════════════════════════════════════
function actualizarPerfil(usuario) {
  if (!usuario) return;
  const nombre = `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim();
  const rol    = usuario.rol || '';
  const initials = (usuario.nombres?.[0] || '') + (usuario.apellidos?.[0] || '');

  const nameEl = document.querySelector('.user-name');
  const roleEl = document.querySelector('.user-role');
  const avEl   = document.querySelector('.user-avatar');

  if (nameEl) nameEl.textContent = nombre;
  if (roleEl) roleEl.textContent = rol.charAt(0) + rol.slice(1).toLowerCase();
  if (avEl)   avEl.textContent   = initials.toUpperCase();
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
async function cargarDashboard() {
  try {
    const hoy = new Date().toISOString().slice(0, 10);

    const [citasHoy, pacientes, facStats] = await Promise.allSettled([
      get(`/citas/agenda?fechaInicio=${hoy}&fechaFin=${hoy}`),
      get('/pacientes?limit=1'),
      get('/facturacion/stats/resumen'),
    ]);

    const statVals = document.querySelectorAll('#p-dashboard .stat-val');
    if (statVals[0] && citasHoy.status === 'fulfilled')
      statVals[0].textContent = citasHoy.value?.data?.length ?? '—';
    if (statVals[1] && pacientes.status === 'fulfilled')
      statVals[1].textContent = pacientes.value?.meta?.total ?? '—';
    if (statVals[3] && facStats.status === 'fulfilled') {
      const val = facStats.value?.data?.recaudadoMes ?? 0;
      statVals[3].textContent = '$' + formatCOP(val);
    }

    // Citas de hoy en dashboard
    if (citasHoy.status === 'fulfilled') {
      const lista = document.querySelector('#p-dashboard .cita-list');
      if (lista) renderCitasList(lista, citasHoy.value?.data || []);
    }
  } catch (err) {
    console.warn('Dashboard parcial:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// PACIENTES
// ══════════════════════════════════════════════════════════════
async function cargarPacientes() {
  try {
    const { data, meta } = await get('/pacientes?limit=20');

    // Actualizar contador
    const contador = document.querySelector('#p-pacientes .sc-head span');
    if (contador) contador.textContent = `${meta.total} registros`;

    const tbody = document.querySelector('#p-pacientes .list-table tbody');
    if (!tbody) return;

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--t3);padding:24px;">Sin pacientes registrados</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(p => {
      const u = p.usuario || {};
      const ultimaCita = p.citas?.[0]?.fecha
        ? new Date(p.citas[0].fecha).toLocaleDateString('es-CO')
        : '—';
      const hcEstado = p.historias?.[0]?.estado || '—';
      const chipClass = hcEstado === 'ACTIVA' ? 'chip-teal' : hcEstado === 'PENDIENTE_FIRMA' ? 'chip-yellow' : 'chip-blue';
      const hcLabel   = hcEstado === 'ACTIVA' ? 'ACTIVA' : hcEstado === 'PENDIENTE_FIRMA' ? 'PEND. FIRMA' : hcEstado === 'CERRADA' ? 'CERRADA' : '—';

      return `<tr>
        <td>
          <div style="font-weight:600;">${u.nombres || ''} ${u.apellidos || ''}</div>
          <div style="font-size:11px;color:var(--t3);">${u.email || ''}</div>
        </td>
        <td>${u.tipoDocumento || 'CC'} ${u.numeroDocumento || ''}</td>
        <td>${p.eps || '—'}</td>
        <td>${ultimaCita}</td>
        <td><span class="chip ${chipClass}">${hcLabel}</span></td>
        <td class="actions">
          <button class="action-btn" onclick="openModal('modal-historia')">Historia</button>
          <button class="action-btn" onclick="openModal('modal-cita')">Cita</button>
        </td>
      </tr>`;
    }).join('');

    // Buscador
    const buscador = document.querySelector('#p-pacientes input[type="text"]');
    if (buscador) {
      buscador.addEventListener('input', debounce(async (e) => {
        const q = e.target.value.trim();
        const res = await get(`/pacientes?limit=20${q ? '&q=' + encodeURIComponent(q) : ''}`);
        if (res?.data) {
          const t = document.querySelector('#p-pacientes .list-table tbody');
          if (t) t.innerHTML = res.data.map(p => {
            const u = p.usuario || {};
            return `<tr>
              <td><div style="font-weight:600;">${u.nombres || ''} ${u.apellidos || ''}</div>
              <div style="font-size:11px;color:var(--t3);">${u.email || ''}</div></td>
              <td>${u.tipoDocumento || 'CC'} ${u.numeroDocumento || ''}</td>
              <td>${p.eps || '—'}</td><td>—</td>
              <td><span class="chip chip-teal">—</span></td>
              <td class="actions"><button class="action-btn">Historia</button><button class="action-btn">Cita</button></td>
            </tr>`;
          }).join('');
        }
      }, 400));
    }
  } catch (err) {
    console.error('Error cargando pacientes:', err);
    showToast('❌ No se pudieron cargar los pacientes');
  }
}

// ══════════════════════════════════════════════════════════════
// AGENDA / CITAS
// ══════════════════════════════════════════════════════════════
async function cargarAgenda() {
  try {
    const hoy = new Date();
    const inicio = hoy.toISOString().slice(0, 10);
    const fin = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data } = await get(`/citas/agenda?fechaInicio=${inicio}&fechaFin=${fin}`);

    // Lista de citas del día
    const listaEl = document.querySelector('#p-agenda .cita-list');
    if (listaEl) renderCitasList(listaEl, data.filter(c => c.fecha?.slice(0, 10) === inicio));

    // Marcar días con citas en el calendario
    const fechasConCitas = new Set(data.map(c => new Date(c.fecha).getDate()));
    document.querySelectorAll('#p-agenda .cal-day').forEach(el => {
      const num = parseInt(el.querySelector('.cal-day-num')?.textContent);
      if (fechasConCitas.has(num)) el.classList.add('has-cita');
    });
  } catch (err) {
    console.warn('Error agenda:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// HISTORIAS CLÍNICAS
// ══════════════════════════════════════════════════════════════
async function cargarHistorias() {
  try {
    const { data } = await get('/historias?limit=20');
    const tbody = document.querySelector('#p-historias table tbody');
    if (!tbody || !data) return;

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--t3);padding:24px;">Sin historias clínicas</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(h => {
      const u = h.paciente?.usuario || {};
      const estado = h.estado || '';
      const chipClass = estado === 'ACTIVA' ? 'chip-teal' : estado === 'PENDIENTE_FIRMA' ? 'chip-yellow' : 'chip-orange';
      const estadoLabel = estado === 'ACTIVA' ? 'ACTIVA' : estado === 'PENDIENTE_FIRMA' ? 'PEND. FIRMA' : estado;
      return `<tr>
        <td><code>${h.codigo}</code></td>
        <td>${u.nombres || ''} ${u.apellidos || ''}</td>
        <td>${new Date(h.fechaApertura).toLocaleDateString('es-CO')}</td>
        <td><span class="chip ${chipClass}">${estadoLabel}</span></td>
        <td>${h.docenteFirmante ? `${h.docenteFirmante.usuario?.nombres || ''} ${h.docenteFirmante.usuario?.apellidos || ''}` : '—'}</td>
        <td class="actions">
          <button class="action-btn" onclick="openModal('modal-historia')">Ver</button>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.warn('Error historias:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// PRESCRIPCIONES
// ══════════════════════════════════════════════════════════════
async function cargarPrescripciones() {
  try {
    const { data } = await get('/prescripciones?limit=20');
    const tbody = document.querySelector('#p-prescripciones table tbody');
    if (!tbody || !data) return;

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--t3);padding:24px;">Sin prescripciones</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(p => {
      const u = p.historia?.paciente?.usuario || {};
      return `<tr>
        <td>${u.nombres || ''} ${u.apellidos || ''}</td>
        <td>${p.historia?.codigo || '—'}</td>
        <td><span class="enc-b">ENC</span> ${p.medicamento || '—'}</td>
        <td><span class="enc-b">ENC</span> ${p.dosis || '—'}</td>
        <td>${p.duracion}</td>
        <td>${p.indicaciones || '—'}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.warn('Error prescripciones:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// FACTURACIÓN
// ══════════════════════════════════════════════════════════════
async function cargarFacturacion() {
  try {
    const [facturas, stats] = await Promise.allSettled([
      get('/facturacion?limit=10'),
      get('/facturacion/stats/resumen'),
    ]);

    // Stats
    if (stats.status === 'fulfilled') {
      const d = stats.value?.data || {};
      const statVals = document.querySelectorAll('#p-facturacion .stat-val');
      if (statVals[0]) statVals[0].textContent = '$' + formatCOP(d.recaudadoMes || 0);
      if (statVals[3]) statVals[3].textContent = d.facturasPagadas ?? '—';
    }

    // Tabla
    if (facturas.status === 'fulfilled') {
      const { data } = facturas.value;
      const tbody = document.querySelector('#p-facturacion table tbody');
      if (tbody && data) {
        tbody.innerHTML = data.map(f => {
          const u = f.cita?.paciente?.usuario || {};
          const chipClass = f.estado === 'PAGADA' ? 'chip-teal' : f.estado === 'PENDIENTE' ? 'chip-yellow' : 'chip-red';
          return `<tr>
            <td><code>${f.numero}</code></td>
            <td>${u.nombres || ''} ${u.apellidos || ''}</td>
            <td>$${formatCOP(f.total)}</td>
            <td><span class="chip ${chipClass}">${f.estado}</span></td>
            <td>${new Date(f.createdAt).toLocaleDateString('es-CO')}</td>
          </tr>`;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('Error facturación:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// INVENTARIO
// ══════════════════════════════════════════════════════════════
async function cargarInventario() {
  try {
    const { data, meta } = await get('/inventario?limit=20');
    const statVals = document.querySelectorAll('#p-inventario .stat-val');
    if (statVals[0]) statVals[0].textContent = meta?.total ?? '—';
    if (statVals[1]) statVals[1].textContent = data?.filter(i => i.esCritico)?.length ?? '—';

    const tbody = document.querySelector('#p-inventario table tbody');
    if (tbody && data) {
      tbody.innerHTML = data.map(i => `<tr>
        <td>${i.nombre} ${i.esCritico ? '<span style="color:var(--red);font-size:10px;">⚠ CRÍTICO</span>' : ''}</td>
        <td>${i.stockActual}</td>
        <td>${i.stockMinimo}</td>
        <td>${i.unidadMedida}</td>
        <td>$${formatCOP(i.precioUnitario)}</td>
        <td class="actions">
          <button class="action-btn" onclick="showToast('🔄 Función disponible en la API')">Usar</button>
          <button class="action-btn" onclick="showToast('📦 Función disponible en la API')">Restock</button>
        </td>
      </tr>`).join('');
    }
  } catch (err) {
    console.warn('Error inventario:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// MULTIMEDIA
// ══════════════════════════════════════════════════════════════
async function cargarMultimedia() {
  try {
    const { data } = await get('/multimedia');
    const tbody = document.querySelector('#p-multimedia table tbody');
    if (tbody && data) {
      if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--t3);padding:24px;">Sin archivos</td></tr>';
        return;
      }
      tbody.innerHTML = data.map(a => `<tr>
        <td><b>${a.nombre}</b></td>
        <td>${a.historiaId?.slice(0, 8) || '—'}...</td>
        <td><span class="chip chip-teal">${a.tipo}</span></td>
        <td>${formatBytes(a.tamanioBytes)}</td>
        <td>—</td>
        <td>${new Date(a.createdAt).toLocaleDateString('es-CO')}</td>
      </tr>`).join('');
    }
  } catch (err) {
    console.warn('Error multimedia:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// SEGURIDAD
// ══════════════════════════════════════════════════════════════
async function cargarSeguridad() {
  try {
    const [logs, stats] = await Promise.allSettled([
      get('/seguridad/logs?limit=10'),
      get('/seguridad/stats'),
    ]);

    if (stats.status === 'fulfilled') {
      const d = stats.value?.data || {};
      const statVals = document.querySelectorAll('#p-seguridad .stat-val');
      if (statVals[0]) statVals[0].textContent = d.sesionesActivas ?? '—';
      if (statVals[1]) statVals[1].textContent = d.logsHoy ?? '—';
    }

    if (logs.status === 'fulfilled') {
      const { data } = logs.value;
      const tbody = document.querySelector('#p-seguridad table tbody');
      if (tbody && data) {
        tbody.innerHTML = data.map(l => `<tr>
          <td>${l.usuario ? `${l.usuario.nombres || ''} ${l.usuario.apellidos || ''}` : 'Sistema'}</td>
          <td>${l.accion}</td>
          <td>${l.recurso}</td>
          <td>${l.ipAddress || '—'}</td>
          <td><span class="chip ${l.exitoso ? 'chip-teal' : 'chip-red'}">${l.exitoso ? 'ÉXITO' : 'FALLO'}</span></td>
          <td>${new Date(l.fecha).toLocaleString('es-CO')}</td>
        </tr>`).join('');
      }
    }
  } catch (err) {
    console.warn('Error seguridad:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// HOOK DE NAVEGACIÓN — cargar datos al cambiar de página
// ══════════════════════════════════════════════════════════════
const _goToOriginal = window.goTo;
window.goTo = function (key, el) {
  _goToOriginal(key, el);
  if (!Auth.isLogged()) return;
  const loaders = {
    dashboard:     cargarDashboard,
    pacientes:     cargarPacientes,
    agenda:        cargarAgenda,
    historias:     cargarHistorias,
    prescripciones:cargarPrescripciones,
    facturacion:   cargarFacturacion,
    inventario:    cargarInventario,
    multimedia:    cargarMultimedia,
    seguridad:     cargarSeguridad,
  };
  loaders[key]?.();
};

// ══════════════════════════════════════════════════════════════
// HELPERS DE RENDER
// ══════════════════════════════════════════════════════════════
const ESTADO_COLOR = {
  CONFIRMADA: 'var(--teal)',
  PENDIENTE:  'var(--yellow)',
  EN_CURSO:   'var(--blue)',
  COMPLETADA: 'var(--green)',
  CANCELADA:  'var(--red)',
  NO_ASISTIO: 'var(--orange)',
};
const ESTADO_BADGE = {
  CONFIRMADA: 'badge-confirmada',
  PENDIENTE:  'badge-pendiente',
  EN_CURSO:   'badge-encurso',
  COMPLETADA: 'badge-completada',
  CANCELADA:  'badge-cancelada',
  NO_ASISTIO: 'badge-cancelada',
};

function renderCitasList(container, citas) {
  if (!citas.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t3);">Sin citas para hoy</div>';
    return;
  }
  container.innerHTML = citas.slice(0, 8).map(c => {
    const u = c.paciente?.usuario || {};
    const proc = c.procedimiento?.nombre || c.motivo || 'Consulta';
    const cons = c.consultorio ? `Cons. ${c.consultorio.numero}` : '';
    return `<div class="cita-item">
      <div class="cita-color" style="background:${ESTADO_COLOR[c.estado] || 'var(--teal)'}"></div>
      <div class="cita-time">${c.horaInicio}<span>${c.procedimiento?.duracionMin ?? '—'} min</span></div>
      <div class="cita-info">
        <div class="cita-paciente">${u.nombres || ''} ${u.apellidos || ''}</div>
        <div class="cita-proc">🦷 ${proc} ${cons ? '— ' + cons : ''}</div>
      </div>
      <span class="cita-badge ${ESTADO_BADGE[c.estado] || 'badge-pendiente'}">${c.estado}</span>
    </div>`;
  }).join('');
}

function formatCOP(val) {
  const n = Number(val);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return n.toLocaleString('es-CO');
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes > 1_000_000) return (bytes / 1_000_000).toFixed(1) + ' MB';
  return (bytes / 1_000).toFixed(0) + ' KB';
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ══════════════════════════════════════════════════════════════
// INICIO: si ya hay sesión activa, cargar directo al dashboard
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  if (Auth.isLogged()) {
    document.getElementById('auth-wrapper')?.classList.add('hidden');
    const user = Auth.getUser();
    if (user) actualizarPerfil(user);
    cargarDashboard();
  }

  // Botón de cerrar sesión (si existe en el sidebar)
  const logoutBtn = document.querySelector('.sidebar-footer .user-pill');
  if (logoutBtn) {
    logoutBtn.title = 'Click derecho → Cerrar sesión';
    logoutBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm('¿Cerrar sesión?')) doLogout();
    });
  }
});
