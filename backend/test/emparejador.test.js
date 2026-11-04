import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emparejar, elegirMejor } from '../src/agente/emparejador.js';

const yerba = { producto: 'Yerba mate', marca: 'Playadito', categoria: 'Alimentos', presentacion: '1000 g', contenido: 1000, unidad: 'g' };
const pub = (titulo, extra = {}) => ({ titulo, marca: 'Playadito', categoria: 'Alimentos', precio_regular: 100, disponible: true, regiones: [], url: 'https://x.example/p', ...extra });

test('misma marca y presentación (1 kg = 1000 g) es equivalente', () => {
  assert.equal(emparejar(yerba, pub('Yerba mate Playadito 1 kg')).estado, 'equivalente');
});

test('otra presentación se marca para comparar por unidad', () => {
  assert.equal(emparejar(yerba, pub('Yerba mate Playadito 500 g')).estado, 'equivalente_otra_presentacion');
});

test('otra marca se descarta', () => {
  assert.equal(emparejar(yerba, pub('Yerba mate Taragüi 1 kg', { marca: 'Taragüi' })).estado, 'descartado');
});

test('variante distinta se descarta', () => {
  assert.equal(emparejar(yerba, pub('Yerba mate Playadito orgánico 1 kg')).estado, 'descartado');
});

test('sin marca informada no es confiable', () => {
  assert.equal(emparejar(yerba, pub('Yerba mate 1 kg', { marca: null })).estado, 'no_confiable');
});

test('sin marca pero con otra marca en el título se descarta', () => {
  assert.equal(emparejar(yerba, pub('Yerba mate Amanda 1 kg', { marca: null })).estado, 'descartado');
});

test('unidad incompatible se descarta', () => {
  assert.equal(emparejar(yerba, pub('Yerba mate Playadito 1 l')).estado, 'descartado');
});

test('elegirMejor prioriza misma presentación y luego el tamaño más cercano', () => {
  const { mejor } = elegirMejor(yerba, [pub('Yerba mate Playadito 250 g'), pub('Yerba mate Playadito 900 g'), pub('Yerba mate Playadito 2 kg')]);
  assert.equal(mejor.publicacion.titulo, 'Yerba mate Playadito 900 g');
});
