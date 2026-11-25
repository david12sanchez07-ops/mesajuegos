// Lógica pura de los juegos (sin DOM). Pirámide y TriPeaks comparten el mismo modelo:
// cada carta tiene fila (r) y posición horizontal (x); está libre si ninguna carta de la fila siguiente la tapa.
const mezclar = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const mazo = () => mezclar([...Array(52).keys()].map(i => ({ r: i % 13 + 1, s: Math.floor(i / 13) })));

export const INFO = {
  piramide: { nombre: 'Pirámide', filas: 7, ancho: 12, alto: 44,
    ayuda: 'Retira parejas de cartas libres que sumen 13 (A=1, J=11, Q=12). El rey sale solo. Fácil: 2 reciclajes del mazo, Medio: 1.' },
  tripeaks: { nombre: 'TriPeaks', filas: 4, ancho: 18, alto: 52,
    ayuda: 'Retira cartas libres un valor arriba o abajo de la carta del descarte. Encadenar sube los puntos. Fácil: A y K se enlazan, Medio: no.' },
  spider: { nombre: 'Spider',
    ayuda: 'Mueve una carta o una secuencia del mismo palo sobre una carta de valor inmediatamente mayor (o a una columna vacía). Completa ocho secuencias de K a A. Fácil: 1 palo, Medio: 2 palos. Para repartir, ninguna columna puede estar vacía.' }
};

export function crear(tipo, dif) {
  if (tipo === 'spider') return crearSpider(dif);
  const mz = mazo();
  const filas = tipo === 'piramide'
    ? Array.from({ length: 7 }, (_, r) => Array.from({ length: r + 1 }, (_, i) => 6 - r + 2 * i))
    : [[3, 9, 15], [2, 4, 8, 10, 14, 16], [1, 3, 5, 7, 9, 11, 13, 15, 17], [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]];
  const nodos = filas.flatMap((xs, r) => xs.map(x => ({ r, x, c: mz.pop(), fuera: false })));
  const g = { tipo, dif, nodos, mazo: mz, desc: [], pts: 0, racha: 0, rec: tipo === 'piramide' ? (dif === 'facil' ? 2 : 1) : 0, sel: null, fin: null };
  if (tipo === 'tripeaks') g.desc.push(g.mazo.pop());
  return g;
}

export const libre = (g, n) => !g.nodos.some(m => !m.fuera && m.r === n.r + 1 && Math.abs(m.x - n.x) === 1);
const adyacente = (g, a, b) => { const d = Math.abs(a - b); return d === 1 || (g.dif === 'facil' && d === 12); };

export function elegir(g, it) { // it: un nodo del tablero, o 'd' (carta del descarte)
  if (g.fin) return;
  const top = g.desc.at(-1);
  if (g.tipo === 'piramide') {
    const valor = x => x === 'd' ? top?.r : (libre(g, x) ? x.c.r : undefined);
    const quitar = x => x === 'd' ? g.desc.pop() : (x.fuera = true);
    const v = valor(it);
    if (v === undefined) return;
    if (v === 13) { quitar(it); g.pts += 10; }
    else if (!g.sel) g.sel = it;
    else if (g.sel === it) g.sel = null;
    else if (valor(g.sel) + v === 13) { const s = g.sel; quitar(s); quitar(it); g.pts += 20; g.sel = null; }
    else g.sel = it;
  } else {
    if (it === 'd' || !libre(g, it) || !top || !adyacente(g, it.c.r, top.r)) return;
    it.fuera = true; g.desc.push(it.c); g.pts += 10 * ++g.racha;
  }
  evaluar(g);
}

export function robar(g) {
  if (g.fin) return;
  g.sel = null; g.racha = 0;
  if (g.mazo.length) g.desc.push(g.mazo.pop());
  else if (g.rec > 0 && g.desc.length) { g.rec--; g.mazo = g.desc.reverse(); g.desc = []; }
  else return;
  evaluar(g);
}

function evaluar(g) {
  if (g.nodos.every(n => n.fuera)) { g.pts += g.tipo === 'piramide' ? 100 + g.mazo.length * 5 : 200 + g.mazo.length * 10; g.fin = 'ganada'; return; }
  if (g.mazo.length || (g.rec > 0 && g.desc.length)) return;
  const top = g.desc.at(-1), libres = g.nodos.filter(n => !n.fuera && libre(g, n)).map(n => n.c.r);
  const hay = g.tipo === 'tripeaks'
    ? libres.some(r => adyacente(g, r, top.r))
    : [...libres, ...(top ? [top.r] : [])].some((a, i, v) => a === 13 || v.some((b, j) => i !== j && a + b === 13));
  if (!hay) g.fin = 'perdida';
}

// ---------- Spider: 104 cartas, 10 columnas, 1 palo (fácil) o 2 palos (medio) ----------
function crearSpider(dif) {
  const palos = dif === 'facil' ? [0] : [0, 1];
  const mz = mezclar(Array.from({ length: 104 }, (_, i) => ({ r: i % 13 + 1, s: palos[Math.floor(i / 13) % palos.length], up: false })));
  const cols = Array.from({ length: 10 }, (_, i) => mz.splice(0, i < 4 ? 6 : 5));
  cols.forEach(c => { c.at(-1).up = true; });
  return { tipo: 'spider', dif, cols, mazo: mz, hechas: 0, pts: 0, sel: null, fin: null };
}

// Desde la posición i hasta el final: todas boca arriba, mismo palo y valores descendentes
const corrida = (col, i) => col.slice(i).every((c, k, a) => c.up && (k === 0 || (c.s === a[k - 1].s && c.r === a[k - 1].r - 1)));
const voltear = (g, col) => { const p = col.at(-1); if (p && !p.up) { p.up = true; g.pts += 10; } };

export function elegirSpider(g, ci, i) { // i = -1 si se tocó una columna vacía
  if (g.fin) return;
  const col = g.cols[ci];
  if (g.sel && g.sel.ci !== ci) {
    const orig = g.cols[g.sel.ci], mov = orig.slice(g.sel.i), dest = col.at(-1);
    if (!dest || dest.r === mov[0].r + 1) {
      orig.splice(g.sel.i); col.push(...mov); g.sel = null;
      voltear(g, orig); completar(g); return;
    }
  }
  g.sel = i >= 0 && corrida(col, i) && !(g.sel?.ci === ci && g.sel.i === i) ? { ci, i } : null;
}

export function repartir(g) {
  if (g.fin || !g.mazo.length || g.cols.some(c => !c.length)) return false;
  g.sel = null;
  g.cols.forEach(c => { const x = g.mazo.pop(); x.up = true; c.push(x); });
  completar(g); return true;
}

function completar(g) {
  g.cols.forEach(col => {
    if (col.length >= 13 && col.at(-13).r === 13 && corrida(col, col.length - 13)) {
      col.splice(-13); g.hechas++; g.pts += 100; voltear(g, col);
    }
  });
  if (g.hechas === 8) { g.pts += 200; g.fin = 'ganada'; }
}
