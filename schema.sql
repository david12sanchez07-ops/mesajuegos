-- ============================================================
-- ESQUEMA RELACIONAL — Mesa de Juegos
-- ============================================================

-- ---------- TABLAS INDEPENDIENTES (no tienen llaves foráneas) ----------
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  xp_total      INTEGER NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS juegos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo    TEXT NOT NULL UNIQUE,          -- rummikub, klondike, spider, piramide, tripeaks
  nombre    TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('fichas','cartas'))
);

CREATE TABLE IF NOT EXISTS dificultades (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo       TEXT NOT NULL UNIQUE,       -- facil, medio
  nombre       TEXT NOT NULL,
  mult_puntos  REAL NOT NULL,              -- multiplica el puntaje
  mult_xp      REAL NOT NULL               -- multiplica la experiencia
);

-- ---------- TABLAS DEPENDIENTES (llaves foráneas) ----------
-- Una partida depende de un usuario, un juego y una dificultad.
CREATE TABLE IF NOT EXISTS partidas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id)      ON DELETE CASCADE,
  juego_id      INTEGER NOT NULL REFERENCES juegos(id),
  dificultad_id INTEGER NOT NULL REFERENCES dificultades(id),
  resultado     TEXT NOT NULL CHECK (resultado IN ('ganada','perdida','abandonada')),
  puntos        INTEGER NOT NULL DEFAULT 0,
  xp_ganada     INTEGER NOT NULL DEFAULT 0,
  duracion_seg  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_partidas_usuario ON partidas(usuario_id, created_at DESC);

-- Entidad dependiente con llave primaria COMPUESTA (usuario + juego).
CREATE TABLE IF NOT EXISTS estadisticas_usuario (
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  juego_id      INTEGER NOT NULL REFERENCES juegos(id),
  partidas      INTEGER NOT NULL DEFAULT 0,
  victorias     INTEGER NOT NULL DEFAULT 0,
  derrotas      INTEGER NOT NULL DEFAULT 0,
  mejor_puntaje INTEGER NOT NULL DEFAULT 0,
  puntaje_total INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, juego_id)
);

-- ---------- DATOS INICIALES ----------
INSERT OR IGNORE INTO juegos(codigo,nombre,categoria) VALUES
 ('rummikub','Rummikub','fichas'),('klondike','Klondike','cartas'),
 ('spider','Spider','cartas'),('piramide','Pirámide','cartas'),('tripeaks','TriPeaks','cartas');
INSERT OR IGNORE INTO dificultades(codigo,nombre,mult_puntos,mult_xp) VALUES
 ('facil','Fácil',1.0,1.0),('medio','Medio',1.5,1.5);
