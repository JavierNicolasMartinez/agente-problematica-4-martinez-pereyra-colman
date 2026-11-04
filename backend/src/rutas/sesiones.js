import { Router } from 'express';
import { z } from 'zod';
import { validar } from '../middlewares/validar.js';
import { almacen } from '../sesiones/almacenSesiones.js';
import { ErrorApi } from '../utils/errores.js';
import { aCsv, aMarkdown } from '../agente/exportador.js';

const router = Router();
const idSesion = z.object({ id: z.string().uuid() });
const idInforme = z.object({ id: z.string().uuid(), informeId: z.string().uuid() });

router.post('/', (_req, res) => {
  const s = almacen.crear();
  res.status(201).json(almacen.resumen(s));
});

router.get('/:id', validar(idSesion, 'params'), (req, res) => {
  const s = almacen.obtener(req.validado.params.id);
  if (!s) throw new ErrorApi(404, 'La sesión no existe o venció.');
  res.json(almacen.resumen(s));
});

function buscarInforme(req) {
  const { id, informeId } = req.validado.params;
  const inf = almacen.informe(id, informeId);
  if (!inf) throw new ErrorApi(404, 'Informe no encontrado.');
  return inf;
}

router.get('/:id/informes/:informeId', validar(idInforme, 'params'), (req, res) => {
  res.json(buscarInforme(req));
});

router.get('/:id/informes/:informeId/exportar', validar(idInforme, 'params'), validar(z.object({ formato: z.enum(['csv', 'md']).default('csv') }), 'query'), (req, res) => {
  const inf = buscarInforme(req);
  const { formato } = req.validado.query;
  const nombre = `informe-precios-${inf.fecha.slice(0, 10)}.${formato}`;
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  if (formato === 'csv') res.type('text/csv; charset=utf-8').send(aCsv(inf));
  else res.type('text/markdown; charset=utf-8').send(aMarkdown(inf));
});

export default router;
