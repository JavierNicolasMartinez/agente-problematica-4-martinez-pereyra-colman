# Agente inteligente de investigación y comparación de precios — Ragnar S.A.

Problemática 04. Equipo: Martínez · Pereyra · Colman.

El agente recibe pedidos en lenguaje natural ("productos de limpieza más caros que la competencia en AMBA"),
consulta el catálogo de Ragnar, busca los mismos artículos en supermercados competidores, verifica que
sean equivalentes, compara precios regulares y promocionales, y genera un informe con fuentes y fechas.

Está hecho con **Google ADK** y el modelo **gemma4:31b-cloud** a través de Ollama. Las consultas se hacen
desde un frontend en React, que habla con una API en FastAPI.

> Las fuentes de competidores son **simuladas** (nombres, dominios `.example` y precios ficticios).

## Requisitos
- Python 3.12
- Node.js 20 o superior (solo para el frontend)
- Ollama con la sesión iniciada y el modelo disponible:

```bash
ollama signin
```

```bash
ollama pull gemma4:31b-cloud
```

## Instalación

Desde la raíz del repositorio, con Python 3.12:

```bash
python -m venv .venv
```

```bash
.venv/Scripts/python -m pip install -r requirements.txt
```

```bash
cd frontend && npm install
```

## Puesta en marcha (desarrollo)

Terminal 1, API en http://127.0.0.1:3001:

```bash
.venv/Scripts/python -m api.main
```

Terminal 2, frontend en http://127.0.0.1:5173:

```bash
cd frontend && npm run dev
```

## Producción local (un solo servidor)

```bash
cd frontend && npm run build
```

```bash
.venv/Scripts/python -m api.main
```

La API sirve el frontend compilado en http://127.0.0.1:3001.

## Probar el agente sin frontend

```bash
.venv/Scripts/adk web
```

Muestra las llamadas a herramientas paso a paso. Elegí la aplicación `agente`.

## Tests

No necesitan el modelo: reemplazan su respuesta por una fija.

```bash
.venv/Scripts/python -m pytest
```

## Configuración

| Variable | Valor por defecto | Para qué sirve |
|---|---|---|
| `MODELO_AGENTE` | `ollama_chat/gemma4:31b-cloud` | Modelo que usa el agente |
| `OLLAMA_API_BASE` | `http://localhost:11434` | Dirección de Ollama |
| `HOST` y `PORT` | `127.0.0.1` y `3001` | Dirección de la API |
| `ORIGENES_PERMITIDOS` | `http://localhost:5173,http://127.0.0.1:5173` | Orígenes admitidos por CORS |

## Documentación
- [`Explicación.md`](Explicación.md): cómo funciona todo y dónde está cada cosa.
- [`DESIGN.md`](DESIGN.md): sistema visual del frontend.
