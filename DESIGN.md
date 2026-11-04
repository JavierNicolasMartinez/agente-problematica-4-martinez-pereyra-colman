# Sistema visual "Fleje"

Pantalla de trabajo (modo *Operate*): analistas comerciales que la usan de día, en oficina.
Por eso: fondo claro, densidad media, controles estándar. El mundo visual sale de la **góndola del supermercado**.

## Idea
El precio de Ragnar es un **fleje amarillo** clavado en el centro de una **regla de góndola**.
Cada competidor se ubica a la izquierda (vende más barato) o a la derecha (más caro).
En un vistazo se ve si Ragnar está caro, barato o en línea, y quién tiene promoción.

## Color (tokens en `frontend/src/estilos/tokens.css`)
| Rol | Token | Uso |
|---|---|---|
| Mueble de góndola | `--gondola` | Barra lateral, botón principal |
| Suelo | `--suelo` | Fondo de la app (claro, tinte verde frío) |
| Fleje | `--fleje` | **Solo** Ragnar en la regla y promociones |
| Caro | `--caro` | Ragnar más caro |
| Barato | `--barato` | Ragnar más barato |
| Duda | `--duda` (rayado) | Coincidencia no confiable |
| Nada | `--nada` | No encontrado |

## Tipografía
Archivo Variable (autoalojada, eje de ancho). Precios en ancho 72 % y peso 760, como las etiquetas de góndola.
Interfaz en ancho normal. Números siempre tabulares.

## Componentes clave
- **Regla de góndola** (`ReglaGondola.jsx`): firma visual. Escala simétrica ±20–60 %, marcadores fuera de escala con borde punteado, anillo amarillo = promoción.
- **Fila-fleje** (`FilaProducto.jsx`): producto · regla · precio Ragnar · diferencia vs. mediana. Se expande en línea (sin modal).
- **Fleje de promoción**: etiqueta amarilla con la promoción y el precio efectivo por unidad.
- **Traza del agente** (`Lateral.jsx`): pasos con tiempo, fuentes consultadas/omitidas y advertencias.

## Movimiento
Un solo momento: al llegar el informe, los marcadores salen desde Ragnar hacia su posición. Se desactiva con `prefers-reduced-motion`.
