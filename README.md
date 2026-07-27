# 🧡 Liga Carpincho — Poker Cabivara

App web (mobile-first) para los torneos de póker entre amigos.

## Funciones
- **Sorteo de mesa**: reparte los asientos al azar; los libres quedan en espera para los que llegan tarde (tocás el asiento libre y elegís al jugador).
- **Torneo**: anotás jugadores sin límite, contás entradas (buy-in, 2ª, 3ª…) y add-on. Si alguien supera el máximo acordado se marca como *excepción* (permitido).
- **Pozo y premios**: cálculo en vivo — 50% / 30% / 10% + 10% casa (configurable).
- **Resultados**: marcás eliminados en orden y la app asigna las posiciones y corona al campeón.
- **Ranking anual**: puntos por posición (1º=20, 2º=15, … configurable), ordenado automáticamente.
- **Ajustes**: montos de buy-in (20.000 Gs) y add-on (30.000 Gs), máximo de entradas, reparto y tabla de puntos.

Los datos se guardan en el navegador (localStorage) del dispositivo que se use como "cuaderno".

## Desarrollo
```bash
npm install
npm run dev
```

## Publicación
Cada push a `main` publica automáticamente en GitHub Pages:
**https://alanpy.github.io/poker-cabivara/**

(En el repo: Settings → Pages → Source: *GitHub Actions*, solo la primera vez.)
