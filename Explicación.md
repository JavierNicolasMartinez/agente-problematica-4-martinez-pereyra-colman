# Explicación del proyecto

Cómo funciona el agente y dónde está cada cosa.

---

## 1. Idea general

```
Frontend React  ──HTTP──▶  API FastAPI  ──▶  root_agent (ADK)  ──▶  Herramientas en Python
                                                   │                  (catálogo, fuentes, cálculos)
                                                   └──▶  gemma4:31b-cloud (Ollama)
```

La regla central es que **el modelo decide y Python calcula**:

- **Gemma** interpreta el pedido y elige qué herramienta usar.
- **Las herramientas** buscan, verifican, comparan y arman el informe.

El modelo nunca le pasa un precio a una herramienta: solo pasa identificadores (`producto_id`, `competidor_id`,
`sku`) y los precios se leen de los datos. Además, el informe que ve el empleado lo calcula Python entero; el
modelo solo agrega un comentario breve, que se valida contra esos datos. Por eso no puede inventar precios en
el informe.

---

## 2. Estructura de carpetas

```
agente/                        Agente ADK
  agent.py                     root_agent: interpreta el pedido y decide
  config.py                    Modelo que se usa
  sub_agents/investigador.py   Responde preguntas puntuales en texto
  tools/                       Una herramienta por archivo
    consultar_catalogo.py      F02: busca en el catálogo
    buscar_precios_competencia.py  F03: busca publicaciones
    verificar_equivalencia.py  F04: decide si es el mismo artículo
    comparar_precios.py        F05 y F06: diferencias y promociones
    analizar_posicionamiento.py    F07: analiza varios productos en texto
    generar_informe.py         F08 y F09: arma el informe del frontend
    consultar_documentos.py    RAG: recupera fragmentos de los PDF cargados
    comun/                     Lógica compartida
      texto.py                 Normalización de texto
      precios.py               Presentaciones, promociones y cálculos
      datos.py                 Lectura del CSV y de los JSON
      analisis.py              Clasificación contra la mediana
      investigacion.py         Búsqueda, verificación y comparación de un producto
  guardrails/                  Controles de entrada, herramientas, salida y documentos
    reglas.py                  Reglas como funciones puras
    plugin.py                  Conecta las reglas con ADK y registra cada bloqueo
  rag/                         RAG por capas
    infrastructure/            Embeddings y base vectorial Chroma
    schemas/                   Datos de entrada del servicio
    services/                  Carga de PDF y recuperación de fragmentos
  data/                        Catálogo, fuentes simuladas y tipos de cambio
api/                           Conecta el agente con el frontend
  main.py                      Aplicación, errores y seguridad
  rutas.py                     Rutas /api
  servicio_agente.py           Ejecuta el agente y arma la respuesta
  sesiones.py                  Sesiones e informes en memoria
  exportador.py                Exportación a CSV y Markdown
  documentos.py                Carga y lista los PDF del RAG
frontend/                      Interfaz en React
tests/                         Pruebas con pytest
```

---

## 3. Recorrido de una consulta

Ejemplo: "Productos de limpieza más caros que la competencia en AMBA".

1. El frontend envía `POST /api/agente/consultas`.
2. La API busca la sesión del empleado y ejecuta el agente.
3. Gemma entiende el pedido y llama a `generar_informe` con `categorias=["Limpieza"]`, `regiones=["AMBA"]` y
   `clasificacion="mas_caro"`.
4. La herramienta selecciona los productos, decide qué competidores consultar, busca publicaciones, verifica
   cada una, compara precios, clasifica y arma el informe.
5. La herramienta deja el informe listo y le devuelve al modelo un resumen sin precios.
6. Gemma comenta el resultado en dos o tres frases. El guardrail de salida bloquea el comentario si cita un
   número sin respaldo, y el informe se entrega igual si el comentario falla.
7. La API retira el informe, lo guarda en la sesión y lo devuelve al frontend.

Si el pedido no es de precios o falta información, el modelo responde en texto y el frontend lo muestra como
una aclaración. Las preguntas puntuales ("¿por qué se descartó esta publicación?") van al sub-agente
`investigador`, que el agente raíz usa como herramienta (`AgentTool`).

---

## 4. Funcionalidades del enunciado

| Función | Dónde está |
|---|---|
| F01 Comprensión de solicitudes | `root_agent` y los parámetros de `generar_informe` |
| F02 Consulta del catálogo | `tools/consultar_catalogo.py` |
| F03 Investigación de precios | `tools/buscar_precios_competencia.py` |
| F04 Coincidencia de productos | `tools/verificar_equivalencia.py` |
| F05 Comparación de precios | `tools/comparar_precios.py` |
| F06 Promociones | `promocion_vigente` en `comun/precios.py` |
| F07 Análisis de resultados | `comun/analisis.py` |
| F08 Informes | `tools/generar_informe.py` y `api/exportador.py` |
| F09 Fuentes y fechas | `_fuentes_utilizadas` en `generar_informe.py` |
| F10 Gestión de consultas | Sesiones de ADK y `continuar_analisis` |

### Estados de coincidencia (F04)

| Estado | Significado | ¿Se compara? |
|---|---|---|
| `equivalente` | Mismo artículo y misma presentación | Sí, por envase |
| `equivalente_otra_presentacion` | Mismo artículo, otro tamaño | Sí, por kg, litro o unidad |
| `no_confiable` | Faltan datos para asegurarlo | No |
| `descartado` | Otra marca, categoría, unidad o variante | No |

### Fórmulas (F05)

Una diferencia positiva significa que Ragnar está **más caro**.

```
diferencia absoluta   = precio Ragnar - precio competidor
diferencia porcentual = (precio Ragnar - precio competidor) / precio competidor * 100
```

Cada producto se clasifica contra la **mediana** de sus diferencias, para que un solo precio raro no decida.
Queda `en_linea` si la mediana está dentro de ±1 %, y es significativa desde el 10 %, salvo que el pedido
indique otro umbral.

### Restricciones del enunciado

| Restricción | Cómo se cumple |
|---|---|
| No inventar precios | Las herramientas reciben identificadores, y el informe lo arma Python |
| Precios con fuente y fecha | Cada comparación guarda url, sku y fecha de consulta |
| No comparar sin verificar | `comparar_precios` vuelve a verificar y se niega si no hay equivalencia |
| Regular y promocional separados | Se calculan e informan por separado |
| Avisar si no hay coincidencia confiable | Clasificaciones `no_confiable` y `sin_coincidencias` |
| Diferencias regionales y monetarias | Filtro por región y conversión con `tipos_cambio.json` |
| No comprar ni modificar precios | No existe ninguna herramienta de escritura |
| Respetar el acceso a las fuentes | Se omiten las fuentes con `permite_consulta_automatizada: false` |

---

## 5. API

Mantiene el formato que espera el frontend.

| Método y ruta | Para qué sirve |
|---|---|
| `POST /api/agente/consultas` | Ejecuta una consulta. Cuerpo: `mensaje`, `sesionId` y `nuevoAnalisis` |
| `GET /api/agente/sugerencias` | Ejemplos de pedidos |
| `GET /api/catalogo` | Catálogo paginado y con filtros |
| `GET /api/catalogo/facetas` | Categorías, marcas, productos y países |
| `GET /api/catalogo/{id}` | Un producto |
| `GET /api/competidores` | Fuentes y tipos de cambio |
| `GET /api/documentos` | Documentos cargados en el RAG |
| `POST /api/documentos` | Carga e indexa un PDF de hasta 20 MB |
| `GET /api/sesiones/{id}/informes/{informeId}` | Un informe guardado |
| `GET /api/sesiones/{id}/informes/{informeId}/exportar` | Exportación, con `formato=csv` o `md` |
| `GET /api/salud` | Estado del servicio |

Los errores se devuelven como `{"error": "...", "detalles": [...]}`. Si el modelo no responde, la API devuelve
503 con un mensaje que indica revisar Ollama.

---

## 6. Sesiones y contexto (F10)

Cada `sesionId` tiene una conversación de ADK y sus últimos 25 informes. Están en memoria, así que se pierden
al reiniciar la API, y vencen tras 2 horas sin uso.

Un pedido como "y en Córdoba?" llega con `continuar_analisis=true`: lo que no menciona se toma del alcance
anterior. Una marca o categoría nueva acota el análisis anterior, y un producto nuevo ("y el café?") cambia de
tema: conserva región y competidores, pero no la categoría ni los filtros. Si acotar dejaría cero productos,
también se cambia de tema. "empezar de cero" envía `nuevoAnalisis=true`, que abre una conversación nueva de ADK.

---

## 7. Fuentes simuladas

| Competidor | Regiones | Moneda | Consulta |
|---|---|---|---|
| Mercado Austral | AMBA, Córdoba | ARS | Permitida |
| Hiper Delta | AMBA, Rosario | ARS | Permitida |
| SuperCiudad | AMBA, Mendoza | ARS | Permitida |
| Almacén Pampa | Córdoba, Rosario, Mendoza | ARS | Permitida |
| Grupo Vértice | AMBA | ARS | **No permitida** (demuestra la restricción) |
| Tienda Oriental | Montevideo | UYU | Permitida (demuestra la conversión de moneda) |

Sin un competidor o una región pedidos, solo se consultan fuentes del país del producto.

**Limitación conocida de los datos:** 282 filas del catálogo pertenecen a 117 grupos repetidos, con el mismo
producto, marca y presentación pero distinto ID y precio. El agente los marca como "repetido en catálogo" y lo
avisa en el informe. Como los JSON se generaron una vez por artículo, estos casos pueden mostrar diferencias
muy grandes: los cálculos son correctos, pero el dato de origen es incoherente.

---

## 8. RAG: documentos del agente

El RAG sigue la estructura del repositorio de clase `clase_rag_fastapi`: capas `infrastructure`, `schemas` y
`services`, Chroma como base vectorial y `nomic-embed-text` para los embeddings.

```
PDF ──▶ POST /api/documentos ──▶ PyPDFLoader ──▶ SemanticChunker ──▶ embeddings ──▶ Chroma
Pregunta ──▶ root_agent ──▶ consultar_documentos (top 5) ──▶ Gemma responde con esos fragmentos
```

La respuesta no pasa por una ruta `/response`: la tool le entrega los fragmentos a Gemma dentro del agente ADK.
Si no alcanzan, responde `esta pregunta está fuera de mis limites!`, igual que el repositorio de clase.

Decisiones importantes:

- **Sin puntaje mínimo:** en las pruebas, "cotización del bitcoin" dio 0,62 y un acierto dio 0,60. El puntaje no
  separa lo relevante, así que recupera el top 5 y el modelo decide si alcanza.
- **El catálogo no se indexa:** con nombres cortos en español, `nomic-embed-text` confunde productos. "refrescos"
  devolvió azúcar con mayor puntaje que los aciertos.
- **Los precios no salen de documentos:** el informe no usa los fragmentos, y `generar_informe` sigue leyendo solo
  las fuentes. Un PDF no puede cambiar un precio del informe.
- **Subir de nuevo reemplaza:** un archivo con el mismo nombre sustituye sus fragmentos en lugar de duplicarlos.

---

## 9. Guardrails

Son controles por código alrededor del modelo, reunidos en `GuardrailsPlugin`. Se registra en el `Runner` de la
API y lo hereda `investigador`, porque `AgentTool` propaga los plugins.

| Guardrail | Mecanismo de ADK | Qué hace |
|---|---|---|
| Entrada | `before_model_callback` | Bloquea inyecciones, pedidos de código y de datos falsos sin llamar al modelo |
| Herramientas | `before_tool_callback` | Valida identificadores, competidores, regiones, categorías, límites y hasta 15 llamadas por consulta |
| Salida | `after_model_callback` | Bloquea código, identificadores internos, frases de las instrucciones y números sin respaldo |
| Documentos | `after_tool_callback` | Retira de los fragmentos las oraciones que intentan darle órdenes al modelo |

Un número tiene respaldo si salió de una herramienta en la sesión o del pedido. No se controlan los enteros de
hasta 31, para no bloquear listas numeradas ni plazos. Cada bloqueo queda en `agente/data/guardrails.log`.

**Límites:** los patrones de entrada y de documentos se pueden esquivar reformulando el texto, y por eso también
se conserva la regla en las instrucciones. El control de números detecta valores inventados, no malas
interpretaciones. El plugin no se aplica en `adk web`, porque se registra en el `Runner` de la API.

---

## 10. Seguridad

- La API escucha solo en `127.0.0.1` por defecto.
- Se validan cuerpo, parámetros y largo del mensaje. El cuerpo admite hasta 10 kB.
- Cada cliente puede hacer hasta 30 consultas por minuto.
- Las respuestas llevan cabeceras de seguridad, incluida una política de contenido restrictiva.
- Un informe solo se puede leer desde la sesión que lo generó.
- En CSV se neutralizan las celdas que empiezan con `=`, `+`, `-` o `@`, para evitar inyección de fórmulas.
- Las fuentes externas son datos: el agente no ejecuta nada de lo que contienen.
- El texto de un PDF es información, no instrucciones. El guardrail de documentos retira las órdenes que detecta,
  pero una inyección reformulada podría pasar y alterar una respuesta en texto.
- La carga acepta solo PDF válidos, y usa únicamente el nombre del archivo, sin rutas.

---

## 11. Ejemplos de pedidos

- "Compará la yerba mate en todos los competidores"
- "Productos de limpieza más caros que la competencia en AMBA"
- "Bebidas con diferencias mayores al 15 %"
- "Precios de Coca-Cola en Hiper Delta y SuperCiudad"
- "Compará el Detergente Ala en Montevideo"
- Seguimientos: "ahora solo en Córdoba", "agregá el café"
- Con documentos cargados: "¿Qué restricciones tiene el agente según el documento de la problemática?"
