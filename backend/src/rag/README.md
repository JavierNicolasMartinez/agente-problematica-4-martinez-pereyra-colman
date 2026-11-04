# Módulo RAG (pendiente)

Este módulo está vacío a propósito: el equipo lo implementa a mano.

## Contrato

`recuperarContexto(mensaje, interpretacion)` → `Promise<{ habilitado, fragmentos, sugerencias }>`

- `fragmentos`: `[{ texto, fuente, puntaje }]`. Se muestran en el informe como "Contexto recuperado".
- `sugerencias` (opcional): `{ productos, marcas, categorias }`. Si viene, el orquestador las suma a la
  interpretación cuando el interpretador no detectó alcance.

## Pasos sugeridos

1. Elegir documentos a indexar (`data/conocimiento/*.md`, fichas del catálogo, informes previos).
2. Dividir en fragmentos (300–500 palabras) y calcular embeddings.
3. Guardar vectores (en memoria, archivo JSON o una base vectorial).
4. En `recuperarContexto`: embedding del mensaje → top-k por similitud coseno → devolver fragmentos.
5. Cambiar `habilitado` a `true`.

No hace falta tocar otros archivos: el orquestador ya llama a esta función y el frontend
ya muestra los fragmentos.
