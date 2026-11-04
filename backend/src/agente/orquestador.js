/**
 * Orquestador del agente: coordina las herramientas en orden y deja una traza
 * de cada paso (qué hizo, cuánto tardó, qué encontró).
 *
 *  1. Interpretar la solicitud (F01)            → interpretador.js
 *  2. Recuperar contexto (RAG, pendiente)       → rag/index.js
 *  3. Consultar el catálogo de Ragnar (F02)     → herramientas/consultarCatalogo.js
 *  4. Elegir competidores y buscar precios (F03) → herramientas/buscarPrecios.js
 *  5. Emparejar productos (F04)                 → emparejador.js
 *  6. Comparar precios y promociones (F05, F06) → comparador.js
 *  7. Analizar resultados (F07)                 → analizador.js
 *  8. Generar el informe (F08, F09)             → generadorInforme.js
 */
import { interpretar, SUGERENCIAS } from './interpretador.js';
import { elegirMejor } from './emparejador.js';
import { comparar } from './comparador.js';
import { clasificar } from './analizador.js';
import { generarInforme } from './generadorInforme.js';
import { consultarCatalogo } from '../herramientas/consultarCatalogo.js';
import { planificarCompetidores, buscarPrecios } from '../herramientas/buscarPrecios.js';
import { recuperarContexto } from '../rag/index.js';
import { catalogo, aPublico } from '../repositorios/catalogoRepositorio.js';
import { config } from '../config.js';

function crearTraza() {
  const pasos = [];
  return {
    pasos,
    async paso(id, titulo, fn) {
      const inicio = performance.now();
      const salida = await fn();
      pasos.push({ id, titulo, detalle: salida.detalle, duracionMs: Math.round(performance.now() - inicio) });
      return salida.valor;
    },
  };
}

function aplicarFiltros(items, filtros) {
  let r = items;
  if (filtros.clasificacion) r = r.filter((i) => i.analisis.clasificacion === filtros.clasificacion);
  if (filtros.soloSignificativas) r = r.filter((i) => i.analisis.significativa);
  if (filtros.soloPromociones) r = r.filter((i) => i.analisis.tienePromociones);
  return r;
}

export async function ejecutarConsulta(mensaje, sesion, { nuevoAnalisis = false } = {}) {
  const traza = crearTraza();

  const interpretacion = await traza.paso('interpretar', 'Interpretar la solicitud', () => {
    const i = interpretar(mensaje, nuevoAnalisis ? null : sesion?.ultimaInterpretacion ?? null);
    const partes = [
      i.productos.length && `productos: ${i.productos.join(', ')}`,
      i.marcas.length && `marcas: ${i.marcas.join(', ')}`,
      i.categorias.length && `categorías: ${i.categorias.join(', ')}`,
      i.ids.length && `IDs: ${i.ids.join(', ')}`,
      i.regiones.length && `regiones: ${i.regiones.join(', ')}`,
      i.todoElCatalogo && 'todo el catálogo',
    ].filter(Boolean);
    return { valor: i, detalle: partes.length ? `Detectado ${partes.join(' · ')}` : 'No se detectó qué productos analizar.' };
  });

  const rag = await traza.paso('rag', 'Recuperar contexto (RAG)', async () => {
    const r = await recuperarContexto(mensaje, interpretacion);
    // Si el RAG sugiere alcance y el interpretador no encontró nada, se usa la sugerencia.
    if (r.habilitado && r.sugerencias && interpretacion.intencion === 'aclarar') {
      for (const k of ['productos', 'marcas', 'categorias']) interpretacion[k] = r.sugerencias[k] || [];
      if (interpretacion.productos.length || interpretacion.marcas.length || interpretacion.categorias.length) interpretacion.intencion = 'investigar';
    }
    return { valor: r, detalle: r.habilitado ? `${r.fragmentos.length} fragmentos recuperados.` : 'Módulo RAG no configurado todavía.' };
  });

  if (interpretacion.intencion === 'aclarar') {
    return {
      tipo: 'aclaracion',
      interpretacion,
      mensaje: 'No identifiqué qué productos investigar. Indicá un producto, marca, categoría o ID del catálogo.',
      sugerencias: SUGERENCIAS,
      pasos: traza.pasos,
    };
  }

  const umbral = interpretacion.filtros.umbralPct ?? config.umbralSignificativoPct;

  const seleccion = await traza.paso('catalogo', 'Consultar el catálogo de Ragnar', () => {
    const s = consultarCatalogo(interpretacion);
    return { valor: s, detalle: `${s.totalEncontrado} productos encontrados${s.recortado ? `, se analizan ${s.productos.length}` : ''}.` };
  });

  const pais = seleccion.productos[0]?.pais ?? 'Argentina';
  const plan = await traza.paso('competidores', 'Elegir competidores', () => {
    const p = planificarCompetidores(interpretacion, pais);
    const det = `Consultar: ${p.consultar.map((c) => c.nombre).join(', ') || 'ninguno'}.${p.omitidos.length ? ` Omitidos: ${p.omitidos.map((o) => o.nombre).join(', ')}.` : ''}`;
    return { valor: p, detalle: det };
  });

  let busquedas = 0;
  const crudo = await traza.paso('buscar', 'Buscar precios en la competencia', async () => {
    const resultados = [];
    for (const producto of seleccion.productos) {
      const porComp = await Promise.all(plan.consultar.map((prov) => buscarPrecios(producto, prov)));
      busquedas += porComp.length;
      resultados.push({ producto, porComp });
    }
    return { valor: resultados, detalle: `${busquedas} búsquedas realizadas.` };
  });

  const regiones = interpretacion.regiones;
  let equivalentes = 0;
  let descartados = 0;
  const items = await traza.paso('emparejar', 'Verificar coincidencias y comparar', () => {
    const lista = crudo.map(({ producto, porComp }) => {
      const competidores = porComp.map((b) => {
        const prov = plan.consultar.find((p) => p.id === b.competidorId);
        const candidatos = b.candidatos.filter((c) => !regiones.length || c.regiones.some((r) => regiones.includes(r)));
        const { mejor, evaluados } = elegirMejor(producto, candidatos);
        descartados += evaluados.filter((e) => e.estado === 'descartado').length;
        const usable = mejor && (mejor.estado === 'equivalente' || mejor.estado === 'equivalente_otra_presentacion');
        if (usable) equivalentes += 1;
        return {
          competidorId: b.competidorId,
          competidor: prov.nombre,
          consulta: b.consulta,
          consultadoEn: b.consultadoEn,
          candidatosEvaluados: evaluados.filter((e) => e.estado !== 'descartado').length,
          estado: mejor ? mejor.estado : 'sin_resultados',
          confianza: mejor?.confianza ?? null,
          criterios: mejor?.criterios ?? [],
          publicacion: mejor ? mejor.publicacion : null,
          comparacion: usable ? comparar(producto, mejor, prov.competidor) : null,
          descartes: evaluados.filter((e) => e !== mejor).slice(0, 4).map((e) => ({ titulo: e.publicacion.titulo, estado: e.estado, motivo: e.criterios.find((c) => c.resultado !== 'ok')?.detalle ?? null, url: e.publicacion.url })),
        };
      });
      return { producto: aPublico(producto), repetidoEnCatalogo: catalogo.esRepetido(producto), competidores, analisis: clasificar(competidores, umbral) };
    });
    return { valor: lista, detalle: `${equivalentes} coincidencias verificadas, ${descartados} publicaciones descartadas.` };
  });

  const filtrados = await traza.paso('analizar', 'Analizar resultados', () => {
    const f = aplicarFiltros(items, interpretacion.filtros);
    return { valor: f, detalle: f.length === items.length ? `${items.length} productos clasificados.` : `${f.length} de ${items.length} productos cumplen el filtro pedido.` };
  });

  const advertencias = [];
  const repetidos = filtrados.filter((i) => i.repetidoEnCatalogo).length;
  if (repetidos) advertencias.push(`${repetidos} productos aparecen repetidos en el catálogo (mismo artículo con distinto ID y precio). Conviene revisarlos.`);
  if (filtrados.some((i) => i.competidores.some((c) => c.comparacion?.tipoCambio))) advertencias.push('Hay precios en otra moneda convertidos con un tipo de cambio de demostración.');

  const informe = await traza.paso('informe', 'Generar informe', () => {
    const inf = generarInforme({
      interpretacion,
      items: filtrados,
      competidores: { consultados: plan.consultar.map((p) => ({ id: p.id, nombre: p.nombre, tipoFuente: p.tipo, sitio: p.competidor.sitio })), omitidos: plan.omitidos },
      rag,
      pasos: [],
      advertencias,
      umbral,
      recortado: seleccion.recortado,
      totalEncontrado: seleccion.totalEncontrado,
    });
    return { valor: inf, detalle: `${inf.conclusiones.length} conclusiones, ${inf.fuentes.length} precios con fuente.` };
  });
  informe.pasos = traza.pasos;
  return { tipo: 'informe', interpretacion, informe };
}
