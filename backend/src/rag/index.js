/**
 * RAG — Recuperación de contexto (A IMPLEMENTAR MANUALMENTE).
 *
 * El orquestador llama a `recuperarContexto()` en cada consulta, antes de buscar
 * en el catálogo. Hoy no hace nada y devuelve `habilitado: false`.
 *
 * Cuando se implemente, debe devolver fragmentos relevantes (por ejemplo, políticas
 * comerciales, fichas de productos, informes anteriores) con su fuente, así:
 *
 *   {
 *     habilitado: true,
 *     fragmentos: [{ texto: '...', fuente: 'politicas/precios.md', puntaje: 0.82 }],
 *     sugerencias: { productos: [], marcas: [], categorias: [] } // opcional: ayuda al interpretador
 *   }
 *
 * Reglas: los fragmentos sirven para INTERPRETAR y EXPLICAR, nunca como fuente de
 * precios de la competencia (esos solo salen de las herramientas de búsqueda).
 * Ver rag/README.md.
 */
export async function recuperarContexto(_mensaje, _interpretacion) {
  return { habilitado: false, fragmentos: [], sugerencias: null };
}
