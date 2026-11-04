import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretar } from '../src/agente/interpretador.js';

test('detecta producto, competidor, región y filtro', () => {
  const i = interpretar('Yerba más cara que en Hiper Delta en Rosario');
  assert.deepEqual(i.productos, ['Yerba mate']);
  assert.deepEqual(i.competidores, ['hiper-delta']);
  assert.deepEqual(i.regiones, ['Rosario']);
  assert.equal(i.filtros.clasificacion, 'mas_caro');
});

test('detecta categoría, marca y umbral', () => {
  const i = interpretar('Bebidas Coca-Cola con diferencias mayores al 15%');
  assert.deepEqual(i.categorias, ['Bebidas']);
  assert.ok(i.marcas.includes('Coca-Cola'));
  assert.equal(i.filtros.umbralPct, 15);
});

test('IDs del catálogo', () => {
  assert.deepEqual(interpretar('compará RAG-00001 y rag-00002').ids, ['RAG-00001', 'RAG-00002']);
});

test('sin alcance pide aclaración', () => {
  assert.equal(interpretar('hola, cómo andás').intencion, 'aclarar');
});

test('continuación conserva el contexto anterior', () => {
  const a = interpretar('Compará la yerba mate');
  const b = interpretar('ahora solo en Córdoba', a);
  assert.equal(b.esContinuacion, true);
  assert.deepEqual(b.productos, ['Yerba mate']);
  assert.deepEqual(b.regiones, ['Córdoba']);
});

test('agregar suma productos al contexto', () => {
  const a = interpretar('Compará la yerba mate');
  const b = interpretar('agregá el café', a);
  assert.deepEqual(b.productos.sort(), ['Cafe molido', 'Yerba mate']);
});

test('sacar un competidor lo excluye sin sumar otros', async () => {
  const { planificarCompetidores } = await import('../src/herramientas/buscarPrecios.js');
  const a = interpretar('Compará la yerba mate');
  const b = interpretar('sacá Hiper Delta', a);
  const ids = planificarCompetidores(b).consultar.map((p) => p.id);
  assert.ok(!ids.includes('hiper-delta'));
  assert.ok(!ids.includes('tienda-oriental'));
  assert.ok(ids.includes('mercado-austral'));
});
