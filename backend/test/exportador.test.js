import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aCsv } from '../src/agente/exportador.js';

test('CSV neutraliza fórmulas', () => {
  const inf = { items: [{ producto: { id: 'RAG-00001', producto: '=HYPERLINK("x")', marca: '+cmd', presentacion: '1 un', precio: 1 }, analisis: { clasificacion: 'en_linea' }, competidores: [{ competidor: '@x', estado: 'sin_resultados', publicacion: null, comparacion: null, consultadoEn: '' }] }] };
  const csv = aCsv(inf);
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(csv.includes("'+cmd"));
  assert.ok(csv.includes("'@x"));
});
