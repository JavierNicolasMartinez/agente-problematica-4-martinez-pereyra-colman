# Explicación del proyecto

Guía para entender **qué hace cada parte** del agente de precios de Ragnar y **cómo seguirlo**.

---

## 1. Idea general

```
Empleado escribe un pedido
        │
        ▼
┌──────────────┐  POST /api/agente/consultas   ┌──────────────────────────────┐
│  Frontend    │ ─────────────────────────────▶│  Backend (Express)           │
│  React+Vite  │ ◀───────────── informe JSON ──│  Orquestador del agente      │
└──────────────┘                               └──────────────────────────────┘
                                                      │
       ┌──────────────┬──────────────┬────────────────┼──────────────┬───────────────┐
       ▼              ▼              ▼                ▼              ▼               ▼
  Interpretar     RAG (vacío)    Catálogo        Buscar precios   Emparejar     Comparar/Analizar
     F01                           F02           en fuentes F03      F04          F05 F06 F07
                                                                                   │
                                                                                   ▼
                                                                           Informe F08 F09
```

El agente **no usa un LLM** por ahora: todo es determinístico (reglas), así cada resultado se puede explicar.
El RAG y un posible LLM se enchufan en puntos ya preparados (ver sección 6).

---

## 2. Estructura de carpetas

```
backend/
  main.js                     Arranca el servidor.
  .env.example                Variables de configuración.
  data/
    catalogo_ragnar.csv       Catálogo entregado por Ragnar (500 artículos).
    fuentes/*.json            Sitios de competidores SIMULADOS (uno por archivo).
    tipos_cambio.json         Tipo de cambio de demostración (UYU → ARS).
  scripts/
    generarFuentesSimuladas.js  Crea data/fuentes con semilla fija.
  src/
    app.js                    Arma Express: seguridad, rutas, errores.
    config.js                 Toda la configuración en un lugar.
    agente/
      orquestador.js          Coordina los 8 pasos y guarda la traza.
      interpretador.js        F01: entiende el pedido.
      emparejador.js          F04: ¿es el mismo artículo?
      comparador.js           F05/F06: diferencias y promociones.
      analizador.js           F07: más caro / más barato / sin coincidencia.
      generadorInforme.js     F08/F09: informe, conclusiones y fuentes.
      exportador.js           Informe a CSV y Markdown.
    herramientas/
      consultarCatalogo.js    F02: herramienta de catálogo.
      buscarPrecios.js        F03: herramienta de búsqueda + qué competidores consultar.
      proveedores/            Fuentes de precios (hoy simuladas).
    repositorios/
      catalogoRepositorio.js  Lee y valida el CSV (solo lectura).
      fuentesRepositorio.js   Lee y valida las fuentes y tipos de cambio.
    rag/                      Módulo RAG vacío, para implementar.
    sesiones/almacenSesiones.js  F10: memoria de consultas por sesión.
    rutas/                    Endpoints HTTP.
    middlewares/              Validación y manejo de errores.
    utils/                    Texto, unidades y errores.
  test/                       Tests con node:test.
frontend/
  src/
    App.jsx                   Estado general y navegación.
    api.js                    Cliente HTTP.
    componentes/              Piezas de la interfaz.
    vistas/                   Catálogo y Fuentes.
    estilos/                  tokens.css (colores, tipos) y app.css.
```

---

## 3. Recorrido de una consulta (paso a paso)

Ejemplo: **"Productos de limpieza más caros que la competencia en AMBA"**

| # | Paso | Archivo | Qué pasa |
|---|---|---|---|
| 1 | Interpretar | `interpretador.js` | Detecta categoría *Limpieza*, filtro *más caros*, región *AMBA*. |
| 2 | RAG | `rag/index.js` | Hoy devuelve "no configurado". |
| 3 | Catálogo | `consultarCatalogo.js` | Trae los 101 artículos de Limpieza. |
| 4 | Competidores | `buscarPrecios.js` | Elige los que operan en AMBA y permiten consulta. *Grupo Vértice* se omite (sus términos lo prohíben). |
| 5 | Buscar | `buscarPrecios.js` + `proveedores/` | Por cada artículo y competidor busca "Lavandina Ayudin" y guarda la **hora de consulta**. |
| 6 | Emparejar | `emparejador.js` | Revisa cada resultado: nombre, marca, categoría, variante, presentación. |
| 7 | Comparar | `comparador.js` | Calcula diferencias, normaliza por kg/litro/unidad y separa promociones. |
| 8 | Analizar | `analizador.js` | Clasifica contra la **mediana** de la competencia y aplica el filtro "más caros". |
| 9 | Informe | `generadorInforme.js` | Resumen, conclusiones, fuentes (URL + fecha) y advertencias. |

La respuesta incluye `informe.pasos` con lo que hizo cada paso y cuánto tardó. El frontend lo muestra en
"Cómo lo resolvió el agente".

---

## 4. Funcionalidades del enunciado → dónde están

| Req. | Qué pide | Cómo se resolvió |
|---|---|---|
| **F01** | Entender pedidos | `interpretador.js`: diccionarios construidos desde el catálogo (productos, marcas, categorías), alias ("coca", "yerba"), competidores, regiones, filtros ("más caros", "mayores al 15 %", "solo promociones"), IDs `RAG-00001` y límites ("top 10"). Si no entiende, pide aclaración. |
| **F02** | Consultar catálogo | `catalogoRepositorio.js` valida cada fila con zod. Sin métodos de escritura: **no puede modificar precios**. |
| **F03** | Investigar precios | `buscarPrecios.js` usa proveedores intercambiables. Hoy: `proveedores/simulado.js`. |
| **F04** | Coincidencia de productos | `emparejador.js`. Ver tabla de estados abajo. |
| **F05** | Comparar precios | `comparador.js`: diferencia absoluta y %. Si cambia la presentación, compara por kg / litro / unidad. |
| **F06** | Promociones | `comparador.js → precioPromocional()`: porcentaje, 2x1, 3x2, 70 % en la 2.ª unidad. Precio regular y promocional **siempre separados**. |
| **F07** | Análisis | `analizador.js`: más caro, más barato, en línea, diferencia significativa, no encontrado, no confiable. |
| **F08** | Informes | `generadorInforme.js` + `exportador.js` (CSV y Markdown). |
| **F09** | Fundamentación | Cada precio usado lleva `url`, `sku`, `consultadoEn` y `publicado`. Si no hay resultado, **no se inventa**: se informa "no encontrado". |
| **F10** | Contexto entre consultas | `almacenSesiones.js` guarda la última interpretación. "ahora solo en Córdoba" o "agregá el café" reutilizan el contexto. |

### Estados de coincidencia (F04)

| Estado | Cuándo | ¿Se compara? |
|---|---|---|
| `equivalente` | Nombre, marca, categoría y variante OK, misma presentación (±1 %). | Sí, por envase. |
| `equivalente_otra_presentacion` | Todo OK pero otro tamaño (ej. 500 g vs 1 kg). | Sí, por kg / litro / unidad. |
| `no_confiable` | Falta un dato para asegurar (sin marca, sin contenido, nombre parcial). | **No**. Se informa. |
| `descartado` | Otra marca, otra variante ("light", "repuesto"), unidad incompatible, otra categoría. | **No**. |

Entre varios candidatos se elige: primero `equivalente`, después el tamaño **más cercano**, después la mayor confianza.

### Fórmulas (F05)

```
diferenciaAbsoluta = precioRagnar − precioCompetidor
diferencia%        = (precioRagnar − precioCompetidor) / precioCompetidor × 100
precio por kg      = precio / gramos × 1000      (igual para litros con ml)
```
**Positivo = Ragnar más caro.** La clasificación usa la **mediana** de las diferencias de todos los
competidores comparados. "En línea" = ±1 %. "Significativa" = ≥ 10 % (configurable o pedido en el mensaje).

### Restricciones del enunciado

| Restricción | Cómo se cumple |
|---|---|
| No inventar precios | Solo se usan precios que vienen de una fuente; sin coincidencia, se informa. Las conclusiones se arman con datos calculados. |
| Fuente y fecha | `url`, `sku`, `consultadoEn`, `publicado` en cada comparación. |
| Verificar antes de comparar | Solo se comparan `equivalente` y `equivalente_otra_presentacion`. |
| Regular vs promoción | Campos y columnas separadas. |
| Informar si no hay coincidencia confiable | Estados `no_confiable` y `sin_coincidencias`. |
| Diferencias regionales y monetarias | Filtro por región; competidores de otro país solo si se piden; conversión con `tipos_cambio.json` (con aviso). |
| No comprar ni modificar precios | No existe ningún endpoint ni método que lo haga. |
| Respetar condiciones de acceso | Cada fuente declara `permite_consulta_automatizada`. Si es `false`, se omite y se avisa. |

---

## 5. API

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/api/salud` | Estado del servidor. |
| GET | `/api/catalogo?q=&categoria=&marca=&pagina=&limite=` | Listado paginado. |
| GET | `/api/catalogo/facetas` | Categorías, marcas y productos con cantidades. |
| GET | `/api/catalogo/:id` | Un producto (`RAG-00001`). |
| GET | `/api/competidores` | Fuentes y tipos de cambio. |
| GET | `/api/agente/sugerencias` | Ejemplos de pedidos. |
| POST | `/api/agente/consultas` | **Ejecuta el agente.** Body: `{ mensaje, sesionId?, nuevoAnalisis? }` |
| POST | `/api/sesiones` | Crea una sesión. |
| GET | `/api/sesiones/:id` | Historial de la sesión. |
| GET | `/api/sesiones/:id/informes/:informeId` | Un informe. |
| GET | `/api/sesiones/:id/informes/:informeId/exportar?formato=csv\|md` | Descarga. |

Respuesta de `/api/agente/consultas` (resumida):
```json
{
  "sesionId": "uuid",
  "tipo": "informe",
  "interpretacion": { "productos": [], "categorias": ["Limpieza"], "regiones": ["AMBA"], "filtros": { "clasificacion": "mas_caro" } },
  "informe": {
    "resumen": { "totalProductos": 54, "mas_caro": 54 },
    "conclusiones": ["..."],
    "items": [{ "producto": {}, "competidores": [{ "estado": "equivalente", "comparacion": {}, "publicacion": { "url": "..." } }], "analisis": {} }],
    "fuentes": [{ "url": "...", "consultadoEn": "2026-11-03T..." }],
    "pasos": [{ "titulo": "Interpretar la solicitud", "detalle": "...", "duracionMs": 2 }]
  }
}
```
Si el pedido no se entiende: `"tipo": "aclaracion"` con un mensaje y sugerencias.

---

## 6. Dónde enchufar el RAG (y un LLM)

1. **RAG**: implementar `backend/src/rag/index.js → recuperarContexto()`. El orquestador ya la llama en el
   paso 2 y el frontend ya muestra los fragmentos. Instrucciones en `backend/src/rag/README.md`.
   Regla: el RAG sirve para **interpretar y explicar**, nunca como fuente de precios de la competencia.
2. **LLM para entender pedidos** (opcional): reemplazar `interpretar()` por una función que devuelva el
   **mismo objeto**. El resto del agente no cambia.
3. **Fuente real**: crear un proveedor en `herramientas/proveedores/` con la misma forma que el simulado
   (ver su README) y registrarlo en `proveedores/index.js`.

---

## 7. Fuentes simuladas

`npm run generar-fuentes` crea seis competidores ficticios con semilla fija (siempre los mismos datos):

| Competidor | Regiones | Moneda | Consulta |
|---|---|---|---|
| Mercado Austral | AMBA, Córdoba | ARS | Permitida |
| Hiper Delta | AMBA, Rosario | ARS | Permitida |
| SuperCiudad | AMBA, Mendoza | ARS | Permitida |
| Almacén Pampa | Córdoba, Rosario, Mendoza | ARS | Permitida |
| Grupo Vértice | AMBA | ARS | **No permitida** (demuestra la restricción) |
| Tienda Oriental | Montevideo | UYU | Permitida (demuestra conversión de moneda) |

El generador mete a propósito casos difíciles: títulos desordenados ("Terrabusi Galletitas dulces 900 grs"),
otras presentaciones, variantes ("light", "repuesto"), publicaciones sin marca y promociones.

**Dato del catálogo:** hay artículos repetidos (mismo producto, marca y presentación con distinto ID y precio).
El agente los marca como "repetido en catálogo" y lo avisa en el informe.

---

## 8. Seguridad

| Riesgo | Medida |
|---|---|
| Entradas maliciosas | Validación con zod en body, query y params. Mensaje de 3 a 500 caracteres. Campos desconocidos → 400. |
| Cuerpos enormes | `express.json({ limit: '10kb' })`. |
| Abuso / DoS | Límite de 300 pedidos/min en `/api` y 30 consultas/min al agente por IP. Máx. 120 productos por consulta. |
| Memoria | Máx. 500 sesiones, 25 informes por sesión, vencimiento a las 2 h. |
| Acceso a informes ajenos | Un informe solo se entrega si coincide el ID de sesión (UUID aleatorio). |
| XSS | React escapa todo el texto; no se usa `dangerouslySetInnerHTML`. CSP estricta con Helmet (`script-src 'self'`). |
| Enlaces externos | `rel="noopener noreferrer nofollow"`. |
| Inyección de fórmulas en CSV | Celdas que empiezan con `= + - @` se prefijan con `'`. |
| Markdown | Se escapan caracteres especiales en la exportación. |
| CORS | Solo orígenes listados en `ORIGENES_PERMITIDOS`. |
| Fuga de información | Errores genéricos (sin trazas), sin `x-powered-by`, servidor escucha en `127.0.0.1` por defecto. |
| Path traversal | IDs validados por regex; archivos estáticos solo desde `frontend/dist`. |
| Secretos | No hay claves en el código. `.env` está en `.gitignore`. |
| Dependencias | `npm audit`: 0 vulnerabilidades al momento de entregar. |

---

## 9. Frontend

- **Investigar**: escribís el pedido; ves lo que entendió el agente, el panorama (barra de distribución y
  conclusiones), la lista de productos con la **regla de góndola** y, al abrir un producto, la tabla por
  competidor con criterios de coincidencia, precio regular, promoción, diferencia y fuente.
- **Seguimiento**: después del primer informe, el cuadro dice "Continúa sobre: …". Escribí "ahora solo en
  Córdoba" o "agregá el café". "Empezar de cero" ignora el contexto.
- **Catálogo**: búsqueda y filtro por categoría; botón "Investigar" por artículo.
- **Fuentes**: competidores, regiones, moneda y si permiten consulta.
- Diseño documentado en `DESIGN.md`.

### Cómo leer la regla de góndola
El fleje amarillo **R** es Ragnar. Cada círculo es un competidor: a la **izquierda** vende más barato,
a la **derecha** más caro. Rojo = Ragnar más caro que ese competidor; verde = más barato.
Anillo amarillo = tiene promoción. Borde punteado = fuera de escala.

---

## 10. Ejemplos de pedidos

- `Compará la yerba mate en todos los competidores`
- `Productos de limpieza más caros que la competencia en AMBA`
- `Bebidas con diferencias mayores al 15 %`
- `Precios de Coca-Cola en Hiper Delta y SuperCiudad`
- `Gaseosa Coca-Cola solo promociones`
- `Compará RAG-00001 y RAG-00002`
- `Yerba mate Playadito en Montevideo` (conversión de moneda)
- Seguimiento: `ahora solo en Córdoba`, `agregá el café`, `sacá Hiper Delta`
