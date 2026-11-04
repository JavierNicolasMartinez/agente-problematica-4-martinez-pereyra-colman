/** Valida body, query o params con un esquema zod. Si falla responde 400 con detalle. */
import { ErrorApi } from '../utils/errores.js';

export function validar(esquema, origen = 'body') {
  return (req, _res, next) => {
    const r = esquema.safeParse(req[origen]);
    if (!r.success) {
      return next(new ErrorApi(400, 'Datos inválidos.', r.error.issues.map((i) => ({ campo: i.path.join('.'), problema: i.message }))));
    }
    req.validado = { ...(req.validado || {}), [origen]: r.data };
    next();
  };
}
