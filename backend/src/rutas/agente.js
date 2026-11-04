import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { validar } from '../middlewares/validar.js';
import { almacen } from '../sesiones/almacenSesiones.js';
import { ejecutarConsulta } from '../agente/orquestador.js';
import { SUGERENCIAS } from '../agente/interpretador.js';
import { ErrorApi } from '../utils/errores.js';

const router = Router();

const esquemaConsulta = z.object({
  sesionId: z.string().uuid().optional(),
  mensaje: z.string().trim().min(3, 'Escribí al menos 3 caracteres.').max(config.maxLargoMensaje),
  // true = no usar el contexto de consultas anteriores (empezar un análisis nuevo en la misma sesión).
  nuevoAnalisis: z.boolean().optional(),
}).strict();

router.get('/sugerencias', (_req, res) => res.json({ sugerencias: SUGERENCIAS }));

router.post('/consultas', validar(esquemaConsulta), async (req, res, next) => {
  try {
    const { sesionId, mensaje, nuevoAnalisis } = req.validado.body;
    let sesion = sesionId ? almacen.obtener(sesionId) : null;
    if (sesionId && !sesion) throw new ErrorApi(404, 'La sesión no existe o venció. Empezá una nueva.');
    if (!sesion) sesion = almacen.crear();
    const resultado = await ejecutarConsulta(mensaje, sesion, { nuevoAnalisis });
    almacen.registrar(sesion, { mensaje, interpretacion: resultado.interpretacion, informe: resultado.informe });
    res.json({ sesionId: sesion.id, ...resultado });
  } catch (e) {
    next(e);
  }
});

export default router;
