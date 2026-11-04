import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuentes } from '../src/repositorios/fuentesRepositorio.js';

test('todas las publicaciones tienen URL http(s), precio y fecha', () => {
  for (const f of fuentes) {
    for (const p of f.productos) {
      assert.match(p.url, /^https:\/\//);
      assert.ok(p.precio_regular > 0 && p.publicado);
    }
  }
});

test('la fuente que prohíbe consultas no trae datos', () => {
  const v = fuentes.find((f) => !f.competidor.permite_consulta_automatizada);
  assert.equal(v.productos.length, 0);
});
