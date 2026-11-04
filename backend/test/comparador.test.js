import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparar, precioPromocional } from '../src/agente/comparador.js';
import { leerPresentacion, precioPorReferencia } from '../src/utils/unidades.js';

const producto = { precio: 1100, contenido: 1000, unidad: 'g', moneda: 'ARS', precioPorReferencia: 1100, unidadReferencia: 'kg' };
const pub = (extra) => ({ precio_regular: 1000, moneda: 'ARS', disponible: true, promocion: null, ...extra });

test('diferencia absoluta y porcentual (positiva = Ragnar más caro)', () => {
  const r = comparar(producto, { estado: 'equivalente', publicacion: pub(), presentacionLeida: { contenido: 1000 } });
  assert.deepEqual(r.diferenciaRegular, { absoluta: 100, porcentual: 10 });
  assert.equal(r.base, 'envase');
});

test('otra presentación compara por kg', () => {
  const r = comparar(producto, { estado: 'equivalente_otra_presentacion', publicacion: pub({ precio_regular: 500 }), presentacionLeida: { contenido: 500 } });
  assert.equal(r.base, 'unidad_referencia');
  assert.equal(r.precioPorReferencia, 1000);
  assert.equal(r.diferenciaRegular.porcentual, 10);
});

test('promociones 2x1, porcentaje y segunda unidad', () => {
  assert.equal(precioPromocional(pub({ promocion: { tipo: 'nxm', lleva: 2, paga: 1, descripcion: '2x1' } })).precio, 500);
  assert.equal(precioPromocional(pub({ precio_promocional: 800, promocion: { tipo: 'porcentaje', descripcion: '20%' } })).precio, 800);
  assert.equal(precioPromocional(pub({ promocion: { tipo: 'segunda_unidad', porcentaje: 70, descripcion: '' } })).precio, 650);
});

test('el precio regular no se pisa con el promocional', () => {
  const r = comparar(producto, { estado: 'equivalente', publicacion: pub({ promocion: { tipo: 'nxm', lleva: 2, paga: 1, descripcion: '2x1' } }), presentacionLeida: { contenido: 1000 } });
  assert.equal(r.precioRegular, 1000);
  assert.equal(r.promocion.precioEfectivo, 500);
  assert.equal(r.diferenciaPromocional.porcentual, 120);
});

test('lectura de presentaciones', () => {
  assert.deepEqual(leerPresentacion('Gaseosa 1,5 L'), { contenido: 1500, unidad: 'ml' });
  assert.deepEqual(leerPresentacion('Agua pack 6 x 500 ml'), { contenido: 3000, unidad: 'ml', pack: 6 });
  assert.equal(leerPresentacion('Sin datos'), null);
  assert.equal(precioPorReferencia(500, 500, 'g'), 1000);
});
