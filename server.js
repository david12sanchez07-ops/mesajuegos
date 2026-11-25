const express = require('express'), Database = require('better-sqlite3'), bcrypt = require('bcryptjs'),
      jwt = require('jsonwebtoken'), fs = require('fs'), path = require('path');

const SECRET = process.env.JWT_SECRET || 'cambia-este-secreto-en-produccion';
const db = new Database(path.join(__dirname, 'cartas.db'));
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Nivel n empieza en 100*(n-1)^2 XP: 0, 100, 400, 900...
const nivelDe = xp => Math.floor(Math.sqrt(xp / 100)) + 1;
const pub = u => { const n = nivelDe(u.xp_total);
  return { id: u.id, username: u.username, xp_total: u.xp_total, nivel: n, xp_inicio: 100 * (n - 1) ** 2, xp_fin: 100 * n ** 2 }; };
const firmar = u => jwt.sign({ id: u.id }, SECRET, { expiresIn: '7d' });
const auth = (req, res, next) => {
  try { req.uid = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET).id; next(); }
  catch { res.status(401).json({ error: 'Sesión inválida, vuelve a entrar' }); }
};

// ---------- AUTENTICACIÓN ----------
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body || {};
  if (!/^\w{3,20}$/.test(username || '')) return res.status(400).json({ error: 'Usuario: 3 a 20 letras, números o guion bajo' });
  if (!/^\S+@\S+\.\S+$/.test(email || '')) return res.status(400).json({ error: 'Correo inválido' });
  if ((password || '').length < 6) return res.status(400).json({ error: 'La contraseña necesita al menos 6 caracteres' });
  try {
    const info = db.prepare('INSERT INTO usuarios(username,email,password_hash) VALUES(?,?,?)')
      .run(username, email.toLowerCase(), bcrypt.hashSync(password, 10));
    const u = db.prepare('SELECT * FROM usuarios WHERE id=?').get(info.lastInsertRowid);
    res.status(201).json({ token: firmar(u), usuario: pub(u) });
  } catch { res.status(409).json({ error: 'Ese usuario o correo ya está registrado' }); }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = db.prepare('SELECT * FROM usuarios WHERE username=? OR email=?').get(username, (username || '').toLowerCase());
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  res.json({ token: firmar(u), usuario: pub(u) });
});

app.get('/api/me', auth, (req, res) => {
  const u = db.prepare('SELECT * FROM usuarios WHERE id=?').get(req.uid);
  u ? res.json(pub(u)) : res.status(404).json({ error: 'Usuario no encontrado' });
});

// ---------- CATÁLOGOS ----------
app.get('/api/juegos', (_, res) => res.json(db.prepare('SELECT * FROM juegos').all()));
app.get('/api/dificultades', (_, res) => res.json(db.prepare('SELECT * FROM dificultades').all()));

// ---------- PARTIDAS: el servidor calcula puntos finales y XP ----------
const XP_BASE = { ganada: 50, perdida: 15, abandonada: 5 };
app.post('/api/partidas', auth, (req, res) => {
  const { juego, dificultad, resultado, puntos, duracion_seg } = req.body || {};
  const j = db.prepare('SELECT * FROM juegos WHERE codigo=?').get(juego);
  const d = db.prepare('SELECT * FROM dificultades WHERE codigo=?').get(dificultad);
  if (!j || !d || !Object.hasOwn(XP_BASE, resultado)) return res.status(400).json({ error: 'Datos de partida inválidos' });

  const base = Math.max(0, Math.min(5000, Math.floor(Number(puntos) || 0)));
  const pts = Math.round(base * d.mult_puntos);
  const xp = Math.round((XP_BASE[resultado] + Math.floor(pts / 20)) * d.mult_xp);
  const dur = Math.max(0, Math.min(86400, Math.floor(Number(duracion_seg) || 0)));
  const gan = resultado === 'ganada' ? 1 : 0, per = resultado === 'perdida' ? 1 : 0;

  db.transaction(() => {
    db.prepare('INSERT INTO partidas(usuario_id,juego_id,dificultad_id,resultado,puntos,xp_ganada,duracion_seg) VALUES(?,?,?,?,?,?,?)')
      .run(req.uid, j.id, d.id, resultado, pts, xp, dur);
    db.prepare(`INSERT INTO estadisticas_usuario(usuario_id,juego_id,partidas,victorias,derrotas,mejor_puntaje,puntaje_total)
                VALUES(?,?,1,?,?,?,?)
                ON CONFLICT(usuario_id,juego_id) DO UPDATE SET
                  partidas=partidas+1, victorias=victorias+excluded.victorias, derrotas=derrotas+excluded.derrotas,
                  mejor_puntaje=MAX(mejor_puntaje,excluded.mejor_puntaje), puntaje_total=puntaje_total+excluded.puntaje_total`)
      .run(req.uid, j.id, gan, per, pts, pts);
    db.prepare('UPDATE usuarios SET xp_total=xp_total+? WHERE id=?').run(xp, req.uid);
  })();
  res.status(201).json({ puntos: pts, xp, usuario: pub(db.prepare('SELECT * FROM usuarios WHERE id=?').get(req.uid)) });
});

app.get('/api/partidas', auth, (req, res) => res.json(db.prepare(
  `SELECT p.id, j.nombre AS juego, d.nombre AS dificultad, p.resultado, p.puntos, p.xp_ganada, p.duracion_seg, p.created_at
   FROM partidas p JOIN juegos j ON j.id=p.juego_id JOIN dificultades d ON d.id=p.dificultad_id
   WHERE p.usuario_id=? ORDER BY p.id DESC LIMIT 15`).all(req.uid)));

app.get('/api/estadisticas', auth, (req, res) => res.json(db.prepare(
  `SELECT j.codigo, j.nombre, e.partidas, e.victorias, e.derrotas, e.mejor_puntaje, e.puntaje_total
   FROM estadisticas_usuario e JOIN juegos j ON j.id=e.juego_id WHERE e.usuario_id=?`).all(req.uid)));

// ---------- RANKING (global por XP, o por juego por mejor puntaje) ----------
app.get('/api/ranking', (req, res) => {
  if (req.query.juego) return res.json(db.prepare(
    `SELECT u.username, e.mejor_puntaje, e.victorias, e.partidas
     FROM estadisticas_usuario e JOIN usuarios u ON u.id=e.usuario_id JOIN juegos j ON j.id=e.juego_id
     WHERE j.codigo=? ORDER BY e.mejor_puntaje DESC LIMIT 10`).all(req.query.juego));
  res.json(db.prepare('SELECT username, xp_total FROM usuarios ORDER BY xp_total DESC LIMIT 10').all()
    .map(u => ({ ...u, nivel: nivelDe(u.xp_total) })));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mesa de Juegos en http://localhost:${PORT}`));
