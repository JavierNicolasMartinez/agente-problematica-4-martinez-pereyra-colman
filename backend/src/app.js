/**
 * Construcción de la aplicación Express (sin levantar el puerto, para poder testearla).
 */
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { catalogo } from './repositorios/catalogoRepositorio.js';
import { proveedores } from './herramientas/proveedores/index.js';
import rutasCatalogo from './rutas/catalogo.js';
import rutasCompetidores from './rutas/competidores.js';
import rutasAgente from './rutas/agente.js';
import rutasSesiones from './rutas/sesiones.js';
import { manejarErrores, noEncontrado } from './middlewares/errores.js';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: null, // se sirve por http en local; activarlo detrás de HTTPS
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }));

  app.use('/api', cors({
    origin(origen, cb) {
      // Sin cabecera Origin (curl, mismo origen) se permite; si viene, debe estar en la lista.
      if (!origen || config.origenesPermitidos.includes(origen)) return cb(null, true);
      return cb(null, false);
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  }));

  app.use(express.json({ limit: '10kb' }));

  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
  const limiteAgente = rateLimit({
    windowMs: 60_000,
    limit: config.consultasPorMinuto,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiadas consultas. Esperá un minuto.' },
  });

  app.get('/api/salud', (_req, res) => {
    res.json({ estado: 'ok', productosCatalogo: catalogo.total(), fuentes: proveedores.length, fecha: new Date().toISOString() });
  });
  app.use('/api/catalogo', rutasCatalogo);
  app.use('/api/competidores', rutasCompetidores);
  app.use('/api/agente', limiteAgente, rutasAgente);
  app.use('/api/sesiones', rutasSesiones);
  app.use('/api', noEncontrado);

  // En producción, el mismo servidor entrega el frontend compilado.
  if (fs.existsSync(config.rutaFrontend)) {
    app.use(express.static(config.rutaFrontend, { index: 'index.html', maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile('index.html', { root: config.rutaFrontend }));
  }

  app.use(manejarErrores);
  return app;
}
