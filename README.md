# Agente inteligente de investigación y comparación de precios — Ragnar S.A.

Problemática 04. Equipo: Martínez · Pereyra · Colman.

El agente recibe pedidos en lenguaje natural ("productos de limpieza más caros que la competencia en AMBA"),
consulta el catálogo de Ragnar, busca los mismos artículos en supermercados competidores, verifica que
sean equivalentes, compara precios regulares y promocionales, y genera un informe con fuentes y fechas.

> Las fuentes de competidores son **simuladas** (nombres, dominios `.example` y precios ficticios).
> El módulo **RAG** queda preparado pero vacío, para implementarlo manualmente.

## Requisitos
- Node.js 20 o superior

## Puesta en marcha (desarrollo)

Terminal 1 — backend (API en http://127.0.0.1:3001):
```bash
cd backend
npm install
npm run dev
```

Terminal 2 — frontend (http://127.0.0.1:5173):
```bash
cd frontend
npm install
npm run dev
```

## Producción local (un solo servidor)
```bash
cd frontend && npm install && npm run build
cd ../backend && npm install && NODE_ENV=production npm start
```
El backend sirve el frontend compilado en http://127.0.0.1:3001.

## Tests
```bash
cd backend && npm test
```

## Documentación
- [`Explicación.md`](Explicación.md): cómo funciona todo, archivo por archivo.
- [`DESIGN.md`](DESIGN.md): sistema visual del frontend.
- [`backend/src/rag/README.md`](backend/src/rag/README.md): cómo implementar el RAG.
