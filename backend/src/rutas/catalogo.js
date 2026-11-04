import { Router } from 'express';
import { z } from 'zod';
import { catalogo, aPublico } from '../repositorios/catalogoRepositorio.js';
import { validar } from '../middlewares/validar.js';
import { ErrorApi } from '../utils/errores.js';

const router = Router();

const esquemaListado = z.object({
  q: z.string().trim().max(80).optional(),
  categoria: z.string().trim().max(40).optional(),
  marca: z.string().trim().max(40).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(25),
});

router.get('/', validar(esquemaListado, 'query'), (req, res) => {
  res.json(catalogo.listar(req.validado.query));
});

router.get('/facetas', (_req, res) => {
  res.json({ total: catalogo.total(), ...catalogo.facetas() });
});

router.get('/:id', validar(z.object({ id: z.string().regex(/^RAG-\d{5}$/) }), 'params'), (req, res) => {
  const p = catalogo.obtener(req.validado.params.id);
  if (!p) throw new ErrorApi(404, 'Producto no encontrado.');
  res.json(aPublico(p));
});

export default router;
