import { api, sesion, guardarToken } from './api.js';
import { INFO, crear, elegir, robar, libre, elegirSpider, repartir, clicKl, robarKl } from './juegos.js';

const $ = s => document.querySelector(s);
const el = (tag, txt = '', cls = '') => Object.assign(document.createElement(tag), { textContent: txt, className: cls });
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const RANGOS = 'A 2 3 4 5 6 7 8 9 10 J Q K'.split(' '), PALOS = ['♠', '♥', '♦', '♣'];
const DESC = {
  klondike: ['♠', 'El clásico solitario de siete columnas.'],
  spider: ['🕷️', 'Ordena ocho secuencias de K a A.'],
  piramide: ['🔺', 'Suma 13 y despeja la pirámide.'],
  tripeaks: ['⛰️', 'Encadena cartas consecutivas en tres picos.']
};
const modalAuth = new bootstrap.Modal('#modal-auth');
const aviso = msg => { $('#toast-msg').textContent = msg; bootstrap.Toast.getOrCreateInstance('#toast').show(); };

// ---------- Usuario y sesión ----------
function pintarUsuario() {
  const u = sesion.usuario;
  $('#anon').hidden = !!u; $('#logueado').hidden = !u;
  if (!u) return;
  $('#nombre').textContent = u.username;
  $('#nivel').textContent = `Nivel ${u.nivel} · ${u.xp_total} XP`;
  $('#xpbar').style.width = `${(u.xp_total - u.xp_inicio) / (u.xp_fin - u.xp_inicio) * 100}%`;
}

let modo = 'login';
$('#btn-entrar').addEventListener('click', () => modalAuth.show());
$('#auth-cambio').addEventListener('click', () => {
  modo = modo === 'login' ? 'register' : 'login';
  const reg = modo === 'register';
  $('#campo-email').hidden = !reg;
  $('#auth-titulo').textContent = reg ? 'Crear cuenta' : 'Entrar';
  $('#auth-enviar').textContent = reg ? 'Registrarme' : 'Entrar';
  $('#auth-cambio').textContent = reg ? '¿Ya tienes cuenta? Entra' : '¿No tienes cuenta? Regístrate';
});
$('#form-auth').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const { token, usuario } = await api(`/auth/${modo}`, Object.fromEntries(new FormData(e.target)));
    guardarToken(token); sesion.usuario = usuario; pintarUsuario(); modalAuth.hide();
    $('#auth-error').textContent = ''; aviso(`Bienvenido, ${usuario.username}`);
  } catch (err) { $('#auth-error').textContent = err.message; }
});
$('#btn-salir').addEventListener('click', () => { guardarToken(null); sesion.usuario = null; pintarUsuario(); ir('jugar'); });

// ---------- Vistas ----------
function ir(v) {
  ['jugar', 'ranking', 'perfil'].forEach(x => { $(`#vista-${x}`).hidden = x !== v; });
  if (v === 'ranking') ranking('global').catch(e => aviso(e.message));
  if (v === 'perfil') perfil().catch(e => aviso(e.message));
}
document.querySelectorAll('[data-vista]').forEach(b => b.addEventListener('click', () => ir(b.dataset.vista)));

// Los datos de usuarios se insertan con textContent (nunca innerHTML)
const tabla = (cab, filas) => {
  const t = el('table', '', 'table table-dark table-striped align-middle'), h = el('tr'), th = el('thead'), tb = el('tbody');
  h.append(...cab.map(x => el('th', x))); th.append(h);
  filas.forEach(f => { const tr = el('tr'); tr.append(...f.map(v => el('td', v))); tb.append(tr); });
  t.append(th, tb); return t;
};

async function ranking(clave) {
  const claves = ['global', ...Object.keys(INFO)], global = clave === 'global';
  $('#tabs').replaceChildren(...claves.map(k => {
    const b = el('button', k === 'global' ? 'Global' : INFO[k].nombre, `nav-link ${k === clave ? 'active' : ''}`); b.dataset.k = k; return b;
  }));
  const filas = await api('/ranking' + (global ? '' : `?juego=${clave}`));
  $('#tabla').replaceChildren(filas.length
    ? tabla(['#', 'Jugador', global ? 'Nivel' : 'Mejor puntaje', global ? 'XP' : 'Victorias'],
        filas.map((f, i) => [i + 1, f.username, global ? f.nivel : f.mejor_puntaje, global ? f.xp_total : f.victorias]))
    : el('p', 'Todavía no hay partidas. Juega una y aparece aquí.', 'text-body-secondary'));
}
$('#tabs').addEventListener('click', ({ target }) => target.dataset.k && ranking(target.dataset.k));

async function perfil() {
  const c = $('#perfil');
  if (!sesion.usuario) return c.replaceChildren(el('p', 'Entra para ver tus estadísticas y tu historial.', 'text-body-secondary'));
  const [est, hist] = await Promise.all([api('/estadisticas'), api('/partidas')]);
  c.replaceChildren(
    el('h2', 'Estadísticas', 'h4'),
    est.length ? tabla(['Juego', 'Partidas', 'Victorias', 'Derrotas', 'Mejor puntaje', 'Puntos totales'],
      est.map(({ nombre, partidas, victorias, derrotas, mejor_puntaje, puntaje_total }) => [nombre, partidas, victorias, derrotas, mejor_puntaje, puntaje_total]))
      : el('p', 'Aún no has jugado ninguna partida.', 'text-body-secondary'),
    el('h2', 'Últimas partidas', 'h4 mt-4'),
    hist.length ? tabla(['Juego', 'Dificultad', 'Resultado', 'Puntos', 'XP', 'Duración'],
      hist.map(p => [p.juego, p.dificultad, p.resultado, p.puntos, `+${p.xp_ganada}`, fmt(p.duracion_seg)])) : el('span'));
}

// ---------- Catálogo (viene de la API) ----------
async function catalogo() {
  const juegos = await api('/juegos');
  $('#catalogo').replaceChildren(...juegos.filter(j => j.codigo in INFO).map(({ codigo, nombre }) => {
    const [ico, desc] = DESC[codigo], col = el('div', '', 'col');
    // innerHTML es seguro aquí: son textos propios, no datos escritos por usuarios
    col.innerHTML = `<div class="card h-100 juego"><div class="card-body"><div class="display-5">${ico}</div>
      <h3 class="h5 mt-2">${nombre}</h3><p class="text-body-secondary mb-0">${desc}</p></div>
      <div class="card-footer bg-transparent border-0 pb-3">${codigo in INFO
        ? `<button class="btn btn-warning btn-sm me-2" data-jugar="${codigo}" data-dif="facil">Fácil</button>
           <button class="btn btn-outline-warning btn-sm" data-jugar="${codigo}" data-dif="medio">Medio</button>`
        : '<span class="badge text-bg-secondary">Próximamente</span>'}</div></div>`;
    return col;
  }));
}
$('#catalogo').addEventListener('click', ({ target }) => {
  const b = target.closest('[data-jugar]');
  if (b) iniciar(b.dataset.jugar, b.dataset.dif);
});

// ---------- Mesa de juego ----------
let g = null, t0 = 0, reloj;

function iniciar(tipo, dif) {
  if (!sesion.usuario) { aviso('Entra para guardar tus puntos y tu XP'); return modalAuth.show(); }
  clearInterval(reloj); g = crear(tipo, dif); t0 = Date.now();
  reloj = setInterval(() => { $('#tiempo').textContent = fmt(Math.round((Date.now() - t0) / 1000)); }, 1000);
  $('#titulo').textContent = INFO[tipo].nombre; $('#dif').textContent = dif === 'facil' ? 'Fácil' : 'Medio';
  $('#ayuda').textContent = INFO[tipo].ayuda; $('#resultado').hidden = true;
  $('#lobby').hidden = true; $('#mesa').hidden = false; dibujar();
}

const carta = (c, estilo = '', cls = '', attr = '') => c.up === false ? `<div class="carta dorso" style="${estilo}" ${attr}></div>` :
  `<div class="carta ${c.s === 1 || c.s === 2 ? 'roja' : ''} ${cls}" style="${estilo}" ${attr}><b>${RANGOS[c.r - 1]}</b><span>${PALOS[c.s]}</span><em>${PALOS[c.s]}</em></div>`;

function dibujar() {
  if (g.tipo === 'spider') return dibujarSpider();
  if (g.tipo === 'klondike') return dibujarKlondike();
  const { filas, ancho, alto } = INFO[g.tipo], U = 34, top = g.desc.at(-1);
  const nodos = g.nodos.map((n, i) => n.fuera ? '' :
    carta(n.c, `left:${n.x * U}px;top:${n.r * alto}px;z-index:${n.r}`, `${libre(g, n) ? '' : 'tapada'} ${g.sel === n ? 'sel' : ''}`, `data-i="${i}"`)).join('');
  $('#tablero').innerHTML = `<div class="piramide" style="width:${ancho * U + 60}px;height:${(filas - 1) * alto + 84}px">${nodos}</div>
    <div class="d-flex justify-content-center gap-4 mt-4">
      <div class="text-center" data-mazo>${g.mazo.length ? '<div class="carta dorso"></div>' : `<div class="carta vacia">${g.rec > 0 ? '↻' : ''}</div>`}
        <small>${g.mazo.length} cartas${g.tipo === 'piramide' ? ` · reciclajes ${g.rec}` : ''}</small></div>
      <div>${top ? carta(top, '', g.sel === 'd' ? 'sel' : '', 'data-desc') : '<div class="carta vacia"></div>'}</div></div>`;
  $('#pts').textContent = g.pts;
  if (g.fin) terminar(g.fin);
}

const columnasHtml = g => {
  return g.cols.map((col, ci) => {
    let y = 0;
    const cartas = col.map((c, i) => {
      const t = y; y += c.up ? 26 : 14;
      return carta(c, `top:${t}px;left:0`, g.sel && g.sel.ci === ci && i >= g.sel.i ? 'sel' : '', `data-i="${i}"`);
    }).join('');
    return `<div class="col-sp" data-c="${ci}" style="height:${y + 88}px">${cartas}</div>`;
  }).join('');
};

function dibujarKlondike() {
  const vis = g.dif === 'medio' ? g.desc.slice(-3) : g.desc.slice(-1), ult = vis.length - 1;
  const desc = vis.map((c, k) => carta(c, `left:${k * 16}px;top:0`, k === ult && g.sel?.z === 'd' ? 'sel' : '', k === ult ? 'data-desc' : '')).join('');
  const bases = g.base.map((b, p) => b.length ? carta(b.at(-1), '', '', 'data-b') : `<div class="carta vacia" data-b>${PALOS[p]}</div>`).join('');
  $('#tablero').innerHTML = `<div class="d-flex align-items-start justify-content-center gap-4 mb-4 flex-wrap">
      <div class="text-center" data-mazo>${g.mazo.length ? '<div class="carta dorso"></div>' : `<div class="carta vacia">${g.desc.length ? '↻' : ''}</div>`}
        <small class="d-block">${g.mazo.length} cartas</small></div>
      <div class="abanico">${desc}</div>
      <div class="d-flex gap-2 ms-md-auto">${bases}</div></div>
    <div class="d-flex justify-content-center gap-2">${columnasHtml(g)}</div>`;
  $('#pts').textContent = g.pts;
  if (g.fin) terminar(g.fin);
}

function dibujarSpider() {
  const cols = columnasHtml(g);
  $('#tablero').innerHTML = `<div class="d-flex justify-content-center gap-2">${cols}</div>
    <div class="d-flex justify-content-center align-items-center gap-4 mt-4">
      <div class="text-center" data-mazo>${g.mazo.length ? '<div class="carta dorso"></div>' : '<div class="carta vacia"></div>'}
        <small class="d-block">${g.mazo.length / 10} repartos</small></div>
      <div class="fs-5">Secuencias completas: <b>${g.hechas}</b>/8</div></div>`;
  $('#pts').textContent = g.pts;
  if (g.fin) terminar(g.fin);
}

$('#tablero').addEventListener('click', ({ target }) => {
  if (!g || g.fin) return;
  if (g.tipo === 'klondike') {
    const col = target.closest('[data-c]'), c = target.closest('[data-i]');
    if (target.closest('[data-mazo]')) robarKl(g);
    else if (target.closest('[data-desc]')) clicKl(g, 'd');
    else if (target.closest('[data-b]')) clicKl(g, 'b');
    else if (col) clicKl(g, 'c', +col.dataset.c, c ? +c.dataset.i : -1);
    return dibujar();
  }
  if (g.tipo === 'spider') {
    if (target.closest('[data-mazo]')) {
      if (!repartir(g)) aviso(g.mazo.length ? 'Llena las columnas vacías antes de repartir' : 'Ya no quedan repartos');
    } else {
      const col = target.closest('[data-c]'), carta = target.closest('[data-i]');
      if (col) elegirSpider(g, +col.dataset.c, carta ? +carta.dataset.i : -1);
    }
    return dibujar();
  }
  const nodo = target.closest('[data-i]');
  if (target.closest('[data-mazo]')) robar(g);
  else if (target.closest('[data-desc]')) elegir(g, 'd');
  else if (nodo) elegir(g, g.nodos[+nodo.dataset.i]);
  dibujar();
});

async function terminar(resultado) {
  if (g.cerrada) return;
  g.cerrada = true; g.fin = resultado; clearInterval(reloj);
  const caja = $('#resultado'); caja.hidden = false;
  try {
    const r = await api('/partidas', { juego: g.tipo, dificultad: g.dif, resultado, puntos: g.pts, duracion_seg: Math.round((Date.now() - t0) / 1000) });
    sesion.usuario = r.usuario; pintarUsuario();
    const otra = el('button', 'Jugar de nuevo', 'btn btn-warning'), { tipo, dif } = g;
    otra.addEventListener('click', () => iniciar(tipo, dif));
    caja.replaceChildren(el('h2', { ganada: '¡Victoria!', perdida: 'Sin movimientos', abandonada: 'Partida abandonada' }[resultado], 'h3'),
      el('p', `${r.puntos} puntos y +${r.xp} XP`, 'fs-5'), otra);
  } catch (e) { caja.replaceChildren(el('p', `No se pudo guardar la partida: ${e.message}`)); }
}
$('#rendirse').addEventListener('click', () => g && !g.fin && terminar('abandonada'));
$('#volver').addEventListener('click', () => {
  if (g && !g.fin) terminar('abandonada');
  $('#mesa').hidden = true; $('#lobby').hidden = false;
});

// ---------- Inicio ----------
(async () => {
  try { if (sesion.token) sesion.usuario = await api('/me'); } catch { guardarToken(null); }
  pintarUsuario(); catalogo().catch(e => aviso(e.message));
})();
