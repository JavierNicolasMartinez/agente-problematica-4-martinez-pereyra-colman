/** Manejo central de errores: nunca expone trazas internas al cliente. */
import { ErrorApi } from '../utils/errores.js';
import { config } from '../config.js';

export function noEncontrado(_req, _res, next) {
  next(new ErrorApi(404, 'Recurso no encontrado.'));
}

// eslint-disable-next-line no-unused-vars
export function manejarErrores(err, _req, res, _next) {
  if (err instanceof ErrorApi) {
    return res.status(err.estado).json({ error: err.message, detalles: err.detalles });
  }
  // Errores de express.json (cuerpo demasiado grande o JSON mal formado).
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'La solicitud es demasiado grande.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON mal formado.' });
  if (config.entorno !== 'test') console.error('[error]', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
}
