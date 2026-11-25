# Mesa de Juegos

Plataforma web de cartas con API REST, base de datos SQLite, puntajes por usuario y sistema de XP.

## Ejecutar
```bash
npm install
npm start          # http://localhost:3000
```

## Base de datos (schema.sql)
- **Independientes:** `usuarios`, `juegos`, `dificultades`
- **Dependientes:** `partidas` (FK a las tres anteriores) y `estadisticas_usuario` (PK compuesta usuario_id + juego_id)

## API
| Método | Ruta | Descripción |
|---|---|---|
| POST | /api/auth/register · /api/auth/login | Registro e inicio de sesión (JWT) |
| GET | /api/me | Usuario, nivel y XP |
| GET | /api/juegos · /api/dificultades | Catálogos |
| POST | /api/partidas | Guarda una partida; el servidor calcula puntos y XP |
| GET | /api/partidas · /api/estadisticas | Historial y estadísticas propias |
| GET | /api/ranking?juego=piramide | Ranking global (XP) o por juego (mejor puntaje) |

XP por partida: ganada 50, perdida 15, abandonada 5, más 1 por cada 20 puntos; Fácil x1, Medio x1.5.
Nivel n empieza en 100·(n−1)² XP.

## Relación con lo visto en clase
- **JavaScript ES6:** módulos (`import`/`export`), `async/await` con `fetch`, arrow functions, desestructuración, spread, template literals.
- **DOM:** `querySelector`, `createElement`, `textContent` para datos de usuarios, delegación de eventos en el tablero.
- **Bootstrap 5:** navbar, grid, cards, modal, toast, tablas y barra de progreso.
- **Git/GitHub:** `.gitignore` incluido; trabaja con una rama por función (`feature/klondike`, `feature/rummikub`).
- **VS Code:** prueba la API con Thunder Client o REST Client.

## Pendiente
Rummikub y Klondike ya existen en el catálogo de la base de datos; falta su motor de juego en `public/js/juegos.js`.
