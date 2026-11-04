"""Exporta un informe a CSV o Markdown.

Seguridad: en CSV se neutralizan las celdas que empiezan con = + - @ (inyección de fórmulas).
"""
import re

CLASIFICACIONES = {
    "mas_caro": "Más caro",
    "mas_barato": "Más barato",
    "en_linea": "En línea",
    "sin_coincidencias": "Sin coincidencias",
    "no_confiable": "Sin coincidencia confiable",
}
COLUMNAS = [
    "producto_id", "producto", "marca", "presentacion", "precio_ragnar", "competidor", "estado_coincidencia",
    "titulo_competidor", "precio_regular", "precio_promocional", "promocion", "base_comparacion",
    "dif_absoluta", "dif_pct", "clasificacion", "url_fuente", "consultado_en",
]


def _texto(valor) -> str:
    if isinstance(valor, float) and valor.is_integer():
        return str(int(valor))
    return str(valor)


def _celda(valor) -> str:
    if valor is None:
        return ""
    texto = _texto(valor)
    if re.match(r"[=+\-@\t\r]", texto):
        texto = f"'{texto}"
    if re.search(r'[",\n;]', texto):
        comillas = texto.replace('"', '""')
        return f'"{comillas}"'
    return texto


def a_csv(informe: dict) -> str:
    filas = [COLUMNAS]
    for item in informe["items"]:
        producto = item["producto"]
        for c in item["competidores"]:
            comparacion = c["comparacion"] or {}
            promocion = comparacion.get("promocion") or {}
            diferencia = comparacion.get("diferenciaRegular") or {}
            filas.append([
                producto["id"], producto["producto"], producto["marca"], producto["presentacion"], producto["precio"],
                c["competidor"], c["estado"], (c["publicacion"] or {}).get("titulo"),
                comparacion.get("precioRegular"), promocion.get("precioEfectivo"), promocion.get("descripcion"),
                comparacion.get("base"), diferencia.get("absoluta"), diferencia.get("porcentual"),
                CLASIFICACIONES[item["analisis"]["clasificacion"]],
                c["publicacion"]["url"] if comparacion else "", c["consultadoEn"],
            ])
    return "﻿" + "\n".join(",".join(_celda(v) for v in fila) for fila in filas) + "\n"


def _md(texto) -> str:
    """Escapa los caracteres con significado en Markdown."""
    return re.sub(r"([\\`*_{}\[\]()#+!|<>])", r"\\\1", str(texto if texto is not None else ""))


def _pct(numero) -> str:
    return "—" if numero is None else f"{'+' if numero > 0 else ''}{_texto(numero)} %"


def _pesos(numero) -> str:
    if numero is None:
        return "—"
    miles = f"{numero:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"$ {miles}"


def a_markdown(informe: dict) -> str:
    competidores = informe["competidores"]
    consultados = ", ".join(_md(c["nombre"]) for c in competidores["consultados"]) or "—"
    lineas = [
        "# Informe de posicionamiento de precios — Ragnar S.A.", "",
        f"- **Fecha:** {informe['fecha']}",
        f"- **Solicitud:** {_md(informe['solicitud'])}",
        f"- **Competidores consultados:** {consultados}",
    ]
    if competidores["omitidos"]:
        omitidos = "; ".join(f"{_md(o['nombre'])} ({_md(o['motivo'])})" for o in competidores["omitidos"])
        lineas.append(f"- **Omitidos:** {omitidos}")

    lineas += ["", "## Conclusiones", "", *[f"- {_md(c)}" for c in informe["conclusiones"]], ""]
    if informe["advertencias"]:
        lineas += ["## Advertencias", "", *[f"- {_md(a)}" for a in informe["advertencias"]], ""]

    lineas += ["## Productos", "", "| ID | Producto | Precio Ragnar | Dif. mediana | Clasificación |", "|---|---|---:|---:|---|"]
    for item in informe["items"]:
        producto, analisis = item["producto"], item["analisis"]
        nombre = _md(f"{producto['producto']} {producto['marca']} {producto['presentacion']}")
        etiqueta = CLASIFICACIONES[analisis["clasificacion"]] + (" (significativa)" if analisis["significativa"] else "")
        lineas.append(f"| {producto['id']} | {nombre} | {_pesos(producto['precio'])} | {_pct(analisis['diferenciaMedianaPct'])} | {etiqueta} |")

    lineas += ["", "## Fuentes", "", "| Competidor | SKU | URL | Consultado |", "|---|---|---|---|"]
    for fuente in informe["fuentes"]:
        lineas.append(f"| {_md(fuente['competidorId'])} | {_md(fuente['sku'])} | <{fuente['url']}> | {fuente['consultadoEn']} |")
    lineas += ["", "> Fuentes simuladas con fines académicos: competidores, dominios y precios ficticios."]
    return "\n".join(lineas) + "\n"
