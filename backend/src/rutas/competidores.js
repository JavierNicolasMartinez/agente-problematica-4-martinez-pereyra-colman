import { Router } from 'express';
import { competidoresPublicos } from '../herramientas/proveedores/index.js';
import { tiposCambio } from '../repositorios/fuentesRepositorio.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ competidores: competidoresPublicos(), tiposCambio });
});

export default router;
