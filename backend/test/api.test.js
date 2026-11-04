import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../src/app.js';

let servidor;
let base;
before(async () => {
  servidor = crearApp().listen(0, '127.0.0.1');
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});
after(() => servidor.close());

const post = (ruta, cuerpo) => fetch(`${base}${ruta}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });

test('salud y catálogo', async () => {
  assert.equal((await (await fetch(`${base}/salud`)).json()).productosCatalogo, 500);
  const cat = await (await fetch(`${base}/catalogo?q=yerba&limite=5`)).json();
  assert.ok(cat.total > 0 && cat.productos.length <= 5);
});

test('consulta completa con fuentes y fechas, y seguimiento en la misma sesión', async () => {
  const r1 = await (await post('/agente/consultas', { mensaje: 'Compará la yerba mate Playadito' })).json();
  assert.equal(r1.tipo, 'informe');
  assert.ok(r1.informe.fuentes.every((f) => f.url && f.consultadoEn));
  assert.ok(r1.informe.competidores.omitidos.some((o) => o.id === 'grupo-vertice'));
  const r2 = await (await post('/agente/consultas', { sesionId: r1.sesionId, mensaje: 'ahora solo en Córdoba' })).json();
  assert.equal(r2.interpretacion.esContinuacion, true);
  const csv = await (await fetch(`${base}/sesiones/${r1.sesionId}/informes/${r2.informe.id}/exportar?formato=csv`)).text();
  assert.ok(csv.includes('producto_id'));
});

test('validaciones y errores seguros', async () => {
  assert.equal((await post('/agente/consultas', { mensaje: 'x' })).status, 400);
  assert.equal((await post('/agente/consultas', { mensaje: 'a'.repeat(600) })).status, 400);
  assert.equal((await post('/agente/consultas', { sesionId: 'no-es-uuid', mensaje: 'yerba' })).status, 400);
  assert.equal((await fetch(`${base}/catalogo/..%2F..%2Fetc%2Fpasswd`)).status, 400);
  assert.equal((await post('/agente/consultas', { mensaje: 'yerba', extra: 1 })).status, 400);
  assert.equal((await fetch(`${base}/sesiones/00000000-0000-4000-8000-000000000000/informes/00000000-0000-4000-8000-000000000000`)).status, 404);
  const malJson = await fetch(`${base}/agente/consultas`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{mal' });
  assert.equal(malJson.status, 400);
  assert.ok(!(await malJson.text()).includes('at '));
});
